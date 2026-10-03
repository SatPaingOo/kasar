/**
 * The walk cycle. Where he goes is roam.test.ts now; this is only that his
 * feet carry him the way he is going rather than moonwalk him there.
 */

import { describe, expect, it } from 'vitest';

import { footAt } from '../../../src/shell/walk.js';

describe('the walk cycle', () => {
  const SAMPLES = 720;
  const at = (i: number): number => ((i / SAMPLES) * Math.PI * 2) % (Math.PI * 2);

  it('lifts the foot that is swinging forwards', () => {
    for (let i = 0; i < SAMPLES; i += 1) {
      const here = footAt(at(i));
      const next = footAt(at(i + 1));
      // Excluding the two instants it touches down and leaves the ground.
      const turning = Math.abs(here.reach) > 0.999;
      if (!turning && next.reach > here.reach) expect(here.lift).toBeGreaterThan(0);
    }
  });

  it('plants the foot travelling backwards, which is the half that carries him', () => {
    for (let i = 0; i < SAMPLES; i += 1) {
      const here = footAt(at(i));
      const next = footAt(at(i + 1));
      if (next.reach < here.reach) expect(here.lift).toBe(0);
    }
  });

  it('lands the foot at the front of the stride and leaves it at the back', () => {
    expect(footAt(0)).toEqual({ reach: 1, lift: 0 });
    expect(footAt(Math.PI).reach).toBeCloseTo(-1);
    expect(footAt(Math.PI).lift).toBe(0);
  });

  it('never has him in the air: one of the two feet is always down', () => {
    for (let i = 0; i < SAMPLES; i += 1) {
      const phase = at(i);
      expect(footAt(phase).lift === 0 || footAt(phase + Math.PI).lift === 0).toBe(true);
    }
  });
});
