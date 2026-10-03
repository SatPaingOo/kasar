/**
 * What to tell someone whose code did not do what was asked.
 *
 * Apart from the runner because the runner is full of workers and blobs, and
 * the tools and tests here are typed without a DOM in them — so nothing that
 * imports it can be tested. This is only string work, and it is the part worth
 * testing: the engine's own wording for these is useless to a beginner.
 */

import { fits } from './types.js';
import type { Type } from './types.js';
import type { Value } from './values.js';

export type Advice = 'loop' | 'annotation' | 'plain';

/**
 * A type annotation in the box.
 *
 * Matched on the source rather than on the error text. `const x: number` comes
 * back as "Missing initializer in const declaration", which says nothing about
 * types; a parameter annotation comes back as "Unexpected token ':'", which
 * says nothing either. Both are the same mistake and deserve the same answer:
 * the signature above the box is TypeScript, the box is not.
 *
 * Object literals and conditional expressions both contain a colon too, and
 * neither is this, so both are left alone.
 */
function annotated(source: string): boolean {
  const declared = /(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:/.test(source);
  const inParams = /\([^)]*[A-Za-z_$][\w$]*\s*:\s*[A-Za-z]/.test(source);
  return declared || inParams;
}

export function adviseOn(source: string, fatal: string | null): Advice {
  if (fatal === null) return 'plain';
  if (fatal === 'timeout') return 'loop';
  return annotated(source) ? 'annotation' : 'plain';
}

/**
 * The line of the box something threw on, read out of its stack.
 *
 * Every engine writes a frame as `<script>:<line>:<column>`, whatever it puts
 * around it, so this looks for the script's own address rather than for any
 * one engine's format. The first frame that lands inside the box is the one
 * that matters: anything after it is the harness that called the player's
 * code, which the player never wrote.
 */
export function lineOf(stack: string, script: string, above: number): number | null {
  const marker = `${script}:`;
  let at = stack.indexOf(marker);
  while (at >= 0) {
    const found = /^(\d+):\d+/.exec(stack.slice(at + marker.length));
    if (found !== null) {
      const line = Number(found[1]) - above;
      if (line >= 1) return line;
    }
    at = stack.indexOf(marker, at + marker.length);
  }
  return null;
}

/** One case that came back wrong, as much of it as advice needs. */
export interface Missed {
  readonly got: Value | null;
  /** Its type in TypeScript's words: `number[]`, `undefined`, `NaN`. */
  readonly type: string;
  readonly error: string | null;
}

/**
 * Why an answer was wrong, from most to least specific.
 *
 * The order is the point. "Came back undefined, needed 4" is true and nearly
 * useless. With no `return` in the box at all, a missing return is the
 * mistake every time; with one there, undefined means the thing returned was
 * not there — an index one past the end, a property spelt wrong — and saying
 * "is a return missing?" to someone looking straight at their return is how
 * advice stops being read. A broken promise about the *shape* comes before a
 * wrong value for the same reason: if a list was promised and a number came
 * back, which number it was is not the interesting part.
 */
export type Why =
  | { readonly kind: 'threw' }
  | { readonly kind: 'noReturn' }
  | { readonly kind: 'notThere' }
  | { readonly kind: 'nan' }
  | { readonly kind: 'promise' }
  | { readonly kind: 'value' };

/** Whether the code says `return` anywhere outside a comment or a string. */
export function returnsSomething(source: string): boolean {
  const bare = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, '');
  return /\breturn\b/.test(bare);
}

export function whyMissed(missed: Missed, returns: Type | null, source: string): Why {
  if (missed.error !== null) return { kind: 'threw' };
  if (missed.type === 'undefined') return { kind: returnsSomething(source) ? 'notThere' : 'noReturn' };
  if (/\bNaN\b/.test(missed.type)) return { kind: 'nan' };
  if (!fits(missed.got, returns)) return { kind: 'promise' };
  return { kind: 'value' };
}
