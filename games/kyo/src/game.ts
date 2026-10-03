/**
 * Kyo — rules.
 *
 * A gorge, and a man crossing it on a rope. One button: hold it and he is
 * attached and swinging, let go and the rope is gone and he is in the air
 * carrying whatever speed the swing gave him. Press again and he throws a new
 * rope at whatever is in reach above him.
 *
 * So the whole game is when to let go. Early in the arc he goes up and slow;
 * late he goes out and fast and low. There is nothing else to decide and
 * nothing else to press.
 *
 * Deliberately not another falling-things game: the other two on the shelf
 * both have you dealing with what comes down at you in one column, and a
 * third would make the shelf a genre rather than a shelf. Here nothing falls
 * and he is going somewhere.
 *
 * This module is pure: no canvas, no DOM, no timers, no Math.random unless the
 * caller hands one in. Everything the renderer needs is readable state.
 */

export const RULES = {
  /** How far the ground is below the anchors he starts among. */
  height: 20,
  /**
   * And how far the whole gorge drops for every length he crosses.
   *
   * It has to drop, and this is not a decoration. A rope only ever spends
   * height: a pendulum keeps the energy it was given, a swing converts height
   * into speed and speed back into height, and nothing anywhere puts any back.
   * On a level gorge he sinks a little every swing and is on the floor inside
   * seventy lengths however well he is played — measured, with the air taken
   * out altogether, and it made no difference. So the gorge goes down with
   * him, a shade slower than he falls, and crossing it is a descent he has to
   * keep ahead of rather than a walk he has to not trip on.
   */
  slope: 0.24,
  /** Reach this far across and he is over. */
  distance: 1700,

  gravity: 26,
  /**
   * The longest rope he can throw.
   *
   * It has to span a gap taken from the bottom of a swing, which is where he
   * is fastest and also five and a half metres below the anchors. At 7.5 that
   * line was geometrically impossible and the only way across was to creep
   * from one anchor to the next with no speed at all.
   */
  reach: 10,
  /** And he cannot grab anything that is not at least this far above him. */
  minRise: 1.2,

  /**
   * Physics runs at this step whatever the frame rate is. A rope constraint
   * solved against a variable frame time gives a different swing on every
   * machine, and makes the headless balance runs a lie.
   */
  tick: 1 / 120,
  /** Air, so a long swing does not wind itself up for ever. */
  drag: 0.02,

  /** Anchors are this far apart at the near side, and this far at the far. */
  gapNear: 7,
  gapFar: 14,
  /** And sit between these heights, measured down from the sky. */
  anchorHigh: 3,
  anchorLow: 11,
  /** Keep the sky stocked this far ahead of him. */
  lookAhead: 60,
  /** And forget anything this far behind. */
  forget: 30,

  startSpeed: 3,
  /** How far back from the first anchor he starts, which is his first drop. */
  startDrop: 5.5,
} as const;

export interface Anchor {
  readonly x: number;
  readonly y: number;
}

export interface Rope {
  readonly x: number;
  readonly y: number;
  readonly length: number;
}

