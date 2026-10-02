/**
 * Static file server for local development.
 *
 * Browsers refuse to load ES modules over file://, so the shelf and the games
 * need an http origin. Run with Node's type stripping, no build step and no
 * dependency:
 *
 *   node --experimental-strip-types tools/serve.ts
 *
 * Any path ending in / is served that folder's index.html, so each game is
 * reachable at its own folder exactly as it will be on a static host.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env['PORT'] ?? 5190);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  const requested = decodeURIComponent(pathname.endsWith('/') ? `${pathname}index.html` : pathname);
  const target = resolve(ROOT, normalize(requested).replace(/^[/\\]+/, ''));

  // Never serve outside the project folder, however the path was spelled.
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    response.writeHead(403, { 'content-type': 'text/plain' }).end('forbidden');
    return;
  }

  readFile(target)
    .then((body) => {
      response.writeHead(200, {
        'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    })
    .catch(() => {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    });
});

server.listen(PORT, () => {
  console.log(`kasar dev server: http://localhost:${PORT}/`);
});
