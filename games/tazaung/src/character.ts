/**
 * Tazaung — the wizard.
 *
 * A stick figure drawn entirely in code: joints, lines and two circles. There
 * is no sprite sheet and no image file, which is the point. Animation comes
 * from three things only — an idle wave, poses eased toward a target, and
 * two-bone IK so a hand can be told where to go and the elbow works itself out.
 *
 * Posture is not decoration. It reads the lantern: standing tall at full
 * light, stooping as it fails, sitting down when it goes out.
 */

import { RULES } from "./game.js";
import type { GameEvent, GameState } from "./game.js";
import type { Viewport } from "./render.js";

export interface Point {
  x: number;
  y: number;
}

export interface Wizard {
  /** Eased column position, so he walks instead of snapping. */
  column: number;
  /** 0 standing, 1 folded over the lantern. Follows lost light. */
  stoop: number;
  /** Rises briefly on a shot: crouch first, then throw. */
  recoil: number;
  /** Lands on a near miss. */
  flinch: number;
  /** Both arms thrown up when a boon is caught. */
  flourish: number;
  /** He sits down when the lantern goes out. The ending, not a death. */
  sit: number;
  /** He stands and lifts the lantern when the sun comes up. */
  salute: number;
  /** Lantern on a damped pendulum, in radians from straight down. */
  swingAngle: number;
  swingVelocity: number;
  /** Hat tip trails the head. */
  hatLag: Point;
  /** Where the wand tip ended up, for the renderer to fire sparks from. */
  readonly wandTip: Point;
  /** Where the lantern ended up, for the renderer to hang the light on. */
  readonly lantern: Point;
  previousHand: Point;
  handVelocity: number;
}

