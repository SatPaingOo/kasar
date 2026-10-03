/**
 * Where the drums sit in the circle, and which one a tap was meant for.
 *
 * Apart from the drawing because it is the part a test has to be able to
 * reach: a tap that lands on the wrong drum breaks the phrase, so which drum
 * a point on the screen means is a rule, not a matter of taste.
 *
 * Everything here is in the ring's own coordinates — the ellipse squashed back
 * to a unit circle, centre at the origin, y down as on the screen.
 */

export const CIRCLE = {
  /** The opening at the front of the frame, where he gets in, in radians. */
  gap: 1.15,
  /** A tap nearer the middle than this, as a share of the ring, is on him and strikes nothing. */
  dead: 0.3,
  /** How far in from the frame the drums hang, as a share of the ring. */
  inset: 0.8,
} as const;

/**
 * The angle drum `i` of `n` sits at.
 *
 * The lowest at the front on the left, round the back, to the highest at the
 * front on the right — so the drums run left to right the way the keys under
 * the player's fingers do, and a drum that joins at the top of the scale
 * joins at the right-hand end.
 */
export function angleOf(i: number, n: number): number {
  if (n <= 1) return Math.PI * 1.5;
  const first = Math.PI / 2 + CIRCLE.gap / 2;
  return first + ((2 * Math.PI - CIRCLE.gap) * i) / (n - 1);
}

/** The difference between two angles, folded into -π..π. */
function turn(a: number, b: number): number {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * The drum a tap at (u, v) means, or null if it means none.
 *
 * Whichever drum is nearest by angle, not by distance: every drum owns a
 * whole wedge of the screen out to the edge, so on a phone a tap does not
 * have to land on a drum head to count, only on the right side of it.
 */
export function drumAt(u: number, v: number, n: number): number | null {
  if (n <= 0 || Math.hypot(u, v) < CIRCLE.dead) return null;
  const at = Math.atan2(v, u);
  let best = 0;
  let nearest = Infinity;
  for (let i = 0; i < n; i += 1) {
    const d = Math.abs(turn(at, angleOf(i, n)));
    if (d < nearest) {
      nearest = d;
      best = i;
    }
  }
  return best;
}

/** Keys for the drums, low to high: the home row, both hands. */
export const KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'] as const;

/** The drum a key strikes, or null. The number row works too, 1 for the lowest. */
export function drumForKey(key: string, n: number): number | null {
  const lower = key.toLowerCase();
  let i = KEYS.indexOf(lower as (typeof KEYS)[number]);
  if (i < 0 && /^[1-8]$/.test(lower)) i = Number(lower) - 1;
  return i >= 0 && i < n ? i : null;
}
