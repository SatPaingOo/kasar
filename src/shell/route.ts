/**
 * How to get from where he is to where he wants to be.
 *
 * A shortest path over the surfaces, where walking costs its distance and
 * every way between surfaces costs a little more than its own length — a
 * climb most of all, because a ladder is slow. The answer is a list of steps
 * he can carry out one at a time: walk to here, hop across, climb that.
 */

import type { Link, World } from './world.js';
import { ladderOf, surfaceOf } from './world.js';

export interface Spot {
  readonly surface: string;
  readonly x: number;
}

export type Step =
  /** Along the surface he is on, to x. */
  | { readonly kind: 'walk'; readonly x: number }
  /** Through the air onto another surface, landing at x. */
  | { readonly kind: 'hop' | 'leap' | 'drop'; readonly to: string; readonly x: number }
  /** Up or down a ladder, stepping off onto another surface at x. */
  | { readonly kind: 'climb'; readonly ladder: string; readonly to: string; readonly x: number };

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Where he leaves a surface to take a link, starting from x. */
function exitFor(link: Link, x: number): number {
  return link.kind === 'leap' ? clamp(x, link.min, link.max) : link.at;
}

/** Where he arrives on the far side. */
function landFor(link: Link, exit: number): number {
  return link.kind === 'leap' ? exit : link.land;
}

function costOf(world: World, link: Link): number {
  const from = surfaceOf(world, link.from);
  const to = surfaceOf(world, link.to);
  const rise = from !== undefined && to !== undefined ? Math.abs(from.y - to.y) : 0;
  switch (link.kind) {
    case 'hop':
      return 24 + Math.abs(link.land - link.at);
    case 'leap':
      return 30 + rise;
    case 'drop':
      return 30 + rise * 0.6;
    case 'ladder':
      return 20 + rise * 1.6;
  }
}

/** The steps from one spot to another, or null if there is no way. */
export function route(world: World, from: Spot, to: Spot): Step[] | null {
  const target = surfaceOf(world, to.surface);
  if (surfaceOf(world, from.surface) === undefined || target === undefined) return null;
  const goalX = clamp(to.x, target.x0, target.x1);

  interface Visit {
    readonly cost: number;
    readonly x: number;
    readonly via: { readonly link: Link; readonly prev: string; readonly exit: number } | null;
  }
  const best = new Map<string, Visit>([[from.surface, { cost: 0, x: from.x, via: null }]]);
  const open = new Set<string>([from.surface]);
  const done = new Set<string>();

  while (open.size > 0) {
    let here = '';
    let lowest = Infinity;
    for (const id of open) {
      const cost = best.get(id)?.cost ?? Infinity;
      if (cost < lowest) [here, lowest] = [id, cost];
    }
    open.delete(here);
    if (done.has(here)) continue;
    done.add(here);
    if (here === to.surface) break;
    const visit = best.get(here);
    if (visit === undefined) continue;
    for (const link of world.links) {
      if (link.from !== here || done.has(link.to)) continue;
      const exit = exitFor(link, visit.x);
      const cost = visit.cost + Math.abs(visit.x - exit) + costOf(world, link);
      if (cost < (best.get(link.to)?.cost ?? Infinity)) {
        best.set(link.to, { cost, x: landFor(link, exit), via: { link, prev: here, exit } });
        open.add(link.to);
      }
    }
  }

  if (!best.has(to.surface)) return null;

  // Walk the chain back from the goal, then turn it into steps.
  const chain: { readonly link: Link; readonly exit: number; readonly land: number }[] = [];
  let at = to.surface;
  for (let guard = 0; guard < world.links.length + 1; guard += 1) {
    const visit = best.get(at);
    if (visit === undefined || visit.via === null) break;
    chain.unshift({ link: visit.via.link, exit: visit.via.exit, land: visit.x });
    at = visit.via.prev;
  }

  const steps: Step[] = [];
  let x = from.x;
  const walk = (to: number): void => {
    if (Math.abs(to - x) > 0.5) steps.push({ kind: 'walk', x: to });
    x = to;
  };
  for (const { link, exit, land } of chain) {
    walk(exit);
    if (link.kind === 'ladder') {
      const ladder = ladderOf(world, link.ladder);
      if (ladder === undefined) return null;
      steps.push({ kind: 'climb', ladder: link.ladder, to: link.to, x: land });
    } else {
      steps.push({ kind: link.kind, to: link.to, x: land });
    }
    x = land;
  }
  walk(goalX);
  return steps;
}

/** Every surface each surface can reach, for checking that nowhere is cut off. */
export function reachable(world: World, from: string): Set<string> {
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length > 0) {
    const here = queue.shift() as string;
    for (const link of world.links) {
      if (link.from === here && !seen.has(link.to)) {
        seen.add(link.to);
        queue.push(link.to);
      }
    }
  }
  return seen;
}
