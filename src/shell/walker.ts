/**
 * The little figure who lives along the bottom of the shelf.
 *
 * He is the shelf's, not a game's. Tazaung has a stick figure of its own and
 * this one deliberately shares no code with it: no hat, no wand, no lantern,
 * no colour. Borrowing that file would be the same mistake as borrowing the
 * night sky was — see ARCHITECTURE.md, "The shelf may not borrow a game's
 * visual language".
 *
 * He draws in the shelf's own ink at low opacity, behind the cards, and never
 * takes a click. Where he goes is decided in walk.ts; this file only draws him
 * there.
 */

import { WALK, createWalker, stepWalker } from './walk.js';
import type { WalkerState } from './walk.js';

/** Limb lengths, in figure units, scaled once at draw time. */
const FIGURE = {
  scale: 1,
  headRadius: 7,
  /** Height of each joint above the ground. */
  hip: 26,
  shoulder: 44,
  neck: 47,
  thigh: 15,
  shin: 15,
  upperArm: 11,
  forearm: 11,
  /** How far the arms swing from hanging, in radians. */
  armSwing: 0.68,
  /** How far they hang from the body while he stands. */
  armRest: 0.09,
  /** A permanent slight bend at the elbow: a straight arm reads as a stick. */
  elbowBend: 0.34,
  stride: 9,
  /** How high a foot clears the ground mid-step. */
  footLift: 7,
  /** Feet this far apart while standing. */
  stance: 11,
  lineWidth: 2.4,
} as const;

/** How far above the canvas's bottom edge the ground sits. */
const GROUND_INSET = 16;
const CANVAS_HEIGHT = 112;
const INK_ALPHA = 0.3;
const STARTLED_ALPHA = 0.46;
/** A pointer higher above his strip than this is not his problem. */
const POINTER_REACH = 70;
/** The longest frame he will believe, so a backgrounded tab cannot teleport him. */
const MAX_DT = 0.05;

interface Point {
  readonly x: number;
  readonly y: number;
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/**
 * Two-bone inverse kinematics: put the middle joint where bones of length `a`
 * and `b` reach from `root` to `target`, bending the way `bend` says. Law of
 * cosines.
 */
function midJoint(root: Point, target: Point, a: number, b: number, bend: 1 | -1): Point {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  // Keep the triangle solvable when the target is out of reach or on top of
  // the root: a limb locked straight is right, a NaN is a hole in the figure.
  const distance = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 0.001, a + b - 0.001);
  const cosine = clamp((a * a + distance * distance - b * b) / (2 * a * distance), -1, 1);
  const angle = Math.atan2(dy, dx) + bend * Math.acos(cosine);
  return { x: root.x + Math.cos(angle) * a, y: root.y + Math.sin(angle) * a };
}

function line(ctx: CanvasRenderingContext2D, from: Point, ...rest: readonly Point[]): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  for (const point of rest) ctx.lineTo(point.x, point.y);
  ctx.stroke();
}

/**
 * Draw him at the origin, ground at y = 0, y growing downwards.
 *
 * `gait` runs 0 (standing) to 1 (walking), so setting off and stopping is a
 * lean rather than a snap. `breath` is seconds, and only moves while he stands.
 */
