/**
 * API de Asfalia — http nativo de Node, cero dependencias nuevas.
 *
 * Mantiene UNA conexion viva al contrato (wallet sync es caro) y expone:
 *   GET  /api/state          estado publico + job de attest en curso
 *   GET  /api/book           libro privado (solo lo ve la entidad: corre en su maquina)
 *   PUT  /api/book           edita un item {side, index, cents} — momento adversarial
 *   POST /api/attest         dispara attest (async; el estado se sigue por /api/state)
 *   GET  /*                  dashboard estatico (ui/dist)
 */
import * as http from 'node:http';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectAsfalia, type AsfaliaConnection } from '../src/contract';
import {
  loadEntityBook, loadUsers, toPrivateState, toClientAccount, bookFile, usersFile,
  type EntityBook, type DemoUser,
} from '../src/entity-data';
import { PRIVATE_STATE_ID } from '../src/contract';
import { inclusionProof, verifyInclusion, merkleRoot } from '../src/merkle';
import { computeScore } from '../src/score';

const PORT = Number(process.env.PORT ?? 3300);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIST = path.resolve(__dirname, '..', 'ui', 'dist');
const LOG_FILE = process.env.ASFALIA_LOG ?? path.resolve(__dirname, '..', 'data', 'attest-log.json');

// Heartbeat: emision automatica de certificados, renovacion solapada.
// 0 = apagado. En produccion: 86400 (diario). En demo: 180.
const HEARTBEAT_SEC = Number(process.env.ASFALIA_HEARTBEAT_SEC ?? 0);

// ── Estado del servidor ────────────────────────────────────────────────────────

let conn: AsfaliaConnection;
let book: EntityBook = loadEntityBook();
let users: DemoUser[] = loadUsers();

async function syncPrivateState() {
  conn.providers.privateStateProvider.setContractAddress(conn.deployment.address as any);
  await conn.providers.privateStateProvider.set(
    PRIVATE_STATE_ID as any,
    toPrivateState(book, users) as any,
  );
}

// ── Historial de emisiones ─────────────────────────────────────────────────────
// Cada fila apunta a su tx on-chain: el log es un indice verificable, no una
// fuente de verdad paralela. Los huecos entre filas son SENAL: la entidad
// eligio no probar en ese periodo.

