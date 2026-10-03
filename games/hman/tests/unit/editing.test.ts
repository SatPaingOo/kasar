/**
 * The box behaving like an editor.
 *
 * All of this is string work, which is why it is out here where it can be
 * tested: every one of these is the sort of thing that is obviously right
 * until it eats somebody's code.
 */

import { describe, expect, it } from 'vitest';

import {
  applied,
  leadOf,
  lineAt,
  lineCount,
  onBackspace,
  onEnter,
  onTab,
  onType,
  opensBlock,
  toggleComment,
} from '../../src/editing.js';
import type { Edit } from '../../src/editing.js';

/** The text and the caret after an edit, which is what a person would see. */
function after(text: string, edit: Edit | null): { text: string; caret: number } {
  if (edit === null) throw new Error('no edit');
  return { text: applied(text, edit), caret: edit.end };
}

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

  it('knows which line an offset is on', () => {
    expect(lineAt('a\nb\nc', 0)).toBe(1);
    expect(lineAt('a\nb\nc', 2)).toBe(2);
    expect(lineAt('a\nb\nc', 5)).toBe(3);
  });
});

describe('an edit', () => {
  it('replaces only the stretch it names, which is what keeps undo working', () => {
    const edit = onType('a b', 1, 1, '(');
    expect(edit).not.toBeNull();
    // A replacement at the caret, not a whole new text.
    expect(edit?.from).toBe(1);
    expect(edit?.to).toBe(1);
  });
});

describe('Enter', () => {
  it('carries the indent down instead of going back to column zero', () => {
    const text = '  const x = 1;';
    const out = after(text, onEnter(text, text.length));
    expect(out.text).toBe('  const x = 1;\n  ');
    expect(out.caret).toBe(out.text.length);
  });

  it('goes one deeper after a line that opened a block', () => {
    const text = '  parts.map((n) => {';
    expect(after(text, onEnter(text, text.length)).text).toBe('  parts.map((n) => {\n    ');
  });

  it('puts the closing half of a pair on a line of its own', () => {
    const text = 'for (const n of parts) {}';
    const at = text.length - 1;
    const out = after(text, onEnter(text, at));
    expect(out.text).toBe('for (const n of parts) {\n  \n}');
    expect(out.caret).toBe('for (const n of parts) {\n  '.length);
  });

  it('splits a line at the caret rather than appending to the end', () => {
    expect(after('abcd', onEnter('abcd', 2)).text).toBe('ab\ncd');
  });

  it('replaces a selection rather than inserting beside it', () => {
    expect(after('abcd', onEnter('abcd', 1, 3)).text).toBe('a\nd');
  });
});

describe('Tab', () => {
  it('indents instead of leaving the box', () => {
    const out = after('x', onTab('x', 1, 1, false));
    expect(out.text).toBe('x  ');
    expect(out.caret).toBe(3);
  });

  it('indents every line of a selection', () => {
    expect(after('a\nb', onTab('a\nb', 0, 3, false)).text).toBe('  a\n  b');
  });

  it('leaves the line after a selection alone when the selection stops at its start', () => {
    expect(after('a\nb', onTab('a\nb', 0, 2, false)).text).toBe('  a\nb');
  });

  it('takes an indent back out again', () => {
    expect(after('    a', onTab('    a', 4, 4, true)).text).toBe('  a');
  });

  it('does not eat the line when there is nothing to take out', () => {
    expect(after('a', onTab('a', 1, 1, true)).text).toBe('a');
  });
});

describe('typing a bracket or a quote', () => {
  it('closes what you open', () => {
    const out = after('', onType('', 0, 0, '('));
    expect(out.text).toBe('()');
    expect(out.caret).toBe(1);
  });

  it('steps past a closing bracket rather than doubling it', () => {
    const out = after('()', onType('()', 1, 1, ')'));
    expect(out.text).toBe('()');
    expect(out.caret).toBe(2);
  });

  it('steps past a closing quote too, rather than opening another pair', () => {
    const out = after("'a'", onType("'a'", 2, 2, "'"));
    expect(out.text).toBe("'a'");
    expect(out.caret).toBe(3);
  });

  it('does not close a bracket typed in front of a word', () => {
    // Typing ( before `parts` wants (parts, not ()parts.
    expect(onType('parts', 0, 0, '(')).toBeNull();
  });

  it('does not pair a quote straight after a letter, where it is an apostrophe', () => {
    expect(onType('// don', 6, 6, "'")).toBeNull();
  });

  it('goes round a selection instead of replacing it', () => {
    const out = after('n * 2', onType('n * 2', 0, 5, '('));
    expect(out.text).toBe('(n * 2)');
  });

  it('brings a closing brace back out to where its block started', () => {
    const text = 'if (x) {\n  return 1;\n  ';
    const out = after(text, onType(text, text.length, text.length, '}'));
    expect(out.text).toBe('if (x) {\n  return 1;\n}');
  });

  it('leaves ordinary characters alone', () => {
    expect(onType('', 0, 0, 'n')).toBeNull();
  });

  it('does not step past a closing bracket that is not there', () => {
    expect(onType('a', 1, 1, ')')).toBeNull();
  });
});

describe('Backspace', () => {
  it('takes both halves of an empty pair', () => {
    const out = after('()', onBackspace('()', 1));
    expect(out.text).toBe('');
    expect(out.caret).toBe(0);
  });

  it('takes a whole step of indent at once', () => {
    const out = after('    ', onBackspace('    ', 4));
    expect(out.text).toBe('  ');
  });

  it('leaves a pair with something in it alone', () => {
    expect(onBackspace('(a)', 1)).toBeNull();
  });

  it('leaves ordinary text to the browser', () => {
    expect(onBackspace('abc', 2)).toBeNull();
    expect(onBackspace('', 0)).toBeNull();
  });

  it('leaves a selection to the browser', () => {
    expect(onBackspace('()', 0, 2)).toBeNull();
  });
});

describe('Ctrl+/', () => {
  it('turns a line off', () => {
    expect(after('  return 1;', toggleComment('  return 1;', 4, 4)).text).toBe('  // return 1;');
  });

  it('turns it back on again', () => {
    expect(after('  // return 1;', toggleComment('  // return 1;', 6, 6)).text).toBe('  return 1;');
  });

  it('does every line of a selection at the same depth', () => {
    const text = 'a\n  b';
    expect(after(text, toggleComment(text, 0, text.length)).text).toBe('// a\n//   b');
  });

  it('round-trips', () => {
    const text = 'let total = 0;\nfor (const n of parts) total += n;';
    const once = applied(text, toggleComment(text, 0, text.length));
    const twice = applied(once, toggleComment(once, 0, once.length));
    expect(twice).toBe(text);
  });
});
