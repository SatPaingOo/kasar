/**
 * Hlaykar — rules.
 *
 * Water is rising in a shaft. Stones fall from the rim. You decide where they
 * land; the climber decides where he goes, and he only ever goes up.
 *
 * The whole game is in that last clause. He can step up exactly one, never
 * down, and turns around at anything else. So a flat wall is useless to him
 * and a two-high step is a wall — what he needs is a stair, and building one
 * out of the shapes you are given, ahead of a man who is already walking, is
 * the game. Clearing a row does nothing here. There are no rows to clear.
 *
 * This module is pure: no canvas, no DOM, no timers, no Math.random unless the
 * caller hands one in. Everything the renderer needs is readable state.
 */

export const RULES = {
  columns: 9,
  rows: 16,

  /** Reach this row and he is over the rim and out. */
  exitRow: 0,

  /** Rows per second a stone falls under its own weight. */
  fallRate: 5.5,
  /** Quiet moment between one stone landing and the next appearing. */
  spawnDelay: 0.85,

  /** Seconds between the climber's steps. */
  stepSeconds: 0.33,
  /** The one step up he can make. Anything taller is a wall to him. */
  reach: 1,

  /**
   * The water holds off this long at the start, so the first stone is a
   * decision rather than a scramble.
   */
  waterDelay: 5,
  /** Rows per second the water rises once it starts. */
  riseRate: 0.11,
  /**
   * And it quickens: by the end of a long run it is rising at about twice
   * this. A constant rise made the last third of a good run a formality —
   * once you were ahead of it you stayed ahead of it.
   */
  riseAccel: 0.0015,
} as const;

export type PieceKind = 'single' | 'bar' | 'corner' | 'square';

/** [row, column], before the piece is placed anywhere. */
export type Offset = readonly [number, number];

/**
 * Singles are the stair-maker, so they are the rare one. A bag of nothing but
 * singles is a game with no decisions in it.
 */
const BAG: readonly PieceKind[] = ['single', 'bar', 'bar', 'bar', 'corner', 'corner', 'corner', 'square', 'square'];

const SHAPES: Readonly<Record<PieceKind, readonly Offset[]>> = {
  single: [[0, 0]],
  bar: [
    [0, 0],
    [0, 1],
  ],
  corner: [
    [0, 0],
    [1, 0],
    [1, 1],
  ],
  square: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
};

export interface Piece {
  readonly kind: PieceKind;
  cells: readonly Offset[];
  /** Column of the shape's left edge. */
  col: number;
  /** Row of its top edge; fractional while it is still falling. */
  row: number;
}

export interface Climber {
  col: number;
  row: number;
  facing: 1 | -1;
  /** Seconds until his next step. */
  nextStepIn: number;
  /** Where he stepped from, and how far along he is, for the renderer. */
  fromCol: number;
  fromRow: number;
  progress: number;
}

export type Outcome = 'playing' | 'out' | 'drowned';

export type Event =
  | { readonly kind: 'land'; readonly cells: number }
  | { readonly kind: 'step'; readonly climbed: boolean }
  | { readonly kind: 'blocked' }
  | { readonly kind: 'knocked' }
  | { readonly kind: 'out' }
  | { readonly kind: 'drowned' };

export interface Game {
  /** rows × columns, row 0 at the rim. True where there is stone. */
  readonly cells: boolean[];
  piece: Piece | null;
  next: PieceKind;
  spawnIn: number;
  climber: Climber;
  /** Row of the water's surface. Everything below it is under water. */
  waterRow: number;
  elapsed: number;
  /** How high he has been, in rows above the floor: the score. */
  best: number;
  outcome: Outcome;
  events: Event[];
}

const index = (row: number, col: number): number => row * RULES.columns + col;

export function cellAt(game: Game, row: number, col: number): boolean {
  if (row < 0 || row >= RULES.rows || col < 0 || col >= RULES.columns) return false;
  return game.cells[index(row, col)] === true;
}

/**
 * The topmost stone in a column, or the floor if it is empty. The climber
 * stands one row above whatever this returns.
 */
export function surfaceRow(game: Game, col: number): number {
  for (let row = 0; row < RULES.rows; row += 1) {
    if (cellAt(game, row, col)) return row;
  }
  return RULES.rows;
}

