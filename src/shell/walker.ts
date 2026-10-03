/**
 * The little figure who lives on the shelf, and the ladders he gets about by.
 *
 * He is the shelf's, not a game's. Tazaung has a stick figure of its own and
 * this one deliberately shares no code with it: no hat, no wand, no lantern,
 * no colour. Borrowing that file would be the same mistake as borrowing the
 * night sky was — see ARCHITECTURE.md, "The shelf may not borrow a game's
 * visual language". The ladders are thin rails in the shelf's own grey, not
 * rope.
 *
 * Where he goes is decided in roam.ts over the world built in world.ts; this
 * file measures the page into that world, draws him and the ladders, and
 * never takes a click. He is drawn on a small canvas that moves with him
 * inside a layer the size of the page, so he scrolls with the page instead of
 * a frame behind it, and the page never grows to make room for him.
 */

import { createRoamer, settle, stepRoamer } from './roam.js';
import type { Roamer } from './roam.js';
import { footAt } from './walk.js';
import { buildWorld, ladderOf } from './world.js';
import type { Box, Layout, Perch, World } from './world.js';

/** Limb lengths, in figure units, scaled once at draw time. */
const FIGURE = {
  scale: 0.9,
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

/** His own canvas, and where his feet sit on it. */
const SPRITE = { width: 128, height: 132, footX: 64, footY: 118 } as const;
const INK_ALPHA = 0.5;
const STARTLED_ALPHA = 0.7;
/** Half the gap between a ladder's rails, and the gap between its rungs. */
const RAIL = 5;
const RUNG = 11;
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

function head(ctx: CanvasRenderingContext2D, at: Point, eye: Point | null): void {
  // Whatever is behind his head is behind it: an arm raised past it on a
  // ladder would otherwise show through.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(at.x, at.y, FIGURE.headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(at.x, at.y, FIGURE.headRadius, 0, Math.PI * 2);
  ctx.stroke();
  if (eye === null) return;
  // One eye, on the side he faces. A tick for a nose was the other option and
  // it read as a beak.
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(eye.x, eye.y, 1.15, 0, Math.PI * 2);
  ctx.fill();
}

/** An arm swung from the shoulder: `swing` radians forward of hanging. */
function arm(ctx: CanvasRenderingContext2D, shoulder: Point, facing: 1 | -1, swing: number, bend: number): void {
  const upper = Math.PI / 2 - facing * swing;
  const lower = upper + facing * bend;
  const joint = {
    x: shoulder.x + Math.cos(upper) * FIGURE.upperArm,
    y: shoulder.y + Math.sin(upper) * FIGURE.upperArm,
  };
  const hand = { x: joint.x + Math.cos(lower) * FIGURE.forearm, y: joint.y + Math.sin(lower) * FIGURE.forearm };
  line(ctx, shoulder, joint, hand);
}

/**
 * Standing and walking, ground at y = 0. `gait` runs 0 (standing) to 1
 * (walking), so setting off and stopping is a lean rather than a snap.
 */
function drawUpright(ctx: CanvasRenderingContext2D, r: Roamer, gait: number, breath: number): void {
  const facing = r.facing;
  const phase = r.phase;
  // Hips rise and fall twice per stride; standing, he only breathes.
  const bob = gait * -Math.cos(phase * 2) * 1.2 + (1 - gait) * Math.sin(breath * 1.7) * 0.5;
  // Leaning into a run, straightening up to stroll.
  const lean = facing * gait * (r.startled > 0 ? 3.4 : 1.4);

  const hip: Point = { x: lean * 0.45, y: -FIGURE.hip + bob };
  const shoulder: Point = { x: lean, y: -FIGURE.shoulder + bob };
  const neck: Point = { x: lean * 1.05, y: -FIGURE.neck + bob };
  const top: Point = { x: lean * 1.2, y: -FIGURE.neck - FIGURE.headRadius + bob };

  for (let leg = 0; leg < 2; leg += 1) {
    const step = footAt(phase + leg * Math.PI);
    const walkX = step.reach * FIGURE.stride * facing;
    const standX = (leg === 0 ? 1 : -1) * FIGURE.stance * 0.5 * facing;
    const foot: Point = { x: gait * walkX + (1 - gait) * standX, y: -gait * step.lift * FIGURE.footLift };
    line(ctx, hip, midJoint(hip, foot, FIGURE.thigh, FIGURE.shin, facing === 1 ? -1 : 1), foot);
  }
  line(ctx, hip, shoulder, neck);
  for (let side = 0; side < 2; side += 1) {
    // Arms are swung from the shoulder rather than solved to a hand position.
    // Solving them threw the elbow out sideways whenever the hand sat close
    // to the body, which is most of the time, and read as a chicken wing.
    const p = phase + side * Math.PI + Math.PI;
    const swing = gait * Math.cos(p) * FIGURE.armSwing + (1 - gait) * FIGURE.armRest;
    arm(ctx, shoulder, facing, swing, FIGURE.elbowBend * (0.6 + gait * 0.4));
  }
  head(ctx, top, { x: top.x + facing * 2.6, y: top.y - 1.2 });
}

/** In the air: knees up and arms out, most of all at the top of the arc. */
function drawAirborne(ctx: CanvasRenderingContext2D, r: Roamer): void {
  const f = r.flight;
  const u = f === null ? 0 : clamp(f.t / f.time, 0, 1);
  const tuck = Math.sin(u * Math.PI) * (f?.kind === 'step' ? 0.3 : 1);
  const facing = r.facing;
  const hip: Point = { x: 0, y: -FIGURE.hip + tuck * 3 };
  const shoulder: Point = { x: facing * 1.5, y: -FIGURE.shoulder + tuck * 3 };
  const neck: Point = { x: facing * 1.6, y: -FIGURE.neck + tuck * 3 };
  for (const side of [1, -1]) {
    const foot: Point = { x: facing * (side * 4 + tuck * 3), y: -tuck * 11 };
    line(ctx, hip, midJoint(hip, foot, FIGURE.thigh, FIGURE.shin, facing === 1 ? -1 : 1), foot);
  }
  line(ctx, hip, shoulder, neck);
  // One arm thrown forward and one back, both higher the higher he is.
  for (const side of [1, -1]) arm(ctx, shoulder, facing, side * (0.5 + tuck * 1.5), 0.45);
  const top: Point = { x: neck.x + facing * 0.4, y: neck.y - FIGURE.headRadius };
  head(ctx, top, { x: top.x + facing * 2.6, y: top.y - 1.2 });
}

/**
 * On a ladder, seen from behind: hands on the rails, one up while the
 * opposite foot is up, the way anyone climbs.
 */
function drawClimbing(ctx: CanvasRenderingContext2D, r: Roamer): void {
  const c = r.climb;
  const lift = (v: number): number => Math.max(0, v);
  const hip: Point = { x: 0, y: -FIGURE.hip + Math.sin(c * 2) * 0.6 };
  const shoulder: Point = { x: 0, y: -FIGURE.shoulder + Math.sin(c * 2) * 0.6 };
  const neck: Point = { x: 0, y: -FIGURE.neck + Math.sin(c * 2) * 0.6 };
  for (const side of [-1, 1] as const) {
    const s = side < 0 ? Math.sin(c) : -Math.sin(c);
    const foot: Point = { x: side * RAIL, y: -lift(s) * 8 };
    line(
      ctx,
      { x: hip.x + side * 2, y: hip.y },
      midJoint({ x: hip.x + side * 2, y: hip.y }, foot, FIGURE.thigh, FIGURE.shin, side === 1 ? -1 : 1),
      foot,
    );
    // Hands up on the rails above his head, reaching higher on the side
    // whose foot is down.
    const hand: Point = { x: side * (RAIL + 2.5), y: shoulder.y - 14 - lift(-s) * 5 };
    const root: Point = { x: side * 4, y: shoulder.y };
    line(ctx, root, midJoint(root, hand, FIGURE.upperArm, FIGURE.forearm, side === 1 ? 1 : -1), hand);
  }
  line(ctx, hip, shoulder, neck);
  // The back of his head: no eye to draw.
  head(ctx, { x: 0, y: neck.y - FIGURE.headRadius }, null);
}

/** Sitting on the very end of something, legs over the edge and swinging. */
function drawSitting(ctx: CanvasRenderingContext2D, r: Roamer, time: number): void {
  const f = r.facing;
  const hip: Point = { x: 0, y: -2 };
  const shoulder: Point = { x: -f * 1.5, y: -20 + Math.sin(time * 1.7) * 0.4 };
  const neck: Point = { x: -f * 1.6, y: -23 + Math.sin(time * 1.7) * 0.4 };
  for (let leg = 0; leg < 2; leg += 1) {
    const swing = Math.sin(time * 2.4 + leg * 2.1) * 3.2;
    const knee: Point = { x: f * 14, y: -2.5 };
    line(ctx, hip, knee, { x: f * (15 + swing), y: 12 });
  }
  line(ctx, hip, shoulder, neck);
  // Hands on the ledge behind him.
  for (const reach of [8, 10]) {
    const hand: Point = { x: -f * reach, y: -1 };
    line(ctx, shoulder, midJoint(shoulder, hand, FIGURE.upperArm, FIGURE.forearm, f === 1 ? 1 : -1), hand);
  }
  const top: Point = { x: neck.x + f * 0.6, y: neck.y - FIGURE.headRadius };
  head(ctx, top, { x: top.x + f * 2.6, y: top.y + 0.4 });
}

/** At the edge, leaning out and looking down it. */
function drawLooking(ctx: CanvasRenderingContext2D, r: Roamer, time: number): void {
  const f = r.facing;
  const sway = Math.sin(time * 1.3) * 0.8;
  const hip: Point = { x: -f * 1, y: -FIGURE.hip };
  const shoulder: Point = { x: f * (9 + sway), y: -FIGURE.shoulder + 5 };
  const neck: Point = { x: f * (10.5 + sway), y: -FIGURE.neck + 6 };
  for (const side of [1, -1]) {
    const foot: Point = { x: side * FIGURE.stance * 0.45 - f * 2, y: 0 };
    line(ctx, hip, midJoint(hip, foot, FIGURE.thigh, FIGURE.shin, f === 1 ? -1 : 1), foot);
  }
  line(ctx, hip, shoulder, neck);
  for (const side of [0.15, -0.1]) arm(ctx, shoulder, f, side, 0.25);
  const top: Point = { x: neck.x + f * 4.5, y: neck.y - FIGURE.headRadius + 3 };
  head(ctx, top, { x: top.x + f * 2.2, y: top.y + 2.4 });
}

/** The page's boxes, in document coordinates. */
function boxOf(element: Element): Box {
  const r = element.getBoundingClientRect();
  return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY };
}

