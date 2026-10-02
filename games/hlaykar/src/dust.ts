/**
 * What is left in the air after a stone comes apart.
 *
 * Two things, because a breaking stone is two things: chips, which are pieces
 * of the stone thrown out and falling, and dust, which hangs and spreads and
 * goes nowhere. Chips alone read as a firework; dust alone reads as smoke.
 *
 * The same machinery carries the bubbles that come up when the water takes
 * him, which are dust that happens to fall upwards.
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
  kind: MoteKind;
}

export type MoteKind = 'chip' | 'dust' | 'bubble';

const DUST = {
  chipsPerCell: 4,
  dustPerCell: 5,
  /** Rows per second per second. Dust barely feels it; chips do. */
  chipGravity: 15,
  dustGravity: 1.6,
  /** Bubbles fall upwards, and faster the longer they have been going. */
  bubbleLift: -2.6,
  bubbleWobble: 2.4,
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
        kind: 'chip',
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
        kind: 'dust',
      });
    }
  }
  return motes;
}

/** The water closing over him: a column of bubbles going the other way. */
export function bubbles(motes: Mote[], col: number, row: number, random: () => number = Math.random): Mote[] {
  for (let i = 0; i < 14; i += 1) {
    if (motes.length >= DUST.most) return motes;
    const span = 0.7 + random() * 1.1;
    motes.push({
      col: col + 0.5 + (random() - 0.5) * 0.8,
      row: row + 0.3 + random() * 0.7,
      vcol: 0,
      vrow: -0.6 - random() * 1.1,
      life: span,
      span,
      size: 0.07 + random() * 0.11,
      // Reused as the wobble's phase, so no two of them sway together.
      angle: random() * Math.PI * 2,
      spin: 0,
      kind: 'bubble',
    });
  }
  return motes;
}

/** Move everything on, and drop whatever has finished. */
export function stepMotes(motes: Mote[], dt: number): Mote[] {
  let kept = 0;
  for (const mote of motes) {
    mote.life -= dt;
    if (mote.life <= 0) continue;

    if (mote.kind === 'bubble') {
      mote.vrow += DUST.bubbleLift * dt;
      mote.angle += dt * 5;
      mote.vcol = Math.sin(mote.angle) * DUST.bubbleWobble * 0.25;
      mote.col += mote.vcol * dt;
      mote.row += mote.vrow * dt;
      motes[kept] = mote;
      kept += 1;
      continue;
    }

    if (mote.kind === 'chip') {
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
