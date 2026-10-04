/**
 * Tote Tote has visitors.
 *
 * Now and then someone comes to see him: they turn up at the side of the
 * screen, find him, say hello, keep him company for a while — walking where
 * he walks, sitting down beside him when he sits — and then say goodbye and
 * go. One at a time, and not always: most of the time he is on his own, so
 * that a visit is something that happens rather than part of the furniture,
 * and a shelf of games does not turn into a zoo competing with its cards.
 *
 * They talk mostly in signs — ♪ ! ? … ♥ — which need no translating and are
 * gone in a moment; a hello, a goodbye and his name are the only words, and
 * they are said in the page's language.
 *
 * Each visitor moves by the same rules he does (roam.ts) but is led: its mind
 * is made up here. Pure, like the rest: no DOM, no clock, randomness handed
 * in, so that a visit always ending, and nobody ever standing on nothing, are
 * tested by running whole afternoons of them.
 */

import { createRoamer, goTo, inTransit, pause, stepRoamer } from './roam.js';
import type { RoamInput, Roamer } from './roam.js';
import { surfaceOf } from './world.js';
import type { Box, Surface, World } from './world.js';

/** Who can come. */
export type Kind = 'friend';
export const KINDS: readonly Kind[] = ['friend'];

/** What is said: a word, looked up in the page's language when it is drawn, or a sign that needs none. */
export type Say = 'name' | 'hello' | 'bye' | '♪' | '!' | '?' | '…' | '♥' | 'ha';

export interface Actor {
  readonly kind: 'tote' | Kind;
  readonly body: Roamer;
  say: Say | null;
  /** Seconds left of what is being said. */
  sayFor: number;
  /** 0 to 1: a visitor fades in as it arrives and out as it goes. */
  alpha: number;
  /** Seconds left of waving. */
  wave: number;
}

/**
 * - `coming`: on its way to find him
 * - `greeting`: the two of them stopped, saying hello
 * - `staying`: keeping him company
 * - `going`: said goodbye, on its way out
 */
export type Stage = 'coming' | 'greeting' | 'staying' | 'going';

export interface Visit {
  readonly actor: Actor;
  stage: Stage;
  /** Seconds into the stage. */
  t: number;
  /** Seconds left of the stay. */
  stay: number;
  /** Seconds until it next looks round for where he has got to. */
  check: number;
  /** Where it leaves from. */
  exit: { readonly surface: string; readonly x: number } | null;
  /** Whether he has answered yet, in the greeting and the goodbye. */
  answered: boolean;
}

export interface Scene {
  readonly tote: Actor;
  visit: Visit | null;
  /** Seconds before anyone may come. */
  quiet: number;
  /** Who came last, so the next is someone else. */
  last: Kind | null;
  /** Seconds until someone says something idle. */
  chatter: number;
}

export const VISIT = {
  /** The first visit comes soon, so a look at the shelf has a fair chance of one. */
  firstQuiet: [12, 30],
  quiet: [45, 120],
  /** And when the time comes, someone comes this often. */
  chance: 0.8,
  stay: [45, 90],
  /** Close enough to say hello. */
  meet: 56,
  greet: 2.6,
  /** Further than this and it goes after him. */
  near: 90,
  /** It keeps this far behind him, and sits this far in from him. */
  behind: 28,
  beside: 24,
  fade: 0.7,
  /** Out of sight this long and it gives up and goes. */
  lost: 15,
  /** Unable to reach him for this long, and it gives up too. */
  patience: 40,
  sayFor: 2.2,
  chatter: [7, 14],
} as const;

/** How each visitor differs, so they do not all move alike. */
const BODY: Readonly<Record<Kind, { readonly pace: number; readonly bouncy: number }>> = {
  /** Smaller and quicker than he is, and bouncier. */
  friend: { pace: 1.35, bouncy: 0.35 },
};

const SIGNS: readonly Say[] = ['♪', 'ha', '…', '♥', '!', '?'];

const between = (random: () => number, [lo, hi]: readonly [number, number]): number => lo + random() * (hi - lo);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function actor(kind: Actor['kind'], body: Roamer): Actor {
  return { kind, body, say: null, sayFor: 0, alpha: kind === 'tote' ? 1 : 0, wave: 0 };
}

