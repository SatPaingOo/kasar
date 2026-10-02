/**
 * Deciding what the site is.
 *
 * Split out of the script that copies it so what goes live can be asserted
 * directly. Everything not on this list stays behind: sources, build configs,
 * node_modules, tests, the game.json the manifest was built from.
 */

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface Copy {
  /** Relative to the repository root. */
  readonly from: string;
  /** Relative to the site root, and therefore the URL it is served at. */
  readonly to: string;
  /** Missing required pieces are a failed build, not a quiet gap. */
  readonly required: boolean;
}

export interface Plan {
  readonly copies: readonly Copy[];
  readonly games: readonly string[];
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

/** What to copy, in order, for the repository rooted at `root`. */
export async function planSite(root: string): Promise<Plan> {
  const copies: Copy[] = [
    { from: 'index.html', to: 'index.html', required: true },
    { from: 'games.json', to: 'games.json', required: true },
    { from: join('dist', 'shell'), to: join('dist', 'shell'), required: true },
  ];
  const games: string[] = [];

  const gamesDir = join(root, 'games');
  const folders = await readdir(gamesDir, { withFileTypes: true });

  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    const here = join('games', folder.name);

    copies.push({ from: join(here, 'index.html'), to: join(here, 'index.html'), required: true });
    copies.push({ from: join(here, 'dist'), to: join(here, 'dist'), required: true });

    // A poster is optional: without one the card shows the title on the
    // game's own colour, which is a card and not a gap.
    if (await exists(join(root, here, 'poster.svg'))) {
      copies.push({ from: join(here, 'poster.svg'), to: join(here, 'poster.svg'), required: false });
    }

    games.push(folder.name);
  }

  return { copies, games };
}
