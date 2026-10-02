/**
 * What the shelf will and will not accept as a game.
 *
 * Built against real folders in a temporary directory rather than a mocked
 * filesystem: the thing under test is reading a directory, so mocking it
 * would only prove the mock works.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readGames } from '../../../tools/lib/manifest.ts';

let games: string;

const COMPLETE = {
  id: 'tazaung',
  version: '0.1.0',
  title: { en: 'Tazaung', my: 'တန်ဆောင်' },
  blurb: { en: 'Relight the sky', my: 'ကောင်းကင်ကို ပြန်ထွန်းပါ' },
  accent: '#f0d2a8',
  year: 2026,
};

async function game(folder: string, data: unknown, extra?: { readonly poster?: boolean }): Promise<void> {
  const dir = join(games, folder);
  await mkdir(dir, { recursive: true });
  if (data !== undefined) {
    await writeFile(join(dir, 'game.json'), typeof data === 'string' ? data : JSON.stringify(data));
  }
  if (extra?.poster === true) await writeFile(join(dir, 'poster.svg'), '<svg/>');
}

beforeEach(async () => {
  games = join(await mkdtemp(join(tmpdir(), 'kasar-')), 'games');
  await mkdir(games, { recursive: true });
});

afterEach(async () => {
  await rm(games, { recursive: true, force: true });
});

describe('readGames', () => {
  it('describes a complete game, and links to its folder', async () => {
    await game('tazaung', COMPLETE);
    const { entries, problems } = await readGames(games);

    expect(problems).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'tazaung',
      version: '0.1.0',
      href: 'games/tazaung/',
      accent: '#f0d2a8',
      poster: null,
    });
  });

  it('finds a poster when there is one, and does not invent one when there is not', async () => {
    await game('withposter', { ...COMPLETE, id: 'withposter' }, { poster: true });
    await game('without', { ...COMPLETE, id: 'without' });

    const { entries } = await readGames(games);
    const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry.poster]));

    expect(byId['withposter']).toBe('games/withposter/poster.svg');
    expect(byId['without']).toBeNull();
  });

  it('refuses an id that does not match the folder it is in', async () => {
    // The href is built from the folder, so a mismatch would link nowhere.
    await game('tazaung', { ...COMPLETE, id: 'something-else' });
    const { entries, problems } = await readGames(games);

    expect(entries).toEqual([]);
    expect(problems[0]?.why).toContain('does not match the folder name');
  });

  it('refuses a title or blurb missing either language', async () => {
    await game('one', { ...COMPLETE, id: 'one', title: { en: 'One' } });
    await game('two', { ...COMPLETE, id: 'two', blurb: { my: 'နှစ်' } });

    const { entries, problems } = await readGames(games);
    expect(entries).toEqual([]);
    expect(Object.fromEntries(problems.map((problem) => [problem.folder, problem.why]))).toEqual({
      one: 'title needs both en and my',
      two: 'blurb needs both en and my',
    });
  });

  it('refuses a missing or non-string version', async () => {
    await game('tazaung', { ...COMPLETE, version: 1 });
    const { problems } = await readGames(games);
    expect(problems[0]?.why).toBe('version must be a string');
  });

  it('reports broken JSON instead of throwing', async () => {
    await game('tazaung', '{ not json');
    const { entries, problems } = await readGames(games);

    expect(entries).toEqual([]);
    expect(problems[0]?.why).toBe('game.json is not valid JSON');
  });

  it('skips a folder with no game.json rather than failing the build', async () => {
    await game('scratch', undefined);
    await game('tazaung', COMPLETE);

    const { entries, problems, skipped } = await readGames(games);
    expect(problems).toEqual([]);
    expect(skipped).toEqual(['scratch']);
    expect(entries).toHaveLength(1);
  });

  it('fills in an accent and a year when they are left out', async () => {
    const { accent, year, ...rest } = COMPLETE;
    expect(accent).toBeTruthy();
    expect(year).toBeTruthy();

    await game('tazaung', rest);
    const { entries } = await readGames(games, 2031);

    expect(entries[0]?.accent).toBe('#8fa6c8');
    expect(entries[0]?.year).toBe(2031);
  });

  it('returns games in a stable order whatever the directory gives back', async () => {
    await game('zebra', { ...COMPLETE, id: 'zebra' });
    await game('alpha', { ...COMPLETE, id: 'alpha' });
    await game('middle', { ...COMPLETE, id: 'middle' });

    const { entries } = await readGames(games);
    expect(entries.map((entry) => entry.id)).toEqual(['alpha', 'middle', 'zebra']);
  });

  it('keeps the good games when one of them is broken', async () => {
    await game('good', { ...COMPLETE, id: 'good' });
    await game('bad', { ...COMPLETE, id: 'wrong' });

    const { entries, problems } = await readGames(games);
    expect(entries.map((entry) => entry.id)).toEqual(['good']);
    expect(problems).toHaveLength(1);
  });
});