/** Where the words of a block actually are, which can be much narrower than the block. */
function textOf(element: Element): Box | null {
  const range = document.createRange();
  range.selectNodeContents(element);
  const r = range.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY };
}

function measure(layer: HTMLElement): Layout {
  // The layer must not hold the page open while it is measured, or the page
  // could never get shorter — nor narrower, which is what happens when the
  // cards arrive and a scrollbar takes its share of the width.
  layer.style.width = '0px';
  layer.style.height = '0px';
  const width = document.documentElement.scrollWidth;
  const height = document.documentElement.scrollHeight;
  layer.style.width = `${width}px`;
  layer.style.height = `${height}px`;

  const perches: Perch[] = [];
  const mark = document.querySelector('header .mark');
  const readout = document.querySelector('header .readout');
  if (mark !== null) perches.push({ id: 'mark', box: boxOf(mark) });
  if (readout !== null) perches.push({ id: 'readout', box: boxOf(readout) });
  for (const card of document.querySelectorAll('#shelf .card')) {
    perches.push({ id: `card:${card.getAttribute('href') ?? perches.length}`, box: boxOf(card) });
  }
  const obstacles: Box[] = [];
  for (const block of document.querySelectorAll('header .tagline, header .by a, #shelf .empty')) {
    const words = textOf(block);
    if (words !== null) obstacles.push(words);
  }
  for (const slot of document.querySelectorAll('#shelf .slot')) obstacles.push(boxOf(slot));
  const header = document.querySelector('header');
  return { width, height, rule: header === null ? null : boxOf(header), perches, obstacles };
}

