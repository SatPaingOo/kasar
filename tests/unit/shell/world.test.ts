/**
 * The page as somewhere to live, and the ways around it. The promise that
 * matters is that nowhere is cut off: whatever the layout, every surface can
 * be reached from every other, and no ladder stands across a card or a line
 * of text.
 */

import { describe, expect, it } from 'vitest';

import { reachable, route } from '../../../src/shell/route.js';
import type { Step } from '../../../src/shell/route.js';
import { WORLD, buildWorld, isCrowded, ladderOf, spotOn, surfaceOf, surfaceUnder } from '../../../src/shell/world.js';
import type { Layout, World } from '../../../src/shell/world.js';
import { desktop, phone } from './layouts.js';

/** Before the shelf has loaded: the masthead and the floor, nothing else. */
const empty = (): Layout => ({
  ...desktop(),
  height: 768,
  perches: desktop().perches.slice(0, 2),
  ground: { left: 104, top: 700, right: 1176, bottom: 768 },
});

const layouts: Record<string, () => Layout> = { desktop, phone, empty };

/** Carry out a route on paper, failing if any step is not a real way from where he is. */
function walkThrough(world: World, from: { surface: string; x: number }, steps: readonly Step[]): string {
  let at = from.surface;
  for (const step of steps) {
    const here = surfaceOf(world, at);
    expect(here).toBeDefined();
    if (step.kind === 'walk') {
      expect(step.x).toBeGreaterThanOrEqual((here?.x0 ?? 0) - 0.01);
      expect(step.x).toBeLessThanOrEqual((here?.x1 ?? 0) + 0.01);
      continue;
    }
    const way = world.links.find(
      (l) =>
        l.from === at &&
        l.to === step.to &&
        (step.kind !== 'climb' || (l.kind === 'ladder' && l.ladder === step.ladder)),
    );
    expect(way, `${step.kind} from ${at} to ${step.to}`).toBeDefined();
    at = step.to;
  }
  return at;
}