/** Height above the floor, which is the only number worth showing him. */
export function heightOf(row: number): number {
  return RULES.rows - 1 - row;
}

function normalise(cells: readonly Offset[]): readonly Offset[] {
  let minRow = Infinity;
  let minCol = Infinity;
  for (const [r, c] of cells) {
    if (r < minRow) minRow = r;
    if (c < minCol) minCol = c;
  }
  return cells.map(([r, c]) => [r - minRow, c - minCol] as const);
}

/** A quarter turn inside the shape's own 2×2 box. */
export function rotate(cells: readonly Offset[]): readonly Offset[] {
  return normalise(cells.map(([r, c]) => [c, 1 - r] as const));
}

export function widthOf(cells: readonly Offset[]): number {
  let max = 0;
  for (const [, c] of cells) if (c > max) max = c;
  return max + 1;
}

/** Can this shape sit at this column and row without overlapping stone? */
export function fits(game: Game, cells: readonly Offset[], col: number, row: number): boolean {
  for (const [r, c] of cells) {
    const rr = row + r;
    const cc = col + c;
    if (cc < 0 || cc >= RULES.columns) return false;
    if (rr >= RULES.rows) return false;
    // Above the rim is not a collision: a tall piece spawns half out of shot.
    if (rr < 0) continue;
    if (cellAt(game, rr, cc)) return false;
  }
  return true;
}

function drawKind(random: () => number): PieceKind {
  return BAG[Math.min(BAG.length - 1, Math.floor(random() * BAG.length))] ?? 'single';
}

export function createGame(random: () => number = Math.random): Game {
  const climberCol = Math.floor(RULES.columns / 2);
  const game: Game = {
    cells: new Array<boolean>(RULES.rows * RULES.columns).fill(false),
    piece: null,
    next: drawKind(random),
    spawnIn: RULES.spawnDelay,
    climber: {
      col: climberCol,
      row: RULES.rows - 1,
      facing: 1,
      nextStepIn: RULES.stepSeconds,
      fromCol: climberCol,
      fromRow: RULES.rows - 1,
      progress: 1,
    },
    waterRow: RULES.rows,
    elapsed: 0,
    best: 0,
    outcome: 'playing',
    events: [],
  };
  return game;
}

function spawn(game: Game, random: () => number): void {
  const kind = game.next;
  const cells = SHAPES[kind];
  game.piece = {
    kind,
    cells,
    col: Math.max(0, Math.floor((RULES.columns - widthOf(cells)) / 2)),
    // Starting above the rim, so a stone is never on top of the player before
    // they have seen it.
    row: -1,
  };
  game.next = drawKind(random);
}

/** Slide the falling stone. Refused rather than clamped, so a wall feels solid. */
export function movePiece(game: Game, by: -1 | 1): boolean {
  const piece = game.piece;
  if (piece === null || game.outcome !== 'playing') return false;
  if (!fits(game, piece.cells, piece.col + by, Math.floor(piece.row))) return false;
  piece.col += by;
  return true;
}

export function rotatePiece(game: Game): boolean {
  const piece = game.piece;
  if (piece === null || game.outcome !== 'playing') return false;
  const turned = rotate(piece.cells);
  const row = Math.floor(piece.row);
  // One nudge off each wall, which is the whole of the kick table a shape
  // this small needs.
  for (const shift of [0, -1, 1]) {
    if (fits(game, turned, piece.col + shift, row)) {
      piece.cells = turned;
      piece.col += shift;
      return true;
    }
  }
  return false;
}

/** How far down the stone would come to rest from where it is now. */
export function restingRow(game: Game, piece: Piece): number {
  let row = Math.floor(piece.row);
  while (fits(game, piece.cells, piece.col, row + 1)) row += 1;
  return row;
}

export function hardDrop(game: Game): void {
  const piece = game.piece;
  if (piece === null || game.outcome !== 'playing') return;
  piece.row = restingRow(game, piece);
  land(game);
}

/**
 * Let the stone fall this far, landing it if it cannot. Gravity and the
 * player's soft drop are the same motion, so they are the same function.
 */
export function dropBy(game: Game, rows: number): void {
  const piece = game.piece;
  if (piece === null || game.outcome !== 'playing') return;
  const next = piece.row + rows;
  if (fits(game, piece.cells, piece.col, Math.floor(next))) piece.row = next;
  else {
    piece.row = Math.floor(piece.row);
    land(game);
  }
}

