/**
 * What the shelf's figure — Tote Tote, တုတ်တုတ် — does with the page, one
 * frame at a time. Visitors move by the same rules; see visit.ts.
 *
 * He is not wandering at random. Whenever he has nothing to do he picks
 * something he wants — to go and see somewhere else on the page, to stroll,
 * to sit on the end of a card with his legs over the edge, to look down over
 * one, to hop for no reason, to stand — and then he carries it out: the route
 * to get there is planned (route.ts) and walked, hopped, climbed and jumped a
 * step at a time.
 *
 * Two things outrank whatever he wanted. A pointer coming at him sends him
 * scurrying along whatever he is on, as it always has. And he lives where
 * you are looking: somewhere you can see is six times as likely as
 * somewhere you cannot, and a while out of sight sends him back into view —
 * on a long page he would otherwise spend most of his life off the screen.
 *
 * Pure, like the games' rules: no DOM, no clock, randomness handed in, so the
 * promises — never off a surface, never chased off one, never lost — can be
 * tested by running him for a long time.
 */

import { route } from './route.js';
import type { Step, Ways } from './route.js';
import { ladderOf, spotOn, surfaceOf, surfaceUnder } from './world.js';
import type { Box, Surface, World } from './world.js';

export const ROAM = {
  stroll: 36,
  /** Speed when he is out of sight and heading back, so the trip is not a long one. */
  hurry: 80,
  flee: 118,
  climb: 46,
  /** A pointer nearer than this to his chest startles him. */
  startle: 90,
  chest: 30,
  startleSeconds: 1.1,
  fleeDistance: 200,
  /** Room he needs to run along before he would rather jump. */
  cornered: 30,
  /** Seconds out of sight before he heads back into view. */
  away: 5,
  phasePerPixel: 0.085,
  climbPerPixel: 0.16,
} as const;

/** The shape of each kind of jump: how long it takes and how high it goes above the higher end. */
const ARC = {
  hop: { time: 0.34, height: 16 },
  leap: { time: 0.44, height: 14 },
  drop: { time: 0.3, height: 8 },
  bounce: { time: 0.4, height: 14 },
  step: { time: 0.2, height: 4 },
  /** A bird's flight: as long as its distance needs, and high in the middle. */
  fly: { time: 0.6, height: 30 },
} as const;

/** Where a flight lands that is not on a surface: on his head, or off the page altogether. */
export const RIDE = '@head';
export const AWAY = '@away';

/**
 * `sit` is on the very end of something with the legs over the edge; `cross`
 * is cross-legged, anywhere — beside someone sitting on an end, say. A bird
 * has two of its own: `ride`, perched on his head, where whoever leads it
 * keeps it; and `gone`, flown off the page.
 */
export type Mode = 'stand' | 'walk' | 'climb' | 'air' | 'sit' | 'cross' | 'look' | 'ride' | 'gone';
export type Then = 'rest' | 'sit' | 'cross' | 'look' | 'bounce';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Flight {
  readonly kind: keyof typeof ARC;
  readonly from: Point;
  readonly to: Point;
  readonly peak: number;
  readonly time: number;
  t: number;
  /** The surface he lands on, or null for onto a ladder. */
  readonly onto: string | null;
}

export interface Roamer {
  /** His feet, in document pixels. */
  x: number;
  y: number;
  facing: 1 | -1;
  mode: Mode;
  /** What he is standing on, or null while he climbs or flies. */
  surface: string | null;
  ladder: string | null;
  /** Walk cycle, advanced by distance so the legs match the pace. */
  phase: number;
  /** Climb cycle, the same for hands and feet on rungs. */
  climb: number;
  /** Pixels per second right now, for how much he leans into it. */
  speed: number;
  flight: Flight | null;
  steps: Step[];
  then: Then;
  /** Seconds left of standing, sitting or looking. */
  restFor: number;
  startled: number;
  /** Seconds he has been out of sight. */
  away: number;
  /** Where a climb is heading, and what he steps off onto at the end of it. */
  climbTo: number | null;
  stepOff: { readonly to: string; readonly x: number } | null;
  /** How fast he goes, against Tote Tote's own pace. */
  pace: number;
  /**
   * Following someone else's plan instead of making his own: a visitor,
   * whose mind is made up in visit.ts. Left with nothing to do, he waits.
   */
  led: boolean;
  /** Which way to face on arriving, if it matters. */
  face: 1 | -1 | null;
  /** Whether ladders are any use to him. A cat goes without. */
  climbs: boolean;
}