/** The ladders as one SVG path: two rails each, and rungs between. */
function laddersPath(world: World): string {
  const parts: string[] = [];
  for (const ladder of world.ladders) {
    const top = ladder.top.y - 7;
    const bottom = ladder.bottom.y;
    parts.push(`M${ladder.x - RAIL} ${top}V${bottom}M${ladder.x + RAIL} ${top}V${bottom}`);
    for (let y = ladder.top.y; y < bottom - 3; y += RUNG) parts.push(`M${ladder.x - RAIL} ${y}H${ladder.x + RAIL}`);
  }
  return parts.join('');
}

/** A short summary of the world, so a re-measure that changed nothing changes nothing. */
const shapeOf = (world: World): string =>
  world.surfaces.map((s) => `${s.id}:${Math.round(s.x0)},${Math.round(s.x1)},${Math.round(s.y)}`).join('|');

export function startWalker(layer: HTMLElement): void {
  const sprite = layer.querySelector<HTMLCanvasElement>('canvas');
  const path = layer.querySelector<SVGPathElement>('path');
  const svg = layer.querySelector<SVGSVGElement>('svg');
  const ctx = sprite?.getContext('2d') ?? null;
  if (sprite === null || path === null || svg === null || ctx === null) return;

  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#f2f4f8';
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  sprite.width = Math.round(SPRITE.width * ratio);
  sprite.height = Math.round(SPRITE.height * ratio);

  let world = buildWorld(measure(layer));
  let shape = shapeOf(world);
  const roamer = createRoamer(world);
  let gait = 0;
  let clock = 0;
  let pointer: Point | null = null;

  function draw(): void {
    if (ctx === null || sprite === null) return;
    // Whole pixels for the canvas, the fraction drawn inside it, so he
    // neither blurs nor jitters.
    const left = roamer.x - SPRITE.footX;
    const top = roamer.y - SPRITE.footY;
    const px = Math.round(left);
    const py = Math.round(top);
    sprite.style.transform = `translate(${px}px, ${py}px)`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, SPRITE.width, SPRITE.height);
    ctx.translate(SPRITE.footX + left - px, SPRITE.footY + top - py);
    ctx.scale(FIGURE.scale, FIGURE.scale);
    ctx.strokeStyle = ink;
    ctx.lineWidth = FIGURE.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = roamer.startled > 0 ? STARTLED_ALPHA : INK_ALPHA;
    switch (roamer.mode) {
      case 'air':
        drawAirborne(ctx, roamer);
        break;
      case 'climb':
        drawClimbing(ctx, roamer);
        break;
      case 'sit':
        drawSitting(ctx, roamer, clock);
        break;
      case 'look':
        drawLooking(ctx, roamer, clock);
        break;
      default:
        drawUpright(ctx, roamer, gait, clock);
    }
  }

  function rebuild(): void {
    const next = buildWorld(measure(layer));
    const nextShape = shapeOf(next);
    world = next;
    path?.setAttribute('d', laddersPath(world));
    svg?.setAttribute('viewBox', `0 0 ${world.width} ${world.height}`);
    svg?.setAttribute('width', String(world.width));
    svg?.setAttribute('height', String(world.height));
    if (nextShape !== shape) {
      shape = nextShape;
      // The page moved under him: whatever he was doing is off.
      const onLadder = roamer.ladder !== null && ladderOf(world, roamer.ladder) !== undefined;
      if (!onLadder || roamer.mode !== 'climb') settle(roamer, world);
    }
    draw();
  }

  let pending = 0;
  const soon = (): void => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(rebuild);
  };
  // The cards arrive after a fetch, fonts load late, and the language button
  // changes every card's height: anything that moves the page re-measures it.
  const watcher = new ResizeObserver(soon);
  watcher.observe(document.body);
  const shelf = document.querySelector('#shelf');
  if (shelf !== null) watcher.observe(shelf);
  window.addEventListener('resize', soon);
  void document.fonts?.ready.then(soon);
  rebuild();

  // Someone who asked for less movement gets him standing there, not gone: he
  // is part of the page, and the page should not change shape on them.
  if (still.matches) return;

  window.addEventListener(
    'pointermove',
    (event) => {
      pointer = { x: event.clientX + scrollX, y: event.clientY + scrollY };
    },
    { passive: true },
  );
  const forget = (): void => {
    pointer = null;
  };
  document.addEventListener('pointerleave', forget);
  window.addEventListener('pointerup', (event) => {
    // A finger lifted is gone; a mouse is still where it was.
    if (event.pointerType !== 'mouse') forget();
  });

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    clock += dt;
    const view: Box = { left: scrollX, top: scrollY, right: scrollX + innerWidth, bottom: scrollY + innerHeight };
    stepRoamer(roamer, world, { dt, random: Math.random, pointer, view });
    gait += clamp((roamer.mode === 'walk' && roamer.speed > 0 ? 1 : 0) - gait, -dt * 5, dt * 5);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
