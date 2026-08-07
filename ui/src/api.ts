// Cliente fino de la API. Un solo lugar donde se habla con el servidor.

export type LedgerState = {
  verdict: boolean;
  attestedAt: string; // epoch segundos (bigint serializado)
  validUntil: string; // epoch segundos — la cadena rechaza settlement despues de esto
  assetsCommitment: string;
  liabilitiesRoot: string; // raiz Merkle de las cuentas de clientes
} | null;

export type AttestJob = {
  kind: 'attest' | 'settle' | null;
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
  heartbeat: { sec: number; nextAt: number | null } | null;
  now: number; // epoch segundos del server — evita el reloj del cliente
};

export type LogEntry = {
  ts: number;
  trigger: 'heartbeat' | 'manual';
  ok: boolean;
  verdict: boolean | null;
  txId: string | null;
  attestedAt: string | null;
  validUntil: string | null;
  assetsCommitment: string | null;
  liabilitiesRoot: string | null;
  durationSec: number | null;
  error: string | null;
};

export type HistoryResponse = { heartbeatSec: number | null; entries: LogEntry[] };

export type BookItem = { label: string; cents: string };
export type BookUser = { account: string; name: string; cents: string };
export type Book = {
  entity: string;
  assets: BookItem[];
  users: BookUser[];
};

export type InclusionResponse = {
  account: string;
  name: string;
  cents: string;
  leafHex: string;
  path: { siblingHex: string; siblingSide: 'left' | 'right' }[];
  rootHex: string;
};

export const getState = (): Promise<ServerState> =>
  fetch('/api/state').then((r) => r.json());

export const getBook = (): Promise<Book> => fetch('/api/book').then((r) => r.json());

export const putBook = (side: 'assets' | 'clients', index: number, cents: string) =>
  fetch('/api/book', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ side, index, cents }),
  }).then((r) => r.json());

export const postAttest = () => fetch('/api/attest', { method: 'POST' }).then((r) => r.json());

export const postSettle = () => fetch('/api/settle', { method: 'POST' }).then((r) => r.json());

export const getHistory = (): Promise<HistoryResponse> =>
  fetch('/api/history').then((r) => r.json());

export type ChainAction = {
  data?: {
    contractAction?: {
      __typename: string;
      transaction: { hash: string; block: { height: number; timestamp: number; hash: string } };
    } | null;
  };
};

export const getChain = (): Promise<ChainAction> =>
  fetch('/api/chain').then((r) => r.json());

export type ScanRow = {
  identifier: string;
  verdict: boolean | null;
  trigger: 'heartbeat' | 'manual';
  hash: string;
  block: { height: number; hash: string; timestamp: number };
};
export type ScanResponse = {
  head: { height: number; hash: string; timestamp: number } | null;
  contractAddress: string;
  rows: ScanRow[];
};

export const getScan = (): Promise<ScanResponse> =>
  fetch('/api/scan').then((r) => r.json());

export const importCsv = (kind: 'assets' | 'clients', csv: string) =>
  fetch('/api/book/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, csv }),
  }).then((r) => r.json());

export const getInclusion = (account: string): Promise<InclusionResponse> =>
  fetch(`/api/inclusion?account=${encodeURIComponent(account)}`).then((r) => r.json());

export const postVerifyInclusion = (leafHex: string, path: InclusionResponse['path']) =>
  fetch('/api/verify-inclusion', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ leafHex, path }),
  }).then((r) => r.json());

/** Centavos -> "1.824.500.000,00" (es-AR). */
export const fmtCents = (cents: string) => {
  const n = BigInt(cents);
  const whole = n / 100n;
  const frac = (n % 100n).toString().padStart(2, '0');
  return `${whole.toLocaleString('es-AR')},${frac}`;
};
