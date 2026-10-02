/**
 * Reading what the games say about themselves.
 *
 * Split out of the script that writes games.json so the validation — the part
 * that decides whether a game is describable at all — can be tested against
 * real folders rather than inferred from a build log.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface Localized {
  readonly en: string;
  readonly my: string;
}

export interface GameEntry {
  readonly id: string;
  readonly version: string;
  readonly title: Localized;
  readonly blurb: Localized;
  readonly accent: string;
  readonly year: number;
  /** Where the shelf links to. Always the folder, so the game owns its page. */
  readonly href: string;
  readonly poster: string | null;
}

export interface Problem {
  readonly folder: string;
  readonly why: string;
}

export interface Reading {
  readonly entries: readonly GameEntry[];
  readonly problems: readonly Problem[];
  /** Folders with no game.json at all: skipped, not an error. */
  readonly skipped: readonly string[];
}

const DEFAULT_ACCENT = '#8fa6c8';

function localized(value: unknown): Localized | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const en = record['en'];
  const my = record['my'];
  if (typeof en !== 'string' || typeof my !== 'string') return null;
  return { en, my };
}

async function present(path: string): Promise<boolean> {
  return readFile(path).then(
    () => true,
    () => false,
  );
}

/** Every game under `gamesDir`, in id order, with whatever could not be read. */
export async function readGames(gamesDir: string, thisYear = new Date().getFullYear()): Promise<Reading> {
  const entries: GameEntry[] = [];
  const problems: Problem[] = [];
  const skipped: string[] = [];

  const folders = await readdir(gamesDir, { withFileTypes: true });

  for (const folder of folders) {
    if (!folder.isDirectory()) continue;

    let raw: string;
    try {
      raw = await readFile(join(gamesDir, folder.name, 'game.json'), 'utf8');
    } catch {
      skipped.push(folder.name);
      continue;
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      problems.push({ folder: folder.name, why: 'game.json is not valid JSON' });
      continue;
    }

    const id = data['id'];
    const version = data['version'];
    const title = localized(data['title']);
    const blurb = localized(data['blurb']);

    if (typeof id !== 'string') {
      problems.push({ folder: folder.name, why: 'id must be a string' });
      continue;
    }
    if (id !== folder.name) {
      problems.push({ folder: folder.name, why: `id "${id}" does not match the folder name` });
      continue;
    }
    if (typeof version !== 'string') {
      problems.push({ folder: folder.name, why: 'version must be a string' });
      continue;
    }
    if (title === null) {
      problems.push({ folder: folder.name, why: 'title needs both en and my' });
      continue;
    }
    if (blurb === null) {
      problems.push({ folder: folder.name, why: 'blurb needs both en and my' });
      continue;
    }

    const hasPoster = await present(join(gamesDir, folder.name, 'poster.svg'));

    entries.push({
      id,
      version,
      title,
      blurb,
      accent: typeof data['accent'] === 'string' ? data['accent'] : DEFAULT_ACCENT,
      year: typeof data['year'] === 'number' ? data['year'] : thisYear,
      href: `games/${folder.name}/`,
      poster: hasPoster ? `games/${folder.name}/poster.svg` : null,
    });
  }

  entries.sort((a, b) => a.id.localeCompare(b.id));
  return { entries, problems, skipped };
}