/**
 * Where a climber knocked off his feet by a landing stone ends up: off the
 * side that is lower, and the way he was already walking when it is a tie.
 *
 * Being shoved is the one thing that can cost him height, and it is the only
 * reason not to simply drop every stone on his head — which would otherwise
 * carry him up the shaft on a one-wide tower without a stair at all.
 */
function knockAside(game: Game): void {
  const climber = game.climber;
  const left = climber.col - 1;
  const right = climber.col + 1;
  const leftRow = left < 0 ? -Infinity : surfaceRow(game, left);
  const rightRow = right >= RULES.columns ? -Infinity : surfaceRow(game, right);

  let col: number;
  if (leftRow === rightRow) col = climber.col + climber.facing;
  else col = leftRow > rightRow ? left : right;
  if (col < 0 || col >= RULES.columns) col = climber.col - climber.facing;

  climber.col = Math.max(0, Math.min(RULES.columns - 1, col));
  climber.row = surfaceRow(game, climber.col) - 1;
  climber.fromCol = climber.col;
  climber.fromRow = climber.row;
  climber.progress = 1;
  climber.facing = climber.facing === 1 ? -1 : 1;
  game.events.push({ kind: 'knocked' });
}

function land(game: Game): void {
  const piece = game.piece;
  if (piece === null) return;
  const row = Math.floor(piece.row);
  let onTheClimber = false;

  for (const [r, c] of piece.cells) {
    const rr = row + r;
    const cc = piece.col + c;
    if (rr < 0 || rr >= RULES.rows || cc < 0 || cc >= RULES.columns) continue;
    game.cells[index(rr, cc)] = true;
    if (rr === game.climber.row && cc === game.climber.col) onTheClimber = true;
  }

  game.events.push({ kind: 'land', cells: piece.cells.length });
  game.piece = null;
  game.spawnIn = RULES.spawnDelay;

  if (onTheClimber) knockAside(game);
}

/**
 * One step of the climber.
 *
 * He takes the step up if it is exactly one, walks on if it is level, and
 * turns around at anything else — including a way down, which he will not
 * take. Refusing to descend is what makes a stair you built stay built: he
 * cannot wander back down it while your next stone is in the air.
 */
function walk(game: Game): void {
  const climber = game.climber;
  const here = surfaceRow(game, climber.col);
  const target = climber.col + climber.facing;

  if (target < 0 || target >= RULES.columns) {
    climber.facing = climber.facing === 1 ? -1 : 1;
    game.events.push({ kind: 'blocked' });
    return;
  }

  const there = surfaceRow(game, target);
  const climbed = there === here - RULES.reach;
  if (there !== here && !climbed) {
    climber.facing = climber.facing === 1 ? -1 : 1;
    game.events.push({ kind: 'blocked' });
    return;
  }

  climber.fromCol = climber.col;
  climber.fromRow = climber.row;
  climber.progress = 0;
  climber.col = target;
  climber.row = there - 1;
  game.events.push({ kind: 'step', climbed });
}

export function step(game: Game, dt: number, random: () => number = Math.random): Game {
  game.events = [];
  if (game.outcome !== 'playing') return game;

  game.elapsed += dt;

  if (game.elapsed > RULES.waterDelay) {
    const since = game.elapsed - RULES.waterDelay;
    game.waterRow -= (RULES.riseRate + RULES.riseAccel * since) * dt;
  }

  if (game.piece === null) {
    game.spawnIn -= dt;
    if (game.spawnIn <= 0) spawn(game, random);
  } else {
    dropBy(game, RULES.fallRate * dt);
  }

  const climber = game.climber;
  climber.progress = Math.min(1, climber.progress + dt / RULES.stepSeconds);
  climber.nextStepIn -= dt;
  if (climber.nextStepIn <= 0) {
    climber.nextStepIn += RULES.stepSeconds;
    walk(game);
  }

  const height = heightOf(climber.row);
  if (height > game.best) game.best = height;

  if (climber.row <= RULES.exitRow) {
    game.outcome = 'out';
    game.events.push({ kind: 'out' });
  } else if (game.waterRow <= climber.row) {
    game.outcome = 'drowned';
    game.events.push({ kind: 'drowned' });
  }

  return game;
}