describe('the world', () => {
  for (const [name, make] of Object.entries(layouts)) {
    it(`leaves nowhere cut off, on the ${name} layout`, () => {
      const world = buildWorld(make());
      for (const s of world.surfaces) {
        expect([...reachable(world, s.id)].sort()).toEqual(world.surfaces.map((t) => t.id).sort());
      }
    });

    it(`stands no ladder across a card or a line of text, on the ${name} layout`, () => {
      const layout = make();
      const world = buildWorld(layout);
      for (const ladder of world.ladders) {
        for (const b of [...layout.perches.map((p) => p.box), ...layout.obstacles]) {
          const across = ladder.x > b.left - WORLD.clearance && ladder.x < b.right + WORLD.clearance;
          const along = b.top < ladder.bottom.y - 1 && b.bottom > ladder.top.y + 1;
          expect(across && along, `${ladder.id} at ${ladder.x} crosses ${JSON.stringify(b)}`).toBe(false);
        }
      }
    });
  }

  it('makes a surface of the top of everything, the rule and the floor', () => {
    const world = buildWorld(desktop());
    expect(world.surfaces.map((s) => s.id).sort()).toEqual(
      ['floor', 'roof', 'rule', 'mark', 'readout', 'card:0', 'card:1', 'card:2', 'card:3', 'card:4'].sort(),
    );
    const card = surfaceOf(world, 'card:1');
    expect(card).toEqual({ id: 'card:1', x0: 470 + WORLD.inset, x1: 810 - WORLD.inset, y: 270 });
    // The floor is the top of the footer, not the bottom of the page.
    expect(surfaceOf(world, 'floor')).toEqual({ id: 'floor', x0: 104 + WORLD.inset, x1: 1176 - WORLD.inset, y: 1100 });
  });

  it('hops between neighbours in a row, and only neighbours', () => {
    const world = buildWorld(desktop());
    const hops = world.links.filter((l) => l.kind === 'hop').map((l) => `${l.from}>${l.to}`);
    expect(hops).toEqual(expect.arrayContaining(['card:0>card:1', 'card:1>card:2', 'card:3>card:4', 'card:2>card:1']));
    expect(hops).not.toContain('card:0>card:2');
  });

  it('hops between two things side by side at nearly the same height, not a ladder four pixels tall', () => {
    const world = buildWorld(phone());
    expect(world.links.some((l) => l.kind === 'hop' && l.from === 'mark' && l.to === 'readout')).toBe(true);
    for (const ladder of world.ladders) expect(ladder.bottom.y - ladder.top.y).toBeGreaterThan(WORLD.leap);
  });

  it('leaps between the rule and the cards just under it', () => {
    const world = buildWorld(desktop());
    const leaps = world.links.filter((l) => l.kind === 'leap').map((l) => `${l.from}>${l.to}`);
    expect(leaps).toEqual(expect.arrayContaining(['rule>card:0', 'card:0>rule', 'rule>card:2']));
    // The second row is a card's height below the first: far too far.
    expect(leaps).not.toContain('card:0>card:3');
  });

  it('stands the ladders between rows beside the cards, in a gutter or a margin', () => {
    const layout = desktop();
    const wide = buildWorld(layout);
    const rows = wide.ladders.filter((l) => l.top.surface.startsWith('card:'));
    expect(rows.length).toBeGreaterThan(0);
    for (const ladder of rows) {
      for (const card of layout.perches) {
        expect(ladder.x > card.box.left && ladder.x < card.box.right).toBe(false);
      }
    }
    const narrow = buildWorld(phone());
    for (const ladder of narrow.ladders) expect(ladder.x < 16 || ladder.x > 359).toBe(true);
  });

  it('lets him jump down off the readout rather than always climb, but not through the tagline', () => {
    const world = buildWorld(desktop());
    expect(world.links.some((l) => l.kind === 'drop' && l.from === 'readout' && l.to === 'rule')).toBe(true);
    // Off the title's right-hand end he would fall through the tagline.
    expect(world.links.some((l) => l.kind === 'drop' && l.from === 'mark')).toBe(false);
  });

  it('knows where standing would put him in front of the words above, and steers him off them', () => {
    const world = buildWorld(desktop());
    // The tagline and the byline sit just above the rule at its left-hand end.
    expect(isCrowded(world, 'rule', 120)).toBe(true);
    expect(isCrowded(world, 'rule', 600)).toBe(false);
    let i = 0;
    const steps = [0.1, 0.15, 0.2, 0.9];
    for (let k = 0; k < 20; k += 1) {
      const x = spotOn(world, 'rule', 110, 1170, () => steps[i++ % steps.length] ?? 0.5);
      expect(isCrowded(world, 'rule', x)).toBe(false);
    }
    // And somewhere with nowhere out of the way is still somewhere.
    expect(spotOn(world, 'rule', 140, 160, () => 0.5)).toBe(150);
  });

  it('has a roof above the page, a ladder down from it beside the readout, and nobody put down on it', () => {
    for (const make of [desktop, phone]) {
      const world = buildWorld(make());
      const roof = surfaceOf(world, 'roof');
      expect(world.roof).toBe('roof');
      expect(roof?.y).toBeLessThan(0);
      const ladder = world.ladders.find((l) => l.top.surface === 'roof');
      expect(ladder?.bottom.surface).toBe('readout');
      // Nothing jumps on or off it: it is climbed, or nothing.
      expect(world.links.filter((l) => l.from === 'roof' || l.to === 'roof').every((l) => l.kind === 'ladder')).toBe(
        true,
      );
      expect(surfaceUnder(world, roof?.x0 ?? 0, -100).id).not.toBe('roof');
    }
  });

  it('puts the door at the right-hand end of the floor and the basket at the left', () => {
    const world = buildWorld(desktop());
    const floor = surfaceOf(world, 'floor');
    expect(world.door).toBe((floor?.x1 ?? 0) - WORLD.doorIn);
    expect(world.home).toBe((floor?.x0 ?? 0) + WORLD.homeIn);
    // No room on the floor, no door and no basket.
    const cramped = buildWorld({ ...desktop(), ground: { left: 100, top: 1100, right: 220, bottom: 1166 } });
    expect(cramped.door).toBeNull();
    expect(cramped.home).toBeNull();
  });

  it('finds what is under a point, and the nearest thing when nothing is', () => {
    const world = buildWorld(desktop());
    expect(surfaceUnder(world, 600, 250).id).toBe('card:1');
    // Under the middle of the first row is the middle of the second.
    expect(surfaceUnder(world, 600, 300).id).toBe('card:4');
    // The second row has no third card, so under the third is the floor.
    expect(surfaceUnder(world, 1000, 700).id).toBe('floor');
    expect(surfaceUnder(world, 20, 2000).id).toBe('floor');
  });
});

describe('a route', () => {
  for (const [name, make] of Object.entries(layouts)) {
    it(`gets from everywhere to everywhere by real steps, on the ${name} layout`, () => {
      const world = buildWorld(make());
      for (const a of world.surfaces) {
        for (const b of world.surfaces) {
          const from = { surface: a.id, x: (a.x0 + a.x1) / 2 };
          const steps = route(world, from, { surface: b.id, x: b.x0 + 3 });
          expect(steps, `${a.id} to ${b.id}`).not.toBeNull();
          expect(walkThrough(world, from, steps ?? [])).toBe(b.id);
        }
      }
    });
  }

  it('ends where it was asked to, walking the last of the way', () => {
    const world = buildWorld(desktop());
    const steps = route(world, { surface: 'floor', x: 100 }, { surface: 'card:2', x: 900 }) ?? [];
    expect(steps.at(-1)).toEqual({ kind: 'walk', x: 900 });
    expect(steps.some((s) => s.kind === 'climb')).toBe(true);
  });

  it('climbs a ladder from the end it is standing at', () => {
    const world = buildWorld(phone());
    const steps = route(world, { surface: 'floor', x: 180 }, { surface: 'card:3', x: 180 }) ?? [];
    const climb = steps.find((s) => s.kind === 'climb');
    expect(climb).toBeDefined();
    if (climb?.kind !== 'climb') return;
    const ladder = ladderOf(world, climb.ladder);
    expect(ladder).toBeDefined();
    // The walk before it ends at the ladder's foot, on the floor.
    const before = steps[steps.indexOf(climb) - 1];
    expect(before).toEqual({ kind: 'walk', x: ladder?.bottom.x });
  });

  it('is null for somewhere that does not exist', () => {
    const world = buildWorld(desktop());
    expect(route(world, { surface: 'floor', x: 100 }, { surface: 'nowhere', x: 0 })).toBeNull();
  });
});
