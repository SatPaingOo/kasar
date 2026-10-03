/**
 * The man on the rope.
 *
 * His own figure, written here. Three of these now exist on the shelf and none
 * of them may reach into another; that is the folder rule and it is doing its
 * job, because this one does something the other two cannot. He hangs. Nothing
 * he does is a walk cycle: his whole body is a line swung from one hand, and
 * what the player reads off him is which way he is going and whether he is
 * still holding on.
 */

/** Head at the origin, body hanging down the +y axis before it is turned. */
const BODY = {
  headRadius: 3.6,
  /** From the head down to the hips. */
  spine: 11,
  thigh: 6.4,
  shin: 6.4,
  upperArm: 5.6,
  forearm: 5.6,
  lineWidth: 2.4,
  /** He stands about this many world units tall. */
  tall: 2.4,
  /** Scaled against this, so the drawing is independent of the unit size. */
  height: 26,
} as const;

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Pose {
  /** Which way his body is swung, in radians from straight down. */
  readonly lean: number;
  /** Still holding the rope. */
  readonly held: boolean;
  /** How fast he is going, for how much the legs trail. */
  readonly speed: number;
  /** Which way he is travelling, for which way he faces. */
  readonly facing: 1 | -1;
  /** Seconds, for the small idle motion while he hangs. */
  readonly time: number;
}

function line(ctx: CanvasRenderingContext2D, from: Point, ...rest: readonly Point[]): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  for (const p of rest) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

const swing = (from: Point, angle: number, length: number): Point => ({
  x: from.x + Math.sin(angle) * length,
  y: from.y + Math.cos(angle) * length,
});

/**
 * Draw him with his hands at (x, y) — the end of the rope when he has one,
 * and the front of him when he does not — at `unit` pixels per world unit.
 */
export function drawFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: number,
  pose: Pose,
  ink: string,
): void {
  const scale = (unit * BODY.tall) / BODY.height;
  const trail = Math.min(1, pose.speed / 16);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = BODY.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Hands at the origin; everything else hangs off them along the lean.
  const hands: Point = { x: 0, y: 0 };
  const sway = Math.sin(pose.time * 2.2) * 0.04 * (pose.held ? 1 : 0.3);
  const body = pose.lean + sway;

  const elbow = swing(hands, body + 0.22 * pose.facing, BODY.forearm);
  const shoulder = swing(elbow, body - 0.14 * pose.facing, BODY.upperArm);
  const head: Point = swing(shoulder, body, -1.4);
  const hip = swing(shoulder, body, BODY.spine);

  // The free arm: reaching when he is holding on, thrown back when he is not.
  const freeAngle = pose.held ? body + 1.5 * pose.facing : body - (0.9 + trail) * pose.facing;
  const freeElbow = swing(shoulder, freeAngle, BODY.upperArm);
  const freeHand = swing(freeElbow, freeAngle + 0.4 * pose.facing, BODY.forearm);
  line(ctx, shoulder, freeElbow, freeHand);

  line(ctx, hands, elbow, shoulder, hip);

  // Legs trail behind by how fast he is moving, and tuck when he is flying.
  for (const side of [1, -1]) {
    const tuck = pose.held ? 0.18 : 0.75;
    const thighAngle = body - (tuck + trail * 0.5) * pose.facing + side * 0.16;
    const knee = swing(hip, thighAngle, BODY.thigh);
    const shinAngle = thighAngle + (pose.held ? 0.3 : 0.95) * pose.facing + side * 0.1;
    line(ctx, hip, knee, swing(knee, shinAngle, BODY.shin));
  }

  ctx.beginPath();
  ctx.arc(head.x, head.y, BODY.headRadius, 0, Math.PI * 2);
  ctx.stroke();

  // He looks the way he is going.
  const eye = swing(head, body + 1.5 * pose.facing, BODY.headRadius * 0.55);
  ctx.beginPath();
  ctx.arc(eye.x, eye.y, 0.85, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