export function createScene(tote: Roamer, random: () => number): Scene {
  return { tote: actor('tote', tote), visit: null, quiet: between(random, VISIT.firstQuiet), last: null, chatter: 0 };
}

function say(a: Actor, what: Say): void {
  a.say = what;
  a.sayFor = VISIT.sayFor;
}

function tick(a: Actor, dt: number): void {
  a.sayFor = Math.max(0, a.sayFor - dt);
  if (a.sayFor === 0) a.say = null;
  a.wave = Math.max(0, a.wave - dt);
}

const onScreen = (view: Box, s: Surface): boolean =>
  s.y >= view.top + 70 && s.y <= view.bottom - 6 && s.x1 > view.left + 30 && s.x0 < view.right - 30;

/**
 * Where a visitor turns up: the end of whatever he is on, the end further
 * from him so it walks across to him, if that is on screen; otherwise the
 * end of something that is.
 */
function arrival(scene: Scene, world: World, view: Box, random: () => number): { surface: string; x: number } | null {
  const tote = scene.tote.body;
  const his = tote.surface === null ? undefined : surfaceOf(world, tote.surface);
  const seen = world.surfaces.filter((s) => onScreen(view, s));
  const s = his !== undefined && onScreen(view, his) ? his : seen[Math.floor(random() * seen.length)];
  if (s === undefined) return null;
  const lo = Math.max(s.x0, view.left + 12);
  const hi = Math.min(s.x1, view.right - 12);
  if (hi - lo < 40) return null;
  return { surface: s.id, x: Math.abs(tote.x - lo) > Math.abs(tote.x - hi) ? lo : hi };
}

function begin(scene: Scene, world: World, input: RoamInput): void {
  const pool = KINDS.filter((k) => k !== scene.last);
  const kind = (pool.length > 0 ? pool : KINDS)[Math.floor(input.random() * (pool.length || KINDS.length))] ?? 'friend';
  const at = arrival(scene, world, input.view, input.random);
  if (at === null) {
    scene.quiet = 5;
    return;
  }
  const body = createRoamer(world, input.random, at);
  body.led = true;
  body.pace = BODY[kind].pace;
  body.restFor = 0;
  scene.visit = {
    actor: actor(kind, body),
    stage: 'coming',
    t: 0,
    stay: between(input.random, VISIT.stay),
    check: 0,
    exit: null,
    answered: false,
  };
}

/** Somewhere just behind him on what he is on — or beside him, if he is sitting. */
function besideHim(tote: Roamer, world: World): { surface: string; x: number } | null {
  const s = tote.surface === null ? undefined : surfaceOf(world, tote.surface);
  if (s === undefined) return null;
  const sitting = tote.mode === 'sit' || tote.mode === 'cross';
  const x = tote.x - tote.facing * (sitting ? VISIT.beside : VISIT.behind);
  return { surface: s.id, x: clamp(x, s.x0, s.x1) };
}

const together = (a: Roamer, b: Roamer, within: number): boolean =>
  a.surface !== null && a.surface === b.surface && Math.abs(a.x - b.x) <= within;

function stage(v: Visit, next: Stage): void {
  v.stage = next;
  v.t = 0;
  v.check = 0;
  v.answered = false;
}

