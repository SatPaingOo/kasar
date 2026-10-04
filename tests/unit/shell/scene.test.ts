/**
 * Everyone on the page, run for whole afternoons headlessly: Tote Tote, the
 * cat who lives at the foot of the page, and whoever comes to visit. What has
 * to hold:
 *
 * - nobody is ever standing on nothing, and the cat never leaves the floor;
 * - the cat lives at home and is mostly asleep there, and goes back to it;
 * - he goes down to see it, even when nobody is looking down there;
 * - the friend comes in by the roof or the door, and goes out the same way —
 *   it never appears or vanishes anywhere else;
 * - the bird comes and goes off the screen, and the cat never catches it;
 * - every visit ends.
 */

import { describe, expect, it } from 'vitest';

import type { Mood } from '../../../src/shell/cat.js';
import { createRoamer } from '../../../src/shell/roam.js';
import { createScene, stepScene } from '../../../src/shell/scene.js';
import type { Scene } from '../../../src/shell/scene.js';
import { buildWorld } from '../../../src/shell/world.js';
import type { Box, World } from '../../../src/shell/world.js';
import { DT, LONG, seeded, where, whole } from './check.js';
import { desktop, phone } from './layouts.js';

interface Where {
  readonly surface: string | null;
  readonly x: number;
  readonly y: number;
}

interface Log {
  /** Frames the cat spent in each mood, and whether it ever climbed or left the floor. */
  readonly moods: Record<Mood, number>;
  catClimbed: boolean;
  catOffFloor: number;
  /** Frames he spent on the floor, and frames he was stroking the cat. */
  totesFloor: number;
  stroked: number;
  /** For each friend's visit, where it was first and last. */
  readonly friends: { readonly first: Where; readonly last: Where }[];
  /** For each bird's visit, whether it was first and last seen off the screen. */
  readonly birds: { readonly cameFromOff: boolean; readonly leftOff: boolean }[];
  pounces: number;
  /** A pounce that landed on the bird where it stood. */
  caught: number;
  visits: number;
  ended: number;
}

const at = (r: { surface: string | null; x: number; y: number }): Where => ({ surface: r.surface, x: r.x, y: r.y });
const off = (view: Box, p: Where): boolean =>
  p.x < view.left || p.x > view.right || p.y < view.top || p.y > view.bottom;

function run(world: World, seed: number, seconds: number, view: Box = whole(world)): Log {
  const random = seeded(seed);
  const scene: Scene = createScene(world, createRoamer(world, random), random);
  const log: Log = {
    moods: { home: 0, about: 0, with: 0, watch: 0, hunt: 0 },
    catClimbed: false,
    catOffFloor: 0,
    totesFloor: 0,
    stroked: 0,
    friends: [],
    birds: [],
    pounces: 0,
    caught: 0,
    visits: 0,
    ended: 0,
  };
  let first: Where | null = null;
  let catAir = false;
  for (let i = 0; i < seconds / DT; i += 1) {
    const before = scene.visit;
    stepScene(scene, world, { dt: DT, random, pointer: null, view });
    const him = scene.tote.body;
    where(world, him);
    if (him.surface === 'floor') log.totesFloor += 1;
    if (scene.tote.pet > 0) log.stroked += 1;

    const cat = scene.cat;
    if (cat !== null) {
      const body = cat.actor.body;
      where(world, body);
      log.moods[cat.mood] += 1;
      if (body.mode === 'climb') log.catClimbed = true;
      if (body.mode !== 'air' && body.surface !== 'floor') log.catOffFloor += 1;
      // A pounce landing: was the bird still standing where it came down?
      const inAir = body.mode === 'air';
      if (catAir && !inAir) {
        log.pounces += 1;
        const bird = scene.visit?.actor.kind === 'bird' ? scene.visit.actor.body : null;
        if (bird !== null && bird.mode !== 'air' && bird.surface === 'floor' && Math.abs(bird.x - body.x) < 6) {
          log.caught += 1;
        }
      }
      catAir = inAir;
    }

    const v = scene.visit;
    if (v !== null) {
      if (v !== before) {
        log.visits += 1;
        first = at(v.actor.body);
      }
      if (v.actor.body.mode !== 'gone') where(world, v.actor.body);
    }
    if (before !== null && v !== before) {
      // Where it was when it went — the frame it went in, not the one
      // before: gone is gone from the roof, or the doorway.
      const last = at(before.actor.body);
      log.ended += 1;
      if (first !== null) {
        if (before.actor.kind === 'friend') log.friends.push({ first, last });
        else log.birds.push({ cameFromOff: off(view, first), leftOff: off(view, last) });
      }
    }
  }
  return log;
}

