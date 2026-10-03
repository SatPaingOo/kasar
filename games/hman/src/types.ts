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
 * Only the types the ladder uses are understood. Anything else parses as null
 * and is simply not checked, which is the safe way round: an unchecked type
 * never blames a right answer.
 *
 * String work only, so it is testable.
 */

import type { Value } from './values.js';

export interface Field {
  readonly name: string;
  readonly type: Type;
  /** Written `name?:` — it may be missing altogether. */
  readonly optional: boolean;
}

export type Type =
  | { readonly kind: 'number' | 'string' | 'boolean' }
  /** `unknown`, `any`, and a generic's `T`: anything at all keeps it. */
  | { readonly kind: 'unknown' }
  | { readonly kind: 'literal'; readonly value: string | number | boolean }
  | { readonly kind: 'list'; readonly of: Type }
  | { readonly kind: 'tuple'; readonly of: readonly Type[] }
  | { readonly kind: 'union'; readonly of: readonly Type[] }
  | { readonly kind: 'object'; readonly fields: readonly Field[] }
  | { readonly kind: 'record'; readonly of: Type }
  /**
   * An alias that mentions itself — `type Nested = number | Nested[]` — read
   * lazily, because reading it eagerly never finishes.
   */
  | { readonly kind: 'ref'; readonly name: string; readonly resolve: () => Type | null };

