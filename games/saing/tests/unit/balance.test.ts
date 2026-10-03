/**
 * The balance, settled by simulation. Each of these plays whole pieces
 * against the real rules with a pair of made-up hands — see bots.ts — and
 * the numbers they assert are the ones the README reports.
 *
 * What it is meant to say: the hardware a player happens to have does not
 * decide whether they can finish; a sloppy rhythm and a short memory do; and
 * neither guessing nor knowing the notes but not the rhythm gets anywhere.
 */

import { describe, expect, it } from 'vitest';

import { flail, play, rush } from './bots.js';
import type { Hands } from './bots.js';

const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);

const finished = (hands: Hands): number => SEEDS.filter((seed) => play(seed, hands).finished).length;
const keptOn = (hands: Hands): number => SEEDS.reduce((sum, seed) => sum + play(seed, hands).kept, 0) / SEEDS.length;

describe('whatever the hardware', () => {
  it('a steady player at a desk finishes every time', () => {
    expect(finished({ lateness: 0.01, jitter: 0.03 })).toBe(SEEDS.length);
  });

  it('so does the same player on a phone, a tenth of a second behind', () => {
    expect(finished({ lateness: 0.09, jitter: 0.04 })).toBe(SEEDS.length);
  });

  it('and through Bluetooth headphones, a fifth of a second behind that', () => {
    expect(finished({ lateness: 0.22, jitter: 0.04 })).toBe(SEEDS.length);
  });
});

describe('what the game is about', () => {
  it('a shaky rhythm gets most of the way, and mostly through', () => {
    const shaky = { lateness: 0.05, jitter: 0.08 };
    expect(finished(shaky)).toBeGreaterThan(SEEDS.length * 0.5);
    expect(finished(shaky)).toBeLessThan(SEEDS.length);
  });

  it('a rhythm all over the place does not get through', () => {
    expect(finished({ lateness: 0.05, jitter: 0.12 })).toBeLessThanOrEqual(2);
  });

  it('a memory of five notes gets about half way and no further', () => {
    const short = { lateness: 0.03, jitter: 0.035, memory: 5, learns: 2 };
    expect(finished(short)).toBe(0);
    expect(keptOn(short)).toBeGreaterThan(8);
    expect(keptOn(short)).toBeLessThan(16);
  });

  it('a memory of nine gets through', () => {
    expect(finished({ lateness: 0.03, jitter: 0.035, memory: 9, learns: 2 })).toBeGreaterThanOrEqual(SEEDS.length - 1);
  });
});

describe('what does not work', () => {
  it('striking at random never keeps more than one phrase', () => {
    for (const seed of SEEDS) expect(flail(seed).kept).toBeLessThanOrEqual(1);
  });

  it('knowing the notes but not the rhythm keeps none', () => {
    for (const seed of SEEDS) expect(rush(seed).kept).toBe(0);
  });
});
