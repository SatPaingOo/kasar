/**
 * Making the box behave like somewhere you would write code.
 *
 * A bare textarea is not one. Tab moves focus out of it, Enter throws you back
 * to column zero, brackets are all typed by hand, and there is no way to see
 * which line an error is on. None of that is exotic; all of it is the
 * difference between a text box and an editor, and the whole game is typing
 * into this thing.
 *
 * Every change is a replacement — this stretch of text becomes that — rather
 * than a whole new text. The first version handed back the whole text and the
 * page set it, which worked and quietly broke undo: setting a textarea's value
 * throws its history away, so the first bracket it closed for you was the
 * last thing Ctrl+Z could ever reach. A replacement can be put in the way
 * typing is, and typing is something the browser knows how to undo.
 *
 * String work only, so it is testable.
 */

export const INDENT = '  ';
const PAIRS: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}', "'": "'", '"': '"', '`': '`' };
const CLOSERS = new Set(Object.values(PAIRS));

/** One change: replace `from`..`to` with `insert`, then select `start`..`end`. */
export interface Edit {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
  readonly start: number;
  readonly end: number;
}

/** The text after an edit. The page lets the browser do this; tests do it here. */
export function applied(text: string, edit: Edit): string {
  return text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
}

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

/** Which line, counted from 1, an offset into the text is on. */
export function lineAt(text: string, at: number): number {
  return text.slice(0, Math.max(0, at)).split('\n').length;
}

const lineStartOf = (text: string, at: number): number => text.lastIndexOf('\n', Math.max(0, at - 1)) + 1;

function lineEndOf(text: string, at: number): number {
  const end = text.indexOf('\n', at);
  return end < 0 ? text.length : end;
}

const caretAt = (from: number, to: number, insert: string, caret: number): Edit => ({
  from,
  to,
  insert,
  start: caret,
  end: caret,
});

/**
 * Enter: carry the indent down, and go one deeper after an opening bracket.
 * Between a pair — `{|}` — the closing half goes down a line of its own, which
 * is the only way anyone ever wants a block opened.
 */
export function onEnter(text: string, start: number, end: number = start): Edit {
  const line = text.slice(lineStartOf(text, start), start);
  const lead = leadOf(line);
  const opened = opensBlock(line);
  const open = line.trimEnd().slice(-1);
  const close = text.slice(end).trimStart()[0];

  if (opened && close !== undefined && PAIRS[open] === close && /^[ \t]*[)\]}]/.test(text.slice(end))) {
    const inner = `\n${lead}${INDENT}`;
    return caretAt(start, end, `${inner}\n${lead}`, start + inner.length);
  }
  const inserted = `\n${lead}${opened ? INDENT : ''}`;
  return caretAt(start, end, inserted, start + inserted.length);
}

/** Tab: indent, rather than leaving the box. With Shift, take an indent out. */
export function onTab(text: string, start: number, end: number, back: boolean): Edit {
  if (!back && start === end) return caretAt(start, end, INDENT, start + INDENT.length);

  const from = lineStartOf(text, start);
  // A selection that ends at the very start of a line does not include it.
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const to = lineEndOf(text, last);
  const lines = text.slice(from, to).split('\n');

  if (!back) {
    const insert = lines.map((l) => INDENT + l).join('\n');
    return { from, to, insert, start: start + INDENT.length, end: end + INDENT.length * lines.length };
  }

  let firstLost = 0;
  let lost = 0;
  const insert = lines
    .map((l, i) => {
      const take = l.startsWith(INDENT) ? INDENT.length : /^[ \t]/.test(l) ? 1 : 0;
      if (i === 0) firstLost = take;
      lost += take;
      return l.slice(take);
    })
    .join('\n');
  return {
    from,
    to,
    insert,
    start: Math.max(from, start - firstLost),
    end: Math.max(from, end - lost),
  };
}

