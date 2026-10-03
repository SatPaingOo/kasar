/**
 * What an answer can be, and when two of them are the same.
 *
 * Strict about shape on purpose, because being told that `4` is not `[4]` and
 * not `"4"` is a large part of what the early rungs teach.
 */

import { describe, expect, it } from 'vitest';

import { callOf, clean, inspect, same, show, typeOf } from '../../src/values.js';

describe('comparing two answers', () => {
  it('accepts the same number, word, yes-or-no, list and record', () => {
    expect(same(4, 4)).toBe(true);
    expect(same('aung', 'aung')).toBe(true);
    expect(same(true, true)).toBe(true);
    expect(same([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(same({ name: 'aung', power: 5 }, { name: 'aung', power: 5 })).toBe(true);
  });

  it('does not mind the order of a record’s keys', () => {
    expect(same({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('does mind the order of a list', () => {
    expect(same([1, 2], [2, 1])).toBe(false);
  });

  it('refuses a right value in the wrong shape', () => {
    expect(same(4, [4])).toBe(false);
    expect(same([4], 4)).toBe(false);
    expect(same(4, '4')).toBe(false);
    expect(same(1, true)).toBe(false);
    expect(same({ 0: 1 }, [1])).toBe(false);
  });

  it('refuses a record with a key missing or a key extra', () => {
    expect(same({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(same({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('forgives floating point, because 0.1 + 0.2 is right', () => {
    expect(same(0.1 + 0.2, 0.3)).toBe(true);
    expect(same(0.3, 0.31)).toBe(false);
  });

  it('refuses nothing at all', () => {
    expect(same(null, 4)).toBe(false);
    expect(same(4, null)).toBe(false);
  });
});

describe('cleaning what came back', () => {
  it('keeps anything JSON could carry', () => {
    expect(clean([1, 'a', true, { b: [2] }])).toEqual([1, 'a', true, { b: [2] }]);
  });

  it('refuses what an answer cannot be', () => {
    expect(clean(undefined)).toBeNull();
    expect(clean(Number.NaN)).toBeNull();
    expect(clean(Number.POSITIVE_INFINITY)).toBeNull();
    expect(clean(new Set([1]))).toBeNull();
    expect(clean(new Map())).toBeNull();
    expect(clean(() => 1)).toBeNull();
    expect(clean([1, undefined])).toBeNull();
  });

  it('refuses something nested too deep to be an answer', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 20; i += 1) deep = [deep];
    expect(clean(deep)).toBeNull();
  });
});

describe('showing a value', () => {
  it('writes it the way code would', () => {
    expect(show([1, 2])).toBe('[1, 2]');
    expect(show('aung')).toBe('"aung"');
    expect(show({ name: 'aung', power: 5 })).toBe('{ name: "aung", power: 5 }');
    expect(show({})).toBe('{}');
    expect(show(undefined)).toBe('undefined');
    expect(show(Number.NaN)).toBe('NaN');
    expect(show(new Set([1, 2]))).toBe('Set {1, 2}');
  });

  it('cuts the middle out of something long, rather than running off the edge', () => {
    const long = show(
      Array.from({ length: 100 }, (_, i) => i),
      30,
    );
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long).toContain('…');
  });

  it('writes a call as a call', () => {
    expect(callOf([[4, 9, 2]])).toBe('strike([4, 9, 2])');
    expect(callOf([5, 1, 9])).toBe('strike(5, 1, 9)');
  });
});

describe('the type of a value, in TypeScript’s words', () => {
  it('names the simple ones', () => {
    expect(typeOf(4)).toBe('number');
    expect(typeOf('a')).toBe('string');
    expect(typeOf(true)).toBe('boolean');
    expect(typeOf(undefined)).toBe('undefined');
    expect(typeOf(Number.NaN)).toBe('NaN');
  });

  it('names lists by what is in them', () => {
    expect(typeOf([1, 2])).toBe('number[]');
    expect(typeOf(['a'])).toBe('string[]');
    expect(typeOf([1, 'a'])).toBe('(number | string)[]');
    expect(typeOf([[1]])).toBe('number[][]');
    expect(typeOf([])).toBe('[]');
  });

  it('names records and sets', () => {
    expect(typeOf({ name: 'a', power: 1 })).toBe('{ name: string; power: number }');
    expect(typeOf(new Set([1]))).toBe('Set<number>');
  });

  it('comes back together with the value and how it reads', () => {
    expect(inspect([1])).toEqual({ value: [1], seen: '[1]', type: 'number[]' });
    expect(inspect(undefined)).toEqual({ value: null, seen: 'undefined', type: 'undefined' });
  });
});
