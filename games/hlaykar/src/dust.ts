/**
 * What is left in the air after a stone comes apart.
 *
 * Two things, because a breaking stone is two things: chips, which are pieces
 * of the stone thrown out and falling, and dust, which hangs and spreads and
 * goes nowhere. Chips alone read as a firework; dust alone reads as smoke.
 *
 * Everything here is in grid coordinates — fractional columns and rows — not
 * pixels, so a burst looks the same on a phone as on a desktop and survives
 * the window being resized mid-flight.
 */

import { RULES } from './game.js';
import type { Offset } from './game.js';

export interface Mote {
  /** Fractional column and row. */
  col: number;
  row: number;
  /** Columns and rows per second. */
  vcol: number;
  vrow: number;
  life: number;
  span: number;
  size: number;
  angle: number;
  spin: number;
  chip: boolean;
}

const DUST = {
  chipsPerCell: 4,
  dustPerCell: 5,
  /** Rows per second per second. Dust barely feels it; chips do. */
  chipGravity: 15,
  dustGravity: 1.6,
  /** Dust slows as it spreads, chips do not. */
  dustDrag: 1.9,
  /**
   * A hard cap. A breaker takes at most four cells, so a burst is about forty
   * motes and nothing can queue them up faster than they expire — but a cap
   * is a cheap guarantee and an uncapped particle array is a classic way to
   * turn a small game into a slow one.
   */
  most: 260,
} as const;

/** Add the wreckage of one broken cell. Mutates and returns the same array. */
export function burst(motes: Mote[], at: readonly Offset[], random: () => number = Math.random): Mote[] {
  for (const [row, col] of at) {
    for (let i = 0; i < DUST.chipsPerCell; i += 1) {
      if (motes.length >= DUST.most) return motes;
      const span = 0.45 + random() * 0.4;
      motes.push({
        col: col + 0.2 + random() * 0.6,
        row: row + 0.2 + random() * 0.6,
        vcol: (random() - 0.5) * 5,
        vrow: -1.4 - random() * 2.6,
        life: span,
        span,
        size: 0.1 + random() * 0.14,
        angle: random() * Math.PI,
        spin: (random() - 0.5) * 14,
        chip: true,
      });
    }
    for (let i = 0; i < DUST.dustPerCell; i += 1) {
      if (motes.length >= DUST.most) return motes;
      const span = 0.55 + random() * 0.55;
      motes.push({
        col: col + 0.5 + (random() - 0.5) * 0.7,
        row: row + 0.5 + (random() - 0.5) * 0.7,
        vcol: (random() - 0.5) * 2.4,
        vrow: -0.5 - random() * 1.2,
        life: span,
        span,
        size: 0.16 + random() * 0.2,
        angle: 0,
        spin: 0,
        chip: false,
      });
    }
  }
  return motes;
}

/** Move everything on, and drop whatever has finished. */
export function stepMotes(motes: Mote[], dt: number): Mote[] {
  let kept = 0;
  for (const mote of motes) {
    mote.life -= dt;
    if (mote.life <= 0) continue;

    if (mote.chip) {
      mote.vrow += DUST.chipGravity * dt;
      mote.angle += mote.spin * dt;
    } else {
      mote.vrow += DUST.dustGravity * dt;
      const drag = Math.max(0, 1 - DUST.dustDrag * dt);
      mote.vcol *= drag;
      mote.vrow *= drag;
    }
    mote.col += mote.vcol * dt;
    mote.row += mote.vrow * dt;

    // A chip that reaches the floor stops there rather than falling out of
    // the shaft, which is the only bit of collision any of this gets.
    if (mote.row > RULES.rows - 0.1) {
      mote.row = RULES.rows - 0.1;
      mote.vrow = 0;
      mote.vcol *= 0.6;
    }

    motes[kept] = mote;
    kept += 1;
  }
  motes.length = kept;
  return motes;
}
