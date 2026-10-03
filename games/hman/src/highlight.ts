/**
 * Colour for the code, without a parser.
 *
 * A highlighter only has to be right about what a piece of text *looks* like,
 * not what it means, so a scanner is enough: keywords, strings, numbers,
 * comments, and the names that matter. Getting a regular expression wrong
 * here costs a colour, never a result — nothing that runs reads this.
 *
 * The one rule it must never break is that the pieces put back together are
 * exactly the text it was given. The colour is drawn underneath the real text
 * box, letter for letter, and one character gained or lost would put every
 * letter after it in the wrong place.
 *
 * String work only, so it is testable.
 */

export type Tone =
  | 'plain'
  | 'keyword'
  | 'literal'
  | 'number'
  | 'string'
  | 'comment'
  | 'type'
  | 'param'
  | 'call'
  | 'property'
  | 'operator'
  | 'punct';

export interface Token {
  readonly tone: Tone;
  readonly text: string;
}

const KEYWORDS = new Set([
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'of',
  'readonly',
  'return',
  'switch',
  'this',
  'throw',
  'try',
  'type',
  'typeof',
  'var',
  'void',
  'while',
  'yield',
]);

const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
const TYPES = new Set(['number', 'string', 'boolean', 'unknown', 'never', 'any', 'object', 'Record']);

/** Longest first, so `===` is not read as `==` and then `=`. */
const OPERATORS = [
  '===',
  '!==',
  '...',
  '**=',
  '&&=',
  '||=',
  '??=',
  '=>',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '??',
  '?.',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '**',
];

const SINGLE = '+-*/%=<>!&|^~?:';
const PUNCT = '()[]{},;.';

const isStart = (ch: string): boolean => /[A-Za-z_$]/.test(ch);
const isPart = (ch: string): boolean => /[\w$]/.test(ch);
const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

/** The next character that is not a space, from `at` on. */
function nextSolid(text: string, at: number): string {
  for (let i = at; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (ch !== ' ' && ch !== '\t') return ch;
  }
  return '';
}

/** The last token that was not a space or a comment. */
function lastSolid(tokens: readonly Token[]): Token | undefined {
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const one = tokens[i];
    if (one !== undefined && one.tone !== 'comment' && one.text.trim().length > 0) return one;
  }
  return undefined;
}

/** Read to the closing quote, or to the end of the line if there is none. */
function quoted(text: string, from: number): number {
  const quote = text[from];
  let i = from + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    if (ch === '\n' && quote !== '`') return i;
    i += 1;
  }
  return text.length;
}

export function tokenize(text: string, params: readonly string[] = []): Token[] {
  const tokens: Token[] = [];
  const named = new Set(params);
  let i = 0;

  const push = (tone: Tone, to: number): void => {
    const piece = text.slice(i, to);
    const last = tokens[tokens.length - 1];
    // Runs of the same tone join up, so the page gets fewer spans.
    if (last !== undefined && last.tone === tone && (tone === 'plain' || tone === 'punct')) {
      tokens[tokens.length - 1] = { tone, text: last.text + piece };
    } else {
      tokens.push({ tone, text: piece });
    }
    i = to;
  };

  while (i < text.length) {
    const ch = text[i] ?? '';
    const two = text.slice(i, i + 2);

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      let to = i + 1;
      while (to < text.length && /[ \t\n\r]/.test(text[to] ?? '')) to += 1;
      push('plain', to);
      continue;
    }

    if (two === '//') {
      const end = text.indexOf('\n', i);
      push('comment', end < 0 ? text.length : end);
      continue;
    }
    if (two === '/*') {
      const end = text.indexOf('*/', i + 2);
      push('comment', end < 0 ? text.length : end + 2);
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      push('string', quoted(text, i));
      continue;
    }

    if (isDigit(ch) || (ch === '.' && isDigit(text[i + 1] ?? ''))) {
      const found =
        /^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?|\.\d[\d_]*(?:[eE][+-]?\d+)?)n?/.exec(
          text.slice(i),
        );
      push('number', i + (found?.[0].length ?? 1));
      continue;
    }

    if (isStart(ch)) {
      let to = i + 1;
      while (to < text.length && isPart(text[to] ?? '')) to += 1;
      const word = text.slice(i, to);
      const before = lastSolid(tokens);
      const after = nextSolid(text, to);
      const afterDot =
        before !== undefined &&
        ((before.tone === 'punct' && before.text.endsWith('.')) ||
          (before.tone === 'operator' && before.text === '?.'));

      let tone: Tone;
      if (afterDot) tone = after === '(' ? 'call' : 'property';
      else if (KEYWORDS.has(word)) tone = 'keyword';
      else if (LITERALS.has(word)) tone = 'literal';
      else if (TYPES.has(word) || /^[A-Z]/.test(word)) tone = 'type';
      else if (named.has(word)) tone = 'param';
      else if (after === '(') tone = 'call';
      else tone = 'plain';
      push(tone, to);
      continue;
    }

    const operator = OPERATORS.find((op) => text.startsWith(op, i));
    if (operator !== undefined) {
      push('operator', i + operator.length);
      continue;
    }
    if (SINGLE.includes(ch)) {
      push('operator', i + 1);
      continue;
    }
    if (PUNCT.includes(ch)) {
      push('punct', i + 1);
      continue;
    }

    // Anything else — Burmese in a comment, an emoji, a stray symbol — is
    // carried through as it is, a whole code point at a time.
    const point = text.codePointAt(i) ?? 0;
    push('plain', i + (point > 0xffff ? 2 : 1));
  }

  return tokens;
}