/**
 * A key that was typed, for the keys that are more than a letter.
 *
 * Opening a bracket closes it too — but only where that is wanted, which is
 * before a space, a closing bracket or the end of the line. Closing one that
 * is already there steps over it rather than doubling it. A quote does not
 * pair straight after a letter, because that is an apostrophe in a comment.
 * With text selected, a bracket or quote goes round it. And a closing brace
 * typed on an empty line comes back out to where its block started.
 */
export function onType(text: string, start: number, end: number, key: string): Edit | null {
  const closing = PAIRS[key];
  const next = text[end];
  const prev = text[start - 1];

  if (start === end && CLOSERS.has(key) && next === key) return caretAt(start, end, '', end + 1);

  if (closing !== undefined && start !== end) {
    const inner = text.slice(start, end);
    return { from: start, to: end, insert: key + inner + closing, start: start + 1, end: end + 1 };
  }

  if (closing !== undefined) {
    const quote = key === closing;
    const roomAfter = next === undefined || /[\s)\]};,:]/.test(next);
    const roomBefore = !quote || prev === undefined || !/[\w$'"`]/.test(prev);
    return roomAfter && roomBefore ? caretAt(start, end, key + closing, start + 1) : null;
  }

  if ((key === '}' || key === ']' || key === ')') && start === end) {
    const from = lineStartOf(text, start);
    const before = text.slice(from, start);
    if (before.length > 0 && before.trim() === '') {
      const lead = before.slice(Math.min(before.length, INDENT.length));
      return caretAt(from, start, lead + key, from + lead.length + 1);
    }
  }
  return null;
}

/**
 * Backspace between an empty pair takes both halves; in the indent at the
 * start of a line it takes a whole step of it, so indenting by two is undone
 * by one press rather than two.
 */
export function onBackspace(text: string, start: number, end: number = start): Edit | null {
  if (start !== end || start === 0) return null;

  const left = text[start - 1] ?? '';
  const expected = PAIRS[left];
  if (expected !== undefined && text[start] === expected) return caretAt(start - 1, start + 1, '', start - 1);

  const from = lineStartOf(text, start);
  const before = text.slice(from, start);
  if (before.length > 1 && /^ +$/.test(before)) {
    const take = ((before.length - 1) % INDENT.length) + 1;
    if (take > 1) return caretAt(start - take, start, '', start - take);
  }
  return null;
}

/**
 * Ctrl+/ comments the lines out, or back in. Being able to switch a line off
 * without deleting it is how people try things, which is what this is for.
 */
export function toggleComment(text: string, start: number, end: number): Edit {
  const from = lineStartOf(text, start);
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const to = lineEndOf(text, last);
  const lines = text.slice(from, to).split('\n');
  const solid = lines.filter((l) => l.trim().length > 0);
  const off = solid.length > 0 && solid.every((l) => l.trimStart().startsWith('//'));

  if (off) {
    let firstDelta = 0;
    let delta = 0;
    const insert = lines
      .map((l, i) => {
        const lead = leadOf(l);
        const rest = l.slice(lead.length);
        if (!rest.startsWith('//')) return l;
        const take = rest.startsWith('// ') ? 3 : 2;
        if (i === 0) firstDelta = take;
        delta += take;
        return lead + rest.slice(take);
      })
      .join('\n');
    return { from, to, insert, start: Math.max(from, start - firstDelta), end: Math.max(from, end - delta) };
  }

  const depth = Math.min(...(solid.length > 0 ? solid : ['']).map((l) => leadOf(l).length));
  let firstDelta = 0;
  let delta = 0;
  const insert = lines
    .map((l, i) => {
      if (l.trim().length === 0 && solid.length > 0) return l;
      if (i === 0) firstDelta = 3;
      delta += 3;
      return `${l.slice(0, depth)}// ${l.slice(depth)}`;
    })
    .join('\n');
  return { from, to, insert, start: start + firstDelta, end: end + delta };
}
