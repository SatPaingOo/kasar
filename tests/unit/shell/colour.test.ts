/**
 * The accent on a card comes from the game's own game.json, so these run on
 * a value the shelf did not choose. Getting the contrast wrong leaves a title
 * unreadable on its own poster.
 */

import { describe, expect, it } from 'vitest';

import { brightness, deepen, deepenTo, inkOn, luminance, parseHex } from '../../../src/shell/colour.js';

describe('parseHex', () => {
  it('reads both the short and the long form, with or without the hash', () => {
    expect(parseHex('#f0d2a8')).toEqual([0xf0, 0xd2, 0xa8]);
    expect(parseHex('f0d2a8')).toEqual([0xf0, 0xd2, 0xa8]);
    expect(parseHex('#fa8')).toEqual([0xff, 0xaa, 0x88]);
  });

  it('falls back rather than producing NaN from a value it cannot read', () => {
    // A card with a NaN colour renders as nothing at all; a dull one renders.
    for (const bad of ['', '#', 'rgb(1,2,3)', '#12345', 'zzzzzz', '#ggg']) {
      const parsed = parseHex(bad);
      expect(parsed.every((channel) => Number.isInteger(channel))).toBe(true);
      expect(parsed).toEqual([143, 166, 200]);
    }
  });
});

describe('inkOn', () => {
  it('puts dark ink on a light accent and light ink on a dark one', () => {
    expect(inkOn('#f0d2a8')).toBe('#171a24');
    expect(inkOn('#ffffff')).toBe('#171a24');
    expect(inkOn('#1d6f86')).toBe('#f4f7ff');
    expect(inkOn('#000000')).toBe('#f4f7ff');
  });

  it('judges by brightness, not by how large the channels are', () => {
    // Pure blue is dark despite a full channel; pure green is light.
    expect(inkOn('#0000ff')).toBe('#f4f7ff');
    expect(inkOn('#00ff00')).toBe('#171a24');
  });

  it('is readable either way for every accent on the shelf', () => {
    for (const accent of ['#f0d2a8', '#8fa6c8', '#1d6f86', '#2f7a43', '#b8560f']) {
      const ink = inkOn(accent);
      const gap = Math.abs(luminance(accent) - luminance(ink));
      expect(gap).toBeGreaterThan(0.25);
    }
  });
});

describe('deepen', () => {
  it('returns a darker partner, so a poster is a gradient and not a slab', () => {
    for (const accent of ['#f0d2a8', '#8fa6c8', '#1d6f86', '#2f7a43', '#b8560f']) {
      expect(brightness(deepenTo(accent))).toBeLessThan(luminance(accent));
    }
  });

  it('produces a colour the browser will accept', () => {
    expect(deepen('#f0d2a8')).toMatch(/^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/);
  });

  it('never goes fully black, so the gradient still reads as a colour', () => {
    expect(deepenTo('#000000').every((channel) => channel > 0)).toBe(true);
  });
});
