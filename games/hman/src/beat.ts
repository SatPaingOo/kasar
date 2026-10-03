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

/**
 * One blow, start to finish — and a much shorter one for the rest of a flurry.
 *
 * Four correct cases are four blows, and at a full beat each that was three
 * and a quarter seconds of good news delivered one slow punch at a time, with
 * the desk locked for all of it. Answering a rung correctly then took over six
 * seconds to say so, which reads as nothing having happened.
 *
 * So the first blow of a submit gets the full beat and the hits after it are
 * quick. A miss always gets the full beat wherever it falls, because the miss
 * is the one carrying something you have to read.
 */
export const BLOW = 0.8;
export const BLOW_AGAIN = 0.3;

export function blowSeconds(landed: boolean, index: number): number {
  return landed && index > 0 ? BLOW_AGAIN : BLOW;
}

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

export function swingAt(since: number, hard: number = 1, span: number = BLOW): Swing {
  const t = clamp01(since / span);
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

/** How long a topple takes before the card is readable. */
export const DOWN = 0.9;

export interface Falling {
  /** 0 on his feet, 1 flat out. */
  readonly over: number;
  readonly shake: number;
  readonly dim: number;
  readonly caption: number;
}

/**
 * Going down.
 *
 * He topples rather than fading: a run that ends with a figure quietly
 * replaced by a card never tells you that it was *him* that lost.
 */
export function fallAt(since: number): Falling {
  const t = clamp01(since / DOWN);
  return {
    // Slow off the mark and then all at once, the way falling over works.
    over: clamp01((t / 0.55) ** 1.8),
    shake: t > 0.5 ? (1 - clamp01((t - 0.5) / 0.2)) ** 2 * Math.sin(since * 70) * 7 : 0,
    dim: clamp01((t - 0.3) / 0.5) * 0.55,
    caption: clamp01((t - 0.62) / 0.38),
  };
}

/** How long the end of a whole run plays before its card comes up. */
export const WIN = 3.2;

export interface Winning {
  /** 0 the beaten mirror is still lying there, 1 it is gone. */
  readonly fade: number;
  /** The pieces of it, 0 to 1 through their flight upwards. */
  readonly shards: number;
  /** 0 arms down, 1 both up over his head. */
  readonly cheer: number;
  /** How far off the floor he is, 0 to 1, for the jumps. */
  readonly hop: number;
  /** How much the room has lit up. */
  readonly glow: number;
  /** The count of rungs, coming up last. */
  readonly caption: number;
}

const easeOut = (t: number): number => 1 - (1 - t) ** 3;

/**
 * Winning the whole run.
 *
 * Every rung already ends with the mirror going over. The last one has to be
 * more than that, or seventy-five rungs end the same way the first one did:
 * so the mirror does not get up again. It comes apart and the pieces go up and
 * out of the room, and he is left in it on his own, arms up, jumping — the
 * version of him that kept getting it wrong is not coming back.
 */
export function winAt(since: number): Winning {
  const t = Math.max(0, since);
  const jumping = t > 0.7 && t < 2.3;
  return {
    fade: clamp01(t / 0.9),
    shards: clamp01(t / 2.4),
    cheer: easeOut(clamp01((t - 0.45) / 0.55)),
    // Three small jumps, then he stays down.
    hop: jumping ? Math.abs(Math.sin(((t - 0.7) / 1.6) * Math.PI * 3)) : 0,
    glow: clamp01((t - 0.3) / 1.6) * 0.32,
    caption: clamp01((t - 1.4) / 0.6),
  };
}
