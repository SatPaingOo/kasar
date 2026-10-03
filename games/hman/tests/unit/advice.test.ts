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

import { adviseOn, lineOf, returnsSomething, whyMissed } from '../../src/advice.js';
import { parseType } from '../../src/types.js';

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

describe('the line an error is on', () => {
  const script = 'blob:http://localhost:5173/3f2a';

  it('is read out of a Chrome stack', () => {
    const stack = `TypeError: Cannot read properties of undefined (reading 'x')\n    at strike (${script}:5:18)\n    at ${script}:12:21`;
    expect(lineOf(stack, script, 2)).toBe(3);
  });

  it('is read out of a Firefox stack', () => {
    const stack = `strike@${script}:4:9\nonmessage/results<@${script}:12:21`;
    expect(lineOf(stack, script, 2)).toBe(2);
  });

  it('skips frames above the box, which the player never wrote', () => {
    expect(lineOf(`x@${script}:1:1\ny@${script}:3:1`, script, 2)).toBe(1);
  });

  it('is not guessed when the stack does not say', () => {
    expect(lineOf('', script, 2)).toBeNull();
    expect(lineOf('at somewhere/else.js:9:9', script, 2)).toBeNull();
  });
});

describe('why an answer was wrong', () => {
  const list = parseType('number[]');

  const code = 'return x;';

  it('puts a mistake that threw first', () => {
    expect(whyMissed({ got: null, type: 'undefined', error: 'x is not defined' }, list, code).kind).toBe('threw');
  });

  it('calls running out of stack what it is', () => {
    const deep = { got: null, type: 'undefined', error: 'Maximum call stack size exceeded' };
    expect(whyMissed(deep, list, code).kind).toBe('deep');
    expect(whyMissed({ ...deep, error: 'too much recursion' }, list, code).kind).toBe('deep');
  });

  it('calls undefined a missing return only when there is no return', () => {
    expect(whyMissed({ got: null, type: 'undefined', error: null }, list, 'parts[0];').kind).toBe('noReturn');
    expect(whyMissed({ got: null, type: 'undefined', error: null }, list, '// return\nparts[0];').kind).toBe(
      'noReturn',
    );
  });

  it('calls undefined from a return something that was not there', () => {
    expect(whyMissed({ got: null, type: 'undefined', error: null }, list, 'return parts[parts.length];').kind).toBe(
      'notThere',
    );
  });

  it('explains NaN, wherever it turns up', () => {
    expect(whyMissed({ got: null, type: 'NaN', error: null }, parseType('number'), code).kind).toBe('nan');
    expect(whyMissed({ got: null, type: '(number | NaN)[]', error: null }, list, code).kind).toBe('nan');
  });

  it('calls the wrong shape a broken promise before it calls it a wrong value', () => {
    expect(whyMissed({ got: 4, type: 'number', error: null }, list, code).kind).toBe('promise');
    expect(whyMissed({ got: null, type: 'Set<number>', error: null }, list, code).kind).toBe('promise');
  });

  it('calls a right shape with the wrong contents just wrong', () => {
    expect(whyMissed({ got: [1, 2], type: 'number[]', error: null }, list, code).kind).toBe('value');
  });
});

describe('whether the code returns anything', () => {
  it('finds a return', () => {
    expect(returnsSomething('let x = 1;\nreturn x;')).toBe(true);
  });

  it('does not count one in a comment or a string', () => {
    expect(returnsSomething('// return 1\nparts[0];')).toBe(false);
    expect(returnsSomething('/* return */ parts[0];')).toBe(false);
    expect(returnsSomething("const s = 'return';")).toBe(false);
  });

  it('does not count a word that only contains it', () => {
    expect(returnsSomething('const returned = 1;')).toBe(false);
  });

  it('does not count a return with nothing after it', () => {
    expect(returnsSomething('return ')).toBe(false);
    expect(returnsSomething('return;')).toBe(false);
    expect(returnsSomething('if (x) { return }')).toBe(false);
  });

  it('does not count a return whose value is on the next line, which JavaScript cuts short', () => {
    expect(returnsSomething('return\n  parts[0];')).toBe(false);
  });

  it('counts a string being returned, though the string is blanked out to look inside', () => {
    expect(returnsSomething("return 'a';")).toBe(true);
  });
});
