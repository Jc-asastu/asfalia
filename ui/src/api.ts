// Cliente fino de la API. Un solo lugar donde se habla con el servidor.

export type LedgerState = {
  verdict: boolean;
  attestedAt: string; // epoch segundos (bigint serializado)
  balancesCommitment: string;
} | null;

export type AttestJob = {
  running: boolean;
  phase: string;
  startedAt: number | null;
  finishedAt: number | null;
  durationSec: number | null;
  txId: string | null;
  error: string | null;
};

export type ServerState = {
  network: string;
  contractAddress: string;
  entity: string;
  ledger: LedgerState;
  attest: AttestJob;
  now: number; // epoch segundos del server — evita el reloj del cliente
};

export type BookItem = { label: string; cents: string };
export type Book = {
  entity: string;
  assets: BookItem[];
  liabilities: BookItem[];
};

export const getState = (): Promise<ServerState> =>
  fetch('/api/state').then((r) => r.json());

export const getBook = (): Promise<Book> => fetch('/api/book').then((r) => r.json());

export const putBook = (side: 'assets' | 'liabilities', index: number, cents: string) =>
  fetch('/api/book', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ side, index, cents }),
  }).then((r) => r.json());

export const postAttest = () => fetch('/api/attest', { method: 'POST' }).then((r) => r.json());

/** Centavos -> "1.824.500.000,00" (es-AR). */
export const fmtCents = (cents: string) => {
  const n = BigInt(cents);
  const whole = n / 100n;
  const frac = (n % 100n).toString().padStart(2, '0');
  return `${whole.toLocaleString('es-AR')},${frac}`;
};