function drawFigure(ctx: CanvasRenderingContext2D, state: WalkerState, gait: number, breath: number): void {
  const facing = state.facing;
  const phase = state.phase;

  // Hips rise and fall twice per stride; standing, he only breathes.
  const bob = gait * -Math.cos(phase * 2) * 1.2 + (1 - gait) * Math.sin(breath * 1.7) * 0.5;
  // Leaning into a run, straightening up to stroll.
  const lean = facing * gait * (state.startled > 0 ? 3.4 : 1.4);

  const hip: Point = { x: lean * 0.45, y: -FIGURE.hip + bob };
  const shoulder: Point = { x: lean, y: -FIGURE.shoulder + bob };
  const neck: Point = { x: lean * 1.05, y: -FIGURE.neck + bob };
  const head: Point = { x: lean * 1.2, y: -FIGURE.neck - FIGURE.headRadius + bob };

  ctx.lineWidth = FIGURE.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let leg = 0; leg < 2; leg += 1) {
    const p = phase + leg * Math.PI;
    const walkX = Math.cos(p) * FIGURE.stride * facing;
    const walkLift = Math.max(0, Math.sin(p)) * FIGURE.footLift;
    const standX = (leg === 0 ? 1 : -1) * FIGURE.stance * 0.5 * facing;

    const foot: Point = { x: gait * walkX + (1 - gait) * standX, y: -gait * walkLift };
    const knee = midJoint(hip, foot, FIGURE.thigh, FIGURE.shin, facing === 1 ? -1 : 1);
    line(ctx, hip, knee, foot);
  }

  line(ctx, hip, shoulder, neck);

  for (let arm = 0; arm < 2; arm += 1) {
    // Arms are swung from the shoulder rather than solved to a hand position.
    // Solving them threw the elbow out sideways whenever the hand sat close
    // to the body, which is most of the time, and read as a chicken wing.
    // Legs have to meet the ground, so those stay solved; arms do not.
    const p = phase + arm * Math.PI + Math.PI;
    const swing = facing * (gait * Math.cos(p) * FIGURE.armSwing + (1 - gait) * FIGURE.armRest);
    const upper = Math.PI / 2 - swing;
    const lower = upper + facing * (FIGURE.elbowBend * (0.6 + gait * 0.4));

    const joint: Point = {
      x: shoulder.x + Math.cos(upper) * FIGURE.upperArm,
      y: shoulder.y + Math.sin(upper) * FIGURE.upperArm,
    };
    const hand: Point = {
      x: joint.x + Math.cos(lower) * FIGURE.forearm,
      y: joint.y + Math.sin(lower) * FIGURE.forearm,
    };
    line(ctx, shoulder, joint, hand);
  }

  ctx.beginPath();
  ctx.arc(head.x, head.y, FIGURE.headRadius, 0, Math.PI * 2);
  ctx.stroke();

  // One eye, on the side he is walking towards. A tick for a nose was the
  // other option and it read as a beak.
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(head.x + facing * 2.6, head.y - 1.2, 1.15, 0, Math.PI * 2);
  ctx.fill();
}

export function startWalker(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;

  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#f2f4f8';
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  let width = canvas.clientWidth || window.innerWidth;
  let state = createWalker(width);
  let gait = 0;
  let breath = 0;
  let pointerX: number | null = null;

  function resize(): void {
    const ratio = window.devicePixelRatio || 1;
    width = canvas.clientWidth || window.innerWidth;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(CANVAS_HEIGHT * ratio);
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    // A window narrowing under his feet must not strand him past the edge.
    state.x = clamp(state.x, WALK.margin, Math.max(WALK.margin, width - WALK.margin));
  }

  function draw(): void {
    if (ctx === null) return;
    ctx.clearRect(0, 0, width, CANVAS_HEIGHT);
    ctx.save();
    ctx.translate(state.x, CANVAS_HEIGHT - GROUND_INSET);
    ctx.scale(FIGURE.scale, FIGURE.scale);
    ctx.strokeStyle = ink;
    ctx.globalAlpha = state.startled > 0 ? STARTLED_ALPHA : INK_ALPHA;
    drawFigure(ctx, state, gait, breath);
    ctx.restore();
  }

  resize();
  new ResizeObserver(() => {
    resize();
    draw();
  }).observe(canvas);

  // Someone who asked for less movement gets him standing there, not gone: he
  // is part of the page, and the page should not change shape on them.
  if (still.matches) {
    draw();
    return;
  }

  window.addEventListener(
    'pointermove',
    (event) => {
      const strip = canvas.getBoundingClientRect();
      // He only notices a pointer that has come down to his strip of floor.
      pointerX = event.clientY > strip.top - POINTER_REACH ? event.clientX - strip.left : null;
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => {
    pointerX = null;
  });

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;

    state = stepWalker(state, { width, pointerX, dt, random: Math.random });
    gait += clamp((state.speed > 0 ? 1 : 0) - gait, -dt * 5, dt * 5);
    if (state.speed === 0) breath += dt;

    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
