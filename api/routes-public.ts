/**
 * Superficie PUBLICA de Asfalia. Todo lo que se sirve aca sale de la cadena
 * (o del log de emisiones, que es un indice de transacciones publicas).
 *
 * Regla de oro: por estas rutas no puede pasar un saldo. Ni un endpoint de
 * libros, ni una prueba de inclusion, ni nada que dispare una emision. Lo que
 * un auditor ve, lo puede re-derivar del ledger por su cuenta.
 *
 * Este modulo lo montan los DOS servidores:
 *   - la consola de la entidad (api/server.ts), que ademas monta lo privado
 *   - el sitio publico (api/public-server.ts), que monta SOLO esto
 */
import * as http from 'node:http';
import { json } from './http-util';
import { computeScore } from '../src/score';

/** Una emision registrada. Cada fila apunta a su tx: todo es dato de cadena. */
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

export type Job = {
  kind: 'attest' | 'settle' | null;
  running: boolean;
  phase: string;
  startedAt: number | null;
  finishedAt: number | null;
  durationSec: number | null;
  txId: string | null;
  paymentTxId: string | null;
  paymentTnight: number | null;
  error: string | null;
};

export type LedgerView = {
  verdict: boolean;
  attestedAt: bigint;
  validUntil: bigint;
  assetsCommitment: string;
  liabilitiesRoot: string;
} | null;

/**
 * Lo que la superficie publica necesita para responder. Notar que NO recibe
 * los libros, ni la wallet, ni forma de emitir: no puede filtrar lo que no
 * tiene.
 */
export type PublicDeps = {
  /** 'console' habilita la consola privada en la UI; 'public' la esconde. */
  mode: 'console' | 'public';
  network: string;
  contractAddress: string;
  /** Nombre visible de la entidad. No es un secreto. */
  entityName: string;
  /** URL del indexer, para las consultas GraphQL crudas. */
  indexer: string;
  readLedger: () => Promise<LedgerView>;
  readHistory: () => LogEntry[];
  heartbeatSec: number | null;
  nextBeatAt: () => number | null;
  /** El job de emision en curso. En el sitio publico siempre es null. */
  job: () => Job | null;
};

const scanCache = new Map<string, unknown>();

async function gql(indexer: string, query: string) {
  const r = await fetch(indexer, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(8000),
  });
  return (await r.json()) as any;
}

/**
 * Resuelve una ruta publica. Devuelve `true` si la manejo — el que llama
 * decide que hacer con lo que no cae aca.
 */
export async function handlePublicApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  d: PublicDeps,
): Promise<boolean> {
  if (req.method === 'GET' && url.pathname === '/api/state') {
    const ledger = await d.readLedger();
    json(res, 200, {
      mode: d.mode,
      network: d.network,
      contractAddress: d.contractAddress,
      entity: d.entityName,
      ledger, // veredicto, tiempos, commitment y raiz — nada mas existe
      attest: d.job(),
      score: computeScore(d.readHistory(), d.heartbeatSec, Date.now()),
      heartbeat: d.heartbeatSec
        ? { sec: d.heartbeatSec, nextAt: d.nextBeatAt() ? Math.floor(d.nextBeatAt()! / 1000) : null }
        : null,
      now: Math.floor(Date.now() / 1000),
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/history') {
    const history = d.readHistory();
    json(res, 200, {
      heartbeatSec: d.heartbeatSec,
      entries: history,
      score: computeScore(history, d.heartbeatSec, Date.now()),
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/scan') {
    // Cabeza de la cadena + cada emision resuelta contra el indexer
    // (identifier -> hash real + bloque). Cache en memoria.
    const head = (await gql(d.indexer, '{ block { height hash timestamp } }'))?.data?.block ?? null;
    const rows: any[] = [];
    for (const e of d.readHistory().filter((x) => x.ok && x.txId).slice(-40)) {
      const id = e.txId!;
      if (!scanCache.has(id)) {
        const r = await gql(
          d.indexer,
          `{ transactions(offset: {identifier: "${id.replace(/[^0-9a-fA-F]/g, '')}"}) { hash block { height hash timestamp } } }`,
        );
        const tx = r?.data?.transactions?.[0];
        if (tx) scanCache.set(id, tx);
      }
      const tx = scanCache.get(id);
      if (tx) rows.push({ identifier: id, verdict: e.verdict, trigger: e.trigger, ...(tx as object) });
    }
    rows.reverse(); // mas nuevas primero
    json(res, 200, { head, contractAddress: d.contractAddress, rows });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/chain') {
    // La cadena de primera mano, segun el indexer. Sin parametros: la ultima
    // accion del contrato. Con ?tx=<id>: esa transaccion por su identifier.
    const txId = url.searchParams.get('tx');
    const query = txId
      ? `{ transactions(offset: {identifier: "${txId.replace(/[^0-9a-fA-F]/g, '')}"}) {
          hash block { height timestamp hash }
          contractActions { __typename address }
        } }`
      : `{ contractAction(address: "${d.contractAddress}") {
          __typename address
          transaction { hash block { height timestamp hash } }
        } }`;
    json(res, 200, await gql(d.indexer, query));
    return true;
  }

  return false;
}