export interface Figure {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export type Outcome = 'swinging' | 'across' | 'fallen';

export type Event =
  | { readonly kind: 'grab'; readonly length: number }
  | { readonly kind: 'release'; readonly speed: number }
  | { readonly kind: 'miss' }
  | { readonly kind: 'across' }
  | { readonly kind: 'fallen' };

export interface Game {
  figure: Figure;
  rope: Rope | null;
  anchors: Anchor[];
  /** How far the sky has been stocked to. */
  stockedTo: number;
  elapsed: number;
  /** The furthest he has got, which is the score. */
  best: number;
  outcome: Outcome;
  events: Event[];
  /** Left over from the last frame, so physics runs on a fixed step. */
  spare: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** How far across he is, 0 at the near side and 1 at the far. */
export function progress(game: Game): number {
  return clamp01(game.best / RULES.distance);
}

/** Anchors thin out and the gorge gets harder the further across he gets. */
function gapAt(x: number): number {
  const t = clamp01(x / RULES.distance);
  return RULES.gapNear + (RULES.gapFar - RULES.gapNear) * t;
}

/** The floor at a given point, which falls away as the gorge goes on. */
export function groundAt(x: number): number {
  return RULES.height + RULES.slope * x;
}

/** The top of the band the anchors hang in, which falls away with it. */
export function bandAt(x: number): number {
  return RULES.anchorHigh + RULES.slope * x;
}

function stock(game: Game, random: () => number): void {
  while (game.stockedTo < game.figure.x + RULES.lookAhead) {
    const gap = gapAt(game.stockedTo) * (0.82 + random() * 0.36);
    const x = game.stockedTo + gap;
    const y = bandAt(x) + random() * (RULES.anchorLow - RULES.anchorHigh);
    game.anchors.push({ x, y });
    game.stockedTo = x;
  }
  // Nothing behind him matters, and an array that only grows is a leak.
  const behind = game.figure.x - RULES.forget;
  let kept = 0;
  for (const anchor of game.anchors) {
    if (anchor.x < behind) continue;
    game.anchors[kept] = anchor;
    kept += 1;
  }
  game.anchors.length = kept;
}

export function createGame(random: () => number = Math.random): Game {
  const game: Game = {
    figure: { x: 0, y: 10, vx: RULES.startSpeed, vy: 0 },
    rope: null,
    anchors: [],
    stockedTo: -4,
    elapsed: 0,
    best: 0,
    outcome: 'swinging',
    events: [],
    spare: 0,
  };
  stock(game, random);
  // He starts already hanging, so the first thing the player does is let go
  // rather than work out what the button is for — and he starts level with the
  // anchor rather than under it, so the first swing is a drop.
  //
  // Hanging straight down at rest is a dead start: a pendulum keeps the energy
  // it was given and never finds any more, so from the bottom of the arc he
  // can only ever swing back to where he was. Every bit of speed in this game
  // is height spent, which is also why losing height is how you lose.
  const first = game.anchors[0];
  if (first !== undefined) {
    game.figure.x = first.x - RULES.startDrop;
    game.figure.y = first.y;
    game.figure.vx = RULES.startSpeed;
    game.rope = { x: first.x, y: first.y, length: RULES.startDrop };
  }
  return game;
}

/**
 * Throw a rope at the best anchor in reach, which is the furthest one ahead.
 *
 * Only ahead. Letting him catch something behind him sounds generous and is a
 * trap: the thing in reach the instant after he lets go is always the anchor
 * he just let go of, so one eager press put him straight back where he was
 * and the run never went anywhere. Forwards only, and the button means the
 * same thing every time it is pressed.
 */
export function grab(game: Game): boolean {
  if (game.outcome !== 'swinging' || game.rope !== null) return false;
  const figure = game.figure;

  let best: Anchor | null = null;
  for (const anchor of game.anchors) {
    const dx = anchor.x - figure.x;
    const dy = anchor.y - figure.y;
    if (dx <= 0) continue;
    // Above him by a clear margin, or there is nothing to swing from.
    if (-dy < RULES.minRise) continue;
    if (Math.hypot(dx, dy) > RULES.reach) continue;
    if (best === null || anchor.x > best.x) best = anchor;
  }

  if (best === null) {
    game.events.push({ kind: 'miss' });
    return false;
  }

  const length = Math.hypot(best.x - figure.x, best.y - figure.y);
  game.rope = { x: best.x, y: best.y, length };
  game.events.push({ kind: 'grab', length });
  return true;
}

export function release(game: Game): boolean {
  if (game.rope === null || game.outcome !== 'swinging') return false;
  game.rope = null;
  game.events.push({ kind: 'release', speed: Math.hypot(game.figure.vx, game.figure.vy) });
  return true;
}

/**
 * One fixed step of the world.
 *
 * The rope is solved as a position constraint rather than as a spring: pull
 * him back onto the circle and take away the part of his velocity that was
 * carrying him off it. A spring needs tuning to stop it wobbling and a stiff
 * one explodes; this cannot do either.
 */
function advance(game: Game, dt: number): void {
  const figure = game.figure;

  figure.vy += RULES.gravity * dt;
  const air = Math.max(0, 1 - RULES.drag * dt);
  figure.vx *= air;
  figure.vy *= air;
  figure.x += figure.vx * dt;
  figure.y += figure.vy * dt;

  const rope = game.rope;
  if (rope !== null) {
    const dx = figure.x - rope.x;
    const dy = figure.y - rope.y;
    const dist = Math.hypot(dx, dy);
    // Slack rope, no constraint: a rope pulls and never pushes, which is what
    // lets him drop into the bottom of a swing instead of being held out.
    if (dist > rope.length && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      figure.x = rope.x + nx * rope.length;
      figure.y = rope.y + ny * rope.length;
      const radial = figure.vx * nx + figure.vy * ny;
      if (radial > 0) {
        figure.vx -= radial * nx;
        figure.vy -= radial * ny;
      }
    }
  }
}

export function step(game: Game, dt: number, random: () => number = Math.random): Game {
  game.events = [];
  if (game.outcome !== 'swinging') return game;

  game.elapsed += dt;

  // Fixed steps, with whatever is left over carried into the next frame.
  game.spare += dt;
  let guard = 0;
  while (game.spare >= RULES.tick && guard < 240) {
    advance(game, RULES.tick);
    game.spare -= RULES.tick;
    guard += 1;
  }
  if (guard >= 240) game.spare = 0;

  stock(game, random);
  if (game.figure.x > game.best) game.best = game.figure.x;

  if (game.best >= RULES.distance) {
    game.outcome = 'across';
    game.events.push({ kind: 'across' });
  } else if (game.figure.y >= groundAt(game.figure.x)) {
    game.figure.y = groundAt(game.figure.x);
    game.outcome = 'fallen';
    game.events.push({ kind: 'fallen' });
  }

  return game;
}

/** The angle he hangs or flies at, for anything that has to draw him. */
export function leanOf(game: Game): number {
  const rope = game.rope;
  if (rope !== null) {
    return Math.atan2(game.figure.x - rope.x, game.figure.y - rope.y);
  }
  // Free, he is turned by where he is going rather than by what holds him.
  return Math.atan2(game.figure.vx, Math.max(1, Math.abs(game.figure.vy))) * 0.5;
}
