/**
 * The wreckage, headlessly.
 *
 * Drawing a mote is not worth testing; the two things that are, are that the
 * array cannot grow without bound and that nothing escapes the shaft.
 */

import { describe, expect, it } from 'vitest';

import { RULES } from '../../src/game.js';
import { burst, stepMotes } from '../../src/dust.js';
import type { Mote } from '../../src/dust.js';

/** Deterministic, and not 0 or 1, so nothing lands on a boundary by luck. */
function rolls(): () => number {
  let i = 0;
  const values = [0.1, 0.37, 0.62, 0.84, 0.29, 0.55, 0.71, 0.46];
  return () => values[i++ % values.length] ?? 0.5;
}

describe('a burst', () => {
  it('throws both chips and dust, because a breaking stone is both', () => {
    const motes = burst([], [[10, 4]], rolls());
    expect(motes.some((m) => m.chip)).toBe(true);
    expect(motes.some((m) => !m.chip)).toBe(true);
  });

  it('comes off the cells it was given and nowhere else', () => {
    const motes = burst([], [[10, 4]], rolls());
    for (const mote of motes) {
      expect(mote.col).toBeGreaterThanOrEqual(3.9);
      expect(mote.col).toBeLessThanOrEqual(5.1);
      expect(mote.row).toBeGreaterThanOrEqual(9.9);
      expect(mote.row).toBeLessThanOrEqual(11.1);
    }
  });

  it('scales with how much was broken', () => {
    const one = burst([], [[10, 4]], rolls()).length;
    const three = burst(
      [],
      [
        [10, 3],
        [10, 4],
        [11, 4],
      ],
      rolls(),
    ).length;
    expect(three).toBe(one * 3);
  });

  it('refuses to grow without bound, however hard it is hammered', () => {
    const motes: Mote[] = [];
    for (let i = 0; i < 400; i += 1) burst(motes, [[8, 4]], rolls());
    expect(motes.length).toBeLessThanOrEqual(260);
  });
});

describe('settling', () => {
  it('clears everything once it has had its time', () => {
    const motes = burst([], [[10, 4]], rolls());
    expect(motes.length).toBeGreaterThan(0);
    for (let i = 0; i < 200; i += 1) stepMotes(motes, 1 / 60);
    expect(motes).toHaveLength(0);
  });

  it('keeps the chips inside the shaft instead of dropping them out of it', () => {
    const motes = burst([], [[RULES.rows - 1, 4]], rolls());
    for (let i = 0; i < 90; i += 1) {
      stepMotes(motes, 1 / 60);
      for (const mote of motes) expect(mote.row).toBeLessThanOrEqual(RULES.rows);
    }
  });

  it('moves them, rather than leaving them where they started', () => {
    const motes = burst([], [[8, 4]], rolls());
    const before = motes.map((m) => `${m.col},${m.row}`);
    for (let i = 0; i < 10; i += 1) stepMotes(motes, 1 / 60);
    const after = motes.map((m) => `${m.col},${m.row}`);
    expect(after).not.toEqual(before.slice(0, after.length));
  });

  it('does nothing at all to an empty sky', () => {
    expect(stepMotes([], 0.5)).toHaveLength(0);
  });
});
