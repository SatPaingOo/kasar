/**
 * The box behaving like an editor.
 *
 * All of this is string work, which is why it is out here where it can be
 * tested: every one of these is the sort of thing that is obviously right
 * until it eats somebody's code.
 */

import { describe, expect, it } from 'vitest';

import { leadOf, lineCount, onBackspace, onBracket, onEnter, onTab, opensBlock } from '../../src/editing.js';

describe('reading a line', () => {
  it('finds the indent it starts with', () => {
    expect(leadOf('  const x = 1;')).toBe('  ');
    expect(leadOf('const x = 1;')).toBe('');
    expect(leadOf('    ')).toBe('    ');
  });

  it('knows when a line opens a block', () => {
    expect(opensBlock('parts.map((n) => {')).toBe(true);
    expect(opensBlock('const a = [')).toBe(true);
    expect(opensBlock('return parts[0];')).toBe(false);
  });

  it('counts lines for the gutter, including the empty last one', () => {
    expect(lineCount('a')).toBe(1);
    expect(lineCount('a\nb')).toBe(2);
    expect(lineCount('a\n')).toBe(2);
  });
});

describe('Enter', () => {
  it('carries the indent down instead of going back to column zero', () => {
    const text = '  const x = 1;';
    const { text: out, caret } = onEnter(text, text.length);
    expect(out).toBe('  const x = 1;\n  ');
    expect(caret).toBe(out.length);
  });

  it('goes one deeper after a line that opened a block', () => {
    const text = '  parts.map((n) => {';
    expect(onEnter(text, text.length).text).toBe('  parts.map((n) => {\n    ');
  });

  it('splits a line at the caret rather than appending to the end', () => {
    const text = 'abcd';
    expect(onEnter(text, 2).text).toBe('ab\ncd');
  });
});

describe('Tab', () => {
  it('indents instead of leaving the box', () => {
    const { text, caret } = onTab('x', 1, 1, false);
    expect(text).toBe('x  ');
    expect(caret).toBe(3);
  });

  it('indents every line of a selection', () => {
    const text = 'a\nb';
    expect(onTab(text, 0, 3, false).text).toBe('  a\n  b');
  });

  it('takes an indent back out again', () => {
    const text = '    a';
    expect(onTab(text, 4, 4, true).text).toBe('  a');
  });

  it('does not eat the line when there is nothing to take out', () => {
    expect(onTab('a', 1, 1, true).text).toBe('a');
  });
});

describe('brackets', () => {
  it('closes what you open', () => {
    const { text, caret } = onBracket('', 0, '(') ?? { text: '', caret: 0 };
    expect(text).toBe('()');
    expect(caret).toBe(1);
  });

  it('steps past a closing bracket rather than doubling it', () => {
    const edit = onBracket('()', 1, ')');
    expect(edit?.text).toBe('()');
    expect(edit?.caret).toBe(2);
  });

  it('leaves ordinary characters alone', () => {
    expect(onBracket('', 0, 'n')).toBeNull();
  });

  it('does not step past a closing bracket that is not there', () => {
    expect(onBracket('a', 1, ')')).toBeNull();
  });
});

describe('Backspace', () => {
  it('takes both halves of an empty pair', () => {
    const edit = onBackspace('()', 1);
    expect(edit?.text).toBe('');
    expect(edit?.caret).toBe(0);
  });

  it('leaves a pair with something in it alone', () => {
    expect(onBackspace('(a)', 1)).toBeNull();
  });

  it('leaves ordinary text to the browser', () => {
    expect(onBackspace('abc', 2)).toBeNull();
    expect(onBackspace('', 0)).toBeNull();
  });
});
