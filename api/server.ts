/**
 * API de Asfalia — http nativo de Node, cero dependencias nuevas.
 *
 * Mantiene UNA conexion viva al contrato (wallet sync es caro) y abre dos
 * superficies separadas:
 *   PORT (127.0.0.1)          consola privada + API administrativa
 *   ASFALIA_PUBLIC_PORT       portal opcional, sin libros ni transacciones
 * Las pruebas del portal publico requieren un token ligado a una unica cuenta
 * mediante ASFALIA_CLIENT_TOKENS.
 */
import * as http from 'node:http';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectAsfalia, type AsfaliaConnection } from '../src/contract';
import {
  accountIdHex, loadEntityBook, loadUsers, saveEntityBook, saveUsers,
  toPrivateState, toClientAccount, validateEntityBook, validateUsers,
  type EntityBook, type DemoUser,
} from '../src/entity-data';
import { PRIVATE_STATE_ID } from '../src/contract';
import { inclusionProof } from '../src/merkle';
import { computeScore } from '../src/score';
import { appendHistory, loadHistory, type LogEntry } from '../src/attest-history';
import {
  clientAccountFromRequest,
  loadClientTokenRegistry,
  type ServerScope,
} from './access';

const PORT = Number(process.env.PORT ?? 3300);
const ADMIN_HOST = process.env.ASFALIA_ADMIN_HOST?.trim() || '127.0.0.1';
const PUBLIC_PORT = process.env.ASFALIA_PUBLIC_PORT
  ? Number(process.env.ASFALIA_PUBLIC_PORT)
  : null;
const PUBLIC_HOST = process.env.ASFALIA_PUBLIC_HOST?.trim() || '0.0.0.0';
const CLIENT_TOKENS = loadClientTokenRegistry();
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

if (!LOOPBACK_HOSTS.has(ADMIN_HOST)) {
  throw new Error('ASFALIA_ADMIN_HOST must be a loopback address (127.0.0.1, ::1 or localhost)');
}
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}
if (PUBLIC_PORT !== null && (!Number.isInteger(PUBLIC_PORT) || PUBLIC_PORT < 1 || PUBLIC_PORT > 65535)) {
  throw new Error('ASFALIA_PUBLIC_PORT must be an integer between 1 and 65535');
}
if (PUBLIC_PORT === PORT) {
  throw new Error('ASFALIA_PUBLIC_PORT must be different from the private console PORT');
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIST = path.resolve(__dirname, '..', 'ui', 'dist');
const LOG_FILE = process.env.ASFALIA_LOG ?? path.resolve(__dirname, '..', 'data', 'attest-log.json');

// Heartbeat: emision automatica de certificados, renovacion solapada.
// 0 = apagado. En produccion: 86400 (diario). En demo: 180.
const HEARTBEAT_SEC = Number(process.env.ASFALIA_HEARTBEAT_SEC ?? 0);
if (!Number.isSafeInteger(HEARTBEAT_SEC) || HEARTBEAT_SEC < 0) {
  throw new Error('ASFALIA_HEARTBEAT_SEC must be a non-negative integer');
}

// ── Estado del servidor ────────────────────────────────────────────────────────

let conn: AsfaliaConnection;
let book: EntityBook = loadEntityBook();
let users: DemoUser[] = loadUsers();
let dataMutationRunning = false;

async function syncPrivateState() {
  conn.providers.privateStateProvider.setContractAddress(conn.deployment.address as any);
  await conn.providers.privateStateProvider.set(
    PRIVATE_STATE_ID as any,
    toPrivateState(book, users) as any,
  );
}

// ── Historial de emisiones ─────────────────────────────────────────────────────
// Telemetria operativa local. Cada exito apunta a una tx on-chain, pero el
// archivo no se expone como si fuera historial publico derivado de la cadena.

const scanCache = new Map<string, unknown>();
let history: LogEntry[] = loadHistory(LOG_FILE);

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
async function runJob(kind: 'attest' | 'settle', trigger: 'heartbeat' | 'manual' = 'manual') {
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
    job.finishedAt = Date.now();
    job.durationSec = job.startedAt ? (job.finishedAt - job.startedAt) / 1000 : null;
    if (kind === 'attest') {
      const ledger = await conn.readLedger().catch(() => null);
      try {
        history = appendHistory(LOG_FILE, history, {
          ts: job.finishedAt,
          trigger,
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
      } catch (error) {
        job.phase = 'failed_history';
        job.error = `attestation completed but local history could not be persisted: ${(error as Error).message}`;
        console.error(`  ${job.error}`);
      }
    }
    // Keep the lock until ledger read and durable history persistence finish.
    job.running = false;
  }
}

let nextBeatAt: number | null = null;

/** El latido: emite un certificado nuevo ANTES de que venza el anterior.
 *  Automatizado — sin manos humanas. Si la entidad lo apaga, el hueco
 *  queda visible en el historial para siempre. */
function startHeartbeat() {
  if (!HEARTBEAT_SEC) return;
  const beat = () => {
    nextBeatAt = Date.now() + HEARTBEAT_SEC * 1000;
    if (!job.running && !dataMutationRunning) {
      void runJob('attest', 'heartbeat');
    }
  };
  console.log(`  Heartbeat: cada ${HEARTBEAT_SEC}s (vigencia fijada al desplegar)`);
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
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  res.end(s);
}

const MAX_BODY_BYTES = 1_000_000;

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    let bytes = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        tooLarge = true;
        data = '';
      } else if (!tooLarge) {
        data += chunk.toString('utf8');
      }
    });
    req.on('end', () => {
      if (tooLarge) return reject(new HttpError(413, 'request body too large'));
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new HttpError(400, 'invalid JSON body'));
      }
    });
  });
}

