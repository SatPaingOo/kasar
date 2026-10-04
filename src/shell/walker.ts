/**
 * Tote Tote (တုတ်တုတ်), who lives on the shelf, the ladders he gets about
 * by, and whoever comes to see him.
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

import { createRoamer, settle } from './roam.js';
import type { Roamer } from './roam.js';
import { createScene, stepScene } from './visit.js';
import type { Actor, Say, Scene } from './visit.js';
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

/** Each one's own canvas, and where the feet sit on it. */
const SPRITE = { width: 128, height: 132, footX: 64, footY: 118 } as const;
/** His friend is smaller than he is: younger, and quicker on its feet. */
const SIZE: Readonly<Record<Actor['kind'], number>> = { tote: 1, friend: 0.74 };
/** The only words anyone says. Everything else is a sign, which needs no translating. */
const WORDS: Readonly<Record<'en' | 'my', Readonly<Record<'name' | 'hello' | 'bye', string>>>> = {
  en: { name: 'Tote Tote!', hello: 'hi!', bye: 'bye!' },
  my: { name: 'တုတ်တုတ်!', hello: 'မင်္ဂလာပါ', bye: 'ဘိုင်ဘိုင်' },
};
const FONT = '"Myanmar Text", "Noto Sans Myanmar", Padauk, system-ui, sans-serif';
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
function drawUpright(ctx: CanvasRenderingContext2D, r: Roamer, gait: number, breath: number, wave: number): Point {
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
    if (side === 0 && wave > 0) {
      // Waving: the arm up over his head and going side to side.
      arm(ctx, shoulder, facing, 2.55 + Math.sin(breath * 13) * 0.35, 0.25);
      continue;
    }
    arm(ctx, shoulder, facing, swing, FIGURE.elbowBend * (0.6 + gait * 0.4));
  }
  head(ctx, top, { x: top.x + facing * 2.6, y: top.y - 1.2 });
  return top;
}

/** In the air: knees up and arms out, most of all at the top of the arc. */
function drawAirborne(ctx: CanvasRenderingContext2D, r: Roamer): Point {
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
  return top;
}

/**
 * On a ladder, seen from behind: hands on the rails, one up while the
 * opposite foot is up, the way anyone climbs.
 */
function drawClimbing(ctx: CanvasRenderingContext2D, r: Roamer): Point {
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
  const top: Point = { x: 0, y: neck.y - FIGURE.headRadius };
  head(ctx, top, null);
  return top;
}

/** Sitting on the very end of something, legs over the edge and swinging. */
function drawSitting(ctx: CanvasRenderingContext2D, r: Roamer, time: number): Point {
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
  return top;
}

/** Cross-legged, anywhere — beside someone sitting on an end. */
function drawCross(ctx: CanvasRenderingContext2D, r: Roamer, time: number): Point {
  const f = r.facing;
  const breathe = Math.sin(time * 1.7) * 0.4;
  const hip: Point = { x: 0, y: -4 };
  const shoulder: Point = { x: f * 0.5, y: -22 + breathe };
  const neck: Point = { x: f * 0.6, y: -25 + breathe };
  // Knees out to either side, each foot tucked under the other.
  for (const side of [1, -1]) line(ctx, hip, { x: side * 10, y: -3 }, { x: -side * 4, y: -0.5 });
  line(ctx, hip, shoulder, neck);
  // Hands on his knees.
  for (const side of [1, -1] as const) {
    const hand: Point = { x: side * 9, y: -5 };
    line(ctx, shoulder, midJoint(shoulder, hand, FIGURE.upperArm, FIGURE.forearm, side === 1 ? -1 : 1), hand);
  }
  const top: Point = { x: neck.x + f * 0.5, y: neck.y - FIGURE.headRadius };
  head(ctx, top, { x: top.x + f * 2.6, y: top.y - 0.8 });
  return top;
}

/** At the edge, leaning out and looking down it. */
function drawLooking(ctx: CanvasRenderingContext2D, r: Roamer, time: number): Point {
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
  return top;
}

/** The friend's one mark of its own: a tuft of hair, blown back the way it has come. */
function tuft(ctx: CanvasRenderingContext2D, top: Point, facing: 1 | -1): void {
  for (const lean of [-0.5, 0, 0.5]) {
    const root: Point = { x: top.x + lean * 3, y: top.y - FIGURE.headRadius + 0.5 };
    line(ctx, root, { x: root.x - facing * 3 + lean * 2, y: root.y - 4.5 });
  }
}

/** Words for what is said, in the page's language; a sign as it is. */
function words(what: Say): string {
  const lang = document.documentElement.lang === 'my' ? 'my' : 'en';
  return what === 'name' || what === 'hello' || what === 'bye' ? WORDS[lang][what] : what;
}

/** A small bubble over a head, in the shelf's own grey, fading as it goes. */
function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, alpha: number, ink: string): void {
  ctx.save();
  // Burmese needs a size up to read at all.
  ctx.font = `500 ${/[\u1000-\u109f]/.test(text) ? 12 : 11}px ${FONT}`;
  const w = Math.min(SPRITE.width - 4, ctx.measureText(text).width + 12);
  const h = 18;
  const left = clamp(x - w / 2, 2, SPRITE.width - 2 - w);
  const top = Math.max(2, y - h - 7);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#11141a';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 6);
  ctx.moveTo(x - 3, top + h);
  ctx.lineTo(x, top + h + 5);
  ctx.lineTo(x + 3, top + h);
  ctx.fill();
  ctx.globalAlpha = alpha * 0.55;
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + w / 2, top + h / 2 + 0.5);
  ctx.restore();
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
  // could never get shorter. Its width is left to the stylesheet, which
  // makes it as wide as the window less any scrollbar: given a width in
  // pixels, it went on holding the page that wide after a scrollbar arrived
  // and took its share, until the next frame — and a hidden tab gets none.
  layer.style.height = '0px';
  const width = document.documentElement.scrollWidth;
  const height = document.documentElement.scrollHeight;
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

