/**
 * The man, and the one he is fighting.
 *
 * The same drawing twice: the mirror is this figure flipped and in a colder
 * ink, because that is what it is — the version of him that got the answer
 * wrong. One function, two calls, and nothing to keep in step.
 *
 * His own figure, written here. The shelf has four of these now and none may
 * reach into another; this one stands and strikes, which is a vocabulary none
 * of the other three have.
 */

/** Feet at the origin, y growing downwards. */
const BODY = {
  headRadius: 4.4,
  hip: 16,
  shoulder: 27,
  neck: 29,
  thigh: 9,
  shin: 9,
  upperArm: 7.4,
  forearm: 7.4,
  lineWidth: 2.6,
  height: 34,
} as const;

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Pose {
  readonly facing: 1 | -1;
  /** 0 standing, 1 at full reach of a strike. */
  readonly lunge: number;
  /** 0 upright, 1 knocked back. */
  readonly recoil: number;
  /** 0 on his feet, 1 flat on the floor. */
  readonly fall: number;
  /** 0 arms where a fight puts them, 1 both straight up: the run is won. */
  readonly cheer?: number;
  /** Seconds, for the small motion of standing there. */
  readonly time: number;
}

const reach = (from: Point, angle: number, length: number): Point => ({
  x: from.x + Math.cos(angle) * length,
  y: from.y + Math.sin(angle) * length,
});

function line(ctx: CanvasRenderingContext2D, from: Point, ...rest: readonly Point[]): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  for (const p of rest) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

/** Draw him with his feet at (x, y), `unit` pixels tall overall. */
export function drawFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: number,
  pose: Pose,
  ink: string,
): void {
  const scale = unit / BODY.height;
  const face = pose.facing;
  const lunge = pose.lunge;
  const recoil = pose.recoil;

  ctx.save();
  ctx.translate(x, y);
  // Going down is a topple about the feet, away from whatever hit him, with a
  // little drop at the end so he lands on the floor rather than hinging on it.
  if (pose.fall > 0) {
    const over = pose.fall ** 0.7;
    ctx.rotate(-face * over * (Math.PI / 2 - 0.12));
    ctx.translate(0, over * unit * 0.1);
  }
  ctx.scale(scale, scale);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = BODY.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Weight goes forward into a strike and back out of a hit.
  const shift = face * (lunge * 5 - recoil * 4);
  const breath = Math.sin(pose.time * 2) * 0.35 * (1 - lunge);
  const tilt = face * (lunge * 0.26 - recoil * 0.3);

  const hip: Point = { x: shift * 0.5, y: -BODY.hip + breath };
  const shoulder: Point = {
    x: hip.x + Math.sin(tilt) * (BODY.shoulder - BODY.hip),
    y: hip.y - Math.cos(tilt) * (BODY.shoulder - BODY.hip),
  };
  const neck: Point = { x: shoulder.x + Math.sin(tilt) * 2, y: shoulder.y - 2 };
  const head: Point = { x: neck.x + Math.sin(tilt) * 4.4, y: neck.y - BODY.headRadius };

  // Feet stay where they are; only the body moves over them.
  for (const side of [1, -1]) {
    const foot: Point = { x: side * 4.5 * face + (side === face ? shift * 0.25 : 0), y: 0 };
    const knee: Point = {
      x: (hip.x + foot.x) / 2 + face * 1.6,
      y: (hip.y + foot.y) / 2,
    };
    line(ctx, hip, knee, foot);
  }

  line(ctx, hip, shoulder, neck);

  // Arms hang and come up, rather than starting up and going out. The first
  // version rested them at about a hundred degrees above horizontal, which is
  // a T-pose: both figures stood there with their arms spread and neither of
  // them read as fighting at all.
  //
  // Angles are measured the way the canvas does, so zero is forward-right and
  // a half turn is straight down.
  const forward = face === 1 ? 0 : Math.PI;
  const down = face === 1 ? 1.18 : Math.PI - 1.18;
  const out = face === 1 ? -0.1 : Math.PI + 0.1;

  // Up is reached the long way round on purpose: the front arm swings up
  // through forward and the back arm through behind, the way arms go up,
  // rather than both crossing the body to get there.
  const cheer = pose.cheer ?? 0;
  const upFront = face === 1 ? -Math.PI / 2 + 0.35 : (3 * Math.PI) / 2 - 0.35;
  const upBack = face === 1 ? (3 * Math.PI) / 2 - 0.35 : -Math.PI / 2 + 0.35;

  const fighting = down + (out - down) * lunge;
  const armAngle = fighting + (upFront - fighting) * cheer;
  const elbow = reach(shoulder, armAngle, BODY.upperArm);
  const fist = reach(elbow, armAngle + face * (0.55 - lunge * 0.55) * (1 - cheer), BODY.forearm);
  line(ctx, shoulder, elbow, fist);

  // The other hangs back, and comes up across him when he is hit.
  const guardRest = face === 1 ? 1.95 : Math.PI - 1.95;
  const guarding = guardRest - face * recoil * 0.95;
  const guardAngle = guarding + (upBack - guarding) * cheer;
  const guardElbow = reach(shoulder, guardAngle, BODY.upperArm);
  line(ctx, shoulder, guardElbow, reach(guardElbow, guardAngle - face * 0.75 * (1 - cheer), BODY.forearm));
  void forward;

  ctx.beginPath();
  ctx.arc(head.x, head.y, BODY.headRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Small, and out at the edge. Centred and large it read as one big eye in
  // the middle of the face rather than as a man looking somewhere.
  ctx.beginPath();
  ctx.arc(head.x + face * (BODY.headRadius * 0.55), head.y - 0.8, 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // The fist is where a strike lands, so the caller can put a flash on it.
  lastFist = { x: x + fist.x * scale, y: y + fist.y * scale };
}

let lastFist: Point = { x: 0, y: 0 };

/** Where the striking fist ended up, in canvas pixels, after the last draw. */
export function fistAt(): Point {
  return lastFist;
}
