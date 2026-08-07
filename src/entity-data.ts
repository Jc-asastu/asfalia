// Carga el JSON privado de la entidad y lo convierte al estado privado del circuito.
// Este archivo es la unica puerta de entrada de los balances: de aca van al witness,
// nunca a un log ni a la red.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { EnkuPrivateState } from "./witnesses";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.resolve(__dirname, "..", "data", "demo-entity.json");

export type EntityBook = {
  entity: string;
  assets: { label: string; cents: string }[];
  liabilities: { label: string; cents: string }[];
  nonceHex: string;
};

export function loadEntityBook(file: string = process.env.ENKU_DATA ?? DEFAULT_FILE): EntityBook {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function toPrivateState(book: EntityBook): EnkuPrivateState {
  const toVec = (xs: { cents: string }[]): bigint[] => {
    if (xs.length !== 8) throw new Error(`el circuito espera 8 items, hay ${xs.length}`);
    return xs.map((x) => BigInt(x.cents));
  };
  return {
    assets: toVec(book.assets),
    liabilities: toVec(book.liabilities),
    nonce: Uint8Array.from(Buffer.from(book.nonceHex, "hex")),
  };
}