describe('the cat', () => {
  for (const [name, make] of Object.entries({ desktop, phone })) {
    it(
      `lives on the floor, mostly asleep at home, and never climbs, on the ${name} layout`,
      () => {
        const world = buildWorld(make());
        for (const seed of [1, 2]) {
          const log = run(world, seed, 20 * 60);
          expect(log.catClimbed).toBe(false);
          expect(log.catOffFloor).toBe(0);
          const total = Object.values(log.moods).reduce((a, b) => a + b, 0);
          expect(log.moods.home / total).toBeGreaterThan(0.35);
          expect(log.moods.with).toBeGreaterThan(0);
        }
      },
      LONG,
    );
  }
});

describe('his trips down to the cat', () => {
  it(
    'take him to the bottom of the page even when nobody is looking down there, and it comes to be stroked',
    () => {
      const world = buildWorld(phone());
      // The top of a long page is on screen, the whole time.
      const top: Box = { left: 0, top: 0, right: 375, bottom: 700 };
      const log = run(world, 3, 10 * 60, top);
      expect(log.totesFloor).toBeGreaterThan(0);
      expect(log.stroked).toBeGreaterThan(0);
      expect(log.moods.with).toBeGreaterThan(0);
    },
    LONG,
  );
});

describe('the friend', () => {
  it(
    'comes in by the roof or the door, and goes out the same way — never appearing or vanishing anywhere else',
    () => {
      for (const make of [desktop, phone]) {
        const world = buildWorld(make());
        const door = world.door ?? -1;
        const roof = world.ladders.find((l) => l.top.surface === 'roof')?.x ?? -1;
        let seen = 0;
        for (const seed of [4, 5, 6]) {
          for (const { first, last } of run(world, seed, 30 * 60).friends) {
            seen += 1;
            const byRoof = first.surface === 'roof' && Math.abs(first.x - roof) < 1;
            const byDoor = first.surface === 'floor' && Math.abs(first.x - door) < 1;
            expect(byRoof || byDoor, JSON.stringify(first)).toBe(true);
            expect(last.surface).toBe(first.surface);
            expect(Math.abs(last.x - first.x)).toBeLessThan(2);
          }
        }
        expect(seen).toBeGreaterThan(2);
      }
    },
    LONG,
  );
});

describe('the bird', () => {
  it(
    'comes from off the screen and goes off it, and plays with the cat without ever being caught',
    () => {
      let birds = 0;
      let pounces = 0;
      for (const make of [desktop, phone]) {
        const world = buildWorld(make());
        for (const seed of [7, 8, 9]) {
          const log = run(world, seed, 30 * 60);
          for (const b of log.birds) {
            birds += 1;
            expect(b.cameFromOff).toBe(true);
            expect(b.leftOff).toBe(true);
          }
          pounces += log.pounces;
          expect(log.caught).toBe(0);
        }
      }
      expect(birds).toBeGreaterThan(3);
      expect(pounces).toBeGreaterThan(0);
    },
    LONG,
  );
});

describe('every visit', () => {
  it(
    'ends',
    () => {
      for (const make of [desktop, phone]) {
        const world = buildWorld(make());
        for (const seed of [10, 11]) {
          const log = run(world, seed, 30 * 60);
          expect(log.visits).toBeGreaterThan(3);
          expect(log.ended).toBeGreaterThanOrEqual(log.visits - 1);
        }
      }
    },
    LONG,
  );
});
