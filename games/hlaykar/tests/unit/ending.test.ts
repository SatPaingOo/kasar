/**
 * The shape of an ending.
 *
 * Only the timing is checked, because only the timing can be wrong in a way
 * that matters: a result card that is readable before the thing it reports has
 * finished happening spoils the one moment the game has.
 */

import { describe, expect, it } from 'vitest';

import { RULES } from '../../src/game.js';
import { beatOf } from '../../src/ending.js';
import type { Outcome } from '../../src/game.js';

const ENDINGS: readonly Outcome[] = ['out', 'drowned', 'crushed', 'buried'];

/** Sample a whole ending, well past the end of it. */
function overTime(outcome: Outcome, steps = 240): ReturnType<typeof beatOf>[] {
  return Array.from({ length: steps }, (_, i) => beatOf(outcome, (i / steps) * 4));
}

describe('while the run is still going', () => {
  it('there is no ending at all', () => {
    const beat = beatOf('playing', 0);
    expect(beat).toEqual({ t: 0, shake: 0, swallow: 0, rise: 0, stride: 0, glow: 0, dark: 0, veil: 0, text: 0 });
  });

  it('and no amount of waiting conjures one', () => {
    expect(beatOf('playing', 99).text).toBe(0);
  });
});

describe('every ending', () => {
  it('starts with nothing shown and finishes fully shown', () => {
    for (const outcome of ENDINGS) {
      expect(beatOf(outcome, 0).veil).toBe(0);
      expect(beatOf(outcome, 0).text).toBe(0);
      expect(beatOf(outcome, 10).veil).toBe(1);
      expect(beatOf(outcome, 10).text).toBe(1);
    }
  });

  it('never lets the words arrive before the curtain', () => {
    for (const outcome of ENDINGS) {
      for (const beat of overTime(outcome)) {
        expect(beat.text).toBeLessThanOrEqual(beat.veil + 1e-9);
      }
    }
  });

  it('keeps the words away until the motion is more than half done', () => {
    for (const outcome of ENDINGS) {
      expect(beatOf(outcome, 0).text).toBe(0);
      // Half way through, the player should still be watching, not reading.
      const half = overTime(outcome).find((b) => b.t >= 0.5);
      expect(half?.text).toBe(0);
    }
  });

  it('settles rather than running away once it is done', () => {
    for (const outcome of ENDINGS) {
      for (const beat of overTime(outcome)) {
        expect(beat.t).toBeLessThanOrEqual(1);
        expect(beat.veil).toBeLessThanOrEqual(1);
        expect(beat.text).toBeLessThanOrEqual(1);
        expect(Number.isFinite(beat.shake)).toBe(true);
      }
    }
  });
});

describe('each ending does its own thing and not the others', () => {
  it('carries him up and out when he gets over the rim', () => {
    const end = beatOf('out', 10);
    expect(end.stride).toBeGreaterThan(4);
    expect(end.rise).toBe(0);
    expect(end.glow).toBe(1);
    expect(end.swallow).toBe(0);
    expect(end.dark).toBe(0);
  });

  it('closes the water right over him when it takes him', () => {
    const end = beatOf('drowned', 10);
    expect(end.swallow).toBeGreaterThan(RULES.rows);
    expect(end.stride).toBe(0);
    expect(end.glow).toBe(0);
  });

  it('shakes when the stone lands, and stops shaking', () => {
    const shakes = overTime('crushed').map((b) => Math.abs(b.shake));
    expect(Math.max(...shakes.slice(0, 30))).toBeGreaterThan(2);
    expect(beatOf('crushed', 10).shake).toBe(0);
  });

  it('puts out the light when the shaft fills', () => {
    const end = beatOf('buried', 10);
    expect(end.dark).toBe(1);
    expect(end.glow).toBe(0);
    expect(end.stride).toBe(0);
  });
});
