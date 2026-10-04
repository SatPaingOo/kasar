/**
 * What the walker's tests share: a seeded random, a frame length, the whole
 * page as the view, and the check that someone is somewhere they can be.
 */

import { expect } from 'vitest';

import type { Roamer } from '../../../src/shell/roam.js';
import { ladderOf, surfaceOf } from '../../../src/shell/world.js';
import type { Box, World } from '../../../src/shell/world.js';

export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const DT = 1 / 30;

/** Why he is not somewhere he can be, or null if he is. Cheap, because it runs every frame. */
function problem(world: World, r: Roamer): string | null {
  if (!Number.isFinite(r.x) || !Number.isFinite(r.y)) return `at ${r.x}, ${r.y}`;
  if (r.mode === 'air') return r.flight === null ? 'in the air with no flight' : null;
  // On his head, or flown off the page: a bird's, and somewhere it can be.
  if (r.mode === 'ride' || r.mode === 'gone') return null;
  if (r.mode === 'climb') {
    const ladder = ladderOf(world, r.ladder ?? '');
    if (ladder === undefined) return `climbing ${r.ladder}, which is not there`;
    if (r.x !== ladder.x) return `climbing at ${r.x}, off ${ladder.id} at ${ladder.x}`;
    if (r.y < ladder.top.y - 0.01 || r.y > ladder.bottom.y + 0.01)
      return `climbing at ${r.y}, past the ends of ${ladder.id}`;
    return null;
  }
  const s = surfaceOf(world, r.surface ?? '');
  if (s === undefined) return `${r.mode} on ${r.surface}, which is not there`;
  if (r.y !== s.y) return `${r.mode} at ${r.y}, not on ${s.id} at ${s.y}`;
  if (r.x < s.x0 - 0.01 || r.x > s.x1 + 0.01) return `${r.mode} at ${r.x}, off the end of ${s.id}`;
  return null;
}

/** Fail unless he is somewhere he can be. */
export function where(world: World, r: Roamer): void {
  const wrong = problem(world, r);
  if (wrong !== null) expect.fail(wrong);
}

/** Long simulations get longer than the default five seconds, especially beside the other test files. */
export const LONG = 60_000;

export const whole = (world: World): Box => ({ left: 0, top: 0, right: world.width, bottom: world.height });
