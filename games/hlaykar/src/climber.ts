/**
 * The man in the shaft.
 *
 * His own figure, drawn here and nowhere else. Tazaung has a stick figure and
 * the shelf has one; this game may not reach into either, so he is written
 * again from scratch — which is the point, because he does something neither
 * of them does. He climbs. His signature pose is both arms up over a ledge,
 * and he leans into a step instead of strolling through it.
 *
 * The gait rule is the same fact about walking that any walk cycle obeys: the
 * foot on the ground is the one travelling backwards, because that is the half
 * of the stride carrying the body forward. That is a fact, not a file to share.
 */

/** Feet at y = 0, y growing downwards, head around y = -32. */
const BODY = {
  hip: 13,
  shoulder: 22,
  neck: 24,
  headRadius: 4.2,
  thigh: 7.6,
  shin: 7.6,
  upperArm: 6.6,
  forearm: 6.6,
  /** Half a stride, in the same units. */
  stride: 6.5,
  footLift: 3.4,
  elbowBend: 0.32,
  /** Total height, used to scale him against a cell. */
  height: 32.4,
} as const;

/** He stands this many cells tall, which makes a one-cell step knee-high. */
export const CELLS_TALL = 2.4;

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Pose {
  readonly facing: 1 | -1;
  /** 0 standing, 1 mid-stride. */
  readonly gait: number;
  /** 0 walking, 1 hauling himself up a ledge. */
  readonly climb: number;
  /** Where in the stride he is, 0 to 1. */
  readonly progress: number;
  /** Which leg leads this step. */
  readonly parity: 0 | 1;
  /** Seconds, for breathing while he stands. */
  readonly time: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Two bones from `root` to `target`, bending the way `bend` says. */
function midJoint(root: Point, target: Point, a: number, b: number, bend: 1 | -1): Point {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 0.001, a + b - 0.001);
  const cosine = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const angle = Math.atan2(dy, dx) + bend * Math.acos(cosine);
  return { x: root.x + Math.cos(angle) * a, y: root.y + Math.sin(angle) * a };
}

function line(ctx: CanvasRenderingContext2D, from: Point, ...rest: readonly Point[]): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  for (const p of rest) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

/**
 * Draw him with his feet at (x, y), sized so he stands `CELLS_TALL` cells high.
 */
export function drawClimber(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  pose: Pose,
  ink: string,
): void {
  const scale = (cell * CELLS_TALL) / BODY.height;
  const facing = pose.facing;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // One step is half a gait cycle, and the parity decides which leg takes it.
  const phase = (pose.progress + pose.parity) * Math.PI;
  const bob = pose.gait * -Math.cos(phase * 2) * 0.8 + (1 - pose.gait) * Math.sin(pose.time * 1.8) * 0.4;
  const lean = facing * (pose.gait * 1.6 + pose.climb * 3.2);

  const hip: Point = { x: lean * 0.4, y: -BODY.hip + bob };
  const shoulder: Point = { x: lean, y: -BODY.shoulder + bob };
  const neck: Point = { x: lean * 1.05, y: -BODY.neck + bob };
  const head: Point = { x: lean * 1.15, y: -BODY.neck - BODY.headRadius + bob };

  for (let leg = 0; leg < 2; leg += 1) {
    const p = phase + leg * Math.PI;
    // Planted while travelling back, in the air while swinging forward.
    const reach = Math.cos(p);
    const lift = Math.max(0, -Math.sin(p));
    const standX = (leg === 0 ? 1 : -1) * 2 * facing;

    const foot: Point = {
      x: pose.gait * reach * BODY.stride * facing + (1 - pose.gait) * standX,
      y: -pose.gait * lift * BODY.footLift * (1 + pose.climb * 1.4),
    };
    const knee = midJoint(hip, foot, BODY.thigh, BODY.shin, facing === 1 ? -1 : 1);
    line(ctx, hip, knee, foot);
  }

  line(ctx, hip, shoulder, neck);

  for (let arm = 0; arm < 2; arm += 1) {
    const p = phase + arm * Math.PI + Math.PI;
    // Walking, the arms swing against the legs. Climbing, they both go up and
    // over, which is the pose that says what he is doing at any size.
    const swinging = Math.cos(p) * 0.55;
    const reaching = 2.2 + (arm === 0 ? 0.25 : -0.25);
    const swing = facing * (pose.gait * swinging * (1 - pose.climb) + pose.climb * reaching);
    const upper = Math.PI / 2 - swing;
    const lower = upper + facing * BODY.elbowBend;

    const joint: Point = {
      x: shoulder.x + Math.cos(upper) * BODY.upperArm,
      y: shoulder.y + Math.sin(upper) * BODY.upperArm,
    };
    const hand: Point = {
      x: joint.x + Math.cos(lower) * BODY.forearm,
      y: joint.y + Math.sin(lower) * BODY.forearm,
    };
    line(ctx, shoulder, joint, hand);
  }

  ctx.beginPath();
  ctx.arc(head.x, head.y, BODY.headRadius, 0, Math.PI * 2);
  ctx.stroke();

  // He looks where he is going, and upwards while he climbs.
  ctx.beginPath();
  ctx.arc(head.x + facing * 1.6, head.y - 0.6 - pose.climb * 0.9, 0.75, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
