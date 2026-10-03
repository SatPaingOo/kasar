/**
 * The page, as somewhere to live.
 *
 * The shelf's figure used to have a strip of floor along the bottom of the
 * window. Now he has the whole page: the top of every card, the rule under
 * the masthead, the title and the readout above it, and the floor at the very
 * bottom. This turns the boxes the page has laid out into that world — the
 * surfaces he can stand on, and the ways between them: a hop across the gap
 * between two cards, a leap up or down to something close, a jump down off an
 * end, and ladders where nothing closer will do.
 *
 * Nothing here touches the DOM. It takes boxes in document coordinates and
 * gives back plain data, so the one promise worth testing — that every
 * surface can be reached from every other, whatever the layout — can be.
 *
 * The ladders are the shelf's own: thin rails in the grid's grey, standing in
 * the gutters and the margins and never across a card or a line of text. Not
 * rope — a rope is Kyo's, and the shelf may not borrow a game's look.
 */

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Something on the page with a top to stand on. */
export interface Perch {
  readonly id: string;
  readonly box: Box;
}

export interface Layout {
  /** The document's size. */
  readonly width: number;
  readonly height: number;
  /** The masthead, whose bottom edge is a rule he can walk along. */
  readonly rule: Box | null;
  /** The title, the readout, every card. */
  readonly perches: readonly Perch[];
  /** Anything else a ladder must not cross: lines of text, empty slots. */
  readonly obstacles: readonly Box[];
}

export interface Surface {
  readonly id: string;
  /** Where his feet can be, left to right, and the height they are at. */
  readonly x0: number;
  readonly x1: number;
  readonly y: number;
}

/** Where a ladder meets a surface: its top, or its foot. */
export interface Attach {
  readonly surface: string;
  readonly x: number;
  readonly y: number;
}

export interface Ladder {
  readonly id: string;
  readonly x: number;
  readonly top: Attach;
  readonly bottom: Attach;
}

/**
 * A way from one surface to another, always listed from `from`. Two-way ways
 * are listed once in each direction.
 *
 * - `hop`: across a gap at the same height, leaving at `at` and landing at `land`
 * - `leap`: straight up or down to something close, anywhere between `min` and `max`
 * - `drop`: off an end and down, one way only
 * - `ladder`: climbed, from the attach point at `at` to the one at `land`
 */
export type Link =
  | {
      readonly kind: 'hop' | 'drop';
      readonly from: string;
      readonly to: string;
      readonly at: number;
      readonly land: number;
    }
  | { readonly kind: 'leap'; readonly from: string; readonly to: string; readonly min: number; readonly max: number }
  | {
      readonly kind: 'ladder';
      readonly from: string;
      readonly to: string;
      readonly ladder: string;
      readonly at: number;
      readonly land: number;
    };

export interface World {
  readonly width: number;
  readonly height: number;
  readonly surfaces: readonly Surface[];
  readonly ladders: readonly Ladder[];
  readonly links: readonly Link[];
  /**
   * For each surface, the stretches where something sits just above it —
   * a line of text, the bottom of a card — so that standing there, he would
   * be in front of it. Fine to pass through; not where to stop.
   */
  readonly crowded: ReadonlyMap<string, readonly (readonly [number, number])[]>;
}

export const WORLD = {
  /** His feet stay this far in from the edge of anything he stands on. */
  inset: 6,
  /** The floor is this far above the bottom of the page, and this far in from its sides. */
  floorInset: 14,
  floorMargin: 22,
  /** Surfaces this close in height are at one level. */
  level: 3,
  /** The widest gap a hop clears, and the most it climbs or falls on the way. */
  hopGap: 64,
  hopRise: 14,
  /** The furthest he leaps straight up, or down. */
  leap: 64,
  /** The furthest he will jump down off an end. */
  drop: 170,
  /** Ladders stand this far outside the edge they hang from. */
  ladderOut: 10,
  /** And keep this far clear of anything they pass. */
  clearance: 6,
  /** A ladder's foot has to come down this close to what it lands on. */
  reach: 34,
  /** How tall he stands, for what he would be in front of. */
  tall: 58,
} as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** How far x is from the nearest point of a surface; zero on it. */
const gapTo = (s: Surface, x: number): number => (x < s.x0 ? s.x0 - x : x > s.x1 ? x - s.x1 : 0);

function surfacesOf(layout: Layout): Surface[] {
  const out: Surface[] = [];
  const floorY = layout.height - WORLD.floorInset;
  out.push({
    id: 'floor',
    x0: WORLD.floorMargin,
    x1: Math.max(WORLD.floorMargin, layout.width - WORLD.floorMargin),
    y: floorY,
  });
  if (layout.rule !== null) {
    out.push({
      id: 'rule',
      x0: layout.rule.left + WORLD.inset,
      x1: layout.rule.right - WORLD.inset,
      y: layout.rule.bottom,
    });
  }
  for (const perch of layout.perches) {
    const x0 = perch.box.left + WORLD.inset;
    const x1 = perch.box.right - WORLD.inset;
    // Too narrow to stand on, or below the floor: not a place to be.
    if (x1 - x0 < 12 || perch.box.top >= floorY - WORLD.level) continue;
    out.push({ id: perch.id, x0, x1, y: perch.box.top });
  }
  return out;
}

