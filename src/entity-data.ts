// Carga los libros privados de la entidad (activos + cuentas de clientes)
// y los convierte al estado privado del circuito. Este archivo es la unica
// puerta de entrada de los saldos: de aca van al witness, nunca a un log
// ni a la red.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ClientAccount, AsfaliaPrivateState } from "./witnesses";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BOOK = path.resolve(__dirname, "..", "data", "demo-entity.json");
const DEFAULT_USERS = path.resolve(__dirname, "..", "data", "demo-users.json");

export type EntityBook = {
  entity: string;
  assets: { label: string; cents: string }[];
  nonceHex: string;
};

export type DemoUser = {
  account: string;
  name: string;
  cents: string;
  idHex: string;
  saltHex: string;
};

export const bookFile = () => process.env.ASFALIA_DATA ?? DEFAULT_BOOK;
export const usersFile = () => process.env.ASFALIA_USERS ?? DEFAULT_USERS;

export function loadEntityBook(): EntityBook {
  return JSON.parse(fs.readFileSync(bookFile(), "utf8"));
}

export function loadUsers(): DemoUser[] {
  return JSON.parse(fs.readFileSync(usersFile(), "utf8")).users;
}

const hex = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));

export function toClientAccount(u: DemoUser): ClientAccount {
  return { id: hex(u.idHex), balance: BigInt(u.cents), salt: hex(u.saltHex) };
}

export function toPrivateState(book: EntityBook, users: DemoUser[]): AsfaliaPrivateState {
  if (book.assets.length !== 8) throw new Error(`el circuito espera 8 activos, hay ${book.assets.length}`);
  if (users.length !== 16) throw new Error(`el circuito espera 16 cuentas, hay ${users.length}`);
  return {
    assets: book.assets.map((x) => BigInt(x.cents)),
    assetsNonce: hex(book.nonceHex),
    clients: users.map(toClientAccount),
  };
}
