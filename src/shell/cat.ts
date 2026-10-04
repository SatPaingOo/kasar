/**
 * The cat who lives at the foot of the page.
 *
 * Not a visitor: it lives here, in a basket at the left-hand end of the
 * floor, and it is always somewhere about it. Mostly it sleeps. Now and then
 * it gets up and wanders a little way and comes back. When Tote Tote comes
 * down to the floor it notices, comes to him to be stroked, and keeps him
 * company — following him about, curling up beside him when he stops — until
 * it has had enough or he climbs away; then it watches him go and goes home.
 * A bird that lands near it gets stalked and pounced at, and always gets away.
 *
 * It does not climb ladders, so the floor is all the world it has, and he
 * has to come down to it — which is the reason he ever goes to the bottom of
 * the page at all.
 *
 * Its mind is made up here and its body moves by roam.ts. Pure: no DOM, no
 * clock, randomness handed in.
 */

import { actor, between, clamp, say, tick, together } from './actor.js';
import type { Actor } from './actor.js';
import { createRoamer, goTo, hopTo, inTransit, pause, stepRoamer } from './roam.js';
import type { RoamInput } from './roam.js';
import { surfaceOf } from './world.js';
import type { World } from './world.js';

/**
 * - `home`: asleep in its basket, or on its way back to it
 * - `about`: up and wandering a little way from home
 * - `with`: keeping him company, while he is down on the floor
 * - `watch`: watching him climb away, before it goes home
 * - `hunt`: stalking a bird, and pouncing
 */
export type Mood = 'home' | 'about' | 'with' | 'watch' | 'hunt';

export interface Cat {
  readonly actor: Actor;
  mood: Mood;
  /** Seconds left of the mood, for the ones that run out. */
  left: number;
  /** Seconds until it next looks round. */
  check: number;
  /** Whether it has come to be stroked yet, this time he has come down. */
  greeted: boolean;
  /** Pounces left in it, at the bird it is after. */
  pounces: number;
  /** Seconds until it next says something in its sleep. */
  murmur: number;
}

export const CAT = {
  /** Asleep this long before it gets up for a wander. */
  nap: [20, 45],
  about: [12, 25],
  /** How far it wanders from its basket. */
  roam: 140,
  /** He has come down within this many pixels of it, and it comes to him. */
  notice: 240,
  /** How long it keeps him company before it has had enough. */
  stays: [40, 70],
  behind: 34,
  beside: 30,
  watch: 3,
  /** Crouched this long before each pounce. */
  stalk: [1.2, 2.4],
  pounces: [2, 4],
  /** A bird on the floor this close is worth getting up for; this close, worth pouncing at. */
  spots: 200,
  springs: 90,
} as const;

/** The cat in its basket, asleep — or null, on a page with no floor wide enough for a basket. */
export function createCat(world: World, random: () => number): Cat | null {
  if (world.home === null) return null;
  const body = createRoamer(world, random, { surface: 'floor', x: world.home });
  body.led = true;
  body.climbs = false;
  body.pace = 1.2;
  body.mode = 'cross';
  body.restFor = 1e9;
  return {
    actor: actor('cat', body),
    mood: 'home',
    left: between(random, CAT.nap),
    check: 0,
    greeted: false,
    pounces: 0,
    murmur: between(random, [6, 14]),
  };
}

const atHome = (cat: Cat, world: World): boolean =>
  world.home !== null && cat.actor.body.surface === 'floor' && Math.abs(cat.actor.body.x - world.home) < 2;

function goHome(cat: Cat, world: World, random: () => number): void {
  cat.mood = 'home';
  cat.left = between(random, CAT.nap);
  if (world.home !== null) goTo(cat.actor.body, world, { surface: 'floor', x: world.home }, 'cross', random, 1);
}

/** Whether he has stopped, so it can curl up beside him. */
const still = (tote: Actor): boolean =>
  tote.body.mode === 'sit' ||
  tote.body.mode === 'cross' ||
  tote.body.mode === 'look' ||
  (tote.body.mode === 'stand' && tote.body.restFor > 1.5);