/** One frame of the whole scene: him, and whoever has come to see him. */
export function stepScene(scene: Scene, world: World, input: RoamInput): Scene {
  const dt = input.dt;
  const tote = scene.tote;
  stepRoamer(tote.body, world, input);
  tick(tote, dt);

  const v = scene.visit;
  if (v === null) {
    scene.quiet -= dt;
    if (scene.quiet <= 0) {
      if (input.random() < VISIT.chance) begin(scene, world, input);
      else scene.quiet = between(input.random, VISIT.quiet);
    }
    return scene;
  }

  const guest = v.actor;
  const body = guest.body;
  stepRoamer(body, world, input);
  tick(guest, dt);
  v.t += dt;
  v.check -= dt;

  const leaving = v.stage === 'going';
  guest.alpha = clamp(guest.alpha + (leaving && v.exit === null ? -dt : dt) / VISIT.fade, 0, 1);

  // Out of sight too long — scrolled away from, say — and it goes, quietly.
  if (!leaving && body.away > VISIT.lost) {
    stage(v, 'going');
    v.exit = null;
  }

  switch (v.stage) {
    case 'coming': {
      if (v.t > VISIT.patience) {
        stage(v, 'going');
        v.exit = null;
        break;
      }
      if (v.check > 0 || inTransit(body) || inTransit(tote.body)) break;
      v.check = 1.2;
      if (together(body, tote.body, VISIT.meet)) {
        stage(v, 'greeting');
        const face = body.x < tote.body.x ? 1 : -1;
        pause(body, VISIT.greet, face);
        pause(tote.body, VISIT.greet, face === 1 ? -1 : 1);
        say(guest, 'name');
        break;
      }
      const spot = besideHim(tote.body, world);
      if (spot !== null) goTo(body, world, spot, 'rest', input.random);
      break;
    }
    case 'greeting': {
      if (!v.answered && v.t > 0.7) {
        v.answered = true;
        say(tote, 'hello');
      }
      if (v.t >= VISIT.greet) stage(v, 'staying');
      break;
    }
    case 'staying': {
      v.stay -= dt;
      if (v.stay <= 0) {
        stage(v, 'going');
        const face = body.x < tote.body.x ? 1 : -1;
        say(guest, 'bye');
        guest.wave = 1.6;
        pause(body, 1.4, face);
        if (!inTransit(tote.body)) pause(tote.body, 2.2, face === 1 ? -1 : 1);
        const s = body.surface === null ? undefined : surfaceOf(world, body.surface);
        if (s !== undefined) {
          // Out by whichever end of what it is on is further from him.
          const end = Math.abs(tote.body.x - s.x0) > Math.abs(tote.body.x - s.x1) ? s.x0 : s.x1;
          v.exit = { surface: s.id, x: end };
        }
        break;
      }
      scene.chatter -= dt;
      if (scene.chatter <= 0) {
        scene.chatter = between(input.random, VISIT.chatter);
        const who = input.random() < 0.5 ? guest : tote;
        say(who, SIGNS[Math.floor(input.random() * SIGNS.length)] ?? '♪');
        if (who === guest && input.random() < BODY[guest.kind as Kind].bouncy && !inTransit(body)) {
          goTo(body, world, { surface: body.surface ?? '', x: body.x }, 'bounce', input.random);
        }
      }
      if (v.check > 0 || inTransit(body) || inTransit(tote.body) || body.restFor > 0.3) break;
      v.check = 1;
      const sitting = tote.body.mode === 'sit' || tote.body.mode === 'cross';
      const spot = besideHim(tote.body, world);
      if (spot === null) break;
      if (sitting && body.mode !== 'cross') {
        // He has sat down: it sits down beside him, facing the same way.
        goTo(body, world, spot, 'cross', input.random, tote.body.facing);
      } else if (!sitting && !together(body, tote.body, VISIT.near)) {
        goTo(body, world, spot, 'rest', input.random);
      } else if (!sitting && body.mode === 'cross') {
        // He has got up, so it does.
        goTo(body, world, spot, 'rest', input.random);
      }
      break;
    }
    case 'going': {
      if (!v.answered && v.t > 0.5 && v.exit !== null) {
        v.answered = true;
        say(tote, 'bye');
        tote.wave = 1.8;
      }
      if (v.exit !== null && v.t > 1.4 && !inTransit(body) && body.restFor <= 0.3) {
        const there = body.surface === v.exit.surface && Math.abs(body.x - v.exit.x) < 1;
        if (there || v.t > 30) v.exit = null;
        else if (body.steps.length === 0) {
          if (!goTo(body, world, v.exit, 'rest', input.random)) v.exit = null;
        }
      }
      if (v.exit === null && guest.alpha <= 0) {
        scene.last = guest.kind as Kind;
        scene.visit = null;
        scene.quiet = between(input.random, VISIT.quiet);
      }
      break;
    }
  }
  return scene;
}
