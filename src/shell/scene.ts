/**
 * Everyone on the page at once: Tote Tote, the cat who lives at the foot of
 * it, and whoever has come to visit.
 *
 * He goes about his own business (roam.ts), mostly where you are looking.
 * But every few minutes he goes down to see the cat, wherever you are
 * looking — the only reason he ever has to go all the way down, since the
 * cat cannot climb up — and stays a while: stroking it, sitting with it,
 * pottering about the floor while it follows him. Then he goes back to his
 * own business, which brings him back up into view.
 *
 * Pure, like the rest: no DOM, no clock, randomness handed in.
 */

import { actor, between, clamp, say, tick } from './actor.js';
import type { Actor } from './actor.js';
import { createCat, stepCat } from './cat.js';
import type { Cat } from './cat.js';
import { goTo, inTransit, pause, stepRoamer } from './roam.js';
import type { RoamInput, Roamer } from './roam.js';
import { GUESTS, VISIT, beginVisit, stepVisit } from './visit.js';
import type { Guest, Visit } from './visit.js';
import { surfaceOf } from './world.js';
import type { World } from './world.js';

/** His trip down to see the cat: on his way, or there. */
export interface Trip {
  phase: 'going' | 'there';
  /** Seconds left there. */
  left: number;
  /** Seconds until he next does something different while he is there. */
  next: number;
}

export interface Scene {
  readonly tote: Actor;
  /** The cat, or null on a page with no room on the floor for its basket. */
  cat: Cat | null;
  visit: Visit | null;
  /** Seconds before anyone may come to visit. */
  quiet: number;
  /** Who came last, so the next is someone else. */
  last: Guest | null;
  /** Seconds until a visitor or he says something idle. */
  readonly chatter: { left: number };
  trip: Trip | null;
  /** Seconds until he next goes down to see the cat. */
  nextTrip: number;
}

export const SCENE = {
  /** His first trip down to the cat comes after this long, and the rest this far apart. */
  firstTrip: [40, 80],
  trips: [90, 200],
  /** And he stays down there this long. */
  stays: [25, 45],
  /** While there, he does something different this often. */
  potter: [3, 6],
  /** He potters about within this of the cat's basket. */
  potterWithin: 120,
} as const;

export function createScene(world: World, tote: Roamer, random: () => number): Scene {
  return {
    tote: actor('tote', tote),
    cat: createCat(world, random),
    visit: null,
    quiet: between(random, VISIT.firstQuiet),
    last: null,
    chatter: { left: 0 },
    trip: null,
    nextTrip: between(random, SCENE.firstTrip),
  };
}

/** The page changed under them: the cat is only kept if there is still somewhere for its basket. */
export function refit(scene: Scene, world: World, random: () => number): void {
  if (world.home === null) scene.cat = null;
  else if (scene.cat === null) scene.cat = createCat(world, random);
}

function endTrip(scene: Scene, random: () => number, soon = false): void {
  scene.tote.body.led = false;
  scene.trip = null;
  scene.nextTrip = soon ? 60 : between(random, SCENE.trips);
}

