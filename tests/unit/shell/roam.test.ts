/**
 * The shelf's figure, run for a long time headlessly. What has to hold, every
 * frame: he is on a surface, on a ladder or in the air between two — never
 * standing on nothing, never off the page; a pointer cannot chase him off
 * what he is on; and he does not stay lost out of sight.
 */

import { describe, expect, it } from 'vitest';

import { ROAM, createRoamer, settle, stepRoamer } from '../../../src/shell/roam.js';
import type { Roamer } from '../../../src/shell/roam.js';
import { buildWorld, ladderOf, surfaceOf } from '../../../src/shell/world.js';
import type { Box, World } from '../../../src/shell/world.js';
import { desktop, phone } from './layouts.js';

function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 30;

/** Fail unless he is somewhere he can be. */
function where(world: World, r: Roamer): void {
  expect(Number.isFinite(r.x) && Number.isFinite(r.y)).toBe(true);
  if (r.mode === 'air') {
    expect(r.flight).not.toBeNull();
    return;
  }
  if (r.mode === 'climb') {
    const ladder = ladderOf(world, r.ladder ?? '');
    expect(ladder).toBeDefined();
    expect(r.x).toBe(ladder?.x);
    expect(r.y).toBeGreaterThanOrEqual((ladder?.top.y ?? 0) - 0.01);
    expect(r.y).toBeLessThanOrEqual((ladder?.bottom.y ?? 0) + 0.01);
    return;
  }
  const s = surfaceOf(world, r.surface ?? '');
  expect(s, `${r.mode} on ${r.surface}`).toBeDefined();
  expect(r.y).toBe(s?.y);
  expect(r.x).toBeGreaterThanOrEqual((s?.x0 ?? 0) - 0.01);
  expect(r.x).toBeLessThanOrEqual((s?.x1 ?? 0) + 0.01);
}

const whole = (world: World): Box => ({ left: 0, top: 0, right: world.width, bottom: world.height });

describe('left to himself', () => {
  for (const [name, make] of Object.entries({ desktop, phone })) {
    it(`is always somewhere he can be, and goes everywhere, on the ${name} layout`, () => {
      const world = buildWorld(make());
      for (const seed of [1, 2, 3]) {
        const random = seeded(seed);
        const r = createRoamer(world, random);
        const visited = new Set<string>();
        const did = new Set<string>();
        for (let i = 0; i < 20 * 60 * 30; i += 1) {
          stepRoamer(r, world, { dt: DT, random, pointer: null, view: whole(world) });
          where(world, r);
          if (r.surface !== null) visited.add(r.surface);
          did.add(r.mode === 'air' ? `air:${r.flight?.kind}` : r.mode);
        }
        // Twenty minutes: he has been on most of the page, and done most things.
        expect(visited.size / world.surfaces.length).toBeGreaterThan(0.75);
        // On a phone the only hop is between the title and the readout, and
        // nothing ever needs it; on a wide screen there is one between every
        // two cards in a row.
        const kinds = ['walk', 'climb', 'sit', 'look', 'air:leap', ...(name === 'desktop' ? ['air:hop'] : [])];
        expect([...did]).toEqual(expect.arrayContaining(kinds));
      }
    });
  }
});

describe('the pointer', () => {
  it('sends him along what he is on, away from it, and in a hurry', () => {
    const world = buildWorld(desktop());
    const r = createRoamer(world, () => 0.5);
    r.restFor = 5;
    const x = r.x;
    for (let i = 0; i < 10; i += 1) {
      stepRoamer(r, world, { dt: DT, random: () => 0.5, pointer: { x: x + 40, y: r.y - 30 }, view: whole(world) });
    }
    expect(r.x).toBeLessThan(x);
    expect(r.surface).toBe('rule');
    expect(r.startled).toBeGreaterThan(0);
    expect(r.speed).toBe(ROAM.flee);
  });

  it('cannot chase him off what he is on, from either side, all the way to the end', () => {
    const world = buildWorld(desktop());
    for (const seed of [4, 5]) {
      const random = seeded(seed);
      const r = createRoamer(world, random);
      for (let i = 0; i < 3000; i += 1) {
        const side = Math.floor(i / 500) % 2 === 0 ? 1 : -1;
        stepRoamer(r, world, { dt: DT, random, pointer: { x: r.x + side * 20, y: r.y - 30 }, view: whole(world) });
        where(world, r);
      }
    }
  });
});

describe('where you are looking', () => {
  it('brings him back into view when he has been out of it a while, and keeps him there mostly', () => {
    const world = buildWorld(phone());
    const random = seeded(9);
    const r = createRoamer(world, random);
    const floor = surfaceOf(world, 'floor');
    if (floor === undefined) throw new Error('no floor');
    r.surface = 'floor';
    r.x = 100;
    r.y = floor.y;
    // The top of the page is on screen; he is at the very bottom of it.
    const view: Box = { left: 0, top: 0, right: 375, bottom: 700 };
    const seen = (): boolean => r.y >= view.top && r.y <= view.bottom + 4;
    let back = -1;
    for (let i = 0; i < 120 * 30 && back < 0; i += 1) {
      stepRoamer(r, world, { dt: DT, random, pointer: null, view });
      if (seen()) back = i * DT;
    }
    expect(back).toBeGreaterThan(0);
    let inView = 0;
    const frames = 180 * 30;
    for (let i = 0; i < frames; i += 1) {
      stepRoamer(r, world, { dt: DT, random, pointer: null, view });
      if (seen()) inView += 1;
    }
    expect(inView / frames).toBeGreaterThan(0.7);
  });
});

describe('when the page moves under him', () => {
  it('lands him on whatever is under him now, whatever he was doing', () => {
    const before = buildWorld(desktop());
    const random = seeded(7);
    const r = createRoamer(before, random);
    for (let i = 0; i < 3000; i += 1) stepRoamer(r, before, { dt: DT, random, pointer: null, view: whole(before) });
    // The cards are gone: only the masthead and the floor are left.
    const after = buildWorld({ ...desktop(), perches: desktop().perches.slice(0, 2) });
    settle(r, after);
    where(after, r);
    expect(r.mode).toBe('stand');
    for (let i = 0; i < 600; i += 1) {
      stepRoamer(r, after, { dt: DT, random, pointer: null, view: whole(after) });
      where(after, r);
    }
  });

  it('keeps him on the same card if the card is still there, wherever it moved', () => {
    const before = buildWorld(desktop());
    const r = createRoamer(before, () => 0.5);
    const card = surfaceOf(before, 'card:1');
    if (card === undefined) throw new Error('no card');
    Object.assign(r, { surface: 'card:1', x: card.x0 + 10, y: card.y });
    const moved = buildWorld({ ...phone() });
    settle(r, moved);
    expect(r.surface).toBe('card:1');
    expect(r.y).toBe(surfaceOf(moved, 'card:1')?.y);
  });
});