type LogEntry = {
  ts: number; // epoch ms de emision
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

const scanCache = new Map<string, unknown>();
let history: LogEntry[] = [];
try { history = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch { /* primer arranque */ }

function appendHistory(e: LogEntry) {
  history.push(e);
  fs.writeFileSync(LOG_FILE, JSON.stringify(history, null, 2));
}

type Job = {
  kind: 'attest' | 'settle' | null;
  running: boolean;
  phase: string;
  startedAt: number | null;
  finishedAt: number | null;
  durationSec: number | null;
  txId: string | null;
  error: string | null;
};
const job: Job = {
  kind: null, running: false, phase: 'idle', startedAt: null, finishedAt: null,
  durationSec: null, txId: null, error: null,
};

/** Corre attest o settle con el mismo ciclo de vida de job.
 *  En settle, un rechazo de la cadena NO es una falla del sistema:
 *  es el producto funcionando (certificado vencido = tx rechazada). */
async function runJob(kind: 'attest' | 'settle') {
  job.kind = kind;
  job.running = true;
  // Codigos, no frases: la UI los traduce (ES/EN).
  job.phase = kind === 'attest' ? 'proving' : 'settling';
  job.startedAt = Date.now();
  job.finishedAt = null;
  job.txId = null;
  job.error = null;
  try {
    const { txId } = kind === 'attest' ? await conn.attest() : await conn.settle();
    job.txId = txId;
    job.phase = kind === 'attest' ? 'verified' : 'settled';
  } catch (e: any) {
    const msg: string = e?.cause?.message ?? e?.message ?? String(e);
    job.error = msg;
    job.phase = /expired/.test(msg)
      ? 'rejected_expired'
      : /not solvent/.test(msg)
        ? 'rejected_insolvent'
        : kind === 'attest' ? 'failed_attest' : 'failed_settle';
  } finally {
    job.running = false;
    job.finishedAt = Date.now();
    job.durationSec = job.startedAt ? (job.finishedAt - job.startedAt) / 1000 : null;
    if (kind === 'attest') {
      const ledger = await conn.readLedger().catch(() => null);
      appendHistory({
        ts: job.finishedAt,
        trigger: currentTrigger,
        ok: !job.error,
        verdict: job.error ? null : (ledger?.verdict ?? null),
        txId: job.txId,
        attestedAt: ledger ? String(ledger.attestedAt) : null,
        validUntil: ledger ? String(ledger.validUntil) : null,
        assetsCommitment: ledger?.assetsCommitment ?? null,
        liabilitiesRoot: ledger?.liabilitiesRoot ?? null,
        durationSec: job.durationSec,
        error: job.error,
      });
    }
  }
}

let currentTrigger: 'heartbeat' | 'manual' = 'manual';
let nextBeatAt: number | null = null;

/** El latido: emite un certificado nuevo ANTES de que venza el anterior.
 *  Automatizado — sin manos humanas. Si la entidad lo apaga, el hueco
 *  queda visible en el historial para siempre. */
function startHeartbeat() {
  if (!HEARTBEAT_SEC) return;
  const beat = () => {
    nextBeatAt = Date.now() + HEARTBEAT_SEC * 1000;
    if (!job.running) {
      currentTrigger = 'heartbeat';
      void runJob('attest').finally(() => { currentTrigger = 'manual'; });
    }
  };
  console.log(`  Heartbeat: cada ${HEARTBEAT_SEC}s (ventana ${process.env.ASFALIA_VALIDITY ?? 300}s)`);
  beat();
  setInterval(beat, HEARTBEAT_SEC * 1000);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
};

function json(res: http.ServerResponse, status: number, body: unknown) {
  const s = JSON.stringify(body, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(s);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}

// ── Rutas ──────────────────────────────────────────────────────────────────────

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  if (req.method === 'GET' && url.pathname === '/api/state') {
    const ledger = await conn.readLedger();
    return json(res, 200, {
      network: conn.network,
      contractAddress: conn.deployment.address,
      entity: book.entity,
      ledger, // verdict, attestedAt (epoch s), balancesCommitment — nada mas existe
      attest: job,
      score: computeScore(history, HEARTBEAT_SEC || null, Date.now()),
      heartbeat: HEARTBEAT_SEC
        ? { sec: HEARTBEAT_SEC, nextAt: nextBeatAt ? Math.floor(nextBeatAt / 1000) : null }
        : null,
      now: Math.floor(Date.now() / 1000),
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/history') {
    return json(res, 200, {
      heartbeatSec: HEARTBEAT_SEC || null,
      entries: history,
      score: computeScore(history, HEARTBEAT_SEC || null, Date.now()),
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/scan') {
    // El scanner: cabeza de la cadena + cada emision de nuestro log resuelta
    // contra el indexer (identifier -> hash real + bloque). Cache en memoria.
    const { resolveNetwork } = await import('../src/network');
    const { config } = resolveNetwork();
    const gql = async (query: string) => {
      const r = await fetch(config.indexer, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(8000),
      });
      return (await r.json()).data;
    };
    const head = (await gql('{ block { height hash timestamp } }'))?.block ?? null;
    const rows: any[] = [];
    for (const e of history.filter((x) => x.ok && x.txId).slice(-40)) {
      const id = e.txId!;
      if (!scanCache.has(id)) {
        const d = await gql(
          `{ transactions(offset: {identifier: "${id}"}) { hash block { height hash timestamp } } }`,
        );
        const tx = d?.transactions?.[0];
        if (tx) scanCache.set(id, tx);
      }
      const tx = scanCache.get(id);
      if (tx) rows.push({ identifier: id, verdict: e.verdict, trigger: e.trigger, ...tx });
    }
    rows.reverse(); // mas nuevas primero
    return json(res, 200, { head, contractAddress: conn.deployment.address, rows });
  }

  if (req.method === 'GET' && url.pathname === '/api/chain') {
    // La cadena, de primera mano, segun el INDEXER de la devnet (no nuestro
    // log). Sin parametros: la ultima accion del contrato. Con ?tx=<id>:
    // busca esa transaccion por su identifier (el txId que muestra la UI).
    const { resolveNetwork } = await import('../src/network');
    const { config } = resolveNetwork();
    const txId = url.searchParams.get('tx');
    const q = txId
      ? {
          query: `{ transactions(offset: {identifier: "${txId.replace(/[^0-9a-fA-F]/g, '')}"}) {
            hash block { height timestamp hash }
            contractActions { __typename address }
          } }`,
        }
      : {
      query: `{ contractAction(address: "${conn.deployment.address}") {
        __typename address
        transaction { hash block { height timestamp hash } }
      } }`,
    };
    const r = await fetch(config.indexer, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(q),
      signal: AbortSignal.timeout(8000),
    });
    return json(res, 200, await r.json());
  }

  if (req.method === 'GET' && url.pathname === '/api/book') {
    // Solo la entidad ve esto: el server corre en SU maquina. El auditor
    // accede al certificado, que no contiene un solo numero.
    return json(res, 200, { ...book, users });
  }

  if (req.method === 'PUT' && url.pathname === '/api/book') {
    // Edita un activo o el saldo de una cuenta de cliente — el momento
    // adversarial del demo: mentir un numero y ver romperse la matematica.
    const { side, index, cents } = await readBody(req);
    if (!/^\d+$/.test(String(cents)) || BigInt(cents) > (1n << 64n) - 1n) {
      return json(res, 400, { error: 'cents: entero no negativo dentro de Uint<64>' });
    }
    if (side === 'assets' && index >= 0 && index < 8) {
      book.assets[index].cents = String(cents);
      fs.writeFileSync(bookFile(), JSON.stringify(book, null, 2));
    } else if (side === 'clients' && index >= 0 && index < 16) {
      users[index].cents = String(cents);
      fs.writeFileSync(usersFile(), JSON.stringify({ users }, null, 2));
    } else {
      return json(res, 400, { error: 'side assets(0-7)|clients(0-15)' });
    }
    // El proximo attest usa los libros editados: se pisa el estado privado local.
    await syncPrivateState();
    return json(res, 200, { ok: true, book: { ...book, users } });
  }

  if (req.method === 'POST' && url.pathname === '/api/book/import') {
    // Carga de libros por CSV — el formato que exporta cualquier ERP o DB.
    // assets:  label,amount_usd            (8 filas)
    // clients: account,name,amount_usd     (16 filas)
    // Parser RFC 4180 minimo: campos entrecomillados (nombres con comas,
    // decimales con coma) y comillas escapadas. Los ids y salts los genera
    // el daemon; una cuenta existente conserva su salt (continuidad de las
    // pruebas de inclusion del cliente).
    const { kind, csv } = await readBody(req);
    if (!['assets', 'clients'].includes(kind) || typeof csv !== 'string') {
      return json(res, 400, { error: 'kind assets|clients y csv (texto)' });
    }

    const parseCsv = (text: string): string[][] => {
      const out: string[][] = [];
      let row: string[] = [], cell = '', inQ = false;
      const src = text.replace(/^\uFEFF/, '');
      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (inQ) {
          if (ch === '"') {
            if (src[i + 1] === '"') { cell += '"'; i++; }
            else inQ = false;
          } else cell += ch;
        } else if (ch === '"') inQ = true;
        else if (ch === ',') { row.push(cell.trim()); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && src[i + 1] === '\n') i++;
          row.push(cell.trim()); cell = '';
          if (row.some((c) => c !== '')) out.push(row);
          row = [];
        } else cell += ch;
      }
      row.push(cell.trim());
      if (row.some((c) => c !== '')) out.push(row);
      return out;
    };

    // Una sola regla de centavos para todo el sistema: no negativo, con
    // hasta dos decimales (punto o coma), y acotado a Uint<64>.
    const U64_MAX = (1n << 64n) - 1n;
    const toCents = (v: string): string => {
      if (!/^[0-9]+([.,][0-9]{1,2})?$/.test(v)) {
        throw new Error(`importe invalido: "${v}" (no negativo, hasta 2 decimales)`);
      }
      const [w, f = ''] = v.replace(',', '.').split('.');
      const cents = BigInt(`${w}${f.padEnd(2, '0')}`);
      if (cents > U64_MAX) throw new Error(`importe fuera de rango: "${v}"`);
      return cents.toString();
    };

    try {
      const rows = parseCsv(csv);
      const header = rows.shift()?.map((h) => h.toLowerCase()) ?? [];
      const expected = kind === 'assets' ? ['label', 'amount_usd'] : ['account', 'name', 'amount_usd'];
      const cols = expected.map((name) => {
        const i = header.indexOf(name);
        if (i < 0) throw new Error(`encabezados esperados: ${expected.join(',')}`);
        return i;
      });
      const want = kind === 'assets' ? 8 : 16;
      if (rows.length !== want) {
        throw new Error(`el circuito espera ${want} filas, el CSV trae ${rows.length}`);
      }
      for (const [n, r] of rows.entries()) {
        if (r.length !== header.length) {
          throw new Error(`fila ${n + 2}: ${r.length} columnas, se esperaban ${header.length}`);
        }
      }

      if (kind === 'assets') {
        const [li, ai] = cols;
        book.assets = rows.map((r) => ({ label: r[li], cents: toCents(r[ai]) }));
        fs.writeFileSync(bookFile(), JSON.stringify(book, null, 2));
      } else {
        const [ac, nc, am] = cols;
        const seen = new Set<string>();
        for (const r of rows) {
          if (seen.has(r[ac])) throw new Error(`cuenta duplicada en el CSV: "${r[ac]}"`);
          seen.add(r[ac]);
        }
        const prev = new Map(users.map((u) => [u.account, u]));
        users = rows.map((r) => {
          const existing = prev.get(r[ac]);
          return {
            account: r[ac],
            name: r[nc],
            cents: toCents(r[am]),
            idHex: existing?.idHex ?? randomBytes(32).toString('hex'),
            saltHex: existing?.saltHex ?? randomBytes(32).toString('hex'),
          };
        });
        fs.writeFileSync(usersFile(), JSON.stringify({ users }, null, 2));
      }
    } catch (e: any) {
      return json(res, 400, { error: e?.message ?? 'CSV invalido' });
    }

    // El parseo ya persistio: si la sincronizacion del estado privado falla,
    // decirlo tal cual — los libros quedaron guardados, el proximo attest
    // necesita que el sync se recupere (o un reinicio del daemon).
    try {
      await syncPrivateState();
    } catch (e: any) {
      return json(res, 500, {
        error: `libros guardados, pero fallo la sincronizacion del estado privado: ${e?.message ?? e}. Reintente o reinicie el daemon.`,
      });
    }
    return json(res, 200, { ok: true, book: { ...book, users } });
  }

  if (req.method === 'GET' && url.pathname === '/api/inclusion') {
    // Prueba de inclusion para una cuenta: la entidad se la entrega a SU
    // cliente (en produccion, autenticado). Contiene el saldo propio y el
    // camino de hermanos — jamas el saldo de otro.
    const account = url.searchParams.get('account');
    const idx = users.findIndex((u) => u.account === account);
    if (idx < 0) return json(res, 404, { error: 'cuenta desconocida' });
    const clients = users.map(toClientAccount);
    const proof = await inclusionProof(clients, idx, users[idx].account);
    return json(res, 200, {
      ...proof,
      name: users[idx].name,
      cents: users[idx].cents,
      localRootHex: await merkleRoot(clients),
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/verify-inclusion') {
    // Verificacion del lado del cliente: camino -> raiz, y la raiz se compara
    // contra la RAIZ ON-CHAIN. Si la entidad escondio la cuenta, no cierra.
    const { leafHex, path: proofPath, } = await readBody(req);
    if (!leafHex || !Array.isArray(proofPath)) return json(res, 400, { error: 'leafHex y path' });
    const ledger = await conn.readLedger();
    if (!ledger || !/[^0]/.test(ledger.liabilitiesRoot)) {
      return json(res, 200, { verified: false, reason: 'no_attest' });
    }
    const verified = await verifyInclusion(leafHex, proofPath, ledger.liabilitiesRoot);
    return json(res, 200, { verified, onChainRoot: ledger.liabilitiesRoot });
  }

  if (req.method === 'POST' && (url.pathname === '/api/attest' || url.pathname === '/api/settle')) {
    if (job.running) return json(res, 409, { error: 'operacion en curso' });
    void runJob(url.pathname === '/api/attest' ? 'attest' : 'settle');
    return json(res, 202, { started: true });
  }

  return json(res, 404, { error: 'no existe' });
}

function serveSample(res: http.ServerResponse, name: string) {
  const file = path.resolve(__dirname, '..', 'data', 'samples', name);
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {
    'content-type': 'text/csv',
    'content-disposition': `attachment; filename="${name}"`,
  });
  fs.createReadStream(file).pipe(res);
}

function serveStatic(res: http.ServerResponse, urlPath: string) {
  let file = path.join(UI_DIST, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(UI_DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file)) file = path.join(UI_DIST, 'index.html'); // SPA fallback
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('Asfalia API viva. El dashboard no esta buildeado: npm run ui:build');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

// ── Arranque ───────────────────────────────────────────────────────────────────

console.log('  Asfalia API — conectando al contrato…');
conn = await connectAsfalia((m) => console.log(`  … ${m}`));
console.log(`  Contrato: ${conn.deployment.address.slice(0, 16)}… (${conn.network})`);

http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (/^\/samples\/(assets|clients)\.csv$/.test(url.pathname)) {
      return serveSample(res, url.pathname.split('/').pop()!);
    }
    return serveStatic(res, url.pathname);
  } catch (e: any) {
    console.error('  error:', e?.message ?? e);
    return json(res, 500, { error: e?.message ?? 'error interno' });
  }
}).listen(PORT, () => console.log(`  Dashboard: http://localhost:${PORT}\n`));

startHeartbeat();
