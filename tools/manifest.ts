/**
 * Builds games.json from each game's own game.json.
 *
 * The point of the shelf is that adding a game is dropping a folder in, so
 * there is no central list to remember to edit. Each game's folder is the
 * only source of truth about it; this just gathers them.
 *
 *   node --experimental-strip-types tools/manifest.ts
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const GAMES = join(ROOT, 'games');

interface Localized {
  readonly en: string;
  readonly my: string;
}

interface GameEntry {
  readonly id: string;
  readonly version: string;
  readonly title: Localized;
  readonly blurb: Localized;
  readonly accent: string;
  readonly year: number;
  /** Where the shell links to. Always the folder, so the game owns its page. */
  readonly href: string;
  readonly poster: string | null;
}

function fail(where: string, why: string): never {
  console.error(`games/${where}/game.json: ${why}`);
  process.exit(1);
}

function localized(value: unknown, where: string, field: string): Localized {
  if (typeof value !== 'object' || value === null) fail(where, `${field} must be { en, my }`);
  const record = value as Record<string, unknown>;
  const en = record['en'];
  const my = record['my'];
  if (typeof en !== 'string' || typeof my !== 'string') {
    fail(where, `${field} needs both en and my`);
  }
  return { en, my };
}

const entries: GameEntry[] = [];
const folders = await readdir(GAMES, { withFileTypes: true });

for (const folder of folders) {
  if (!folder.isDirectory()) continue;

  let raw: string;
  try {
    raw = await readFile(join(GAMES, folder.name, 'game.json'), 'utf8');
  } catch {
    console.warn(`games/${folder.name}: no game.json, skipped`);
    continue;
  }

  const data = JSON.parse(raw) as Record<string, unknown>;
  const id = data['id'];
  const version = data['version'];
  if (typeof id !== 'string') fail(folder.name, 'id must be a string');
  if (typeof version !== 'string') fail(folder.name, 'version must be a string');
  if (id !== folder.name) fail(folder.name, `id "${id}" does not match the folder name`);

  const hasPoster = await readFile(join(GAMES, folder.name, 'poster.svg')).then(
    () => true,
    () => false,
  );
  const poster = hasPoster ? `games/${folder.name}/poster.svg` : null;

  entries.push({
    id,
    version,
    title: localized(data['title'], folder.name, 'title'),
    blurb: localized(data['blurb'], folder.name, 'blurb'),
    accent: typeof data['accent'] === 'string' ? data['accent'] : '#8fa6c8',
    year: typeof data['year'] === 'number' ? data['year'] : new Date().getFullYear(),
    href: `games/${folder.name}/`,
    poster,
  });
}

entries.sort((a, b) => a.id.localeCompare(b.id));
await writeFile(join(ROOT, 'games.json'), `${JSON.stringify({ games: entries }, null, 2)}\n`, 'utf8');
console.log(`games.json: ${entries.length} game${entries.length === 1 ? '' : 's'}`);
