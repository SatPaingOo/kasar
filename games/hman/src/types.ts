/**
 * Reading the signature above the box.
 *
 * There is no TypeScript compiler in the page and there will not be one: it is
 * a large runtime dependency and this shelf has none. But the signature is
 * still the most important thing on the desk — reading it and keeping its
 * promise is most of what relearning the language is — so the game reads it
 * too, for three things:
 *
 * - the names of the parameters, which is what the box is called with;
 * - the line that opens the function, which is drawn as the top of the editor;
 * - the return type, so that an answer of the wrong *shape* can be called a
 *   broken promise in TypeScript's own words rather than just "wrong".
 *
 * Only the handful of types the ladder uses are understood. Anything else
 * parses as null and is simply not checked, which is the safe way round: an
 * unchecked type never blames a right answer.
 *
 * String work only, so it is testable.
 */

import type { Value } from './values.js';

export type Type =
  | { readonly kind: 'number' | 'string' | 'boolean' }
  | { readonly kind: 'list'; readonly of: Type }
  | { readonly kind: 'object'; readonly fields: readonly (readonly [string, Type])[] }
  | { readonly kind: 'record'; readonly of: Type };

export interface Param {
  readonly name: string;
  /** As written, for showing. */
  readonly text: string;
  readonly type: Type | null;
}

export interface Signature {
  /** Lines above the function: type aliases. */
  readonly above: readonly string[];
  /** The line that opens the function, without its brace. */
  readonly head: string;
  readonly params: readonly Param[];
  /** As written, for showing. */
  readonly returnsText: string;
  readonly returns: Type | null;
}

const OPEN = '([{<';
const CLOSE = ')]}>';

/** Split on a separator, but only where no bracket is open. */
function splitTop(text: string, separators: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (OPEN.includes(ch)) depth += 1;
    else if (CLOSE.includes(ch)) depth -= 1;
    else if (depth === 0 && separators.includes(ch)) {
      out.push(text.slice(from, i));
      from = i + 1;
    }
  }
  out.push(text.slice(from));
  return out.map((part) => part.trim()).filter((part) => part.length > 0);
}

/** Where the bracket opened at `at` is closed, or -1. */
function closing(text: string, at: number): number {
  let depth = 0;
  for (let i = at; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (OPEN.includes(ch)) depth += 1;
    else if (CLOSE.includes(ch)) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Read one type. Understands `number`, `string`, `boolean`, `T[]`,
 * `readonly T[]`, `{ a: T; b: U }`, `Record<string, T>`, `(T)` and the names
 * of aliases declared above the function. Anything else is null.
 */
export function parseType(raw: string, aliases: Readonly<Record<string, string>> = {}, depth: number = 0): Type | null {
  if (depth > 12) return null;
  let text = raw.trim();
  if (text.startsWith('readonly ')) text = text.slice('readonly '.length).trim();
  if (text.length === 0) return null;
  if (splitTop(text, '|').length > 1) return null;

  if (text.endsWith('[]')) {
    const of = parseType(text.slice(0, -2), aliases, depth + 1);
    return of === null ? null : { kind: 'list', of };
  }
  if (text.startsWith('(') && closing(text, 0) === text.length - 1) {
    return parseType(text.slice(1, -1), aliases, depth + 1);
  }
  if (text === 'number' || text === 'string' || text === 'boolean') return { kind: text };

  if (text.startsWith('{') && closing(text, 0) === text.length - 1) {
    const fields: (readonly [string, Type])[] = [];
    for (const field of splitTop(text.slice(1, -1), ';,')) {
      const colon = field.indexOf(':');
      if (colon < 0) return null;
      const name = field
        .slice(0, colon)
        .trim()
        .replace(/^readonly\s+/, '');
      const type = parseType(field.slice(colon + 1), aliases, depth + 1);
      if (type === null || !/^[A-Za-z_$][\w$]*$/.test(name)) return null;
      fields.push([name, type]);
    }
    return { kind: 'object', fields };
  }

  const record = /^Record<\s*string\s*,([\s\S]*)>$/.exec(text);
  if (record !== null) {
    const of = parseType(record[1] ?? '', aliases, depth + 1);
    return of === null ? null : { kind: 'record', of };
  }

  const alias = aliases[text];
  return alias === undefined ? null : parseType(alias, aliases, depth + 1);
}

/** Read the whole signature: aliases above, then `function strike(…): T`. */
export function readSignature(text: string): Signature {
  const lines = text.split('\n');
  const aliases: Record<string, string> = {};
  const above: string[] = [];
  let head = '';

  for (const line of lines) {
    const alias = /^\s*type\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]*?);?\s*$/.exec(line);
    if (alias !== null) {
      aliases[alias[1] ?? ''] = alias[2] ?? '';
      above.push(line);
      continue;
    }
    if (/^\s*function\s/.test(line)) head = line.trim().replace(/\s*\{\s*$/, '');
  }

  const open = head.indexOf('(');
  const shut = open < 0 ? -1 : closing(head, open);
  const params: Param[] = [];
  let returnsText = '';
  if (open >= 0 && shut > open) {
    for (const one of splitTop(head.slice(open + 1, shut), ',')) {
      const colon = one.indexOf(':');
      const name = (colon < 0 ? one : one.slice(0, colon)).trim();
      const typeText = colon < 0 ? '' : one.slice(colon + 1).trim();
      params.push({ name, text: typeText, type: parseType(typeText, aliases) });
    }
    const after = head.slice(shut + 1).trim();
    returnsText = after.startsWith(':') ? after.slice(1).trim() : '';
  }

  return { above, head, params, returnsText, returns: parseType(returnsText, aliases) };
}

/** Whether a value keeps the promise a type makes. A null type promises nothing. */
export function fits(value: Value | null, type: Type | null): boolean {
  if (type === null) return true;
  if (value === null) return false;
  switch (type.kind) {
    case 'number':
    case 'string':
    case 'boolean':
      return typeof value === type.kind;
    case 'list':
      return Array.isArray(value) && (value as readonly Value[]).every((item) => fits(item, type.of));
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) return false;
      const record = value as { readonly [key: string]: Value };
      return type.fields.every(([name, field]) => Object.hasOwn(record, name) && fits(record[name] ?? null, field));
    }
    case 'record': {
      if (typeof value !== 'object' || Array.isArray(value)) return false;
      return Object.values(value as { readonly [key: string]: Value }).every((item) => fits(item, type.of));
    }
  }
}
