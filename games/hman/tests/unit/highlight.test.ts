/**
 * The colour under the code.
 *
 * The rule that matters is the first one: the pieces put back together are
 * the text, exactly. The colour is drawn letter for letter under the real
 * text box, and a single character gained or lost would shift every letter
 * after it out from under the caret.
 */

import { describe, expect, it } from 'vitest';

import { tokenize } from '../../src/highlight.js';
import type { Tone } from '../../src/highlight.js';

const glued = (text: string): string =>
  tokenize(text)
    .map((token) => token.text)
    .join('');

/** The tone given to the first token that is exactly this text. */
function toneOf(text: string, piece: string, params: readonly string[] = []): Tone | undefined {
  return tokenize(text, params).find((token) => token.text === piece)?.tone;
}

describe('putting it back together', () => {
  it('gives back exactly what it was given', () => {
    const samples = [
      '',
      'return parts[0];',
      'let total = 0;\nfor (const n of parts) {\n  total += n;\n}\nreturn total;',
      "const s = 'it\\'s';  // a comment\n/* block */ x",
      'const t = `a ${b} c`;',
      '"unterminated\nnext line',
      '/* never closed',
      'return parts.map((n) => n * 2) ?? -1 >= 0x1f && .5e3;',
      '// ဗမာလို မှတ်ချက်\nreturn 1; 🙂',
      '\t\r\n  \n',
    ];
    for (const sample of samples) expect(glued(sample), JSON.stringify(sample)).toBe(sample);
  });

  it('gives back exactly what it was given, whatever it was given', () => {
    // A cheap fuzz: printable ASCII and a few awkward characters, at random.
    const alphabet = 'abcXYZ019 _$\t\n\'"`/*+-=<>!&|?:.,;()[]{}\\#@ဗမ🙂';
    let seed = 7;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let round = 0; round < 300; round += 1) {
      let text = '';
      const length = Math.floor(next() * 60);
      for (let i = 0; i < length; i += 1) text += [...alphabet][Math.floor(next() * [...alphabet].length)] ?? '';
      expect(glued(text)).toBe(text);
    }
  });
});

describe('telling the pieces apart', () => {
  it('knows keywords, literals and numbers', () => {
    expect(toneOf('return true;', 'return')).toBe('keyword');
    expect(toneOf('return true;', 'true')).toBe('literal');
    expect(toneOf('x = 42;', '42')).toBe('number');
  });

  it('knows strings and comments', () => {
    expect(toneOf("x = 'hi';", "'hi'")).toBe('string');
    expect(toneOf('x; // why', '// why')).toBe('comment');
  });

  it('marks the parameters, so the names from the signature stand out in the body', () => {
    expect(toneOf('return parts[0];', 'parts', ['parts'])).toBe('param');
    expect(tokenize('return parts[0];').some((token) => token.tone === 'param')).toBe(false);
  });

  it('knows a method call from a property', () => {
    expect(toneOf('parts.map((n) => n)', 'map')).toBe('call');
    expect(toneOf('parts.length', 'length')).toBe('property');
  });

  it('knows a type, including one named in capitals', () => {
    expect(toneOf('function strike(n: number): boolean', 'number')).toBe('type');
    expect(toneOf('Math.max(1, 2)', 'Math')).toBe('type');
  });

  it('reads === as one operator, not three', () => {
    expect(toneOf('a === b', '===')).toBe('operator');
  });
});
