/**
 * Reading the signature.
 *
 * Only the types the ladder uses are understood, and anything else must come
 * back as null — unchecked — rather than as a guess. A wrong guess here would
 * tell someone with a right answer that they had broken a promise.
 */

import { describe, expect, it } from 'vitest';

import { fits, parseType, readSignature } from '../../src/types.js';

describe('reading a type', () => {
  it('reads the simple ones', () => {
    expect(parseType('number')).toEqual({ kind: 'number' });
    expect(parseType(' string ')).toEqual({ kind: 'string' });
    expect(parseType('boolean')).toEqual({ kind: 'boolean' });
  });

  it('reads lists, including lists of lists and readonly ones', () => {
    expect(parseType('number[]')).toEqual({ kind: 'list', of: { kind: 'number' } });
    expect(parseType('number[][]')).toEqual({ kind: 'list', of: { kind: 'list', of: { kind: 'number' } } });
    expect(parseType('readonly string[]')).toEqual({ kind: 'list', of: { kind: 'string' } });
  });

  it('reads a record type and a Record', () => {
    expect(parseType('{ name: string; power: number }')).toEqual({
      kind: 'object',
      fields: [
        ['name', { kind: 'string' }],
        ['power', { kind: 'number' }],
      ],
    });
    expect(parseType('Record<string, number>')).toEqual({ kind: 'record', of: { kind: 'number' } });
  });

  it('reads a name declared above', () => {
    const aliases = { Fighter: '{ name: string; power: number }' };
    expect(parseType('Fighter[]', aliases)?.kind).toBe('list');
  });

  it('gives up, rather than guessing, at anything it does not know', () => {
    expect(parseType('number | string')).toBeNull();
    expect(parseType('Map<string, number>')).toBeNull();
    expect(parseType('Unknown')).toBeNull();
    expect(parseType('')).toBeNull();
  });
});

describe('reading a signature', () => {
  it('finds the parameters and what it promises to give back', () => {
    const sig = readSignature('function strike(n: number, low: number, high: number): boolean');
    expect(sig.params.map((p) => p.name)).toEqual(['n', 'low', 'high']);
    expect(sig.returnsText).toBe('boolean');
    expect(sig.returns).toEqual({ kind: 'boolean' });
    expect(sig.head).toBe('function strike(n: number, low: number, high: number): boolean');
  });

  it('does not split a parameter at a comma inside its type', () => {
    const sig = readSignature('function strike(counts: Record<string, number>, k: string): number');
    expect(sig.params.map((p) => p.name)).toEqual(['counts', 'k']);
    expect(sig.params[0]?.type).toEqual({ kind: 'record', of: { kind: 'number' } });
  });

  it('keeps type aliases above the function as lines of their own', () => {
    const sig = readSignature(
      'type Fighter = { name: string; power: number };\nfunction strike(crew: Fighter[]): string[]',
    );
    expect(sig.above).toHaveLength(1);
    expect(sig.params[0]?.type?.kind).toBe('list');
    expect(sig.returns).toEqual({ kind: 'list', of: { kind: 'string' } });
  });
});

describe('keeping the promise', () => {
  it('holds a value to its type', () => {
    expect(fits(4, { kind: 'number' })).toBe(true);
    expect(fits('4', { kind: 'number' })).toBe(false);
    expect(fits([1, 2], parseType('number[]'))).toBe(true);
    expect(fits([1, '2'], parseType('number[]'))).toBe(false);
    expect(fits(4, parseType('number[]'))).toBe(false);
    expect(fits({ name: 'a', power: 1 }, parseType('{ name: string; power: number }'))).toBe(true);
    expect(fits({ name: 'a' }, parseType('{ name: string; power: number }'))).toBe(false);
    expect(fits({ a: 1, b: 2 }, parseType('Record<string, number>'))).toBe(true);
  });

  it('lets an empty list keep any list’s promise', () => {
    expect(fits([], parseType('string[]'))).toBe(true);
  });

  it('never blames anything when it could not read the type', () => {
    expect(fits(4, null)).toBe(true);
  });

  it('is not kept by nothing', () => {
    expect(fits(null, { kind: 'number' })).toBe(false);
  });
});
