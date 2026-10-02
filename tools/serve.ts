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
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mimeFor, resolveRequest } from './lib/request.ts';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env['PORT'] ?? 5190);

const server = createServer((request, response) => {
  const target = resolveRequest(ROOT, request.url ?? '/');
  if (target === null) {
    response.writeHead(403, { 'content-type': 'text/plain' }).end('forbidden');
    return;
  }

  readFile(target)
    .then((body) => {
      response.writeHead(200, { 'content-type': mimeFor(target), 'cache-control': 'no-store' });
      response.end(body);
    })
    .catch(() => {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    });
});

server.listen(PORT, () => {
  console.log(`kasar dev server: http://localhost:${PORT}/`);
});
