/**
 * Tote Tote's visitors: a friend, and a bird.
 *
 * Nobody appears from nowhere. The friend comes in by one of the two ways
 * into the page — down the ladder from the roof above the top of it, or out
 * of the door on the floor at the foot of it, whichever he is nearer — and
 * goes home the way it came. The bird needs no way: it flies in from off the
 * screen on any side and flies off on any side when it is done.
 *
 * The friend finds him, calls his name and he says hello, keeps him company
 * — walking where he walks, climbing after him, sitting down beside him when
 * he sits — then says goodbye, and they wave. The bird comes to play with
 * him, or with the cat: with him it sings, hops about and rides on his head;
 * with the cat, it lets itself be stalked and pounced at, and is always off
 * again a moment before the cat lands.
 *
 * One visitor at a time, and not always one. They talk mostly in signs.
 * Their minds are made up here; their bodies move by roam.ts. Pure: no DOM,
 * no clock, randomness handed in.
 */

import { actor, between, clamp, headOf, say, tick, together } from './actor.js';
import type { Actor, Say } from './actor.js';
import type { Cat } from './cat.js';
import { reachable } from './route.js';
import { AWAY, RIDE, createRoamer, flyTo, goTo, inTransit, pause, stepRoamer, waysFor } from './roam.js';
import type { Point, RoamInput, Roamer } from './roam.js';
import { surfaceOf } from './world.js';
import type { Box, World } from './world.js';

export type Guest = 'friend' | 'bird';
export const GUESTS: readonly Guest[] = ['friend', 'bird'];

/**
 * - `coming`: on its way to whoever it has come to see
 * - `greeting`: stopped, saying hello
 * - `staying`: keeping them company
 * - `going`: said goodbye, on its way out
 */
export type Stage = 'coming' | 'greeting' | 'staying' | 'going';

/** The way it came in, which is the way it goes out — or, for the bird, any way at all. */
export type Way =
  { readonly by: 'roof' | 'door'; readonly surface: string; readonly x: number } | { readonly by: 'sky' };

export interface Visit {
  readonly actor: Actor;
  /** Who it has come to see: him, or — a bird, sometimes — the cat. */
  readonly host: 'tote' | 'cat';
  readonly way: Way;
  stage: Stage;
  /** Seconds into the stage. */
  t: number;
  /** Seconds left of the stay. */
  stay: number;
  /** Seconds until it next looks round for where its host has got to. */
  check: number;
  /** Whether its host has answered yet, in the greeting and the goodbye. */
  answered: boolean;
  /** Seconds left of riding on his head — the bird's. */
  ride: number;
  /** Times the bird has got away from the cat. */
  escapes: number;
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
  /** Coming out of a doorway or going into one, it is in its shadow this far either side. */
  doorway: 18,
  /** Out of sight this long while staying, and it goes home. */
  lost: 15,
  /** Unable to reach him for this long, and it goes home too. Long, because from the door to the top of a phone is a long climb. */
  patience: 120,
  chatter: [7, 14],
} as const;

const FRIEND_SIGNS: readonly Say[] = ['♪', 'ha', '…', '♥', '!', '?'];
const BIRD_SIGNS: readonly Say[] = ['♪', '♪', '!'];
const HIS_SIGNS: readonly Say[] = ['♪', '!', 'ha', '…'];

const sideOf = (from: number, to: number): 1 | -1 => (from < to ? 1 : -1);

/**
 * Which way the friend comes in: by the roof if he is in the top half of the
 * page, by the door if he is in the bottom half — so it never has the whole
 * page to cross — or by whichever there is.
 */
function wayIn(world: World, tote: Roamer): Way | null {
  const roof = world.roof === null ? undefined : surfaceOf(world, world.roof);
  const door = world.door;
  const roofWay: Way | null = roof === undefined ? null : { by: 'roof', surface: roof.id, x: roof.x0 };
  const doorWay: Way | null = door === null ? null : { by: 'door', surface: 'floor', x: door };
  return tote.y < world.height / 2 ? (roofWay ?? doorWay) : (doorWay ?? roofWay);
}

/** Somewhere just off the screen, on a side picked at random: where a bird comes from, and goes to. */
function offScreen(view: Box, random: () => number): Point {
  const roll = random();
  const across = view.left + 40 + random() * Math.max(1, view.right - view.left - 80);
  if (roll < 0.35) return { x: view.left - 40, y: view.top + 40 + random() * 100 };
  if (roll < 0.7) return { x: view.right + 40, y: view.top + 40 + random() * 100 };
  return { x: across, y: view.top - 40 };
}

