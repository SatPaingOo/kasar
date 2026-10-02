/**
 * Collects exactly what the site is into site/, ready to publish.
 *
 * Deploying the repository as-is would ship node_modules, sources and build
 * configs. This copies only what a browser asks for, which also means
 * `npm run stage` locally shows precisely what is about to go live.
 */

import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { planSite } from './lib/site.ts';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SITE = join(ROOT, 'site');

await rm(SITE, { recursive: true, force: true });
await mkdir(SITE, { recursive: true });

const { copies, games } = await planSite(ROOT);
let missing = 0;

for (const copy of copies) {
  const from = join(ROOT, copy.from);
  const there = await stat(from).then(
    () => true,
    () => false,
  );
  if (!there) {
    if (copy.required) {
      console.error(`missing: ${copy.from} — run the build first`);
      missing += 1;
    }
    continue;
  }

  const to = join(SITE, copy.to);
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
}

console.log(`site/: shell + ${games.length} game${games.length === 1 ? '' : 's'}`);
if (missing > 0) process.exit(1);
