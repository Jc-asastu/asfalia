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

export type Score = {
  score: number;
  level: 'excellent' | 'good' | 'watch' | 'poor';
  greens: number;
  reds: number;
  gaps: number;
  failed: number;
};

export type ServerState = {
  network: string;
  contractAddress: string;
  entity: string;
  ledger: LedgerState;
  attest: AttestJob;
  score: Score | null;
  heartbeat: { sec: number; nextAt: number | null } | null;
  capabilities: {
    entityConsole: boolean;
    settlement: boolean;
    clientProof: boolean;
    clientTokenRequired: boolean;
    history: boolean;
    scanner: boolean;
  };
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

export type HistoryResponse = { heartbeatSec: number | null; entries: LogEntry[]; score: Score };

export type BookItem = { label: string; cents: string };
export type BookUser = { account: string; name: string; cents: string };
export type Book = {
  entity: string;
  assets: BookItem[];
  users: BookUser[];
};

export type InclusionResponse = {
  account: string;
  saltHex: string;
  path: { siblingHex: string; siblingSide: 'left' | 'right' }[];
};

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`);
  }
  return body as T;
}

export const getState = (): Promise<ServerState> =>
  fetch('/api/state').then((response) => responseJson<ServerState>(response));

export const getBook = (): Promise<Book> =>
  fetch('/api/book').then((response) => responseJson<Book>(response));

export const putBook = (side: 'assets' | 'clients', index: number, cents: string): Promise<{ ok: true; book: Book }> =>
  fetch('/api/book', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-asfalia-console': '1' },
    body: JSON.stringify({ side, index, cents }),
  }).then((response) => responseJson<{ ok: true; book: Book }>(response));

export const postAttest = (): Promise<{ started: true }> => fetch('/api/attest', {
  method: 'POST',
  headers: { 'x-asfalia-console': '1' },
}).then((response) => responseJson<{ started: true }>(response));

export const postSettle = (): Promise<{ started: true }> => fetch('/api/settle', {
  method: 'POST',
  headers: { 'x-asfalia-console': '1' },
}).then((response) => responseJson<{ started: true }>(response));

export const getHistory = (): Promise<HistoryResponse> =>
  fetch('/api/history').then((response) => responseJson<HistoryResponse>(response));

export type ChainAction = {
  data?: {
    contractAction?: {
      __typename: string;
      transaction: { hash: string; block: { height: number; timestamp: number; hash: string } };
    } | null;
  };
};

export const getChain = (): Promise<ChainAction> =>
  fetch('/api/chain').then((response) => responseJson<ChainAction>(response));

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
  fetch('/api/scan').then((response) => responseJson<ScanResponse>(response));

export const importCsv = (kind: 'assets' | 'clients', csv: string): Promise<{ ok: true; book: Book }> =>
  fetch('/api/book/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-asfalia-console': '1' },
    body: JSON.stringify({ kind, csv }),
  }).then((response) => responseJson<{ ok: true; book: Book }>(response));

export const getInclusion = (account: string, accessToken: string): Promise<InclusionResponse> => {
  const headers: Record<string, string> = {};
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return fetch(`/api/inclusion?account=${encodeURIComponent(account)}`, { headers })
    .then((response) => responseJson<InclusionResponse>(response));
};

/** Centavos -> "1.824.500.000,00" (es-AR). */
export const fmtCents = (cents: string) => {
  const n = BigInt(cents);
  const whole = n / 100n;
  const frac = (n % 100n).toString().padStart(2, '0');
  return `${whole.toLocaleString('es-AR')},${frac}`;
};