// ── Rutas ──────────────────────────────────────────────────────────────────────

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  scope: ServerScope,
) {
  if (
    scope === 'admin' &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '') &&
    req.headers['x-asfalia-console'] !== '1'
  ) {
    return json(res, 403, { error: 'private console request required' });
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const ledger = await conn.readLedger();
    return json(res, 200, {
      network: conn.network,
      contractAddress: conn.deployment.address,
      entity: book.entity,
      ledger, // verdict, attestedAt (epoch s), balancesCommitment — nada mas existe
      attest: scope === 'admin' ? job : { ...job, error: null },
      score: scope === 'admin'
        ? computeScore(history, HEARTBEAT_SEC || null, Date.now())
        : null,
      heartbeat: HEARTBEAT_SEC
        ? { sec: HEARTBEAT_SEC, nextAt: nextBeatAt ? Math.floor(nextBeatAt / 1000) : null }
        : null,
      capabilities: {
        entityConsole: scope === 'admin',
        settlement: scope === 'admin',
        clientProof: scope === 'admin' || CLIENT_TOKENS.size > 0,
        clientTokenRequired: scope === 'public',
        history: scope === 'admin',
        scanner: scope === 'admin',
      },
      now: Math.floor(Date.now() / 1000),
    });
  }

  if (scope === 'admin' && req.method === 'GET' && url.pathname === '/api/history') {
    return json(res, 200, {
      heartbeatSec: HEARTBEAT_SEC || null,
      entries: history,
      score: computeScore(history, HEARTBEAT_SEC || null, Date.now()),
    });
  }

  if (scope === 'admin' && req.method === 'GET' && url.pathname === '/api/scan') {
    // Consola operativa: resuelve las tx de la telemetria local contra el
    // indexer. No se presenta en el portal como un historial chain-derived.
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

  if (scope === 'admin' && req.method === 'GET' && url.pathname === '/api/book') {
    // Solo la entidad ve esto: el server corre en SU maquina. El auditor
    // accede al certificado, que no contiene un solo numero.
    return json(res, 200, { ...book, users });
  }

  if (scope === 'admin' && req.method === 'PUT' && url.pathname === '/api/book') {
    // Edita un activo o el saldo de una cuenta de cliente — el momento
    // adversarial del demo: mentir un numero y ver romperse la matematica.
    if (job.running || dataMutationRunning) return json(res, 409, { error: 'operacion en curso' });
    dataMutationRunning = true;
    try {
      const { side, index, cents } = await readBody(req);
      if (!Number.isInteger(index)) {
        return json(res, 400, { error: 'index: entero requerido' });
      }
      if (!/^\d+$/.test(String(cents)) || BigInt(cents) > (1n << 64n) - 1n) {
        return json(res, 400, { error: 'cents: entero no negativo dentro de Uint<64>' });
      }
      if (side === 'assets' && index >= 0 && index < 8) {
        const next = validateEntityBook({
          ...book,
          assets: book.assets.map((item, i) => i === index ? { ...item, cents: String(cents) } : item),
        });
        saveEntityBook(next);
        book = next;
      } else if (side === 'clients' && index >= 0 && index < 16) {
        const next = validateUsers({
          users: users.map((user, i) => i === index ? { ...user, cents: String(cents) } : user),
        });
        saveUsers(next);
        users = next;
      } else {
        return json(res, 400, { error: 'side assets(0-7)|clients(0-15)' });
      }
      // El proximo attest usa los libros editados: se pisa el estado privado local.
      await syncPrivateState();
      return json(res, 200, { ok: true, book: { ...book, users } });
    } finally {
      dataMutationRunning = false;
    }
  }

  if (scope === 'admin' && req.method === 'POST' && url.pathname === '/api/book/import') {
    // Carga de libros por CSV — el formato que exporta cualquier ERP o DB.
    // assets:  label,amount_usd            (8 filas)
    // clients: account,name,amount_usd     (16 filas)
    // Parser RFC 4180 minimo: campos entrecomillados (nombres con comas,
    // decimales con coma) y comillas escapadas. El id se deriva de la cuenta;
    // los salts los genera el daemon y una cuenta existente conserva el suyo
    // (continuidad de las pruebas de inclusion del cliente).
    if (job.running || dataMutationRunning) return json(res, 409, { error: 'operacion en curso' });
    dataMutationRunning = true;
    try {
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
      if (inQ) throw new Error('CSV invalido: campo entrecomillado sin cierre');
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
        const next = validateEntityBook({
          ...book,
          assets: rows.map((r) => ({ label: r[li], cents: toCents(r[ai]) })),
        });
        saveEntityBook(next);
        book = next;
      } else {
        const [ac, nc, am] = cols;
        const seen = new Set<string>();
        for (const r of rows) {
          if (seen.has(r[ac])) throw new Error(`cuenta duplicada en el CSV: "${r[ac]}"`);
          seen.add(r[ac]);
        }
        const prev = new Map(users.map((u) => [u.account, u]));
        const next = validateUsers({ users: rows.map((r) => {
          const existing = prev.get(r[ac]);
          return {
            account: r[ac],
            name: r[nc],
            cents: toCents(r[am]),
            idHex: accountIdHex(r[ac]),
            saltHex: existing?.saltHex ?? randomBytes(32).toString('hex'),
          };
        }) });
        saveUsers(next);
        users = next;
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
    } finally {
      dataMutationRunning = false;
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/inclusion') {
    // Prueba de inclusion para una cuenta: la entidad se la entrega a SU
    // cliente (en produccion, autenticado). Contiene el saldo propio y el
    // camino de hermanos — jamas el saldo de otro.
    const requestedAccount = url.searchParams.get('account');
    const account = scope === 'admin'
      ? requestedAccount
      : clientAccountFromRequest(req, CLIENT_TOKENS);
    if (scope === 'public' && !account) {
      res.setHeader('www-authenticate', 'Bearer');
      return json(res, 401, { error: 'invalid client access token' });
    }
    if (scope === 'public' && requestedAccount && requestedAccount !== account) {
      return json(res, 403, { error: 'access token does not authorize that account' });
    }
    if (!account) return json(res, 400, { error: 'account is required' });
    const idx = users.findIndex((u) => u.account === account);
    if (idx < 0) return json(res, 404, { error: 'cuenta desconocida' });
    const clients = users.map(toClientAccount);
    const proof = await inclusionProof(clients, idx, users[idx].account);
    return json(res, 200, {
      account: proof.account,
      path: proof.path,
      saltHex: users[idx].saltHex,
    });
  }

  if (scope === 'admin' && req.method === 'POST' && (url.pathname === '/api/attest' || url.pathname === '/api/settle')) {
    if (job.running || dataMutationRunning) return json(res, 409, { error: 'operacion en curso' });
    void runJob(url.pathname === '/api/attest' ? 'attest' : 'settle', 'manual');
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

function serveStatic(res: http.ServerResponse, urlPath: string, scope: ServerScope) {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (decodedPath.includes('\0')) {
    res.writeHead(400);
    return res.end();
  }
  if (scope === 'public' && decodedPath.startsWith('/console')) {
    res.writeHead(404);
    return res.end();
  }
  const relativePath = decodedPath === '/' ? 'index.html' : `.${decodedPath}`;
  let file = path.resolve(UI_DIST, relativePath);
  if (file !== UI_DIST && !file.startsWith(`${UI_DIST}${path.sep}`)) {
    res.writeHead(403);
    return res.end();
  }
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
// El store privado puede sobrevivir reinicios. Los archivos son la fuente
// operativa elegida por la entidad, asi que se sincronizan antes del heartbeat.
await syncPrivateState();

function adminHostHeaderAllowed(host: string | undefined): boolean {
  if (!host) return false;
  const hostname = host.startsWith('[')
    ? host.slice(1, host.indexOf(']'))
    : host.split(':')[0];
  return LOOPBACK_HOSTS.has(hostname);
}

function createHttpServer(scope: ServerScope) {
  return http.createServer(async (req, res) => {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'content-security-policy',
      "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; " +
        "img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'",
    );

    if (scope === 'admin' && !adminHostHeaderAllowed(req.headers.host)) {
      return json(res, 421, { error: 'private console accepts loopback hosts only' });
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url, scope);
      if (/^\/samples\/(assets|clients)\.csv$/.test(url.pathname)) {
        return serveSample(res, url.pathname.split('/').pop()!);
      }
      return serveStatic(res, url.pathname, scope);
    } catch (e: any) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status >= 500) console.error('  error:', e?.message ?? e);
      const message = scope === 'public' && status >= 500
        ? 'internal server error'
        : e?.message ?? 'error interno';
      return json(res, status, { error: message });
    }
  });
}

createHttpServer('admin').listen(PORT, ADMIN_HOST, () => {
  console.log(`  Consola privada: http://${ADMIN_HOST}:${PORT}`);
});

if (PUBLIC_PORT !== null) {
  createHttpServer('public').listen(PUBLIC_PORT, PUBLIC_HOST, () => {
    console.log(`  Portal publico: http://${PUBLIC_HOST}:${PUBLIC_PORT}`);
    console.log(`  Pruebas cliente: ${CLIENT_TOKENS.size} token(s) configurado(s)\n`);
  });
} else {
  console.log('  Portal publico: desactivado (configure ASFALIA_PUBLIC_PORT para habilitarlo)\n');
}

startHeartbeat();