export interface RoamInput {
  readonly dt: number;
  readonly random: () => number;
  /** The pointer in document pixels, or null. */
  readonly pointer: Point | null;
  /** The part of the document on screen. */
  readonly view: Box;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const between = (random: () => number, lo: number, hi: number): number => lo + random() * (hi - lo);

/**
 * He starts on the masthead's rule, which is on screen whenever the page
 * opens — or wherever there is. A visitor is put where it arrives.
 */
export function createRoamer(
  world: World,
  random: () => number = Math.random,
  at: { readonly surface: string; readonly x: number } | null = null,
): Roamer {
  const start =
    (at === null ? undefined : surfaceOf(world, at.surface)) ??
    surfaceOf(world, 'rule') ??
    surfaceOf(world, 'floor') ??
    (world.surfaces[0] as Surface);
  return {
    x:
      at !== null && at.surface === start.id
        ? clamp(at.x, start.x0, start.x1)
        : spotOn(world, start.id, start.x0, start.x1, random),
    y: start.y,
    facing: random() < 0.5 ? -1 : 1,
    mode: 'stand',
    surface: start.id,
    ladder: null,
    phase: 0,
    climb: 0,
    speed: 0,
    flight: null,
    steps: [],
    then: 'rest',
    restFor: between(random, 0.8, 1.8),
    startled: 0,
    away: 0,
    climbTo: null,
    stepOff: null,
    pace: 1,
    led: false,
    face: null,
    climbs: true,
  };
}

/**
 * The page moved under him — a resize, the cards arriving, the language
 * changing their heights. Whatever he was doing is off; he lands on what is
 * under him now.
 */
export function settle(r: Roamer, world: World): Roamer {
  const same = r.surface === null ? undefined : surfaceOf(world, r.surface);
  const s = same ?? surfaceUnder(world, r.x, r.y);
  r.surface = s.id;
  r.x = clamp(r.x, s.x0, s.x1);
  r.y = s.y;
  r.mode = 'stand';
  r.ladder = null;
  r.flight = null;
  r.steps = [];
  r.then = 'rest';
  r.restFor = Math.min(r.restFor, 0.4);
  r.climbTo = null;
  r.stepOff = null;
  r.speed = 0;
  return r;
}

/** Where he is in a flight, t seconds into it. */
export function flightAt(f: Flight, t: number): Point {
  const u = clamp(t / f.time, 0, 1);
  // A quadratic through both ends whose middle reaches the peak.
  const c = 2 * f.peak - (f.from.y + f.to.y) / 2;
  return {
    x: f.from.x + (f.to.x - f.from.x) * u,
    y: (1 - u) * (1 - u) * f.from.y + 2 * u * (1 - u) * c + u * u * f.to.y,
  };
}

function fly(r: Roamer, kind: keyof typeof ARC, to: Point, onto: string | null): void {
  const arc = ARC[kind];
  const from = { x: r.x, y: r.y };
  const fall = Math.max(0, to.y - from.y);
  const far = Math.hypot(to.x - from.x, to.y - from.y);
  r.flight = {
    kind,
    from,
    to,
    peak: Math.min(from.y, to.y) - arc.height - (kind === 'fly' ? far * 0.12 : 0),
    // A longer drop takes longer, the way falling does; a flight as long as it is far.
    time: arc.time + (kind === 'drop' ? fall / 600 : 0) + (kind === 'fly' ? far / 260 : 0),
    t: 0,
    onto,
  };
  if (Math.abs(to.x - from.x) > 0.5) r.facing = to.x > from.x ? 1 : -1;
  r.mode = 'air';
  r.surface = null;
}

const inView = (view: Box, x: number, y: number): boolean =>
  x >= view.left && x <= view.right && y >= view.top && y <= view.bottom + 4;

/** Somewhere else to go, likelier where it can be seen, and only there if he has been gone a while. */
function destination(r: Roamer, world: World, input: RoamInput): { surface: string; x: number } | null {
  const v = input.view;
  const options = world.surfaces
    .filter((s) => s.id !== r.surface && s.id !== world.roof)
    .map((s) => {
      const lo = Math.max(s.x0, v.left + 20);
      const hi = Math.min(s.x1, v.right - 20);
      const seen = s.y >= v.top + 70 && s.y <= v.bottom - 6 && hi - lo > 10;
      return { s, lo, hi, seen };
    });
  const lost = r.away > ROAM.away;
  const pool = lost && options.some((o) => o.seen) ? options.filter((o) => o.seen) : options;
  if (pool.length === 0) return null;
  const weight = (o: (typeof pool)[number]): number => (o.seen ? 6 : 1);
  let pick = input.random() * pool.reduce((sum, o) => sum + weight(o), 0);
  for (const o of pool) {
    pick -= weight(o);
    if (pick <= 0 || o === pool[pool.length - 1]) {
      const x = o.seen
        ? spotOn(world, o.s.id, o.lo, o.hi, input.random)
        : spotOn(world, o.s.id, o.s.x0, o.s.x1, input.random);
      return { surface: o.s.id, x };
    }
  }
  return null;
}

/** Make up his mind about what to do next. */
function decide(r: Roamer, world: World, input: RoamInput): void {
  const here = r.surface === null ? undefined : surfaceOf(world, r.surface);
  if (here === undefined) return;
  if (r.led) {
    // Someone else decides; until they do, stand where he is.
    r.then = 'rest';
    r.mode = 'stand';
    r.restFor = 0.25;
    return;
  }
  const lost = r.away > ROAM.away;
  const roll = input.random();

  const go = (then: Then): boolean => {
    const where = destination(r, world, input);
    const steps = where === null ? null : route(world, { surface: here.id, x: r.x }, where, waysFor(r));
    if (steps === null || steps.length === 0) return false;
    r.steps = steps;
    r.then = then;
    return true;
  };

  if (lost || roll < 0.42) {
    if (go('rest')) return;
  }
  if (roll < 0.62) {
    // A stroll: somewhere along what he is on, not where he already is.
    const x = spotOn(world, here.id, here.x0, here.x1, input.random);
    if (Math.abs(x - r.x) > 40) {
      r.steps = [{ kind: 'walk', x }];
      r.then = 'rest';
      return;
    }
  }
  if (roll < 0.85 && here.id !== 'floor') {
    // To the nearer end, to sit with his legs over the edge or look down it.
    const end = r.x - here.x0 < here.x1 - r.x ? here.x0 : here.x1;
    r.steps = Math.abs(end - r.x) > 0.5 ? [{ kind: 'walk', x: end }] : [];
    r.then = roll < 0.75 ? 'sit' : 'look';
    return;
  }
  if (roll < 0.92) {
    r.then = 'bounce';
    return;
  }
  r.then = 'rest';
  r.mode = 'stand';
  r.restFor = between(input.random, 2, 4);
}

/** The steps are done: do what he went there for. */
function arrive(r: Roamer, world: World, input: RoamInput): void {
  const here = r.surface === null ? undefined : surfaceOf(world, r.surface);
  const then = r.then;
  const face = r.face;
  r.then = 'rest';
  r.face = null;
  r.speed = 0;
  if ((then === 'sit' || then === 'look') && here !== undefined) {
    // Facing out over whichever end he is at.
    r.facing = face ?? (r.x - here.x0 < here.x1 - r.x ? -1 : 1);
    r.mode = then;
    r.restFor = then === 'sit' ? between(input.random, 4, 8) : between(input.random, 1.6, 3);
    return;
  }
  if (then === 'cross') {
    if (face !== null) r.facing = face;
    r.mode = 'cross';
    r.restFor = between(input.random, 6, 12);
    return;
  }
  if (then === 'bounce') {
    fly(r, 'bounce', { x: r.x, y: r.y }, r.surface);
    return;
  }
  if (face !== null) r.facing = face;
  r.mode = 'stand';
  r.restFor = r.led ? 0.25 : between(input.random, 1.2, 3.5);
}

/** The ways open to him: all of them, or all but the ladders. */
export const waysFor =
  (r: Roamer): Ways =>
  (link) =>
    r.climbs || link.kind !== 'ladder';

/** Whether he is between surfaces — on a ladder or in the air — and cannot be redirected yet. */
export const inTransit = (r: Roamer): boolean => r.mode === 'air' || r.mode === 'climb';

/**
 * Send him somewhere and have him do `then` when he gets there — for a
 * visitor, whose plans are made for it. False if he cannot be sent: he is
 * between surfaces, or there is no way.
 */
export function goTo(
  r: Roamer,
  world: World,
  to: { readonly surface: string; readonly x: number },
  then: Then,
  random: () => number,
  face: 1 | -1 | null = null,
): boolean {
  if (inTransit(r) || r.surface === null) return false;
  const steps = route(world, { surface: r.surface, x: r.x }, to, waysFor(r));
  if (steps === null) return false;
  r.steps = steps;
  r.then = then;
  r.face = face;
  r.restFor = 0;
  if (steps.length === 0) {
    // Already there.
    arrive(r, world, { dt: 0, random, pointer: null, view: { left: 0, top: 0, right: 0, bottom: 0 } });
  } else {
    r.mode = 'walk';
  }
  return true;
}

/** Fly — for a bird — to a point: onto a surface, onto his head, or away. */
export function flyTo(r: Roamer, to: Point, onto: string): void {
  r.steps = [];
  r.restFor = 0;
  fly(r, 'fly', to, onto);
}

/** Jump — a cat's pounce — to a point on a surface. */
export function hopTo(r: Roamer, to: Point, onto: string): void {
  r.steps = [];
  r.restFor = 0;
  fly(r, 'hop', to, onto);
}

/** Stop where he is for a while, facing one way: to greet someone, or see them off. */
export function pause(r: Roamer, seconds: number, facing: 1 | -1): void {
  if (inTransit(r)) return;
  r.steps = [];
  r.then = 'rest';
  r.mode = 'stand';
  r.speed = 0;
  r.restFor = seconds;
  r.facing = facing;
}

/** Take the next step of the plan. */
function begin(r: Roamer, world: World, step: Step): boolean {
  if (step.kind === 'walk') {
    r.mode = 'walk';
    return true;
  }
  const onto = surfaceOf(world, step.to);
  if (onto === undefined) return false;
  if (step.kind === 'climb') {
    const ladder = ladderOf(world, step.ladder);
    if (ladder === undefined) return false;
    const fromTop = Math.abs(r.y - ladder.top.y) < Math.abs(r.y - ladder.bottom.y);
    r.ladder = ladder.id;
    r.climbTo = fromTop ? ladder.bottom.y : ladder.top.y;
    r.stepOff = { to: step.to, x: step.x };
    fly(r, 'step', { x: ladder.x, y: r.y }, null);
    r.steps.shift();
    return true;
  }
  fly(r, step.kind, { x: step.x, y: onto.y }, onto.id);
  r.steps.shift();
  return true;
}

/** One frame. Mutates and returns the same object, so a frame does not allocate. */
export function stepRoamer(r: Roamer, world: World, input: RoamInput): Roamer {
  const dt = input.dt;
  if (r.mode === 'gone' || r.mode === 'ride') {
    // Off the page, or on his head where the visit keeps it: nothing to do here.
    r.away = inView(input.view, r.x, r.y) ? 0 : r.away + dt;
    return r;
  }
  if (r.mode !== 'air' && r.mode !== 'climb' && (r.surface === null || surfaceOf(world, r.surface) === undefined)) {
    settle(r, world);
  }

  r.away = inView(input.view, r.x, r.y) ? 0 : r.away + dt;
  r.startled = Math.max(0, r.startled - dt);

  // A pointer coming at him: along whatever he is on, away from it.
  const here = r.surface === null ? undefined : surfaceOf(world, r.surface);
  if (input.pointer !== null && here !== undefined && r.mode !== 'air') {
    const near = Math.hypot(input.pointer.x - r.x, input.pointer.y - (r.y - ROAM.chest)) < ROAM.startle;
    if (near) {
      const away = input.pointer.x > r.x ? -1 : 1;
      const x = clamp(r.x + away * ROAM.fleeDistance, here.x0, here.x1);
      r.startled = ROAM.startleSeconds;
      r.restFor = 0;
      if (Math.abs(x - r.x) < ROAM.cornered) {
        // Nowhere to run: a startled hop where he stands.
        r.steps = [];
        r.then = 'bounce';
        arrive(r, world, input);
      } else {
        r.steps = [{ kind: 'walk', x }];
        r.then = 'rest';
        r.mode = 'walk';
      }
    }
  }

  const hurry = (r.startled > 0 ? ROAM.flee : r.away > 0 ? ROAM.hurry : ROAM.stroll) * r.pace;

  switch (r.mode) {
    case 'air': {
      const f = r.flight;
      if (f === null) {
        settle(r, world);
        break;
      }
      f.t += dt;
      const at = flightAt(f, f.t);
      r.x = at.x;
      r.y = at.y;
      if (f.t >= f.time) {
        r.x = f.to.x;
        r.y = f.to.y;
        r.flight = null;
        if (f.onto === null) {
          r.mode = 'climb';
        } else if (f.onto === RIDE || f.onto === AWAY) {
          r.mode = f.onto === RIDE ? 'ride' : 'gone';
          r.surface = null;
          r.restFor = 0;
        } else {
          r.surface = f.onto;
          r.ladder = null;
          r.mode = 'stand';
          // A beat on landing before the next thing.
          r.restFor = f.kind === 'step' ? 0.05 : 0.14;
          if (r.steps.length === 0 && f.kind !== 'bounce') arrive(r, world, input);
          else if (f.kind === 'bounce') {
            r.mode = 'stand';
            r.restFor = between(input.random, 0.6, 1.4);
          }
        }
      }
      break;
    }
    case 'climb': {
      const ladder = r.ladder === null ? undefined : ladderOf(world, r.ladder);
      if (ladder === undefined || r.climbTo === null || r.stepOff === null) {
        settle(r, world);
        break;
      }
      r.x = ladder.x;
      const toGo = r.climbTo - r.y;
      const moved = Math.min(Math.abs(toGo), ROAM.climb * r.pace * (r.startled > 0 || r.away > 0 ? 1.6 : 1) * dt);
      r.y += Math.sign(toGo) * moved;
      r.climb += moved * ROAM.climbPerPixel;
      r.speed = moved / Math.max(dt, 1e-6);
      if (Math.abs(r.climbTo - r.y) < 0.01) {
        const off = r.stepOff;
        r.climbTo = null;
        r.stepOff = null;
        fly(r, 'step', { x: off.x, y: r.y }, off.to);
      }
      break;
    }
    default: {
      if (r.restFor > 0) {
        r.restFor -= dt;
        r.speed = 0;
        break;
      }
      const step = r.steps[0];
      if (step === undefined) {
        if (r.mode === 'walk') {
          arrive(r, world, input);
          break;
        }
        decide(r, world, input);
        if (r.steps.length === 0 && r.restFor <= 0) arrive(r, world, input);
        break;
      }
      if (step.kind !== 'walk') {
        if (!begin(r, world, step)) settle(r, world);
        break;
      }
      const s = r.surface === null ? undefined : surfaceOf(world, r.surface);
      if (s === undefined) {
        settle(r, world);
        break;
      }
      r.mode = 'walk';
      const target = clamp(step.x, s.x0, s.x1);
      const toGo = target - r.x;
      if (Math.abs(toGo) > 0.01) r.facing = toGo > 0 ? 1 : -1;
      const moved = Math.min(Math.abs(toGo), hurry * dt);
      r.x += Math.sign(toGo) * moved;
      r.y = s.y;
      r.phase += moved * ROAM.phasePerPixel;
      r.speed = moved > 0 ? hurry : 0;
      if (Math.abs(target - r.x) < 0.01) r.steps.shift();
      break;
    }
  }
  return r;
}
