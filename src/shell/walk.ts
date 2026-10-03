/**
 * How the shelf's figure puts one foot in front of the other.
 *
 * Where he goes used to live here too, back when all he had was a strip of
 * floor along the bottom of the window; that is roam.ts now, over the whole
 * page. What is left is the walk cycle itself, kept on its own because it is
 * easy to get backwards and hard to see — see below.
 *
 * This is the shelf's own, not a game's. It knows nothing about any game and
 * imports nothing from `games/`.
 */

/**
 * Where one foot sits in the walk cycle: `reach` is its position ahead of the
 * hip as a fraction of the stride, `lift` how far off the ground as a fraction
 * of the foot lift.
 *
 * A foot is planted while it travels backwards, because that is the half of
 * the cycle carrying the body forwards, and in the air while it swings
 * forwards. Having those two halves the wrong way round is a moonwalk: the
 * legs still scissor, the figure still moves, and it reads as walking
 * backwards. It is easy to write and hard to see, which is why it is here and
 * tested rather than buried in the drawing.
 */
export function footAt(phase: number): { readonly reach: number; readonly lift: number } {
  return { reach: Math.cos(phase), lift: Math.max(0, -Math.sin(phase)) };
}