/** Whether a vertical line at x from y0 down to y1 stays clear of every box. */
function clear(x: number, y0: number, y1: number, boxes: readonly Box[]): boolean {
  for (const b of boxes) {
    if (x < b.left - WORLD.clearance || x > b.right + WORLD.clearance) continue;
    // A box the line only touches at its very top is the one it hangs from.
    if (b.bottom <= y0 + 1 || b.top >= y1 - 1) continue;
    return false;
  }
  return true;
}

/** Union-find over surface ids, for which of them can already reach which. */
class Groups {
  private readonly parent = new Map<string, string>();

  find(id: string): string {
    let root = id;
    while (this.parent.has(root) && this.parent.get(root) !== root) root = this.parent.get(root) ?? root;
    this.parent.set(id, root);
    return root;
  }

  join(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export function buildWorld(layout: Layout): World {
  const surfaces = surfacesOf(layout);
  const links: Link[] = [];
  const ladders: Ladder[] = [];
  const groups = new Groups();
  for (const s of surfaces) groups.find(s.id);
  const boxes = [...layout.perches.map((p) => p.box), ...layout.obstacles];

  const both = (a: Link, b: Link): void => {
    links.push(a, b);
    groups.join(a.from, a.to);
  };

  // Hops: across the gap between two neighbours at one level.
  for (const a of surfaces) {
    for (const b of surfaces) {
      if (a === b || Math.abs(a.y - b.y) > WORLD.hopRise) continue;
      const gap = b.x0 - a.x1;
      if (gap <= 0 || gap > WORLD.hopGap) continue;
      // Only the nearest neighbour to the right: no hopping over a card.
      const between = surfaces.some(
        (c) => c !== a && c !== b && Math.abs(c.y - a.y) <= WORLD.hopRise && c.x0 >= a.x1 && c.x1 <= b.x0,
      );
      if (between) continue;
      both(
        { kind: 'hop', from: a.id, to: b.id, at: a.x1, land: b.x0 },
        { kind: 'hop', from: b.id, to: a.id, at: b.x0, land: a.x1 },
      );
    }
  }

  // Leaps: straight up or down between two things close above each other,
  // over the stretch where one is above the other.
  for (const upper of surfaces) {
    for (const lower of surfaces) {
      const rise = lower.y - upper.y;
      if (rise <= WORLD.level || rise > WORLD.leap) continue;
      // Side by side and nearly level is a hop, not a leap.
      if (rise <= WORLD.hopRise && (upper.x1 < lower.x0 || lower.x1 < upper.x0)) continue;
      const min = Math.max(upper.x0, lower.x0);
      const max = Math.min(upper.x1, lower.x1);
      if (max - min < 8) continue;
      // Nothing in between to hit his head on.
      const blocked = surfaces.some(
        (s) => s !== upper && s !== lower && s.y > upper.y && s.y < lower.y && s.x0 < max && s.x1 > min,
      );
      if (blocked) continue;
      both(
        { kind: 'leap', from: upper.id, to: lower.id, min, max },
        { kind: 'leap', from: lower.id, to: upper.id, min, max },
      );
    }
  }

  // Drops: off either end of something and down onto whatever is under it,
  // if that is not too far. One way only, so they connect nothing for the
  // ladders' purposes.
  for (const s of surfaces) {
    for (const side of [-1, 1] as const) {
      // Far enough out to fall clear of the side of what he jumps off.
      const out = WORLD.inset + WORLD.clearance + 2;
      const x = side < 0 ? s.x0 - out : s.x1 + out;
      const below = surfaces
        .filter((t) => t !== s && t.y > s.y + WORLD.leap && gapTo(t, x) === 0)
        .sort((p, q) => p.y - q.y)[0];
      if (below === undefined || below.y - s.y > WORLD.drop) continue;
      if (!clear(x, s.y, below.y, boxes)) continue;
      links.push({ kind: 'drop', from: s.id, to: below.id, at: side < 0 ? s.x0 : s.x1, land: x });
    }
  }

  // Ladders, until everything can reach the floor. Each group that cannot
  // yet gets one, from its lowest level down to the nearest thing below that
  // belongs to another group — so between rows of cards, a ladder in the
  // gutter; from the title, one in the margin. They alternate sides as they
  // go, so a long page reads as a zigzag rather than a column of ladders.
  const lowestOf = (root: string): number =>
    Math.max(...surfaces.filter((s) => groups.find(s.id) === root).map((s) => s.y));

  for (let guard = 0; guard < surfaces.length * 2; guard += 1) {
    const floorRoot = groups.find('floor');
    const roots = [...new Set(surfaces.map((s) => groups.find(s.id)))].filter((r) => r !== floorRoot);
    if (roots.length === 0) break;
    // The group nearest the bottom first, so each ladder is a short one.
    roots.sort((a, b) => lowestOf(b) - lowestOf(a));
    const root = roots[0] as string;
    const own = surfaces.filter((s) => groups.find(s.id) === root);
    const lowest = lowestOf(root);

    interface Candidate {
      readonly from: Surface;
      readonly side: -1 | 1;
      readonly x: number;
      readonly onto: Surface;
      readonly length: number;
      /** How close it stands to the nearest box beside it. */
      readonly room: number;
    }
    /** The nearest box beside a stretch of ladder, sideways. */
    const roomAt = (x: number, y0: number, y1: number): number => {
      let room = Infinity;
      for (const b of boxes) {
        if (b.bottom <= y0 + 1 || b.top >= y1 - 1) continue;
        room = Math.min(room, x < b.left ? b.left - x : x > b.right ? x - b.right : 0);
      }
      return room;
    };
    const candidates: Candidate[] = [];
    const consider = (pool: readonly Surface[], careful: boolean): void => {
      for (const from of pool) {
        for (const side of [-1, 1] as const) {
          const x = side < 0 ? from.x0 - WORLD.inset - WORLD.ladderOut : from.x1 + WORLD.inset + WORLD.ladderOut;
          if (x < 2 || x > layout.width - 2) continue;
          const onto = surfaces
            .filter((t) => groups.find(t.id) !== root && t.y > from.y + WORLD.level && gapTo(t, x) <= WORLD.reach)
            .sort((p, q) => p.y - q.y)[0];
          if (onto === undefined) continue;
          if (careful && !clear(x, from.y, onto.y, boxes)) continue;
          candidates.push({ from, side, x, onto, length: onto.y - from.y, room: roomAt(x, from.y, onto.y) });
        }
      }
    };
    consider(
      own.filter((s) => s.y >= lowest - WORLD.level),
      true,
    );
    if (candidates.length === 0) consider(own, true);
    // Nowhere clear: a ladder that crosses something is better than a
    // figure who can never get down.
    if (candidates.length === 0) consider(own, false);
    // Shortest first; a ladder squeezed up against a line of text costs as
    // if it were longer, so where two are alike the one in the open wins.
    const prefer = ladders.length % 2 === 0 ? 1 : -1;
    const cost = (c: Candidate): number => c.length + Math.max(0, 24 - c.room) * 3;
    candidates.sort((a, b) => cost(a) - cost(b) || (a.side === prefer ? -1 : 0) - (b.side === prefer ? -1 : 0));
    const pick = candidates[0];
    if (pick === undefined) break;

    const id = `ladder:${ladders.length}`;
    const top: Attach = { surface: pick.from.id, x: pick.side < 0 ? pick.from.x0 : pick.from.x1, y: pick.from.y };
    const bottom: Attach = { surface: pick.onto.id, x: clamp(pick.x, pick.onto.x0, pick.onto.x1), y: pick.onto.y };
    ladders.push({ id, x: pick.x, top, bottom });
    both(
      { kind: 'ladder', from: top.surface, to: bottom.surface, ladder: id, at: top.x, land: bottom.x },
      { kind: 'ladder', from: bottom.surface, to: top.surface, ladder: id, at: bottom.x, land: top.x },
    );
  }

  const crowded = new Map<string, (readonly [number, number])[]>();
  for (const s of surfaces) {
    const spans: (readonly [number, number])[] = [];
    for (const b of boxes) {
      if (b.bottom > s.y + 1 || b.bottom <= s.y - WORLD.tall) continue;
      if (b.right < s.x0 - 12 || b.left > s.x1 + 12) continue;
      spans.push([b.left - 12, b.right + 12]);
    }
    crowded.set(s.id, spans);
  }

  return { width: layout.width, height: layout.height, surfaces, ladders, links, crowded };
}

/** Whether standing at x on a surface would put him in front of something. */
export function isCrowded(world: World, surface: string, x: number): boolean {
  return (world.crowded.get(surface) ?? []).some(([a, b]) => x >= a && x <= b);
}

/**
 * Somewhere to stand between lo and hi on a surface, out of the way if there
 * is anywhere out of the way, and anywhere if there is not.
 */
export function spotOn(world: World, surface: string, lo: number, hi: number, random: () => number): number {
  let x = lo + random() * (hi - lo);
  for (let tries = 0; tries < 6 && isCrowded(world, surface, x); tries += 1) x = lo + random() * (hi - lo);
  return x;
}

export const surfaceOf = (world: World, id: string): Surface | undefined => world.surfaces.find((s) => s.id === id);
export const ladderOf = (world: World, id: string): Ladder | undefined => world.ladders.find((l) => l.id === id);

/** The surface right under a point, or the nearest one if nothing is: where he lands when the page moves under him. */
export function surfaceUnder(world: World, x: number, y: number): Surface {
  const under = world.surfaces.filter((s) => s.y >= y - WORLD.level && gapTo(s, x) === 0).sort((a, b) => a.y - b.y)[0];
  if (under !== undefined) return under;
  let best = world.surfaces[0] as Surface;
  let distance = Infinity;
  for (const s of world.surfaces) {
    const d = Math.hypot(gapTo(s, x), s.y - y);
    if (d < distance) [best, distance] = [s, d];
  }
  return best;
}
