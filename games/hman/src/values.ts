/**
 * What an answer can be, and how two of them are compared and shown.
 *
 * The first four rungs only ever dealt in numbers and lists of numbers, and
 * that was enough for four. It is not enough for a ladder: a function that
 * says yes or no, one that gives back a word, one that hands back a record —
 * those are most of what real code returns, and a rung cannot ask for any of
 * them if the answer cannot hold one.
 *
 * So an answer is anything JSON could carry. Nothing here touches the DOM, so
 * it can be tested.
 */

export type Value = number | string | boolean | readonly Value[] | { readonly [key: string]: Value };

/** How deep a returned value may nest before it is refused. */
const DEEP = 8;
/** How many items a returned list may hold before it is refused. */
const WIDE = 10_000;

const isPlainObject = (raw: object): boolean => {
  const proto: unknown = Object.getPrototypeOf(raw);
  return proto === Object.prototype || proto === null;
};

/**
 * What came back, as a value the rules can compare — or null when it is not
 * one.
 *
 * A Set, a Map, NaN, undefined and a function all come back as null and count
 * as a miss. That is both safe and the honest answer to "that is not what was
 * asked for"; what the player is told about it is decided from `inspect`.
 */
export function clean(raw: unknown, depth: number = 0): Value | null {
  if (depth > DEEP) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string' || typeof raw === 'boolean') return raw;
  if (Array.isArray(raw)) {
    if (raw.length > WIDE) return null;
    const list: Value[] = [];
    for (const item of raw as readonly unknown[]) {
      const one = clean(item, depth + 1);
      if (one === null) return null;
      list.push(one);
    }
    return list;
  }
  if (typeof raw === 'object' && raw !== null && isPlainObject(raw)) {
    const out: Record<string, Value> = {};
    for (const [key, item] of Object.entries(raw)) {
      const one = clean(item, depth + 1);
      if (one === null) return null;
      out[key] = one;
    }
    return out;
  }
  return null;
}

/** Floating point is not exact, and 0.1 + 0.2 is right. */
function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Two answers are the same answer.
 *
 * Deliberately strict about shape: a rung that asks for a list and is handed
 * a single number has not been answered, even when the number is right, and
 * `4` is not `"4"`. Saying so is a large part of what the early rungs teach.
 * The order of a list matters; the order of a record's keys does not.
 */
export function same(a: Value | null, b: Value | null): boolean {
  if (a === null || b === null) return false;
  if (typeof a === 'number' || typeof b === 'number') {
    return typeof a === 'number' && typeof b === 'number' && near(a, b);
  }
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;

  const aList = Array.isArray(a);
  if (aList !== Array.isArray(b)) return false;
  if (aList) {
    const x = a as readonly Value[];
    const y = b as readonly Value[];
    return x.length === y.length && x.every((item, i) => same(item, y[i] ?? null));
  }

  const x = a as { readonly [key: string]: Value };
  const y = b as { readonly [key: string]: Value };
  const keys = Object.keys(x);
  if (keys.length !== Object.keys(y).length) return false;
  return keys.every((key) => Object.hasOwn(y, key) && same(x[key] ?? null, y[key] ?? null));
}

/** Longest a shown value gets before the middle of it is cut. */
const LONG = 90;

function cut(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const keep = Math.max(4, Math.floor((limit - 1) / 2));
  return `${text.slice(0, keep)}…${text.slice(text.length - keep)}`;
}

const NAME = /^[A-Za-z_$][\w$]*$/;

function shown(raw: unknown, depth: number): string {
  if (raw === undefined) return 'undefined';
  if (raw === null) return 'null';
  if (typeof raw === 'number') {
    if (Object.is(raw, -0)) return '0';
    return String(raw);
  }
  if (typeof raw === 'string') return JSON.stringify(raw);
  if (typeof raw === 'boolean') return String(raw);
  if (typeof raw === 'bigint') return `${raw}n`;
  if (typeof raw === 'function') return 'function';
  if (typeof raw === 'symbol') return 'symbol';
  if (depth > 3) return '…';

  if (Array.isArray(raw)) {
    return `[${(raw as readonly unknown[]).map((item) => shown(item, depth + 1)).join(', ')}]`;
  }
  if (raw instanceof Set) {
    return `Set {${[...(raw as Set<unknown>)].map((item) => shown(item, depth + 1)).join(', ')}}`;
  }
  if (raw instanceof Map) return `Map(${(raw as Map<unknown, unknown>).size})`;
  if (raw instanceof Date) return 'Date';
  if (typeof raw === 'object') {
    const entries = Object.entries(raw);
    if (entries.length === 0) return '{}';
    const inner = entries
      .map(([key, item]) => `${NAME.test(key) ? key : JSON.stringify(key)}: ${shown(item, depth + 1)}`)
      .join(', ');
    return `{ ${inner} }`;
  }
  return String(raw);
}

/** A value as it reads on screen: `[1, 2]`, `"aung"`, `{ name: "aung" }`. */
export function show(raw: unknown, limit: number = LONG): string {
  return cut(shown(raw, 0), limit);
}

/** A call, as it would be written: `strike([4, 9, 2])`, `strike(5, 1, 9)`. */
export function callOf(args: readonly unknown[], limit: number = LONG): string {
  return cut(`strike(${args.map((one) => shown(one, 0)).join(', ')})`, limit);
}

/**
 * The type of a value, written the way TypeScript would write it.
 *
 * This is what makes "wrong shape" readable: "the signature promises
 * `number[]` and this gave back `string[]`" is a type error in the words the
 * player is learning, which "wrong answer" is not.
 */
export function typeOf(raw: unknown, depth: number = 0): string {
  if (raw === undefined) return 'undefined';
  if (raw === null) return 'null';
  if (typeof raw === 'number') return Number.isNaN(raw) ? 'NaN' : 'number';
  if (typeof raw === 'string' || typeof raw === 'boolean' || typeof raw === 'bigint') return typeof raw;
  if (typeof raw === 'function') return 'function';
  if (typeof raw === 'symbol') return 'symbol';
  if (depth > 3) return 'object';

  if (Array.isArray(raw)) {
    const kinds = [...new Set((raw as readonly unknown[]).map((item) => typeOf(item, depth + 1)))];
    if (kinds.length === 0) return '[]';
    if (kinds.length === 1) return `${kinds[0] ?? 'unknown'}[]`;
    return `(${kinds.join(' | ')})[]`;
  }
  if (raw instanceof Set) {
    const kinds = [...new Set([...(raw as Set<unknown>)].map((item) => typeOf(item, depth + 1)))];
    return `Set<${kinds.length === 0 ? 'unknown' : kinds.join(' | ')}>`;
  }
  if (raw instanceof Map) return 'Map';
  if (raw instanceof Date) return 'Date';
  if (typeof raw === 'object') {
    const entries = Object.entries(raw);
    if (entries.length === 0) return '{}';
    return `{ ${entries.map(([key, item]) => `${key}: ${typeOf(item, depth + 1)}`).join('; ')} }`;
  }
  return 'unknown';
}

/** Everything the rest of the game needs to know about one returned value. */
export interface Inspected {
  /** Comparable, or null when it is not something an answer can be. */
  readonly value: Value | null;
  /** How it reads on screen, whatever it was. */
  readonly seen: string;
  /** Its type, in TypeScript's words. */
  readonly type: string;
}

export function inspect(raw: unknown): Inspected {
  return { value: clean(raw), seen: show(raw), type: typeOf(raw) };
}
