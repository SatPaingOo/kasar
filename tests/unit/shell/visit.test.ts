/**
 * Tote Tote's visitors, run for whole afternoons headlessly. What has to
 * hold: one visitor at a time and not always one; whoever comes finds him,
 * says hello, keeps him company and says goodbye; every visit ends; and
 * nobody, him or them, is ever standing on nothing.
 */

import { describe, expect, it } from 'vitest';

import { createRoamer } from '../../../src/shell/roam.js';
import { VISIT, createScene, stepScene } from '../../../src/shell/visit.js';
import type { Say, Scene, Stage } from '../../../src/shell/visit.js';
import { buildWorld } from '../../../src/shell/world.js';
import type { Box, World } from '../../../src/shell/world.js';
import { DT, LONG, seeded, where, whole } from './check.js';
import { desktop, phone } from './layouts.js';

interface Log {
  readonly stages: Stage[];
  readonly said: { readonly who: string; readonly what: Say }[];
  visits: number;
  ended: number;
  /** Frames with a visitor, and with none. */
  busy: number;
  idle: number;
  /** Frames the visitor sat cross-legged while he sat on an end. */
  sideBySide: number;
  longest: number;
}

function run(world: World, seed: number, seconds: number, view: (scene: Scene) => Box = () => whole(world)): Log {
  const random = seeded(seed);
  const scene = createScene(createRoamer(world, random), random);
  const log: Log = { stages: [], said: [], visits: 0, ended: 0, busy: 0, idle: 0, sideBySide: 0, longest: 0 };
  let length = 0;
  let saidTote: Say | null = null;
  let saidGuest: Say | null = null;
  for (let i = 0; i < seconds / DT; i += 1) {
    const before = scene.visit;
    stepScene(scene, world, { dt: DT, random, pointer: null, view: view(scene) });
    where(world, scene.tote.body);
    const v = scene.visit;
    if (v !== null) {
      where(world, v.actor.body);
      if (before === null) log.visits += 1;
      if (log.stages.at(-1) !== v.stage) log.stages.push(v.stage);
      if (v.actor.say !== null && v.actor.say !== saidGuest) log.said.push({ who: 'guest', what: v.actor.say });
      saidGuest = v.actor.say;
      if (v.actor.body.mode === 'cross' && scene.tote.body.mode === 'sit') log.sideBySide += 1;
      log.busy += 1;
      length += DT;
      log.longest = Math.max(log.longest, length);
    } else {
      if (before !== null) {
        log.ended += 1;
        log.stages.push('going');
      }
      log.idle += 1;
      length = 0;
    }
    if (scene.tote.say !== null && scene.tote.say !== saidTote) log.said.push({ who: 'tote', what: scene.tote.say });
    saidTote = scene.tote.say;
  }
  return log;
}

describe('a visit', () => {
  for (const [name, make] of Object.entries({ desktop, phone })) {
    it(
      `comes, finds him, says hello, stays, says goodbye and goes, on the ${name} layout`,
      () => {
        const world = buildWorld(make());
        for (const seed of [1, 2, 3]) {
          const log = run(world, seed, 20 * 60);
          expect(log.visits).toBeGreaterThan(3);
          // Every visit but perhaps the one still going at the end has ended.
          expect(log.ended).toBeGreaterThanOrEqual(log.visits - 1);
          const said = log.said.map((s) => `${s.who}:${s.what}`);
          expect(said).toEqual(expect.arrayContaining(['guest:name', 'tote:hello', 'guest:bye', 'tote:bye']));
          // In order, every time: coming, then hello, then the stay, then away.
          const joined = log.stages.join(' ');
          expect(joined).toContain('coming greeting staying going');
        }
      },
      LONG,
    );
  }

  it(
    'sits down beside him when he sits on an end',
    () => {
      const world = buildWorld(desktop());
      let together = 0;
      for (const seed of [4, 5, 6]) together += run(world, seed, 20 * 60).sideBySide;
      expect(together).toBeGreaterThan(0);
    },
    LONG,
  );

  it(
    'never outstays its welcome, and he is mostly on his own',
    () => {
      const world = buildWorld(desktop());
      for (const seed of [7, 8]) {
        const log = run(world, seed, 30 * 60);
        // The longest stay, plus finding him, plus the goodbye and the walk out.
        expect(log.longest).toBeLessThan(VISIT.stay[1] + VISIT.patience + 40);
        expect(log.idle).toBeGreaterThan(log.busy * 0.4);
      }
    },
    LONG,
  );
});

describe('a visitor out of sight', () => {
  it(
    'gives up and goes, quietly, when nobody is looking where it is',
    () => {
      const world = buildWorld(phone());
      // The view jumps to the bottom of the page the moment anyone arrives.
      const top: Box = { left: 0, top: 0, right: 375, bottom: 700 };
      const bottom: Box = { left: 0, top: 1282, right: 375, bottom: 1982 };
      const log = run(world, 9, 15 * 60, (scene) => (scene.visit === null ? top : bottom));
      expect(log.visits).toBeGreaterThan(0);
      expect(log.ended).toBeGreaterThanOrEqual(log.visits - 1);
      expect(log.longest).toBeLessThan(VISIT.lost + VISIT.patience + 30);
    },
    LONG,
  );
});
