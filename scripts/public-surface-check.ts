// Garantiza que el sitio publico no pueda filtrar lo que no tiene.
//
// La leccion del test de vencimiento: un comentario que dice "esto solo lo ve
// la entidad" no es un control. Asi que la separacion se verifica: se recorre
// el grafo de imports desde `api/public-server.ts` y se exige que NUNCA
// alcance la wallet, los libros ni la maquinaria de emitir pruebas.
//
// No necesita el contrato compilado: es analisis estatico. Corre en cualquier
// maquina y en el job rapido del CI.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = path.join(ROOT, "api", "public-server.ts");

/** Modulos del proyecto que jamas pueden quedar del lado publico. */
const FORBIDDEN_LOCAL = [
  "src/entity-data",     // los libros
  "src/wallet",          // la seed
  "src/contract",        // conexion que firma y prueba
  "src/contract-policy", // la clave de autoridad
  "src/witnesses",       // el estado privado
  "src/merkle",          // pruebas de inclusion (dato por cliente)
  "src/payment",
  "src/setup",
  "src/deploy",
  "src/attest",
];

/** Dependencias que solo tienen sentido si vas a firmar o probar. */
const FORBIDDEN_PACKAGES = [
  "@midnight-ntwrk/wallet-sdk",
  "@midnight-ntwrk/midnight-js-node-zk-config-provider",
  "@midnight-ntwrk/midnight-js-http-client-proof-provider",
  "@midnight-ntwrk/midnight-js-level-private-state-provider",
  "@midnight-ntwrk/midnight-js-contracts",
  "@scure/bip39",
];

/** Rutas privadas: no pueden aparecer en el codigo alcanzable desde el sitio. */
const FORBIDDEN_ROUTES = [
  "/api/book",
  "/api/inclusion",
  "/api/verify-inclusion",
  "/api/attest",
  "/api/settle",
];

const IMPORT_RE = /\bfrom\s+['"]([^'"]+)['"]/g;
const DYNAMIC_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveLocal(fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null; // paquete: es una hoja
  const base = path.resolve(path.dirname(fromFile), spec.replace(/\.js$/, ""));
  for (const cand of [`${base}.ts`, path.join(base, "index.ts")]) {
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, "/");

// ── Recorrido del grafo ────────────────────────────────────────────────────────

const visited = new Set<string>();
const packages = new Map<string, string>(); // paquete -> primer archivo que lo trae

function walk(file: string) {
  if (visited.has(file)) return;
  visited.add(file);
  const src = fs.readFileSync(file, "utf8");
  for (const re of [IMPORT_RE, DYNAMIC_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const spec = m[1];
      const local = resolveLocal(file, spec);
      if (local) walk(local);
      else if (!spec.startsWith("node:") && !packages.has(spec)) packages.set(spec, rel(file));
    }
  }
}

if (!fs.existsSync(ENTRY)) {
  console.error(`  no existe el entrypoint publico: ${rel(ENTRY)}`);
  process.exit(1);
}
walk(ENTRY);

// ── Veredicto ──────────────────────────────────────────────────────────────────

let failures = 0;
const fail = (msg: string) => { failures++; console.log(`  FALLA ${msg}`); };

console.log(`\n  Superficie publica — desde ${rel(ENTRY)}\n`);
for (const f of [...visited].map(rel).sort()) console.log(`    alcanza  ${f}`);
console.log("");

for (const forbidden of FORBIDDEN_LOCAL) {
  const hit = [...visited].map(rel).find((f) => f === `${forbidden}.ts` || f.startsWith(`${forbidden}/`));
  if (hit) fail(`el sitio publico alcanza ${hit} — ahi viven datos que no puede tener`);
}

for (const [pkg, from] of packages) {
  if (FORBIDDEN_PACKAGES.some((p) => pkg === p || pkg.startsWith(`${p}/`))) {
    fail(`${from} importa ${pkg} — eso es maquinaria de firmar/probar, no de mirar`);
  }
}

for (const file of visited) {
  const src = fs.readFileSync(file, "utf8");
  for (const route of FORBIDDEN_ROUTES) {
    // Solo cuenta como ruta servida si aparece comparada contra el pathname.
    if (new RegExp(`pathname\\s*===\\s*['"]${route}['"]`).test(src)) {
      fail(`${rel(file)} sirve ${route} y es alcanzable desde el sitio publico`);
    }
  }
}

if (failures === 0) {
  console.log("  Superficie limpia: el sitio publico no puede ver un saldo aunque quiera.\n");
} else {
  console.log(`\n  ${failures} violacion(es) de la separacion publico/privado.\n`);
}
process.exit(failures === 0 ? 0 : 1);
