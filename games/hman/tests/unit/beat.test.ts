/**
 * The timing of a blow.
 *
 * What is being pinned down is the shape the first version got wrong: there
 * has to be a wind-up before anything lands, the hit has to be a moment rather
 * than a smear, and the answer has to stay on screen after it.
 */

import { describe, expect, it } from 'vitest';

import { BLOW, swingAt } from '../../src/beat.js';

const over = (steps = 200): ReturnType<typeof swingAt>[] =>
  Array.from({ length: steps }, (_, i) => swingAt((i / steps) * BLOW * 1.4));

describe('before it lands', () => {
  it('nothing has struck and nothing is shown', () => {
    const early = swingAt(0.05);
    expect(early.struck).toBe(false);
    expect(early.flash).toBe(0);
    expect(early.shake).toBe(0);
    expect(early.caption).toBe(0);
  });

  it('winds up first, so the hit is arriving from somewhere', () => {
    expect(swingAt(0.2).reach).toBeGreaterThan(swingAt(0.05).reach);
  });
});

describe('the moment it lands', () => {
  it('reaches furthest at the impact and comes back after', () => {
    const peak = over().reduce((best, s) => (s.reach > best.reach ? s : best));
    expect(peak.reach).toBeGreaterThan(0.95);
    expect(swingAt(BLOW).reach).toBeLessThan(0.2);
  });

  it('flashes briefly rather than glowing throughout', () => {
    const lit = over().filter((s) => s.flash > 0.1).length;
    expect(lit).toBeGreaterThan(0);
    expect(lit / 200).toBeLessThan(0.2);
  });

  it('shakes and then stops', () => {
    const shakes = over().map((s) => Math.abs(s.shake));
    expect(Math.max(...shakes)).toBeGreaterThan(2);
    expect(Math.abs(swingAt(BLOW).shake)).toBeLessThan(0.5);
  });
});

describe('after it lands', () => {
  it('holds the answer up for the rest of the blow, which is the point', () => {
    expect(swingAt(BLOW * 0.5).caption).toBeGreaterThan(0);
    expect(swingAt(BLOW).caption).toBe(1);
    // Most of a blow is the hold, not the swing.
    const held = over(200).filter((s) => s.caption > 0.9).length;
    expect(held / 200).toBeGreaterThan(0.3);
  });

  it('throws its shards once and lets them run out', () => {
    expect(swingAt(0.1).shards).toBe(0);
    expect(swingAt(BLOW).shards).toBe(1);
  });
});

describe('a harder blow', () => {
  it('shakes more, and a softer one less', () => {
    const t = BLOW * 0.4;
    expect(Math.abs(swingAt(t, 2).shake)).toBeGreaterThan(Math.abs(swingAt(t, 1).shake));
  });
});

describe('past the end', () => {
  it('settles rather than running away', () => {
    for (const s of [swingAt(BLOW * 3), swingAt(99)]) {
      expect(s.caption).toBe(1);
      expect(s.reach).toBeLessThan(0.2);
      expect(Number.isFinite(s.shake)).toBe(true);
    }
  });
});
