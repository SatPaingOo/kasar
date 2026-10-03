/**
 * The timing of one blow.
 *
 * Apart from the drawing because the drawing cannot be tested — the tools and
 * tests here are typed without a DOM — and because the timing is the thing
 * that was wrong. The first version threw a small lunge and a small recoil at
 * each other in under half a second with nothing else, and it was impossible
 * to tell who had hit whom, or why. A blow now winds up, lands, and then
 * *holds*, because the hold is where the answer is readable.
 */

/** One blow, start to finish. */
export const BLOW = 1.05;

export interface Swing {
  /** 0 to 1, pulling back. */
  readonly windup: number;
  /** 0 to 1, out to full reach. Peaks at the moment of impact. */
  readonly reach: number;
  /** A flash at the point of contact, over almost at once. */
  readonly flash: number;
  /** Pixels of shake, dying fast. */
  readonly shake: number;
  /** Shards thrown off the impact, 0 to 1 through their flight. */
  readonly shards: number;
  /** How far up the caption under the fight is. */
  readonly caption: number;
  /** True once the blow has actually landed, so nothing reacts early. */
  readonly struck: boolean;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** When in the blow the hit happens. Everything before is a wind-up. */
const IMPACT = 0.34;

export function swingAt(since: number, hard: number = 1): Swing {
  const t = clamp01(since / BLOW);
  const struck = t >= IMPACT;
  const after = clamp01((t - IMPACT) / (1 - IMPACT));

  return {
    windup: t < IMPACT ? Math.sin((t / IMPACT) * Math.PI * 0.5) : 0,
    // Out hard to the impact, then eased back rather than snapped back.
    reach: t < IMPACT ? Math.sin((t / IMPACT) * Math.PI * 0.5) : 1 - after ** 0.6,
    flash: struck ? Math.max(0, 1 - after * 6) : 0,
    shake: struck ? (1 - after) ** 3 * Math.sin(since * 60) * 9 * hard : 0,
    shards: struck ? after : 0,
    // The caption comes up with the hit and stays up for the rest of it: the
    // hold is the whole point, and a caption that leaves with the flash may as
    // well not be there.
    caption: struck ? clamp01(after * 5) : 0,
    struck,
  };
}
