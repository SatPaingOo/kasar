/**
 * What we tell someone whose code did not run.
 *
 * The annotation case is the one worth pinning down. The signature above the
 * box is TypeScript and the box is not, which is a confusing thing to meet
 * through "Missing initializer in const declaration" — and the two ways to
 * write an annotation produce two completely different engine messages, so
 * this reads the source instead.
 */

import { describe, expect, it } from 'vitest';

import { adviseOn } from '../../src/advice.js';

describe('nothing to advise', () => {
  it('says nothing when the code ran', () => {
    expect(adviseOn('return parts[0];', null)).toBe('plain');
  });

  it('passes an ordinary error straight through', () => {
    expect(adviseOn('return nope;', 'nope is not defined')).toBe('plain');
  });
});

describe('a loop that never ended', () => {
  it('is named as such, whatever was written', () => {
    expect(adviseOn('while (true) {}', 'timeout')).toBe('loop');
    expect(adviseOn('const x: number = 1;', 'timeout')).toBe('loop');
  });
});

describe('a type annotation in the box', () => {
  it('is caught in a declaration, whose error mentions no types at all', () => {
    expect(adviseOn('const x: number = parts[0];', 'Missing initializer in const declaration')).toBe('annotation');
    expect(adviseOn('let total: number = 0;', 'Missing initializer in const declaration')).toBe('annotation');
  });

  it('is caught in a parameter list, whose error is different again', () => {
    expect(adviseOn('function f(a: number) { return a; }', "Unexpected token ':'")).toBe('annotation');
    expect(adviseOn('const f = (a: string) => a;', "Unexpected token ':'")).toBe('annotation');
  });

  it('leaves an object literal alone, colon and all', () => {
    expect(adviseOn('const o = { a: 1 };\nreturn o.a;', 'something broke')).toBe('plain');
  });

  it('leaves a conditional alone, colon and all', () => {
    expect(adviseOn('return parts[0] > 1 ? parts[0] : 0;', 'something broke')).toBe('plain');
  });

  it('leaves a label and an object argument alone', () => {
    expect(adviseOn('return fn({ a: 1 });', 'something broke')).toBe('plain');
  });
});
