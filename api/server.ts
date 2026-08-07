/**
 * API de Enku — http nativo de Node, cero dependencias nuevas.
 *
 * Mantiene UNA conexion viva al contrato (wallet sync es caro) y expone:
 *   GET  /api/state          estado publico + job de attest en curso
 *   GET  /api/book           libro privado (solo lo ve la entidad: corre en su maquina)
 *   PUT  /api/book           edita un item {side, index, cents} — momento adversarial
 *   POST /api/attest         dispara attest (async; el estado se sigue por /api/state)
 *   GET  /*                  dashboard estatico (ui/dist)
 */
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectEnku, type EnkuConnection } from '../src/contract';
import { loadEntityBook, toPrivateState, type EntityBook } from '../src/entity-data';
import { PRIVATE_STATE_ID } from '../src/contract';

const PORT = Number(process.env.PORT ?? 3300);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIST = path.resolve(__dirname, '..', 'ui', 'dist');
const DATA_FILE = process.env.ENKU_DATA ?? path.resolve(__dirname, '..', 'data', 'demo-entity.json');

// ── Estado del servidor ────────────────────────────────────────────────────────

let conn: EnkuConnection;
let book: EntityBook = loadEntityBook(DATA_FILE);

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
  job.phase = kind === 'attest'
    ? 'Generando prueba ZK — los balances no salen de esta maquina'
    : 'Aceptando certificado — la cadena verifica vigencia';
  job.startedAt = Date.now();
  job.finishedAt = null;
  job.txId = null;
  job.error = null;
  try {
    const { txId } = kind === 'attest' ? await conn.attest() : await conn.settle();
    job.txId = txId;
    job.phase = kind === 'attest' ? 'Verificado en cadena' : 'Certificado aceptado en cadena';
  } catch (e: any) {
    const msg: string = e?.cause?.message ?? e?.message ?? String(e);
    job.error = msg;
    job.phase = /expired/.test(msg)
      ? 'RECHAZADO: el certificado esta vencido'
      : /not solvent/.test(msg)
        ? 'RECHAZADO: el certificado no acredita solvencia'
        : `Fallo el ${kind}`;
  } finally {
    job.running = false;
    job.finishedAt = Date.now();
    job.durationSec = job.startedAt ? (job.finishedAt - job.startedAt) / 1000 : null;
  }
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
      now: Math.floor(Date.now() / 1000),
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/book') {
    // Solo la entidad ve esto: el server corre en SU maquina. El auditor
    // accede al certificado, que no contiene un solo numero.
    return json(res, 200, book);
  }

  if (req.method === 'PUT' && url.pathname === '/api/book') {
    const { side, index, cents } = await readBody(req);
    const list = side === 'assets' ? book.assets : side === 'liabilities' ? book.liabilities : null;
    if (!list || !(index >= 0 && index < 8) || !/^\d+$/.test(String(cents))) {
      return json(res, 400, { error: 'side assets|liabilities, index 0-7, cents entero' });
    }
    list[index].cents = String(cents);
    fs.writeFileSync(DATA_FILE, JSON.stringify(book, null, 2));
    // El proximo attest usa el libro editado: se pisa el estado privado local.
    conn.providers.privateStateProvider.setContractAddress(conn.deployment.address as any);
    await conn.providers.privateStateProvider.set(PRIVATE_STATE_ID as any, toPrivateState(book) as any);
    return json(res, 200, { ok: true, book });
  }

  if (req.method === 'POST' && (url.pathname === '/api/attest' || url.pathname === '/api/settle')) {
    if (job.running) return json(res, 409, { error: 'operacion en curso' });
    void runJob(url.pathname === '/api/attest' ? 'attest' : 'settle');
    return json(res, 202, { started: true });
  }

  return json(res, 404, { error: 'no existe' });
}

function serveStatic(res: http.ServerResponse, urlPath: string) {
  let file = path.join(UI_DIST, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(UI_DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file)) file = path.join(UI_DIST, 'index.html'); // SPA fallback
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('Enku API viva. El dashboard no esta buildeado: npm run ui:build');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

// ── Arranque ───────────────────────────────────────────────────────────────────

console.log('  Enku API — conectando al contrato…');
conn = await connectEnku((m) => console.log(`  … ${m}`));
console.log(`  Contrato: ${conn.deployment.address.slice(0, 16)}… (${conn.network})`);

http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(res, url.pathname);
  } catch (e: any) {
    console.error('  error:', e?.message ?? e);
    return json(res, 500, { error: e?.message ?? 'error interno' });
  }
}).listen(PORT, () => console.log(`  Dashboard: http://localhost:${PORT}\n`));
