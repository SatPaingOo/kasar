/**
 * What goes live.
 *
 * The plan is the list of things a visitor can reach, so the test that
 * matters most is the one proving what is *not* on it: sources, configs,
 * tests, node_modules, and the game.json the manifest was already built from.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { planSite } from '../../../tools/lib/site.ts';

let root: string;

async function file(...parts: string[]): Promise<void> {
  const path = join(root, ...parts);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, 'x');
}

/** A repository that has been built: shelf, one game, and all its leftovers. */
async function built(): Promise<void> {
  await file('index.html');
  await file('games.json');
  await file('dist', 'shell', 'main.js');
  await file('package.json');
  await file('src', 'shell', 'main.ts');
  await file('tests', 'unit', 'shell', 'colour.test.ts');
  await file('node_modules', 'typescript', 'package.json');
  await file('games', 'tazaung', 'index.html');
  await file('games', 'tazaung', 'game.json');
  await file('games', 'tazaung', 'tsconfig.json');
  await file('games', 'tazaung', 'dist', 'main.js');
  await file('games', 'tazaung', 'src', 'game.ts');
  await file('games', 'tazaung', 'tests', 'unit', 'game.test.ts');
}

const paths = (plan: { readonly copies: readonly { readonly from: string }[] }): string[] =>
  plan.copies.map((copy) => copy.from.split(/[\\/]/).join('/'));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'kasar-site-'));
  await mkdir(join(root, 'games'), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('planSite', () => {
  it('takes the shelf, the manifest and the compiled shell', async () => {
    await built();
    expect(paths(await planSite(root))).toEqual(expect.arrayContaining(['index.html', 'games.json', 'dist/shell']));
  });

  it("takes each game's page and its compiled dist, and nothing else of it", async () => {
    await built();
    const taken = paths(await planSite(root));

    expect(taken).toEqual(expect.arrayContaining(['games/tazaung/index.html', 'games/tazaung/dist']));
    expect(taken).not.toContain('games/tazaung/src');
    expect(taken).not.toContain('games/tazaung/game.json');
    expect(taken).not.toContain('games/tazaung/tsconfig.json');
    expect(taken).not.toContain('games/tazaung/tests');
  });

  it('leaves the repository behind', async () => {
    await built();
    const taken = paths(await planSite(root));

    for (const kept of ['package.json', 'src', 'src/shell', 'tests', 'node_modules', 'tools']) {
      expect(taken).not.toContain(kept);
    }
  });

  it('takes a poster when a game has one', async () => {
    await built();
    await file('games', 'tazaung', 'poster.svg');

    expect(paths(await planSite(root))).toContain('games/tazaung/poster.svg');
  });

  it('does not ask for a poster a game has not got', async () => {
    await built();
    const plan = await planSite(root);

    expect(paths(plan)).not.toContain('games/tazaung/poster.svg');
    // And nothing optional is marked required, or a build would fail over one.
    expect(plan.copies.filter((copy) => !copy.required)).toEqual([]);
  });

  it('plans every game, and names them', async () => {
    await built();
    await file('games', 'second', 'index.html');
    await file('games', 'second', 'dist', 'main.js');

    const plan = await planSite(root);
    expect([...plan.games].sort()).toEqual(['second', 'tazaung']);
    expect(paths(plan)).toContain('games/second/index.html');
  });

  it('marks the pieces a site cannot be served without as required', async () => {
    await built();
    const plan = await planSite(root);
    const required = plan.copies.filter((copy) => copy.required).map((copy) => copy.from);

    // A missing one of these is a failed build, not a quiet gap.
    expect(required.length).toBe(plan.copies.length);
  });
});