/** One canvas for one of them, moving with them inside the layer. */
interface Sprite {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** 0 standing to 1 walking, eased, so setting off is a lean rather than a snap. */
  gait: number;
}

export function startWalker(layer: HTMLElement): void {
  const first = layer.querySelector<HTMLCanvasElement>('canvas');
  const path = layer.querySelector<SVGPathElement>('path');
  const svg = layer.querySelector<SVGSVGElement>('svg');
  if (first === null || path === null || svg === null) return;

  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#f2f4f8';
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const ratio = Math.min(2, window.devicePixelRatio || 1);

  const sprite = (canvas: HTMLCanvasElement): Sprite | null => {
    const ctx = canvas.getContext('2d');
    if (ctx === null) return null;
    canvas.width = Math.round(SPRITE.width * ratio);
    canvas.height = Math.round(SPRITE.height * ratio);
    return { canvas, ctx, gait: 0 };
  };
  const his = sprite(first);
  if (his === null) return;
  let guest: Sprite | null = null;

  let world = buildWorld(measure(layer));
  let shape = shapeOf(world);
  const scene: Scene = createScene(createRoamer(world), Math.random);
  let clock = 0;
  let pointer: Point | null = null;

  function paint(s: Sprite, who: Actor): void {
    const r = who.body;
    // Whole pixels for the canvas, the fraction drawn inside it, so nobody
    // either blurs or jitters.
    const left = r.x - SPRITE.footX;
    const top = r.y - SPRITE.footY;
    const px = Math.round(left);
    const py = Math.round(top);
    const ctx = s.ctx;
    s.canvas.style.transform = `translate(${px}px, ${py}px)`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, SPRITE.width, SPRITE.height);
    const scale = FIGURE.scale * SIZE[who.kind];
    const fx = SPRITE.footX + left - px;
    const fy = SPRITE.footY + top - py;
    ctx.translate(fx, fy);
    ctx.scale(scale, scale);
    ctx.strokeStyle = ink;
    ctx.lineWidth = FIGURE.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = (r.startled > 0 ? STARTLED_ALPHA : INK_ALPHA) * who.alpha;
    let at: Point;
    switch (r.mode) {
      case 'air':
        at = drawAirborne(ctx, r);
        break;
      case 'climb':
        at = drawClimbing(ctx, r);
        break;
      case 'sit':
        at = drawSitting(ctx, r, clock);
        break;
      case 'cross':
        at = drawCross(ctx, r, clock);
        break;
      case 'look':
        at = drawLooking(ctx, r, clock);
        break;
      default:
        at = drawUpright(ctx, r, s.gait, clock, who.wave);
    }
    if (who.kind === 'friend') tuft(ctx, at, r.facing);
    if (who.say !== null) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const hx = fx + at.x * scale;
      const hy = fy + (at.y - FIGURE.headRadius) * scale;
      bubble(ctx, hx, hy, words(who.say), Math.min(1, who.sayFor / 0.3) * who.alpha, ink);
    }
  }

  function draw(): void {
    if (his !== null) paint(his, scene.tote);
    const visit = scene.visit;
    if (visit === null) {
      if (guest !== null) guest.canvas.style.display = 'none';
      return;
    }
    if (guest === null) {
      const canvas = document.createElement('canvas');
      layer.append(canvas);
      guest = sprite(canvas);
      if (guest === null) return;
    }
    guest.canvas.style.display = '';
    paint(guest, visit.actor);
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
      // The page moved under them: whatever they were doing is off.
      for (const r of [scene.tote.body, scene.visit?.actor.body]) {
        if (r === undefined) continue;
        const onLadder = r.ladder !== null && ladderOf(world, r.ladder) !== undefined;
        if (!onLadder || r.mode !== 'climb') settle(r, world);
      }
    }
    draw();
  }

  let pending = 0;
  const soon = (): void => {
    // On the next frame, so a burst of changes is measured once — or a
    // moment from now in a hidden tab, which gets no frames at all.
    cancelAnimationFrame(pending);
    window.clearTimeout(pending);
    pending = document.hidden ? window.setTimeout(rebuild, 60) : requestAnimationFrame(rebuild);
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
  // is part of the page, and the page should not change shape on them. Nobody
  // comes to visit, either.
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

  const ease = (s: Sprite | null, r: Roamer | undefined, dt: number): void => {
    if (s === null || r === undefined) return;
    s.gait += clamp((r.mode === 'walk' && r.speed > 0 ? 1 : 0) - s.gait, -dt * 5, dt * 5);
  };

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    clock += dt;
    const view: Box = { left: scrollX, top: scrollY, right: scrollX + innerWidth, bottom: scrollY + innerHeight };
    stepScene(scene, world, { dt, random: Math.random, pointer, view });
    ease(his, scene.tote.body, dt);
    ease(guest, scene.visit?.actor.body, dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
