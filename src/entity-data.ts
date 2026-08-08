// Carga los libros privados de la entidad (activos + cuentas de clientes)
// y los convierte al estado privado del circuito. Este archivo es la unica
// puerta de entrada de los saldos: de aca van al witness, nunca a un log
// ni a la red.

import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
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

const U64_MAX = (1n << 64n) - 1n;
const HEX_32_RE = /^[0-9a-f]{64}$/i;

function object(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${where}: se esperaba un objeto`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  keys: string[],
  where: string,
  optional: string[] = [],
): void {
  const actual = Object.keys(value);
  const allowed = new Set([...keys, ...optional]);
  if (keys.some((key) => !(key in value)) || actual.some((key) => !allowed.has(key))) {
    throw new Error(`${where}: campos esperados ${keys.join(", ")}${optional.length ? ` (opcionales: ${optional.join(", ")})` : ""}`);
  }
}

function text(value: unknown, where: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200 || value !== value.trim()) {
    throw new Error(`${where}: texto obligatorio, sin espacios externos, de hasta 200 caracteres`);
  }
  return value;
}

export function validateCents(value: unknown, where = "cents"): string {
  if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) > U64_MAX) {
    throw new Error(`${where}: entero decimal no negativo dentro de Uint<64>`);
  }
  return value;
}

function hex32(value: unknown, where: string): string {
  if (typeof value !== "string" || !HEX_32_RE.test(value)) {
    throw new Error(`${where}: se esperaban exactamente 32 bytes hexadecimales`);
  }
  return value.toLowerCase();
}

export function validateEntityBook(value: unknown): EntityBook {
  const raw = object(value, "libro de activos");
  exactKeys(raw, ["entity", "assets", "nonceHex"], "libro de activos", ["_comment"]);
  if (raw._comment !== undefined && typeof raw._comment !== "string") {
    throw new Error("libro de activos._comment: se esperaba texto");
  }
  if (!Array.isArray(raw.assets) || raw.assets.length !== 8) {
    throw new Error(`el circuito espera 8 activos, hay ${Array.isArray(raw.assets) ? raw.assets.length : 0}`);
  }
  const labels = new Set<string>();
  const assets = raw.assets.map((item, i) => {
    const row = object(item, `activo ${i + 1}`);
    exactKeys(row, ["label", "cents"], `activo ${i + 1}`);
    const label = text(row.label, `activo ${i + 1}.label`);
    if (labels.has(label)) throw new Error(`label de activo duplicado: ${label}`);
    labels.add(label);
    return { label, cents: validateCents(row.cents, `activo ${i + 1}.cents`) };
  });
  return {
    entity: text(raw.entity, "entity"),
    assets,
    nonceHex: hex32(raw.nonceHex, "nonceHex"),
  };
}

export function validateUsers(value: unknown): DemoUser[] {
  const container = object(value, "libro de usuarios");
  exactKeys(container, ["users"], "libro de usuarios", ["_comment"]);
  if (container._comment !== undefined && typeof container._comment !== "string") {
    throw new Error("libro de usuarios._comment: se esperaba texto");
  }
  if (!Array.isArray(container.users) || container.users.length !== 16) {
    throw new Error(`el circuito espera 16 cuentas, hay ${Array.isArray(container.users) ? container.users.length : 0}`);
  }
  const accounts = new Set<string>();
  const ids = new Set<string>();
  const salts = new Set<string>();
  return container.users.map((item, i) => {
    const row = object(item, `cuenta ${i + 1}`);
    exactKeys(row, ["account", "name", "cents", "idHex", "saltHex"], `cuenta ${i + 1}`);
    const account = text(row.account, `cuenta ${i + 1}.account`);
    const name = text(row.name, `cuenta ${i + 1}.name`);
    const idHex = hex32(row.idHex, `cuenta ${i + 1}.idHex`);
    const saltHex = hex32(row.saltHex, `cuenta ${i + 1}.saltHex`);
    if (accounts.has(account)) throw new Error(`cuenta duplicada: ${account}`);
    if (ids.has(idHex)) throw new Error(`idHex duplicado: ${idHex}`);
    if (salts.has(saltHex)) throw new Error(`saltHex duplicado: ${saltHex}`);
    if (idHex !== accountIdHex(account)) {
      throw new Error(`idHex de ${account} no esta ligado deterministicamente a la cuenta`);
    }
    accounts.add(account);
    ids.add(idHex);
    salts.add(saltHex);
    return { account, name, cents: validateCents(row.cents, `cuenta ${i + 1}.cents`), idHex, saltHex };
  });
}

function atomicJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}

export function loadEntityBook(): EntityBook {
  return validateEntityBook(JSON.parse(fs.readFileSync(bookFile(), "utf8")));
}

export function loadUsers(): DemoUser[] {
  return validateUsers(JSON.parse(fs.readFileSync(usersFile(), "utf8")));
}

export function saveEntityBook(book: EntityBook): void {
  atomicJson(bookFile(), validateEntityBook(book));
}

export function saveUsers(users: DemoUser[]): void {
  atomicJson(usersFile(), { users: validateUsers({ users }) });
}

/** Public, deterministic binding between the human account and the private leaf id. */
export function accountIdHex(account: string): string {
  return createHash("sha256").update(`asfalia:account:${account}`, "utf8").digest("hex");
}

const hex = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));

export function toClientAccount(u: DemoUser): ClientAccount {
  if (u.idHex.toLowerCase() !== accountIdHex(u.account)) {
    throw new Error(`idHex de ${u.account} no esta ligado deterministicamente a la cuenta`);
  }
  return { id: hex(u.idHex), balance: BigInt(u.cents), salt: hex(u.saltHex) };
}

export function toPrivateState(book: EntityBook, users: DemoUser[]): AsfaliaPrivateState {
  const validBook = validateEntityBook(book);
  const validUsers = validateUsers({ users });
  return {
    assets: validBook.assets.map((x) => BigInt(x.cents)),
    assetsNonce: hex(validBook.nonceHex),
    clients: validUsers.map(toClientAccount),
  };
}
