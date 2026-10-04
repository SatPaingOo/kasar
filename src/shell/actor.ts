/**
 * Who is on the page, as far as the scene is concerned: a body that moves by
 * the rules in roam.ts, and what the drawing needs besides — what it is
 * saying, how much of it can be seen, whether it is waving or stroking a cat.
 *
 * Shared by Tote Tote, the cat who lives at the foot of the page, and
 * whoever comes to visit. Pure: no DOM, no clock.
 */

import type { Point, Roamer } from './roam.js';

export type Kind = 'tote' | 'friend' | 'cat' | 'bird';

/** What is said: a word, looked up in the page's language when it is drawn, or a sign that needs none. */
export type Say = 'name' | 'hello' | 'bye' | 'meow' | '♪' | '!' | '?' | '…' | '♥' | 'ha' | 'zZ';

export interface Actor {
  readonly kind: Kind;
  readonly body: Roamer;
  say: Say | null;
  /** Seconds left of what is being said. */
  sayFor: number;
  /** 0 to 1: how much of it can be seen — coming out of a doorway, say. */
  alpha: number;
  /** Seconds left of waving. */
  wave: number;
  /** Seconds left of bending down to stroke the cat. */
  pet: number;
}

/** How long anything said stays said. */
export const SAY_FOR = 2.2;

export function actor(kind: Kind, body: Roamer, alpha = 1): Actor {
  return { kind, body, say: null, sayFor: 0, alpha, wave: 0, pet: 0 };
}

export function say(a: Actor, what: Say): void {
  a.say = what;
  a.sayFor = SAY_FOR;
}

/** Run the clocks on what is being said and done. */
export function tick(a: Actor, dt: number): void {
  a.sayFor = Math.max(0, a.sayFor - dt);
  if (a.sayFor === 0) a.say = null;
  a.wave = Math.max(0, a.wave - dt);
  a.pet = Math.max(0, a.pet - dt);
}

/** On the same surface and within so many pixels of each other. */
export const together = (a: Roamer, b: Roamer, within: number): boolean =>
  a.surface !== null && a.surface === b.surface && Math.abs(a.x - b.x) <= within;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const between = (random: () => number, [lo, hi]: readonly [number, number]): number => lo + random() * (hi - lo);

/** How tall he stands, sits and stoops, in pixels: where his head is, for a bird to land on. */
const TALL = { standing: 55, sitting: 33, stooping: 45 } as const;

/** The top of his head, wherever he is and however he is standing. */
export function headOf(tote: Roamer): Point {
  const f = tote.facing;
  if (tote.mode === 'sit' || tote.mode === 'cross') return { x: tote.x - f, y: tote.y - TALL.sitting };
  if (tote.mode === 'look') return { x: tote.x + f * 13, y: tote.y - TALL.stooping };
  return { x: tote.x, y: tote.y - TALL.standing };
}