/** Somewhere on what `near` is standing on, a little way off on the side the bird comes from. */
function landingBy(
  near: Roamer,
  world: World,
  from: number,
  random: () => number,
): (Point & { readonly onto: string }) | null {
  const s = near.surface === null ? undefined : surfaceOf(world, near.surface);
  if (s === undefined || s.id === world.roof) return null;
  const side = from < near.x ? -1 : 1;
  return { x: clamp(near.x + side * (30 + random() * 30), s.x0, s.x1), y: s.y, onto: s.id };
}

/** Start a visit, if anyone can come just now; null if they cannot. */
export function beginVisit(kind: Guest, world: World, input: RoamInput, tote: Actor, cat: Cat | null): Visit | null {
  const random = input.random;
  if (kind === 'friend') {
    const way = wayIn(world, tote.body);
    if (way === null || way.by === 'sky') return null;
    const body = createRoamer(world, random, { surface: way.surface, x: way.x });
    body.led = true;
    body.pace = 1.35;
    body.restFor = 0;
    return {
      actor: actor('friend', body, way.by === 'door' ? 0 : 1),
      host: 'tote',
      way,
      stage: 'coming',
      t: 0,
      stay: between(random, VISIT.stay),
      check: 0,
      answered: false,
      ride: 0,
      escapes: 0,
    };
  }
  // The bird: to the cat sometimes, if the cat is not busy with him.
  const toCat = cat !== null && cat.mood !== 'with' && random() < 0.45;
  const host = toCat && cat !== null ? cat.actor.body : tote.body;
  if (inTransit(host)) return null;
  const from = offScreen(input.view, random);
  const spot = landingBy(host, world, from.x, random);
  if (spot === null) return null;
  const body = createRoamer(world, random);
  body.led = true;
  body.climbs = false;
  body.x = from.x;
  body.y = from.y;
  body.surface = null;
  flyTo(body, spot, spot.onto);
  return {
    actor: actor('bird', body),
    host: toCat ? 'cat' : 'tote',
    way: { by: 'sky' },
    stage: 'coming',
    t: 0,
    stay: between(random, toCat ? [25, 45] : VISIT.stay),
    check: 0,
    answered: false,
    ride: 0,
    escapes: 0,
  };
}

function next(v: Visit, stage: Stage): void {
  v.stage = stage;
  v.t = 0;
  v.check = 0;
  v.answered = false;
}

/** Somewhere just behind him on what he is on — or beside him, if he is sitting. */
function besideHim(tote: Roamer, world: World): { surface: string; x: number } | null {
  const s = tote.surface === null ? undefined : surfaceOf(world, tote.surface);
  if (s === undefined) return null;
  const sitting = tote.mode === 'sit' || tote.mode === 'cross';
  const x = tote.x - tote.facing * (sitting ? VISIT.beside : VISIT.behind);
  return { surface: s.id, x: clamp(x, s.x0, s.x1) };
}

/** The friend going home: back to the way it came, and through it. True once it is gone. */
function goingHome(v: Visit, world: World, input: RoamInput): boolean {
  const body = v.actor.body;
  if (v.way.by === 'sky') return true;
  const there = body.surface === v.way.surface && Math.abs(body.x - v.way.x) < 1.5;
  if (there) {
    // Up the ladder past the top of the page, or into the dark of the doorway.
    body.mode = 'gone';
    return true;
  }
  if (!inTransit(body) && body.steps.length === 0 && body.restFor <= 0.3) {
    goTo(body, world, { surface: v.way.surface, x: v.way.x }, 'rest', input.random);
  }
  return false;
}

