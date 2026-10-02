/**
 * The shape of an ending over time.
 *
 * Apart from the drawing for the same reason the rules are: this is the part
 * that can be wrong in a way that matters — a result card readable before the
 * thing it reports has finished happening spoils the one moment the game has
 * — and `render.ts` cannot be loaded by a test, because the tools and tests
 * are typed without a DOM in them and it is full of canvas.
 */

import { RULES } from './game.js';
import type { Outcome } from './game.js';

/**
 * How long each ending takes to play before the result card is readable.
 *
 * Getting out is the longest because it is the only one worth watching twice;
 * being crushed is the shortest because it is sudden, and stretching it would
 * only hold the player away from pressing Again.
 */
const BEAT: Readonly<Record<Outcome, number>> = {
  playing: 0,
  out: 2.1,
  drowned: 1.6,
  crushed: 1.1,
  buried: 1.5,
};

export interface Beat {
  /** 0 to 1 through the beat. */
  readonly t: number;
  /** Pixels of shake. */
  readonly shake: number;
  /** Extra rows of water, for the ending that drowns him. */
  readonly swallow: number;
  /** Rows he steps up onto the rim, for the one where he gets out. */
  readonly rise: number;
  /** And columns he then walks away across it. */
  readonly stride: number;
  /** Daylight coming in over the rim. */
  readonly glow: number;
  /** Dark coming down from it instead. */
  readonly dark: number;
  readonly veil: number;
  readonly text: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
/** Fast at first and settling, which is how all four of these should feel. */
const ease = (t: number): number => 1 - (1 - t) ** 3;

/**
 * The shape of an ending at a given moment. Pure, so the timings can be
 * checked without a canvas: what matters is that the result card is never
 * readable before the thing it is reporting has finished happening.
 */
export function beatOf(outcome: Outcome, since: number): Beat {
  const span = BEAT[outcome];
  if (span === 0) {
    return { t: 0, shake: 0, swallow: 0, rise: 0, stride: 0, glow: 0, dark: 0, veil: 0, text: 0 };
  }
  const t = clamp01(since / span);
  const e = ease(t);

  return {
    t,
    // A shake has to die away faster than it arrives or it reads as a rumble.
    shake: outcome === 'crushed' ? (1 - t) ** 2 * Math.sin(since * 46) * 13 : 0,
    swallow: outcome === 'drowned' ? e * (RULES.rows + 2) : 0,
    // He leaves sideways rather than upwards, and at the height he already
    // stands at. There is barely one and a half cells above the rim and he is
    // two and a half tall, so lifting him at all puts his head through the
    // readout at the top of the screen.
    rise: 0,
    stride: outcome === 'out' ? e * 5.5 : 0,
    glow: outcome === 'out' ? e : 0,
    dark: outcome === 'buried' ? e : outcome === 'crushed' ? e * 0.55 : 0,
    veil: clamp01((t - 0.45) / 0.35),
    text: clamp01((t - 0.62) / 0.38),
  };
}
