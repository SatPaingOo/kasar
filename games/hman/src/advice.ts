/**
 * What to tell someone whose code did not run.
 *
 * Apart from the runner because the runner is full of workers and blobs, and
 * the tools and tests here are typed without a DOM in them — so nothing that
 * imports it can be tested. This is only string work, and it is the part worth
 * testing: the engine's own wording for these is useless to a beginner.
 */

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
