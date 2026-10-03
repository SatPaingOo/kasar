/**
 * Making the box behave like somewhere you would write code.
 *
 * A bare textarea is not one. Tab moves focus out of it, Enter throws you back
 * to column zero, brackets are all typed by hand, and there is no way to see
 * which line an error is on. None of that is exotic; all of it is the
 * difference between a text box and an editor, and the whole game is typing
 * into this thing.
 *
 * Still a textarea underneath, with a gutter drawn beside it. No dependency,
 * no syntax highlighting — that needs a parser, and a parser is the kind of
 * thing this shelf does not take on for one game.
 */

const INDENT = '  ';
const PAIRS: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}', "'": "'", '"': '"' };

/** The whitespace a line starts with, which the next one should start with too. */
export function leadOf(line: string): string {
  const match = /^[ \t]*/.exec(line);
  return match === null ? '' : match[0];
}

/** Lines open a block when they end in one of these. */
export function opensBlock(line: string): boolean {
  return /[({[]\s*$/.test(line.trimEnd());
}

/** How many lines the text has, for the gutter. */
export function lineCount(text: string): number {
  return text.split('\n').length;
}

export interface Edit {
  readonly text: string;
  readonly caret: number;
}

/** Enter: carry the indent down, and go one deeper after an opening bracket. */
export function onEnter(text: string, caret: number): Edit {
  const before = text.slice(0, caret);
  const line = before.slice(before.lastIndexOf('\n') + 1);
  const lead = leadOf(line) + (opensBlock(line) ? INDENT : '');
  const inserted = '\n' + lead;
  return { text: before + inserted + text.slice(caret), caret: caret + inserted.length };
}

/** Tab: indent, rather than leaving the box entirely. */
export function onTab(text: string, start: number, end: number, back: boolean): Edit {
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;

  if (!back) {
    if (start !== end) {
      const block = text.slice(lineStart, end);
      const bumped = block
        .split('\n')
        .map((l) => INDENT + l)
        .join('\n');
      return { text: text.slice(0, lineStart) + bumped + text.slice(end), caret: end + bumped.length - block.length };
    }
    return { text: text.slice(0, start) + INDENT + text.slice(end), caret: start + INDENT.length };
  }

  const block = text.slice(lineStart, Math.max(lineStart, end));
  const trimmed = block
    .split('\n')
    .map((l) => (l.startsWith(INDENT) ? l.slice(INDENT.length) : l.replace(/^[ \t]/, '')))
    .join('\n');
  const lost = block.length - trimmed.length;
  return {
    text: text.slice(0, lineStart) + trimmed + text.slice(Math.max(lineStart, end)),
    caret: Math.max(lineStart, start - lost),
  };
}

/**
 * Typing an opening bracket writes the closing one too, and typing the closing
 * one over it steps past instead of doubling it.
 */
export function onBracket(text: string, caret: number, key: string): Edit | null {
  const closing = PAIRS[key];
  if (closing !== undefined) {
    return { text: text.slice(0, caret) + key + closing + text.slice(caret), caret: caret + 1 };
  }
  if (Object.values(PAIRS).includes(key) && text[caret] === key) {
    return { text, caret: caret + 1 };
  }
  return null;
}

/** Backspace between a pair takes both halves. */
export function onBackspace(text: string, caret: number): Edit | null {
  const left = text[caret - 1];
  if (left === undefined) return null;
  const expected = PAIRS[left];
  if (expected === undefined || text[caret] !== expected) return null;
  return { text: text.slice(0, caret - 1) + text.slice(caret + 1), caret: caret - 1 };
}