/** One frame of a friend's visit. True once it is over. */
function stepFriend(v: Visit, world: World, input: RoamInput, tote: Actor, chatter: { left: number }): boolean {
  const dt = input.dt;
  const guest = v.actor;
  const body = guest.body;
  const him = tote.body;

  // Coming out of the doorway, or going into it, it is in its shadow.
  if (v.way.by === 'door') {
    const out = body.surface === 'floor' ? Math.abs(body.x - v.way.x) : VISIT.doorway;
    guest.alpha = clamp(out / VISIT.doorway, 0, 1);
  }
  if (v.stage === 'staying' && body.away > VISIT.lost) next(v, 'going');

  switch (v.stage) {
    case 'coming': {
      if (v.t > VISIT.patience) {
        next(v, 'going');
        break;
      }
      if (v.check > 0 || inTransit(body) || inTransit(him)) break;
      v.check = 1.2;
      // He has seen someone coming: he stops where he is and waits, rather
      // than lead them a chase up and down the ladders.
      const canReach =
        body.surface !== null && him.surface !== null && reachable(world, body.surface, waysFor(body)).has(him.surface);
      if (canReach && !him.led) {
        if (v.t < 3) say(tote, '!');
        pause(him, 1.5, sideOf(him.x, body.x));
      }
      if (together(body, him, VISIT.meet)) {
        next(v, 'greeting');
        const face = sideOf(body.x, him.x);
        pause(body, VISIT.greet, face);
        pause(him, VISIT.greet, face === 1 ? -1 : 1);
        say(guest, 'name');
        break;
      }
      const spot = besideHim(him, world);
      if (spot !== null) goTo(body, world, spot, 'rest', input.random);
      break;
    }
    case 'greeting': {
      if (!v.answered && v.t > 0.7) {
        v.answered = true;
        say(tote, 'hello');
      }
      if (v.t >= VISIT.greet) next(v, 'staying');
      break;
    }
    case 'staying': {
      v.stay -= dt;
      if (v.stay <= 0) {
        next(v, 'going');
        const face = sideOf(body.x, him.x);
        say(guest, 'bye');
        guest.wave = 1.6;
        pause(body, 1.4, face);
        if (!inTransit(him)) pause(him, 2.2, face === 1 ? -1 : 1);
        break;
      }
      chatter.left -= dt;
      if (chatter.left <= 0) {
        chatter.left = between(input.random, VISIT.chatter);
        const mine = input.random() < 0.5;
        const pool = mine ? FRIEND_SIGNS : HIS_SIGNS;
        say(mine ? guest : tote, pool[Math.floor(input.random() * pool.length)] ?? '♪');
        if (mine && input.random() < 0.35 && !inTransit(body) && body.mode !== 'cross' && body.surface !== null) {
          goTo(body, world, { surface: body.surface, x: body.x }, 'bounce', input.random);
        }
      }
      if (v.check > 0 || inTransit(body) || inTransit(him) || body.restFor > 0.3) break;
      v.check = 1;
      const sitting = him.mode === 'sit' || him.mode === 'cross';
      const spot = besideHim(him, world);
      if (spot === null) break;
      if (sitting && body.mode !== 'cross') {
        // He has sat down: it sits down beside him, facing the same way.
        goTo(body, world, spot, 'cross', input.random, him.facing);
      } else if (!sitting && (body.mode === 'cross' || !together(body, him, VISIT.near))) {
        goTo(body, world, spot, 'rest', input.random);
      }
      break;
    }
    case 'going': {
      if (!v.answered && v.t > 0.5) {
        v.answered = true;
        say(tote, 'bye');
        tote.wave = 1.8;
      }
      if (v.t < 1.4) break;
      return goingHome(v, world, input);
    }
  }
  return false;
}

