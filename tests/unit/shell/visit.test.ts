/**
 * Tote Tote's visitors, run for whole afternoons headlessly. What has to
 * hold: one visitor at a time and not always one; whoever comes finds him,
 * greets him, keeps him company and goes, each in its own way; every visit
 * ends; and nobody, him or them, is ever standing on nothing.
 */

import { describe, expect, it } from 'vitest';

import { createRoamer } from '../../../src/shell/roam.js';
import { VISIT, createScene, headOf, stepScene } from '../../../src/shell/visit.js';
import type { Mode } from '../../../src/shell/roam.js';
import type { Kind, Say, Scene, Stage } from '../../../src/shell/visit.js';
import { buildWorld } from '../../../src/shell/world.js';
import type { Box, World } from '../../../src/shell/world.js';
import { DT, LONG, seeded, where, whole } from './check.js';
import { desktop, phone } from './layouts.js';

interface Log {
  readonly stages: Stage[];
  /** `friend:name`, `tote@cat:♥` — who said what, and to whom, for him. */
  readonly said: string[];
  /** Every mode each kind of visitor was seen in. */
  readonly modes: Record<Kind, Set<Mode>>;
  /** Frames he spent stroking a cat. */
  stroked: number;
  /** Times the cat called to him from somewhere he was not. */
  calledAcross: number;
  /** Frames the bird rode on his head, and of those, frames he was on a ladder — and any it was not on his head. */
  riding: number;
  ridingUp: number;
  offHead: number;
  /** How each bird visit ended: what it was doing in its last frame. */
  readonly birdLeft: Mode[];
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
  const log: Log = {
    stages: [],
    said: [],
    modes: { friend: new Set(), cat: new Set(), bird: new Set() },
    stroked: 0,
    calledAcross: 0,
    riding: 0,
    ridingUp: 0,
    offHead: 0,
    birdLeft: [],
    visits: 0,
    ended: 0,
    busy: 0,
    idle: 0,
    sideBySide: 0,
    longest: 0,
  };
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
      const kind = v.actor.kind as Kind;
      if (v.actor.say !== null && v.actor.say !== saidGuest) {
        log.said.push(`${kind}:${v.actor.say}`);
        if (
          kind === 'cat' &&
          v.actor.say === 'meow' &&
          v.stage === 'staying' &&
          v.actor.body.surface !== scene.tote.body.surface
        ) {
          log.calledAcross += 1;
        }
      }
      saidGuest = v.actor.say;
      log.modes[kind].add(v.actor.body.mode);
      if (v.actor.body.mode === 'ride') {
        log.riding += 1;
        if (scene.tote.body.mode === 'climb') log.ridingUp += 1;
        const head = headOf(scene.tote.body);
        if (Math.abs(v.actor.body.x - head.x) > 0.01 || Math.abs(v.actor.body.y - head.y) > 0.01) log.offHead += 1;
      }
      if (scene.tote.pet > 0) log.stroked += 1;
      if (v.actor.body.mode === 'cross' && scene.tote.body.mode === 'sit') log.sideBySide += 1;
      log.busy += 1;
      length += DT;
      log.longest = Math.max(log.longest, length);
    } else {
      if (before !== null) {
        if (before.actor.kind === 'bird') log.birdLeft.push(before.actor.body.mode);
        log.ended += 1;
        log.stages.push('going');
      }
      log.idle += 1;
      length = 0;
    }
    if (scene.tote.say !== null && scene.tote.say !== saidTote) {
      log.said.push(`tote@${(scene.visit?.actor.kind as Kind | undefined) ?? 'nobody'}:${scene.tote.say}`);
    }
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
        const said = new Set<string>();
        for (const seed of [1, 2, 3]) {
          const log = run(world, seed, 20 * 60);
          expect(log.visits).toBeGreaterThan(3);
          // Every visit but perhaps the one still going at the end has ended.
          expect(log.ended).toBeGreaterThanOrEqual(log.visits - 1);
          for (const line of log.said) said.add(line);
          // In order: coming, then hello, then the stay, then away.
          expect(log.stages.join(' ')).toContain('coming greeting staying going');
        }
        // Between them, everyone has been, met him and left in its own way.
        expect([...said]).toEqual(
          expect.arrayContaining([
            'friend:name',
            'tote@friend:hello',
            'friend:bye',
            'tote@friend:bye',
            'cat:meow',
            'tote@cat:♥',
            'bird:♪',
            'tote@bird:hello',
            'tote@bird:bye',
          ]),
        );
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

describe('the cat', () => {
  const runs = (): Log[] => {
    const world = buildWorld(desktop());
    return [11, 12, 13, 14].map((seed) => run(world, seed, 30 * 60));
  };
  let logs: Log[] | null = null;
  const all = (): Log[] => (logs ??= runs());

  it(
    'never climbs a ladder, and calls to him from the top when he goes down one',
    () => {
      for (const log of all()) expect(log.modes.cat.has('climb')).toBe(false);
      expect(all().reduce((n, log) => n + log.calledAcross, 0)).toBeGreaterThan(0);
    },
    LONG,
  );

  it(
    'is stroked when they meet, and curls up beside him when he stops',
    () => {
      expect(all().reduce((n, log) => n + log.stroked, 0)).toBeGreaterThan(0);
      expect(all().some((log) => log.modes.cat.has('cross'))).toBe(true);
      expect(all().some((log) => log.said.includes('cat:zZ'))).toBe(true);
    },
    LONG,
  );

  it(
    'leaves without saying goodbye, as cats do, though he still waves it off',
    () => {
      for (const log of all()) expect(log.said).not.toContain('cat:bye');
      expect(all().some((log) => log.said.includes('tote@cat:bye'))).toBe(true);
    },
    LONG,
  );
});

describe('the bird', () => {
  let logs: Log[] | null = null;
  const all = (): Log[] => {
    if (logs !== null) return logs;
    const wide = buildWorld(desktop());
    const narrow = buildWorld(phone());
    logs = [21, 22, 23].flatMap((seed) => [run(wide, seed, 30 * 60), run(narrow, seed, 30 * 60)]);
    return logs;
  };

  it(
    'flies in, lands beside him and sings, and he says hello',
    () => {
      expect(all().some((log) => log.modes.bird.has('air'))).toBe(true);
      expect(all().some((log) => log.said.includes('bird:♪') && log.said.includes('tote@bird:hello'))).toBe(true);
    },
    LONG,
  );

  it(
    'rides on his head wherever he goes, up and down the ladders too, and never anywhere else',
    () => {
      expect(all().reduce((n, log) => n + log.riding, 0)).toBeGreaterThan(0);
      expect(all().reduce((n, log) => n + log.ridingUp, 0)).toBeGreaterThan(0);
      for (const log of all()) expect(log.offHead).toBe(0);
    },
    LONG,
  );

  it(
    'flies off the page when it is done, and the visit ends',
    () => {
      const left = all().flatMap((log) => log.birdLeft);
      expect(left.length).toBeGreaterThan(0);
      // Fading out on the wing, or already off the page — never standing about.
      for (const mode of left) expect(['air', 'gone']).toContain(mode);
      for (const log of all()) expect(log.ended).toBeGreaterThanOrEqual(log.visits - 1);
    },
    LONG,
  );
});