export interface Param {
  readonly name: string;
  /** As written, for showing. */
  readonly text: string;
  readonly type: Type | null;
  /** Written `name?:` — a call may leave it out. */
  readonly optional: boolean;
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
const NAME = /^[A-Za-z_$][\w$]*$/;

/** Split on a separator, but only where no bracket is open and no quote. */
function splitTop(text: string, separators: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let from = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (quote !== '') {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (OPEN.includes(ch)) depth += 1;
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

const wraps = (text: string, open: string): boolean => text.startsWith(open) && closing(text, 0) === text.length - 1;

/**
 * Read one type. Understands `number`, `string`, `boolean`, `unknown`,
 * literals like `'up'`, `T[]`, `readonly T[]`, tuples `[A, B]`, unions
 * `A | B`, `{ a: T; b?: U }`, `Record<string, T>`, `(T)`, the names of
 * aliases declared above the function — including ones that mention
 * themselves — and the function's own generic names. Anything else is null.
 */
export function parseType(
  raw: string,
  aliases: Readonly<Record<string, string>> = {},
  generics: readonly string[] = [],
): Type | null {
  const table: Record<string, Type | null> = {};
  const reading = new Set<string>();

  const alias = (name: string): Type | null => {
    if (Object.hasOwn(table, name)) return table[name] ?? null;
    if (reading.has(name)) return { kind: 'ref', name, resolve: () => table[name] ?? null };
    reading.add(name);
    const type = parse(aliases[name] ?? '', 0);
    reading.delete(name);
    table[name] = type;
    return type;
  };

  const parse = (source: string, depth: number): Type | null => {
    if (depth > 24) return null;
    let text = source.trim();
    if (text.startsWith('readonly ')) text = text.slice('readonly '.length).trim();
    if (text.length === 0) return null;

    const members = splitTop(text, '|');
    if (members.length > 1) {
      const of = members.map((one) => parse(one, depth + 1));
      return of.some((one) => one === null) ? null : { kind: 'union', of: of as Type[] };
    }

    if (text.endsWith('[]')) {
      const of = parse(text.slice(0, -2), depth + 1);
      return of === null ? null : { kind: 'list', of };
    }
    if (wraps(text, '(')) return parse(text.slice(1, -1), depth + 1);
    if (wraps(text, '[')) {
      const of = splitTop(text.slice(1, -1), ',').map((one) => parse(one, depth + 1));
      return of.some((one) => one === null) ? null : { kind: 'tuple', of: of as Type[] };
    }

    if (text === 'number' || text === 'string' || text === 'boolean') return { kind: text };
    if (text === 'unknown' || text === 'any' || generics.includes(text)) return { kind: 'unknown' };
    if (text === 'true' || text === 'false') return { kind: 'literal', value: text === 'true' };
    if (/^-?\d+(\.\d+)?$/.test(text)) return { kind: 'literal', value: Number(text) };
    const quoted = /^(['"])(.*)\1$/.exec(text);
    if (quoted !== null) return { kind: 'literal', value: quoted[2] ?? '' };

    if (wraps(text, '{')) {
      const fields: Field[] = [];
      for (const field of splitTop(text.slice(1, -1), ';,')) {
        const colon = field.indexOf(':');
        if (colon < 0) return null;
        let name = field
          .slice(0, colon)
          .trim()
          .replace(/^readonly\s+/, '');
        const optional = name.endsWith('?');
        if (optional) name = name.slice(0, -1).trim();
        const type = parse(field.slice(colon + 1), depth + 1);
        if (type === null || !NAME.test(name)) return null;
        fields.push({ name, type, optional });
      }
      return { kind: 'object', fields };
    }

    const record = /^Record<\s*string\s*,([\s\S]*)>$/.exec(text);
    if (record !== null) {
      const of = parse(record[1] ?? '', depth + 1);
      return of === null ? null : { kind: 'record', of };
    }

    return Object.hasOwn(aliases, text) ? alias(text) : null;
  };

  return parse(raw, 0);
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

  // `function strike<T, U>(…)` — the names in the angle brackets keep any value.
  const generic = /^function\s+[A-Za-z_$][\w$]*\s*<([^>]*)>/.exec(head);
  const generics = generic === null ? [] : splitTop(generic[1] ?? '', ',').map((one) => one.split(/\s/)[0] ?? '');

  const open = head.indexOf('(');
  const shut = open < 0 ? -1 : closing(head, open);
  const params: Param[] = [];
  let returnsText = '';
  if (open >= 0 && shut > open) {
    for (const one of splitTop(head.slice(open + 1, shut), ',')) {
      const colon = one.indexOf(':');
      let name = (colon < 0 ? one : one.slice(0, colon)).trim();
      const optional = name.endsWith('?');
      if (optional) name = name.slice(0, -1).trim();
      const typeText = colon < 0 ? '' : one.slice(colon + 1).trim();
      params.push({ name, text: typeText, type: parseType(typeText, aliases, generics), optional });
    }
    const after = head.slice(shut + 1).trim();
    returnsText = after.startsWith(':') ? after.slice(1).trim() : '';
  }

  return { above, head, params, returnsText, returns: parseType(returnsText, aliases, generics) };
}

/**
 * A long union alias, laid out the way Prettier would lay it out: one member
 * to a line. On one line `type Shape = { … } | { … } | { … }` wraps wherever
 * the box happens to end, and the bars that matter are lost in the middle.
 */
export function layoutAlias(line: string, width: number = 64): string {
  const found = /^(\s*type\s+[A-Za-z_$][\w$]*\s*=)\s*([\s\S]*?)(;?)\s*$/.exec(line);
  if (found === null || line.length <= width) return line;
  const members = splitTop(found[2] ?? '', '|');
  if (members.length < 2) return line;
  return `${found[1] ?? ''}\n${members.map((one) => `  | ${one}`).join('\n')}${found[3] ?? ''}`;
}

const isRecord = (value: Value): value is { readonly [key: string]: Value } =>
  typeof value === 'object' && !Array.isArray(value);

/** Whether a value keeps the promise a type makes. A null type promises nothing. */
export function fits(value: Value | null, type: Type | null, depth: number = 0): boolean {
  if (type === null || depth > 64) return true;
  if (value === null) return false;
  switch (type.kind) {
    case 'number':
    case 'string':
    case 'boolean':
      return typeof value === type.kind;
    case 'unknown':
      return true;
    case 'literal':
      return value === type.value;
    case 'list':
      return Array.isArray(value) && (value as readonly Value[]).every((item) => fits(item, type.of, depth + 1));
    case 'tuple':
      return (
        Array.isArray(value) &&
        value.length === type.of.length &&
        type.of.every((one, i) => fits((value as readonly Value[])[i] ?? null, one, depth + 1))
      );
    case 'union':
      return type.of.some((one) => fits(value, one, depth + 1));
    case 'object': {
      if (!isRecord(value)) return false;
      return type.fields.every((field) =>
        Object.hasOwn(value, field.name) ? fits(value[field.name] ?? null, field.type, depth + 1) : field.optional,
      );
    }
    case 'record':
      return isRecord(value) && Object.values(value).every((item) => fits(item, type.of, depth + 1));
    case 'ref':
      return fits(value, type.resolve(), depth + 1);
  }
}
