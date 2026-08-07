// Arbol Merkle de pasivos, lado servidor. Usa los MISMOS circuitos puros del
// contrato compilado (pureCircuits.leafHash / pairHash): el hash de una hoja
// aca y en el circuito es identico por construccion, no por convencion.

import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { ClientAccount } from "./witnesses";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.resolve(__dirname, "..", "contracts", "managed", "enku", "contract", "index.js");

type Pure = {
  leafHash(c: ClientAccount): Uint8Array;
  pairHash(a: Uint8Array, b: Uint8Array): Uint8Array;
};

let pure: Pure | null = null;
async function pureCircuits(): Promise<Pure> {
  if (!pure) {
    const mod = await import(pathToFileURL(contractPath).href);
    pure = mod.pureCircuits as Pure;
  }
  return pure;
}

export type InclusionProof = {
  account: string;
  leafHex: string;
  // El camino desde la hoja a la raiz: en cada paso, el hermano y de que lado va.
  path: { siblingHex: string; siblingSide: "left" | "right" }[];
  rootHex: string;
};

const hexOf = (b: Uint8Array) => Buffer.from(b).toString("hex");

/** Construye el arbol completo (niveles de hojas a raiz). */
export async function buildTree(clients: ClientAccount[]): Promise<Uint8Array[][]> {
  const p = await pureCircuits();
  if (clients.length !== 16) throw new Error(`el arbol es de 16 hojas, hay ${clients.length}`);
  const levels: Uint8Array[][] = [clients.map((c) => p.leafHash(c))];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next: Uint8Array[] = [];
    for (let i = 0; i < prev.length; i += 2) next.push(p.pairHash(prev[i], prev[i + 1]));
    levels.push(next);
  }
  return levels;
}

export async function merkleRoot(clients: ClientAccount[]): Promise<string> {
  const levels = await buildTree(clients);
  return hexOf(levels[levels.length - 1][0]);
}

/** Prueba de inclusion para la cuenta en la posicion `index`. */
export async function inclusionProof(
  clients: ClientAccount[],
  index: number,
  account: string,
): Promise<InclusionProof> {
  const levels = await buildTree(clients);
  const proofPath: InclusionProof["path"] = [];
  let i = index;
  for (let lvl = 0; lvl < levels.length - 1; lvl++) {
    const sibling = i % 2 === 0 ? levels[lvl][i + 1] : levels[lvl][i - 1];
    proofPath.push({
      siblingHex: hexOf(sibling),
      siblingSide: i % 2 === 0 ? "right" : "left",
    });
    i = Math.floor(i / 2);
  }
  return {
    account,
    leafHex: hexOf(levels[0][index]),
    path: proofPath,
    rootHex: hexOf(levels[levels.length - 1][0]),
  };
}

/** Verifica un camino contra una raiz. Es lo que corre "del lado del cliente". */
export async function verifyInclusion(
  leafHex: string,
  proofPath: InclusionProof["path"],
  expectedRootHex: string,
): Promise<boolean> {
  const p = await pureCircuits();
  let node = Uint8Array.from(Buffer.from(leafHex, "hex"));
  for (const step of proofPath) {
    const sibling = Uint8Array.from(Buffer.from(step.siblingHex, "hex"));
    node = step.siblingSide === "right" ? p.pairHash(node, sibling) : p.pairHash(sibling, node);
  }
  return hexOf(node) === expectedRootHex;
}
