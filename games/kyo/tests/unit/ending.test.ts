/**
 * The shape of an ending.
 *
 * Only the timing is checked, because only the timing can be wrong in a way
 * that matters: a result card readable before the thing it reports has
 * finished happening spoils the one moment the run has.
 */

import { describe, expect, it } from 'vitest';

import { beatOf } from '../../src/ending.js';
import type { Outcome } from '../../src/game.js';

const ENDINGS: readonly Outcome[] = ['across', 'fallen'];

function overTime(outcome: Outcome, steps = 240): ReturnType<typeof beatOf>[] {
  return Array.from({ length: steps }, (_, i) => beatOf(outcome, (i / steps) * 4));
}

describe('while he is still swinging', () => {
  it('there is no ending at all', () => {
    expect(beatOf('swinging', 0)).toEqual({
      t: 0,
      shake: 0,
      puff: 0,
      coast: 0,
      glow: 0,
      dim: 0,
      veil: 0,
      text: 0,
    });
  });

  it('and no amount of waiting conjures one', () => {
    expect(beatOf('swinging', 99).text).toBe(0);
  });
});

describe('both endings', () => {
  it('start with nothing shown and finish fully shown', () => {
    for (const outcome of ENDINGS) {
      expect(beatOf(outcome, 0).veil).toBe(0);
      expect(beatOf(outcome, 0).text).toBe(0);
      expect(beatOf(outcome, 10).veil).toBe(1);
      expect(beatOf(outcome, 10).text).toBe(1);
    }
  });

  it('never let the words arrive before the curtain', () => {
    for (const outcome of ENDINGS) {
      for (const beat of overTime(outcome)) {
        expect(beat.text).toBeLessThanOrEqual(beat.veil + 1e-9);
      }
    }
  });

  it('keep the words away until the motion is more than half done', () => {
    for (const outcome of ENDINGS) {
      const half = overTime(outcome).find((b) => b.t >= 0.5);
      expect(half?.text).toBe(0);
    }
  });

  it('settle rather than running away once they are done', () => {
    for (const outcome of ENDINGS) {
      for (const beat of overTime(outcome)) {
        expect(beat.t).toBeLessThanOrEqual(1);
        expect(beat.veil).toBeLessThanOrEqual(1);
        expect(beat.puff).toBeLessThanOrEqual(1);
        expect(Number.isFinite(beat.shake)).toBe(true);
      }
    }
  });
});

describe('each ending does its own thing and not the other', () => {
  it('sails him on into the light when he is across', () => {
    const end = beatOf('across', 10);
    expect(end.coast).toBeGreaterThan(10);
    expect(end.glow).toBe(1);
    expect(end.dim).toBe(0);
    expect(end.puff).toBe(0);
    expect(end.shake).toBe(0);
  });

  it('shakes and throws dust when he hits the floor, and then stops', () => {
    const shakes = overTime('fallen').map((b) => Math.abs(b.shake));
    expect(Math.max(...shakes.slice(0, 30))).toBeGreaterThan(2);
    // Math.abs, because the shake decays to a negative zero as often as not.
    expect(Math.abs(beatOf('fallen', 10).shake)).toBe(0);
    expect(beatOf('fallen', 10).dim).toBeGreaterThan(0.5);
    expect(beatOf('fallen', 10).glow).toBe(0);
  });

  it('blooms the dust early and lets it hang, rather than ending with it', () => {
    const puffs = overTime('fallen').map((b) => b.puff);
    const peak = Math.max(...puffs);
    const whenPeak = puffs.indexOf(peak) / puffs.length;
    expect(peak).toBeGreaterThan(0.6);
    // Early: a cloud that is still growing when the card appears reads as a
    // loading spinner rather than as an impact.
    expect(whenPeak).toBeLessThan(0.18);
  });
});