export function createWizard(): Wizard {
  return {
    column: Math.floor(RULES.columns / 2),
    stoop: 0,
    recoil: 0,
    flinch: 0,
    flourish: 0,
    sit: 0,
    salute: 0,
    swingAngle: 0,
    swingVelocity: 0,
    hatLag: { x: 0, y: 0 },
    wandTip: { x: 0, y: 0 },
    lantern: { x: 0, y: 0 },
    previousHand: { x: 0, y: 0 },
    handVelocity: 0,
  };
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/** Frame-rate independent easing: the same approach per second, any dt. */
const approach = (from: number, to: number, rate: number, dt: number): number =>
  lerp(from, to, 1 - Math.exp(-rate * dt));

/**
 * Two-bone IK. Given a shoulder and where the hand should be, work out the
 * elbow with the law of cosines. `bend` picks which of the two solutions.
 */
function solveLimb(
  root: Point,
  target: Point,
  upper: number,
  lower: number,
  bend: number,
): { readonly joint: Point; readonly end: Point } {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const reach = Math.min(Math.hypot(dx, dy), upper + lower - 0.0001) || 0.0001;
  const direction = Math.atan2(dy, dx);

  const cosine = Math.min(1, Math.max(-1, (upper * upper + reach * reach - lower * lower) / (2 * upper * reach)));
  const spread = Math.acos(cosine) * bend;

  const joint = {
    x: root.x + Math.cos(direction + spread) * upper,
    y: root.y + Math.sin(direction + spread) * upper,
  };
  return {
    joint,
    end: { x: root.x + Math.cos(direction) * reach, y: root.y + Math.sin(direction) * reach },
  };
}

export function updateWizard(
  wizard: Wizard,
  state: GameState,
  events: readonly GameEvent[],
  view: Viewport,
  dt: number,
  time: number,
): void {
  wizard.column = approach(wizard.column, state.wizardColumn, 14, dt);
  wizard.stoop = approach(wizard.stoop, state.phase === "ended" ? 1 : 1 - state.light, 3, dt);
  wizard.recoil = Math.max(0, wizard.recoil - dt * 6);
  wizard.flinch = Math.max(0, wizard.flinch - dt * 4);
  wizard.flourish = Math.max(0, wizard.flourish - dt * 1.6);
  wizard.sit = approach(wizard.sit, state.phase === "ended" ? 1 : 0, 1.6, dt);
  wizard.salute = approach(wizard.salute, state.phase === "dawn" ? 1 : 0, 1.4, dt);

  for (const event of events) {
    if (event.kind === "shot") wizard.recoil = 1;
    if (event.kind === "landed" && Math.abs(event.column - state.wizardColumn) <= 1) {
      wizard.flinch = 1;
    }
    if (event.kind === "boon" || event.kind === "dawn") wizard.flourish = 1;
  }

  const frame = measure(wizard, view, time);

  // Lantern pendulum, pushed by how fast the hand carrying it is moving.
  const hand = frame.lanternHand;
  const swept = (hand.x - wizard.previousHand.x) / Math.max(dt, 0.0001);
  wizard.handVelocity = approach(wizard.handVelocity, swept, 20, dt);
  wizard.previousHand = { x: hand.x, y: hand.y };

  const gravity = 42;
  const push = -wizard.handVelocity / Math.max(view.cell, 1) * 0.5;
  wizard.swingVelocity += (-gravity * Math.sin(wizard.swingAngle) + push) * dt;
  wizard.swingVelocity *= Math.exp(-2.2 * dt);
  wizard.swingAngle += wizard.swingVelocity * dt;
  wizard.swingAngle = Math.max(-1.1, Math.min(1.1, wizard.swingAngle));

  // Hat tip trails the head, which is most of what makes him look animated.
  wizard.hatLag.x = approach(wizard.hatLag.x, frame.head.x, 12, dt);
  wizard.hatLag.y = approach(wizard.hatLag.y, frame.head.y, 12, dt);

  const lanternLength = view.cell * BODY * 0.55;
  wizard.lantern.x = hand.x + Math.sin(wizard.swingAngle) * lanternLength;
  wizard.lantern.y = hand.y + Math.cos(wizard.swingAngle) * lanternLength;
  wizard.wandTip.x = frame.wandTip.x;
  wizard.wandTip.y = frame.wandTip.y;
}

interface Frame {
  readonly ground: number;
  readonly hip: Point;
  readonly neck: Point;
  readonly head: Point;
  readonly headRadius: number;
  readonly wandHand: Point;
  readonly lanternHand: Point;
  readonly wandTip: Point;
  readonly scale: number;
}

/** The figure is drawn larger than one cell: he is the subject, not a token. */
const BODY = 1.45;

/** Every joint for this instant. Pure: same inputs, same skeleton. */
function measure(wizard: Wizard, view: Viewport, time: number): Frame {
  const scale = view.cell * BODY;
  const ground = view.originY + RULES.rows * view.cell;
  const x = view.originX + (wizard.column + 0.5) * view.cell;

  const breathe = Math.sin(time * 2.1) * scale * 0.018;
  const crouch = wizard.recoil > 0.6 ? (wizard.recoil - 0.6) * 2.4 : 0;
  const duck = wizard.flinch * 0.12 + crouch * 0.1;
  const cheer = Math.max(wizard.flourish, wizard.salute);
  const sit = wizard.sit;
  // A caught boon, or the sunrise, lifts him clear of the stoop.
  const fold = Math.max(0, wizard.stoop - cheer * 0.9);

  // Sitting drops the hips almost to the ground; the IK folds the knees up.
  const hipHeight = scale * (0.78 - fold * 0.22 - duck * 0.4 + cheer * 0.1) * (1 - sit * 0.72) + breathe;
  const spine = scale * (0.62 - fold * 0.14) * (1 - sit * 0.12);
  const lean = fold * scale * 0.16 + wizard.flinch * scale * 0.05 + sit * scale * 0.1;

  const hip = { x, y: ground - hipHeight };
  const neck = { x: x - lean, y: hip.y - spine };
  const headRadius = scale * 0.2;
  const head = { x: neck.x - lean * 0.4, y: neck.y - headRadius * 1.15 };

  // The wand arm reaches up the column; the recoil throws it higher.
  const throwUp = (1 - Math.min(1, wizard.recoil * 1.6)) * 0.0 + Math.min(1, wizard.recoil) * 0.45;
  const wandHand = {
    x: neck.x + scale * (0.52 - fold * 0.24 - cheer * 0.18 - sit * 0.08),
    y:
      neck.y -
      scale * (0.3 + throwUp * 0.45 - fold * 0.35 + cheer * 0.5) +
      scale * sit * 0.72,
  };

  // The lantern arm drops and pulls in as the light fails.
  // Held out and up at the sunrise, hugged to the chest when he sits in the
  // dark. Raising it inward put the lantern straight over his face.
  const lanternHand = {
    x: neck.x - scale * (0.4 - fold * 0.22 + cheer * 0.32 - sit * 0.18),
    y: neck.y + scale * (0.05 + fold * 0.42 + sit * 0.1) - scale * cheer * 0.5,
  };

  const wandLength = scale * 0.72;
  const wandAngle =
    -Math.PI / 2 + 0.3 + fold * 0.5 - Math.min(1, wizard.recoil) * 0.18 + sit * 1.45;
  const wandTip = {
    x: wandHand.x + Math.cos(wandAngle) * wandLength,
    y: wandHand.y + Math.sin(wandAngle) * wandLength,
  };

  return { ground, hip, neck, head, headRadius, wandHand, lanternHand, wandTip, scale };
}

/**
 * @param halo a colour at the opposite end from `ink`, laid under it in a
 * wider stroke. The figure stands inside his own lantern light, so picking
 * ink from the sky alone is not enough: against a bright glow a light figure
 * disappears, and against the night a dark one does. An outline under the
 * strokes makes him readable on either, and under a burst of motes.
 */
export function drawWizard(
  ctx: CanvasRenderingContext2D,
  wizard: Wizard,
  view: Viewport,
  time: number,
  ink: string,
  halo: string,
): void {
  paintFigure(ctx, wizard, view, time, halo, 2.4, false);
  paintFigure(ctx, wizard, view, time, ink, 1, true);
}

function paintFigure(
  ctx: CanvasRenderingContext2D,
  wizard: Wizard,
  view: Viewport,
  time: number,
  ink: string,
  weight: number,
  withFace: boolean,
): void {
  const frame = measure(wizard, view, time);
  const { scale, hip, neck, head, headRadius, ground } = frame;

  ctx.save();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = Math.max(1.6, scale * 0.075) * weight;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Legs: feet planted, knees worked out by IK, so a stoop bends them for us.
  // Feet forward of the hips while sitting, so the knees come up in front.
  const stride = scale * (0.22 + wizard.stoop * 0.12 + wizard.sit * 0.55);
  const thigh = scale * 0.42;
  const shin = scale * 0.42;
  for (const side of [-1, 1] as const) {
    const foot = { x: hip.x + side * stride, y: ground };
    const leg = solveLimb(hip, foot, thigh, shin, side);
    stroke(ctx, [hip, leg.joint, leg.end]);
  }

  // Spine and arms.
  stroke(ctx, [hip, neck]);

  const upperArm = scale * 0.34;
  const foreArm = scale * 0.34;
  const wand = solveLimb(neck, frame.wandHand, upperArm, foreArm, 1);
  const lamp = solveLimb(neck, frame.lanternHand, upperArm, foreArm, -1);
  stroke(ctx, [neck, wand.joint, wand.end]);
  stroke(ctx, [neck, lamp.joint, lamp.end]);

  // The wand itself.
  ctx.lineWidth = Math.max(1.2, scale * 0.055) * weight;
  stroke(ctx, [wand.end, frame.wandTip]);

  // The cord, then the lantern hanging off it.
  stroke(ctx, [lamp.end, wizard.lantern]);

  ctx.lineWidth = Math.max(1.6, scale * 0.075) * weight;
  ctx.beginPath();
  ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
  ctx.stroke();
  if (withFace) drawFace(ctx, head, headRadius, wizard, ink);
  drawHat(ctx, head, headRadius, wizard, scale, ink, weight);

  ctx.restore();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  head: Point,
  radius: number,
  wizard: Wizard,
  ink: string,
): void {
  const worry = Math.min(1, wizard.stoop + wizard.flinch * 0.5);
  const eye = radius * 0.17;

  ctx.fillStyle = ink;
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(
      head.x + side * radius * 0.36,
      head.y - radius * 0.08,
      eye,
      eye * (1 - worry * 0.35),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // A smile that flattens, then turns down as the lantern fails.
  ctx.lineWidth = Math.max(1.2, radius * 0.16);
  ctx.beginPath();
  ctx.arc(
    head.x,
    head.y + radius * (0.22 + worry * 0.5),
    radius * 0.4,
    worry > 0.6 ? Math.PI : 0.15 * Math.PI,
    worry > 0.6 ? Math.PI * 2 : 0.85 * Math.PI,
  );
  ctx.stroke();
}

function drawHat(
  ctx: CanvasRenderingContext2D,
  head: Point,
  radius: number,
  wizard: Wizard,
  scale: number,
  ink: string,
  weight: number,
): void {
  const brimY = head.y - radius * 0.55;
  const brim = radius * 1.3;

  // The tip lags behind the head: free secondary motion, two lines of easing.
  // Clamped, because unbounded lag throws the tip clear across the screen the
  // moment he walks, and the hat stops reading as a hat.
  const sway = Math.max(-radius * 0.8, Math.min(radius * 0.8, (head.x - wizard.hatLag.x) * 1.1));
  const tip = {
    x: head.x + sway,
    y: brimY - scale * (0.58 - wizard.stoop * 0.12),
  };

  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1.6, scale * 0.07) * weight;
  ctx.beginPath();
  ctx.moveTo(head.x - brim, brimY);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(head.x + brim, brimY);
  ctx.closePath();
  ctx.stroke();
}

function stroke(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  const [first, ...rest] = points;
  if (first === undefined) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const point of rest) ctx.lineTo(point.x, point.y);
  ctx.stroke();
}