/** One frame of the cat's life. `bird` is whoever is visiting, if it is the bird. */
export function stepCat(cat: Cat, world: World, input: RoamInput, tote: Actor, bird: Actor | null): void {
  const dt = input.dt;
  const body = cat.actor.body;
  const him = tote.body;
  stepRoamer(body, world, input);
  tick(cat.actor, dt);
  cat.left -= dt;
  cat.check -= dt;
  const home = world.home;
  const floor = surfaceOf(world, 'floor');
  if (home === null || floor === undefined) return;

  const hisNear = him.surface === 'floor' && !inTransit(him) && Math.abs(him.x - body.x) < CAT.notice;
  const prey =
    bird !== null &&
    bird.body.surface === 'floor' &&
    bird.body.mode !== 'air' &&
    Math.abs(bird.body.x - body.x) < CAT.spots
      ? bird
      : null;

  // He has come down: whatever it was doing, it goes to him. A bird is the
  // only thing that comes before him, and only once it is already after it.
  if (hisNear && cat.mood !== 'with' && cat.mood !== 'hunt') {
    cat.mood = 'with';
    cat.left = between(input.random, CAT.stays);
    cat.greeted = false;
    cat.check = 0;
  } else if (prey !== null && (cat.mood === 'home' || cat.mood === 'about')) {
    cat.mood = 'hunt';
    cat.pounces = Math.round(between(input.random, CAT.pounces));
    cat.left = between(input.random, CAT.stalk);
    cat.check = 0;
  }

  if (inTransit(body)) return;

  switch (cat.mood) {
    case 'home': {
      if (!atHome(cat, world)) {
        if (body.steps.length === 0 && body.restFor <= 0.3) goHome(cat, world, input.random);
        break;
      }
      if (body.mode !== 'cross' && body.steps.length === 0) {
        // Home, and not yet curled up: the page moved under it, say.
        goTo(body, world, { surface: 'floor', x: home }, 'cross', input.random, 1);
      }
      if (body.mode === 'cross') {
        body.restFor = Math.max(body.restFor, 1);
        cat.murmur -= dt;
        if (cat.murmur <= 0) {
          cat.murmur = between(input.random, [12, 24]);
          say(cat.actor, 'zZ');
        }
      }
      if (cat.left <= 0) {
        // Up for a wander.
        cat.mood = 'about';
        cat.left = between(input.random, CAT.about);
        body.restFor = 0;
      }
      break;
    }
    case 'about': {
      if (cat.left <= 0) {
        goHome(cat, world, input.random);
        break;
      }
      if (body.steps.length > 0 || body.restFor > 0.3) break;
      if (input.random() < 0.6) {
        const x = clamp(home + (input.random() * 2 - 1) * CAT.roam, floor.x0, floor.x1);
        goTo(body, world, { surface: 'floor', x }, input.random() < 0.25 ? 'look' : 'rest', input.random);
      } else {
        pause(body, between(input.random, [1.5, 3.5]), body.facing);
      }
      break;
    }
    case 'with': {
      if (him.surface !== 'floor' && !inTransit(him)) {
        // He has gone up somewhere it cannot follow.
        cat.mood = 'watch';
        cat.left = CAT.watch;
        pause(body, CAT.watch, him.x < body.x ? -1 : 1);
        say(cat.actor, input.random() < 0.5 ? 'meow' : '…');
        break;
      }
      if (inTransit(him)) {
        // On his way up a ladder: it sits and watches.
        if (cat.check <= 0) {
          cat.check = 1;
          pause(body, 1.2, him.x < body.x ? -1 : 1);
        }
        break;
      }
      if (cat.left <= 0) {
        // Had enough of him for now.
        goHome(cat, world, input.random);
        break;
      }
      if (!cat.greeted && together(body, him, 50)) {
        // To be stroked: he bends down to it.
        cat.greeted = true;
        say(cat.actor, 'meow');
        const face = body.x < him.x ? 1 : -1;
        pause(body, 2.6, face);
        if (!him.led || him.steps.length === 0) {
          pause(him, 2.6, face === 1 ? -1 : 1);
          him.mode = 'look';
          tote.pet = 2.6;
        }
        tote.say = '♥';
        tote.sayFor = 2.2;
        break;
      }
      if (cat.check > 0 || (body.restFor > 0.3 && body.mode !== 'cross')) break;
      cat.check = 1;
      const near = together(body, him, 70);
      if (still(tote) && body.mode !== 'cross') {
        if (near) {
          const x = clamp(him.x - him.facing * CAT.beside, floor.x0, floor.x1);
          goTo(body, world, { surface: 'floor', x }, 'cross', input.random, him.facing);
        }
      } else if (!still(tote) && (body.mode === 'cross' || !near)) {
        const x = clamp(him.x - him.facing * CAT.behind, floor.x0, floor.x1);
        goTo(body, world, { surface: 'floor', x }, 'rest', input.random);
      }
      if (body.mode === 'cross') body.restFor = Math.max(body.restFor, 2);
      break;
    }
    case 'watch': {
      if (cat.left <= 0) goHome(cat, world, input.random);
      break;
    }
    case 'hunt': {
      if (bird === null) {
        cat.mood = 'about';
        cat.left = between(input.random, CAT.about);
        break;
      }
      const b = bird.body;
      if (b.mode === 'air' || b.surface !== 'floor') break;
      if (cat.pounces <= 0) {
        // It gives up, as cats do, as if it had never wanted to.
        cat.mood = 'about';
        cat.left = between(input.random, CAT.about);
        say(cat.actor, '…');
        break;
      }
      const toward: 1 | -1 = b.x < body.x ? -1 : 1;
      if (Math.abs(b.x - body.x) > CAT.springs) {
        if (body.steps.length === 0) {
          const x = clamp(b.x - toward * 60, floor.x0, floor.x1);
          goTo(body, world, { surface: 'floor', x }, 'look', input.random, toward);
        }
        break;
      }
      if (body.mode !== 'look') {
        body.facing = toward;
        body.mode = 'look';
        body.restFor = 10;
        cat.left = between(input.random, CAT.stalk);
        break;
      }
      body.facing = toward;
      if (cat.left > 0) break;
      // Pounce.
      cat.pounces -= 1;
      cat.left = between(input.random, CAT.stalk);
      hopTo(body, { x: clamp(b.x - toward * 4, floor.x0, floor.x1), y: floor.y }, 'floor');
      break;
    }
  }
}
