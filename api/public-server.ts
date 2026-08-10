/**
 * Sitio publico de Asfalia — la pagina del auditor / la contraparte.
 *
 * Lee la cadena y nada mas. No tiene la wallet de la entidad, no tiene los
 * libros, no puede emitir. Lo puede hostear cualquiera —la entidad, una
 * auditora, un tercero— porque no guarda un solo secreto: todo lo que muestra
 * se re-deriva del ledger.
 *
 *   ASFALIA_CONTRACT=<address> npm run public
 *
 * A diferencia de la consola, este bindea a 0.0.0.0 por default: esta HECHO
 * para exponerse. Que sea seguro exponerlo es justamente el punto — y lo
 * garantiza `scripts/public-surface-check.ts`, que falla el CI si por aca
 * entra un import de los libros o de la wallet.
 */
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { connectPublicView } from '../src/public-view';
import { handlePublicApi, type LogEntry } from './routes-public';
import { json, serveStatic } from './http-util';

const PORT = Number(process.env.PORT ?? 3400);
const BIND = process.env.ASFALIA_BIND ?? '0.0.0.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIST = path.resolve(__dirname, '..', 'ui', 'dist');

/**
 * El log de emisiones es un indice de transacciones publicas (veredictos,
 * txIds, commitments, raices): no hay un saldo adentro. Si la entidad lo
 * publica, el sitio lo muestra; si no esta, el historial va vacio y la cadena
 * sigue siendo la fuente.
 */
const LOG_FILE = process.env.ASFALIA_LOG ?? path.resolve(__dirname, '..', 'data', 'attest-log.json');

function readHistory(): LogEntry[] {
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) as LogEntry[];
  } catch {
    return [];
  }
}

/** `--contract <address>`, para no pelear con variables de entorno en Windows. */
function contractFlag(argv: string[]): string | undefined {
  const i = argv.indexOf('--contract');
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  const inline = argv.find((a) => a.startsWith('--contract='));
  return inline?.slice('--contract='.length);
}

console.log('  Asfalia publico — leyendo la cadena…');
const view = await connectPublicView({ contractAddress: contractFlag(process.argv) });
console.log(`  Contrato: ${view.contractAddress.slice(0, 16)}… (${view.network})`);

http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const handled = await handlePublicApi(req, res, url, {
        mode: 'public',
        network: view.network,
        contractAddress: view.contractAddress,
        entityName: process.env.ASFALIA_ENTITY_NAME ?? 'Entidad',
        indexer: view.config.indexer,
        readLedger: view.readLedger,
        readHistory,
        heartbeatSec: null,
        nextBeatAt: () => null,
        job: () => null,
      });
      // Lo que no es publico no existe aca: ni 401 ni 403, un 404 limpio.
      if (!handled) json(res, 404, { error: 'no existe' });
      return;
    }
    return serveStatic(res, UI_DIST, url.pathname);
  } catch (e: any) {
    console.error('  error:', e?.message ?? e);
    return json(res, 500, { error: e?.message ?? 'error interno' });
  }
}).listen(PORT, BIND, () => console.log(`  Sitio publico: http://${BIND}:${PORT}\n`));
