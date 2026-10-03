/**
 * How the end-to-end run tells a pass in Hman.
 *
 * A check that cannot fail is worse than none, so these pin down that each
 * one refuses what it should: advice without its line, the wrong line, the
 * right words for the wrong mistake.
 */

import { describe, expect, it } from 'vitest';

import { ADVICE, HARNESS, judgeAdvice, showsVersion } from '../../../tools/lib/hman-e2e.ts';
import type { AdviceCase } from '../../../tools/lib/hman-e2e.ts';

const syntax = ADVICE.find((one) => one.name.startsWith('a syntax error')) as AdviceCase;

describe('judging advice', () => {
  it('passes the words and the line together', () => {
    expect(judgeAdvice(syntax, { says: "it broke (line 2): SyntaxError: Unexpected token ';'", line: [2] })).toBe(true);
  });

  it('fails what Firefox used to say, with neither', () => {
    expect(judgeAdvice(syntax, { says: 'it broke: the code could not be started', line: [] })).toBe(false);
  });

  it('fails the right words on the wrong line', () => {
    expect(judgeAdvice(syntax, { says: 'it broke (line 2): SyntaxError: x', line: [3] })).toBe(false);
  });

  it('does not ask for a line when the mistake has none', () => {
    const loop = ADVICE.find((one) => one.name.includes('loop')) as AdviceCase;
    expect(loop.line).toBeUndefined();
    expect(judgeAdvice(loop, { says: 'It never finished. Something is looping.', line: [] })).toBe(true);
  });

  it('has a case for every kind of advice the desk gives', () => {
    const words = ADVICE.map((one) => one.says.source).join(' ');
    for (const kind of [
      'SyntaxError',
      'line 3',
      'undeclared',
      'Type annotations',
      'never finished',
      'NaN',
      'Nothing came back',
      'promises',
    ]) {
      expect(words).toContain(kind);
    }
  });
});

describe('the version marker', () => {
  it('must name the version exactly', () => {
    expect(showsVersion('v0.7.2', '0.7.2')).toBe(true);
    expect(showsVersion(' v0.7.2 ', '0.7.2')).toBe(true);
    expect(showsVersion('v0.7.1', '0.7.2')).toBe(false);
    expect(showsVersion('', '0.7.2')).toBe(false);
  });
});

describe('the harness put in the page', () => {
  it('is plain JavaScript that parses, with nothing a template literal would swallow', () => {
    expect(() => new Function(HARNESS)).not.toThrow();
    expect(HARNESS).not.toContain('${');
  });
});
