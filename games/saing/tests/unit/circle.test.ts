/**
 * Which drum a tap or a key means. A tap read as the wrong drum breaks the
 * phrase, so this is a rule and is tested like one.
 */

import { describe, expect, it } from 'vitest';

import { CIRCLE, KEYS, angleOf, drumAt, drumForKey } from '../../src/circle.js';

const at = (angle: number, r = 1): readonly [number, number] => [Math.cos(angle) * r, Math.sin(angle) * r];

describe('the circle', () => {
  it('runs low to high from the front left, round the back, to the front right', () => {
    for (let n = 2; n <= 8; n += 1) {
      const [lowX, lowY] = at(angleOf(0, n));
      const [highX, highY] = at(angleOf(n - 1, n));
      expect(lowX).toBeLessThan(0);
      expect(highX).toBeGreaterThan(0);
      // Both ends at the front, either side of the opening.
      expect(lowY).toBeGreaterThan(0);
      expect(highY).toBeGreaterThan(0);
      // And the middle of the run at the back.
      const [, midY] = at(angleOf((n - 1) / 2, n));
      expect(midY).toBeLessThan(0);
    }
  });

  it('reads a tap on any drum as that drum, whatever the size of the circle', () => {
    for (let n = 1; n <= 8; n += 1) {
      for (let i = 0; i < n; i += 1) {
        const [u, v] = at(angleOf(i, n), CIRCLE.inset);
        expect(drumAt(u, v, n)).toBe(i);
      }
    }
  });

  it('reads a tap well wide of a drum as the nearest one, out to the edge of the screen', () => {
    const n = 5;
    for (let i = 0; i + 1 < n; i += 1) {
      const between = (angleOf(i, n) + angleOf(i + 1, n)) / 2;
      expect(drumAt(...at(between - 0.05, 2.5), n)).toBe(i);
      expect(drumAt(...at(between + 0.05, 2.5), n)).toBe(i + 1);
    }
  });

  it('reads a tap in the opening as the drum on that side of it', () => {
    expect(drumAt(...at(Math.PI / 2 + 0.1), 6)).toBe(0);
    expect(drumAt(...at(Math.PI / 2 - 0.1), 6)).toBe(5);
  });

  it('strikes nothing for a tap on him in the middle', () => {
    expect(drumAt(0, 0, 8)).toBeNull();
    expect(drumAt(CIRCLE.dead * 0.9, 0, 8)).toBeNull();
    expect(drumAt(0, 0, 0)).toBeNull();
  });
});

describe('the keys', () => {
  it('run along the home row, low to high', () => {
    KEYS.forEach((key, i) => {
      expect(drumForKey(key, 8)).toBe(i);
      expect(drumForKey(key.toUpperCase(), 8)).toBe(i);
    });
  });

  it('take the number row too', () => {
    expect(drumForKey('1', 8)).toBe(0);
    expect(drumForKey('8', 8)).toBe(7);
    expect(drumForKey('9', 8)).toBeNull();
  });

  it('strike nothing for a drum not in the circle yet', () => {
    expect(drumForKey('f', 3)).toBeNull();
    expect(drumForKey('4', 3)).toBeNull();
    expect(drumForKey('d', 3)).toBe(2);
    expect(drumForKey('q', 8)).toBeNull();
  });
});
