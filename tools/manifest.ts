/**
 * Builds games.json from each game's own game.json.
 *
 * The point of the shelf is that adding a game is dropping a folder in, so
 * there is no central list to remember to edit. Each game's folder is the
 * only source of truth about it; this just gathers them.
 *
 *   node --experimental-strip-types tools/manifest.ts
 */

import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readGames } from './lib/manifest.ts';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const { entries, problems, skipped } = await readGames(join(ROOT, 'games'));

for (const folder of skipped) console.warn(`games/${folder}: no game.json, skipped`);
for (const problem of problems) console.error(`games/${problem.folder}/game.json: ${problem.why}`);
if (problems.length > 0) process.exit(1);

await writeFile(join(ROOT, 'games.json'), `${JSON.stringify({ games: entries }, null, 2)}\n`, 'utf8');
console.log(`games.json: ${entries.length} game${entries.length === 1 ? '' : 's'}`);
