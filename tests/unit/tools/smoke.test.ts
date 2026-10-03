/**
 * How the smoke test tells a game that works from one that does not.
 *
 * Each of these is a way a broken page could still look fine: a canvas that
 * exists but is blank, one that drew once and froze, a shelf missing a card,
 * and — the easiest to miss — a check for errors that was never listening.
 */

import { describe, expect, it } from 'vitest';

import { CATCHER, SAMPLER, cardsMatch, isDrawn, isMoving, noErrors } from '../../../tools/lib/smoke.ts';
import type { Frame } from '../../../tools/lib/smoke.ts';

const frame = (hash: number, colours = 12): Frame => ({ width: 300, height: 150, hash, colours });

describe('drawn', () => {
  it('is a canvas with size and more than one colour', () => {
    expect(isDrawn(frame(1))).toBe(true);
  });

  it('is not a blank one, a missing one, or one with no size', () => {
    expect(isDrawn(frame(1, 1))).toBe(false);
    expect(isDrawn(null)).toBe(false);
    expect(isDrawn({ width: 0, height: 0, hash: 0, colours: 0 })).toBe(false);
  });
});

describe('moving', () => {
  it('is two different pictures a moment apart', () => {
    expect(isMoving(frame(1), frame(2))).toBe(true);
  });

  it('is not one that froze, or one that went blank', () => {
    expect(isMoving(frame(1), frame(1))).toBe(false);
    expect(isMoving(frame(1), frame(2, 1))).toBe(false);
    expect(isMoving(null, frame(2))).toBe(false);
  });
});

describe('errors', () => {
  it('passes none heard', () => {
    expect(noErrors([])).toBe(true);
  });

  it('fails any heard', () => {
    expect(noErrors(['TypeError: x is undefined'])).toBe(false);
  });

  it('fails when nothing was listening, rather than passing for having heard nothing', () => {
    expect(noErrors(null)).toBe(false);
  });
});

describe('the cards on the shelf', () => {
  const games = [
    { id: 'kyo', href: 'games/kyo/' },
    { id: 'hman', href: 'games/hman/' },
  ];

  it('match the manifest one for one, whatever order and however the links are written', () => {
    expect(
      cardsMatch(
        [
          { href: './games/hman/', title: 'Hman' },
          { href: 'games/kyo', title: 'Kyo' },
        ],
        games,
      ),
    ).toBe(true);
  });

  it('do not match with one missing, or one extra', () => {
    expect(cardsMatch([{ href: 'games/kyo/', title: 'Kyo' }], games)).toBe(false);
    expect(
      cardsMatch(
        [
          { href: 'games/kyo/', title: 'Kyo' },
          { href: 'games/hman/', title: 'Hman' },
          { href: 'games/gone/', title: 'Gone' },
        ],
        games,
      ),
    ).toBe(false);
  });
});

describe('what is put in the page', () => {
  it('parses as plain JavaScript, with nothing a template literal would swallow', () => {
    for (const source of [CATCHER, SAMPLER]) {
      expect(() => new Function(source)).not.toThrow();
      expect(source).not.toContain('${');
    }
  });
});
