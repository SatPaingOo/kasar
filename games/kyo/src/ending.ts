/**
 * The shape of an ending over time.
 *
 * Apart from the drawing, for the same reason the rules are: this is the part
 * that can be wrong in a way that matters — a result card readable before the
 * thing it reports has finished happening spoils the one moment the run has —
 * and `render.ts` cannot be loaded by a test, because the tools and tests are
 * typed without a DOM in them and it is full of canvas.
 */

import type { Outcome } from './game.js';

/**
 * How long each ending plays before the card is readable.
 *
 * Getting across is the longer one because it is the only one worth watching
 * twice. Falling is short: it is sudden, and stretching it would only hold the
 * player away from pressing Again.
 */
const BEAT: Readonly<Record<Outcome, number>> = {
  swinging: 0,
  across: 2,
  fallen: 1.3,
};

export interface Beat {
  /** 0 to 1 through the beat. */
  readonly t: number;
  /** Pixels of shake, for the one that ends on the floor. */
  readonly shake: number;
  /** The bloom of dust thrown up by the impact, 0 to 1. */
  readonly puff: number;
  /** World units he sails on after the far side, so he does not stop dead. */
  readonly coast: number;
  /** Light opening up over the far side. */
  readonly glow: number;
  /** And the dark closing instead. */
  readonly dim: number;
  readonly veil: number;
  readonly text: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
/** Fast at first and settling, which is how both of these should feel. */
const ease = (t: number): number => 1 - (1 - t) ** 3;

export function beatOf(outcome: Outcome, since: number): Beat {
  const span = BEAT[outcome];
  if (span === 0) {
    return { t: 0, shake: 0, puff: 0, coast: 0, glow: 0, dim: 0, veil: 0, text: 0 };
  }
  const t = clamp01(since / span);
  const e = ease(t);

  return {
    t,
    // A shake has to die away faster than it arrives, or it reads as a rumble
    // rather than as hitting something.
    shake: outcome === 'fallen' ? (1 - t) ** 2 * Math.sin(since * 52) * 11 : 0,
    // The dust blooms quickly and then hangs, which is what dust does.
    puff: outcome === 'fallen' ? clamp01(t * 4) * (1 - t * 0.55) : 0,
    coast: outcome === 'across' ? e * 26 : 0,
    glow: outcome === 'across' ? e : 0,
    dim: outcome === 'fallen' ? e * 0.72 : 0,
    veil: clamp01((t - 0.45) / 0.35),
    text: clamp01((t - 0.62) / 0.38),
  };
}
