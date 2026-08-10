/** Utilidades http compartidas por la consola de la entidad y el sitio publico. */
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
};

export function json(res: http.ServerResponse, status: number, body: unknown) {
  const s = JSON.stringify(body, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(s);
}

export function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}

export function serveStatic(res: http.ServerResponse, uiDist: string, urlPath: string) {
  let file = path.join(uiDist, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(uiDist)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file)) file = path.join(uiDist, 'index.html'); // SPA fallback
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('Asfalia viva. El dashboard no esta buildeado: npm run ui:build');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}
