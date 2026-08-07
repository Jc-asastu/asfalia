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
import {
  loadEntityBook, loadUsers, toPrivateState, toClientAccount, bookFile, usersFile,
  type EntityBook, type DemoUser,
} from '../src/entity-data';
import { PRIVATE_STATE_ID } from '../src/contract';
import { inclusionProof, verifyInclusion, merkleRoot } from '../src/merkle';

const PORT = Number(process.env.PORT ?? 3300);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIST = path.resolve(__dirname, '..', 'ui', 'dist');

// ── Estado del servidor ────────────────────────────────────────────────────────

let conn: EnkuConnection;
let book: EntityBook = loadEntityBook();
let users: DemoUser[] = loadUsers();

async function syncPrivateState() {
  conn.providers.privateStateProvider.setContractAddress(conn.deployment.address as any);
  await conn.providers.privateStateProvider.set(
    PRIVATE_STATE_ID as any,
    toPrivateState(book, users) as any,
  );
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
    return json(res, 200, { ...book, users });
  }

  if (req.method === 'PUT' && url.pathname === '/api/book') {
    // Edita un activo o el saldo de una cuenta de cliente — el momento
    // adversarial del demo: mentir un numero y ver romperse la matematica.
    const { side, index, cents } = await readBody(req);
    if (!/^\d+$/.test(String(cents))) return json(res, 400, { error: 'cents entero' });
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
      return json(res, 200, { verified: false, reason: 'sin attestacion on-chain todavia' });
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