/** One frame of the bird's visit. True once it is over. */
function stepBird(
  v: Visit,
  world: World,
  input: RoamInput,
  tote: Actor,
  cat: Cat | null,
  chatter: { left: number },
): boolean {
  const dt = input.dt;
  const guest = v.actor;
  const body = guest.body;
  const him = tote.body;
  const host = v.host === 'cat' && cat !== null ? cat.actor.body : him;

  if (body.mode === 'ride') {
    // On his head, wherever that has got to.
    const head = headOf(him);
    body.x = head.x;
    body.y = head.y;
    body.facing = him.facing;
  }
  if (body.mode === 'gone') return true;
  if (v.stage !== 'going' && body.away > VISIT.lost && body.mode !== 'ride' && body.mode !== 'air') {
    next(v, 'going');
  }
  // The cat's pounce on its way, whatever the bird was doing and whoever it
  // came to see: it is off, a moment before the cat lands.
  const pounce = cat !== null && cat.actor.body.mode === 'air' ? cat.actor.body.flight : null;
  if (pounce !== null && body.mode !== 'air' && body.mode !== 'ride' && Math.abs(pounce.to.x - body.x) < 30) {
    v.escapes += 1;
    const floor = surfaceOf(world, 'floor');
    if (floor !== undefined) {
      const away = sideOf(cat?.actor.body.x ?? body.x, body.x);
      const x = clamp(body.x + away * (60 + input.random() * 80), floor.x0, floor.x1);
      flyTo(body, { x, y: floor.y }, 'floor');
      say(guest, '♪');
    }
  }
  const flying = body.mode === 'air';

  switch (v.stage) {
    case 'coming': {
      if (v.t > VISIT.patience) {
        next(v, 'going');
        break;
      }
      if (flying || v.check > 0 || inTransit(host)) break;
      v.check = 1;
      if (together(body, host, VISIT.meet)) {
        next(v, 'greeting');
        const face = sideOf(body.x, host.x);
        pause(body, VISIT.greet, face);
        if (v.host === 'tote') pause(him, VISIT.greet, face === 1 ? -1 : 1);
        say(guest, '♪');
        break;
      }
      if (v.host === 'tote' && !him.led) {
        if (v.t < 3) say(tote, '!');
        pause(him, 1.5, sideOf(him.x, body.x));
      }
      const spot = landingBy(host, world, body.x, input.random);
      if (spot !== null) flyTo(body, spot, spot.onto);
      break;
    }
    case 'greeting': {
      if (!v.answered && v.t > 0.7) {
        v.answered = true;
        if (v.host === 'tote') say(tote, 'hello');
      }
      if (v.t >= VISIT.greet) next(v, 'staying');
      break;
    }
    case 'staying': {
      v.stay -= dt;
      if (v.stay <= 0 && !(body.mode === 'ride' && inTransit(him))) {
        next(v, 'going');
        say(guest, '♪');
        break;
      }
      chatter.left -= dt;
      if (chatter.left <= 0) {
        chatter.left = between(input.random, VISIT.chatter) * 0.8;
        const mine = v.host === 'cat' || input.random() < 0.65;
        const pool = mine ? BIRD_SIGNS : HIS_SIGNS;
        say(mine ? guest : tote, pool[Math.floor(input.random() * pool.length)] ?? '♪');
      }
      if (v.host === 'cat') {
        if (flying || v.check > 0 || body.restFor > 0.3) break;
        v.check = 1.5;
        if (!together(body, host, 220)) {
          const spot = landingBy(host, world, body.x, input.random);
          if (spot !== null) flyTo(body, spot, spot.onto);
        }
        break;
      }
      if (flying) break;
      if (body.mode === 'ride') {
        v.ride -= dt;
        // Off again when it has had enough — and only onto somewhere, not
        // from halfway up a ladder.
        if (v.ride <= 0 && !inTransit(him)) {
          const spot = landingBy(him, world, him.x + (input.random() < 0.5 ? -1 : 1), input.random);
          if (spot !== null) flyTo(body, spot, spot.onto);
        }
        break;
      }
      if (v.check > 0 || body.restFor > 0.3) break;
      v.check = 1;
      if (inTransit(him)) break;
      const roll = input.random();
      const near = body.surface !== null && body.surface === him.surface && Math.abs(body.x - him.x) <= VISIT.near;
      if (!near || roll < 0.08) {
        // To him: onto his head, sometimes; otherwise down beside him.
        if (roll < 0.3) {
          v.ride = 4 + input.random() * 6;
          flyTo(body, headOf(him), RIDE);
        } else {
          const spot = landingBy(him, world, body.x, input.random);
          if (spot !== null) flyTo(body, spot, spot.onto);
        }
      } else if (roll < 0.5 && body.surface !== null) {
        // A few hops along, the way birds go about the ground.
        const s = surfaceOf(world, body.surface);
        if (s !== undefined) {
          const x = clamp(body.x + (input.random() - 0.5) * 60, s.x0, s.x1);
          goTo(body, world, { surface: s.id, x }, input.random() < 0.3 ? 'bounce' : 'rest', input.random);
        }
      }
      break;
    }
    case 'going': {
      if (!v.answered && v.t > 0.4 && v.host === 'tote') {
        v.answered = true;
        say(tote, 'bye');
        tote.wave = 1.8;
      }
      if (body.mode !== 'air') {
        // Up and off the screen, on any side.
        flyTo(body, offScreen(input.view, input.random), AWAY);
      }
      break;
    }
  }
  return false;
}

/** One frame of whoever is visiting. True once the visit is over. */
export function stepVisit(
  v: Visit,
  world: World,
  input: RoamInput,
  tote: Actor,
  cat: Cat | null,
  chatter: { left: number },
): boolean {
  stepRoamer(v.actor.body, world, input);
  tick(v.actor, input.dt);
  v.t += input.dt;
  v.check -= input.dt;
  return v.actor.kind === 'bird'
    ? stepBird(v, world, input, tote, cat, chatter)
    : stepFriend(v, world, input, tote, chatter);
}
