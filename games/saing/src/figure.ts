/**
 * The man in the middle of the circle.
 *
 * His own figure, written here; the folder rule says no game reaches into
 * another, and this one could not borrow anyway. The others run, climb and
 * hang. He sits cross-legged and never goes anywhere, so everything he says
 * is in his head and his hands: which way he is listening, whether he has
 * the beat, which drum he is reaching for.
 *
 * A pat waing is played with the hands, not with sticks, so his palms are
 * what strike.
 */

/** Seat at the origin, up is -y. Measured in a body about 22 tall. */
const BODY = {
  headRadius: 3.6,
  head: -15.2,
  shoulder: -10.4,
  shoulderWide: 3.4,
  upperArm: 5.4,
  forearm: 5.4,
  knee: { x: 7.5, y: 0.6 },
  foot: { x: 2.8, y: 2.4 },
  rest: { x: 6.8, y: -0.8 },
  lineWidth: 1.05,
  height: 22,
} as const;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** One hand: where it is reaching, in pixels from his seat, and how far there it has got. */
export interface Hand {
  readonly to: Point | null;
  /** 0 resting on the knee, 1 the moment the palm lands. */
  readonly reach: number;
}

export interface Pose {
  /** The hand on the screen's left, and the one on its right. */
  readonly left: Hand;
  readonly right: Hand;
  /** The dip of his head on the beat, 0 to 1. */
  readonly nod: number;
  /** Which way he is listening, -1 to the left to 1 to the right. */
  readonly listen: number;
  /** 0 upright, 1 slumped: the circle has stopped. */
  readonly slump: number;
  /** 0 hands down, 1 both hands up: the piece is through. */
  readonly lift: number;
}

function line(ctx: CanvasRenderingContext2D, ...points: readonly Point[]): void {
  const [first, ...rest] = points;
  if (first === undefined) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const p of rest) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * Where the elbow goes for a hand at `hand`, bending away from the body —
 * the two-bone answer, with the arm straightened if the hand is out of reach.
 */
function elbowFor(shoulder: Point, hand: Point, side: 1 | -1): Point {
  const a = BODY.upperArm;
  const b = BODY.forearm;
  const dx = hand.x - shoulder.x;
  const dy = hand.y - shoulder.y;
  const d = Math.min(Math.hypot(dx, dy), a + b - 0.01);
  if (d < 0.01) return { x: shoulder.x + side * a, y: shoulder.y };
  const cos = (a * a + d * d - b * b) / (2 * a * d);
  const bend = Math.acos(Math.max(-1, Math.min(1, cos)));
  const base = Math.atan2(dy, dx);
  // Two answers; take the one whose elbow is further out from his middle.
  const one = { x: shoulder.x + Math.cos(base + bend) * a, y: shoulder.y + Math.sin(base + bend) * a };
  const two = { x: shoulder.x + Math.cos(base - bend) * a, y: shoulder.y + Math.sin(base - bend) * a };
  return one.x * side > two.x * side ? one : two;
}

/** The hand at full stretch towards a point, from the shoulder. */
function towards(shoulder: Point, target: Point): Point {
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const d = Math.hypot(dx, dy);
  const reach = (BODY.upperArm + BODY.forearm) * 0.95;
  if (d <= reach || d < 0.01) return target;
  return { x: shoulder.x + (dx / d) * reach, y: shoulder.y + (dy / d) * reach };
}

/**
 * Draw him with his seat at (x, y), `size` pixels tall sitting down.
 */
export function drawFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  pose: Pose,
  ink: string,
): void {
  const scale = size / BODY.height;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = BODY.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Legs crossed in front of him, each foot tucked under the other knee.
  for (const side of [-1, 1] as const) {
    line(
      ctx,
      { x: side * 1.2, y: 0 },
      { x: side * BODY.knee.x, y: BODY.knee.y },
      { x: -side * BODY.foot.x, y: BODY.foot.y + (side > 0 ? 0.3 : 0) },
    );
  }

  const sag = pose.slump * 1.4;
  const neck: Point = { x: pose.listen * 0.4, y: BODY.shoulder - 0.6 + sag };
  line(ctx, { x: 0, y: 0 }, neck);

  for (const side of [-1, 1] as const) {
    const hand = side < 0 ? pose.left : pose.right;
    const shoulder: Point = { x: side * BODY.shoulderWide + pose.listen * 0.3, y: BODY.shoulder + sag };
    const rest: Point = { x: side * BODY.rest.x, y: BODY.rest.y };
    let at = rest;
    if (hand.to !== null && hand.reach > 0) {
      const target = towards(shoulder, { x: hand.to.x / scale, y: hand.to.y / scale });
      at = lerp(rest, target, hand.reach);
    }
    if (pose.lift > 0) at = lerp(at, { x: side * 5.5, y: -24 }, pose.lift);
    const elbow = elbowFor(shoulder, at, side);
    line(ctx, neck, shoulder, elbow, at);
    ctx.beginPath();
    ctx.arc(at.x, at.y, 1.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // The head dips on the beat, leans towards what he is listening to, and
  // drops when the music stops.
  const head: Point = {
    x: pose.listen * 1.3,
    y: BODY.head + pose.nod * 0.9 + pose.slump * 3.2,
  };
  ctx.beginPath();
  ctx.arc(head.x, head.y, BODY.headRadius, 0, Math.PI * 2);
  ctx.stroke();

  const look = pose.listen * 0.9;
  for (const side of [-1, 1]) {
    const ex = head.x + side * 1.35 + look;
    const ey = head.y - 0.2 + pose.slump * 0.9;
    if (pose.slump > 0.5) {
      // Eyes shut.
      line(ctx, { x: ex - 0.7, y: ey }, { x: ex + 0.7, y: ey });
    } else {
      ctx.beginPath();
      ctx.arc(ex, ey, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
