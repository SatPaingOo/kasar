/**
 * Collects exactly what the site is into site/, ready to publish.
 *
 * Deploying the repository as-is would ship node_modules, sources and build
 * configs. This copies only what a browser asks for, which also means
 * `npm run stage` locally shows precisely what is about to go live.
 *
 * A game contributes its own page, its compiled dist/ and its poster if it
 * has one — nothing else, and nothing it has to declare.
 */

import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SITE = join(ROOT, 'site');
const GAMES = join(ROOT, 'games');

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copy(from: string, to: string, what: string): Promise<boolean> {
  if (!(await exists(from))) {
    console.error(`missing: ${what} — run the build first`);
    return false;
  }
  await cp(from, to, { recursive: true });
  return true;
}

await rm(SITE, { recursive: true, force: true });
await mkdir(SITE, { recursive: true });

let ok = true;
ok = (await copy(join(ROOT, 'index.html'), join(SITE, 'index.html'), 'index.html')) && ok;
ok = (await copy(join(ROOT, 'games.json'), join(SITE, 'games.json'), 'games.json')) && ok;
ok = (await copy(join(ROOT, 'dist', 'shell'), join(SITE, 'dist', 'shell'), 'dist/shell')) && ok;

const folders = await readdir(GAMES, { withFileTypes: true });
let staged = 0;

for (const folder of folders) {
  if (!folder.isDirectory()) continue;
  const from = join(GAMES, folder.name);
  const to = join(SITE, 'games', folder.name);
  await mkdir(to, { recursive: true });

  ok = (await copy(join(from, 'index.html'), join(to, 'index.html'), `games/${folder.name}/index.html`)) && ok;
  ok = (await copy(join(from, 'dist'), join(to, 'dist'), `games/${folder.name}/dist`)) && ok;

  const poster = join(from, 'poster.svg');
  if (await exists(poster)) await cp(poster, join(to, 'poster.svg'));
  staged += 1;
}

console.log(`site/: shell + ${staged} game${staged === 1 ? '' : 's'}`);
if (!ok) process.exit(1);