/** His trip to the cat, one frame of it. */
function stepTrip(scene: Scene, world: World, input: RoamInput): void {
  const trip = scene.trip;
  const cat = scene.cat;
  const him = scene.tote.body;
  if (trip === null) return;
  if (cat === null || world.home === null) {
    endTrip(scene, input.random);
    return;
  }
  if (inTransit(him)) return;
  const floor = surfaceOf(world, 'floor');
  if (floor === undefined) {
    endTrip(scene, input.random);
    return;
  }
  if (trip.phase === 'going') {
    if (him.surface === 'floor' && him.steps.length === 0 && him.restFor <= 0.3) {
      trip.phase = 'there';
      trip.left = between(input.random, SCENE.stays);
      trip.next = 0;
    } else if (him.steps.length === 0 && him.restFor <= 0.3) {
      // Lost his way — the page moved, say. Try again from here.
      const x = clamp(cat.actor.body.x + 30, floor.x0, floor.x1);
      if (!goTo(him, world, { surface: 'floor', x }, 'rest', input.random)) endTrip(scene, input.random);
    }
    return;
  }
  trip.left -= input.dt;
  trip.next -= input.dt;
  if (trip.left <= 0) {
    // Back to his own business, which takes him back up where he is seen.
    endTrip(scene, input.random);
    return;
  }
  if (trip.next > 0 || him.steps.length > 0 || him.restFor > 0.3) return;
  trip.next = between(input.random, SCENE.potter);
  const roll = input.random();
  const home = world.home;
  const catAt = cat.actor.body.x;
  if (roll < 0.35) {
    pause(him, between(input.random, [2, 4]), catAt < him.x ? -1 : 1);
  } else if (roll < 0.6) {
    // Sits down near it, and it will come and curl up beside him.
    const x = clamp(catAt + (him.x < catAt ? -30 : 30), floor.x0, floor.x1);
    goTo(him, world, { surface: 'floor', x }, 'cross', input.random, catAt < x ? -1 : 1);
  } else {
    const x = clamp(home + (input.random() * 2 - 1) * SCENE.potterWithin, floor.x0, floor.x1);
    goTo(him, world, { surface: 'floor', x }, 'rest', input.random);
  }
}

/** Set off down to see the cat, if he is free to. */
function maybeTrip(scene: Scene, world: World, input: RoamInput): void {
  const cat = scene.cat;
  const him = scene.tote.body;
  if (cat === null || scene.trip !== null || him.led || inTransit(him)) return;
  scene.nextTrip -= input.dt;
  if (scene.nextTrip > 0) return;
  // Not while someone has come to see him.
  if (scene.visit !== null && scene.visit.host === 'tote') {
    scene.nextTrip = 20;
    return;
  }
  const floor = surfaceOf(world, 'floor');
  if (floor === undefined) return;
  const x = clamp(cat.actor.body.x + (him.x < cat.actor.body.x ? -30 : 30), floor.x0, floor.x1);
  if (!goTo(him, world, { surface: 'floor', x }, 'rest', input.random)) {
    scene.nextTrip = 30;
    return;
  }
  him.led = true;
  scene.trip = { phase: 'going', left: 0, next: 0 };
  say(scene.tote, '♪');
}

/** One frame of everyone on the page. */
export function stepScene(scene: Scene, world: World, input: RoamInput): Scene {
  const tote = scene.tote;
  stepRoamer(tote.body, world, input);
  tick(tote, input.dt);

  maybeTrip(scene, world, input);
  stepTrip(scene, world, input);

  const visit = scene.visit;
  if (scene.cat !== null)
    stepCat(scene.cat, world, input, tote, visit !== null && visit.actor.kind === 'bird' ? visit.actor : null);

  if (visit === null) {
    scene.quiet -= input.dt;
    // Nobody turns up while he is halfway up a ladder: they would arrive
    // somewhere he is not.
    if (scene.quiet <= 0 && !inTransit(tote.body)) {
      if (input.random() < VISIT.chance) {
        const pool = GUESTS.filter((g) => g !== scene.last);
        const kind = pool[Math.floor(input.random() * pool.length)] ?? 'friend';
        scene.visit = beginVisit(kind, world, input, tote, scene.cat);
        if (scene.visit === null) scene.quiet = 5;
        // Someone has come to see him: his trip to the cat can wait.
        else if (scene.visit.host === 'tote' && scene.trip !== null) endTrip(scene, input.random, true);
      } else {
        scene.quiet = between(input.random, VISIT.quiet);
      }
    }
    return scene;
  }

  if (stepVisit(visit, world, input, tote, scene.cat, scene.chatter)) {
    scene.last = visit.actor.kind === 'bird' ? 'bird' : 'friend';
    scene.visit = null;
    scene.quiet = between(input.random, VISIT.quiet);
  }
  return scene;
}

/** Everyone, for drawing: him, the cat, and a visitor. */
export function everyone(scene: Scene): Actor[] {
  const all: Actor[] = [scene.tote];
  if (scene.cat !== null) all.push(scene.cat.actor);
  if (scene.visit !== null) all.push(scene.visit.actor);
  return all;
}
