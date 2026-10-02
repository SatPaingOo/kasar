/**
 * The rules, headlessly. `game.ts` is pure and takes its randomness as an
 * argument, so every one of these is deterministic without a clock.
 *
 * These cover the judgment calls — the ones where a plausible alternative was
 * tried and turned out to break the game — rather than the happy path.
 */

import { describe, expect, it } from 'vitest';

import {
  RULES,
  cellAt,
  createGame,
  fits,
  hardDrop,
  heightOf,
  movePiece,
  restingRow,
  rotate,
  rotatePiece,
  shapeOf,
  step,
  surfaceRow,
  widthOf,
} from '../../src/game.js';
import type { Game, Offset } from '../../src/game.js';

const never = (): number => 0;

/** Stack `height` stones in a column, resting on the floor. */
function fill(game: Game, col: number, height: number): void {
  for (let i = 0; i < height; i += 1) {
    game.cells[(RULES.rows - 1 - i) * RULES.columns + col] = true;
  }
}

/** Put him on top of a column and face him somewhere. */
function stand(game: Game, col: number, facing: 1 | -1): void {
  game.climber.col = col;
  game.climber.row = surfaceRow(game, col) - 1;
  game.climber.facing = facing;
  game.climber.fromCol = col;
  game.climber.fromRow = game.climber.row;
}

/** Run him forward exactly `steps` of his own paces, with no stones falling. */
function paces(game: Game, steps: number): void {
  game.piece = null;
  game.spawnIn = Infinity;
  for (let i = 0; i < steps; i += 1) step(game, RULES.stepSeconds, never);
}

describe('the shaft', () => {
  it('reads an empty column as floor and a stacked one as its top stone', () => {
    const game = createGame(never);
    expect(surfaceRow(game, 0)).toBe(RULES.rows);
    fill(game, 0, 3);
    expect(surfaceRow(game, 0)).toBe(RULES.rows - 3);
  });

  it('counts height from the floor, so standing on nothing is nothing', () => {
    expect(heightOf(RULES.rows - 1)).toBe(0);
    expect(heightOf(RULES.exitRow)).toBe(RULES.rows - 1);
  });

  it('treats the walls and the floor as solid and the open sky as not', () => {
    const game = createGame(never);
    const single: readonly Offset[] = [[0, 0]];
    expect(fits(game, single, -1, 5)).toBe(false);
    expect(fits(game, single, RULES.columns, 5)).toBe(false);
    expect(fits(game, single, 0, RULES.rows)).toBe(false);
    // A tall piece spawns half above the rim; that is not a collision.
    expect(fits(game, single, 0, -1)).toBe(true);
  });
});

describe('the climber', () => {
  it('takes a step up of exactly one', () => {
    const game = createGame(never);
    fill(game, 5, 1);
    stand(game, 4, 1);
    const before = game.climber.row;
    paces(game, 1);
    expect(game.climber.col).toBe(5);
    expect(game.climber.row).toBe(before - 1);
  });

  it('turns around at a step of two, which is a wall to him', () => {
    const game = createGame(never);
    fill(game, 5, 2);
    stand(game, 4, 1);
    paces(game, 1);
    expect(game.climber.col).toBe(4);
    expect(game.climber.facing).toBe(-1);
  });

  it('walks on across the level', () => {
    const game = createGame(never);
    fill(game, 4, 2);
    fill(game, 5, 2);
    stand(game, 4, 1);
    paces(game, 1);
    expect(game.climber.col).toBe(5);
    expect(game.climber.row).toBe(surfaceRow(game, 5) - 1);
  });

  it('will not go back down a stair it has climbed', () => {
    // Two steps up, then nothing: he must pace, not descend.
    const game = createGame(never);
    fill(game, 4, 1);
    fill(game, 5, 2);
    stand(game, 5, 1);
    const high = game.climber.row;
    paces(game, 12);
    expect(game.climber.row).toBe(high);
    expect(game.climber.col).toBe(5);
  });

  it('turns at the walls instead of walking out of the shaft', () => {
    const game = createGame(never);
    stand(game, RULES.columns - 1, 1);
    paces(game, 40);
    expect(game.climber.col).toBeGreaterThanOrEqual(0);
    expect(game.climber.col).toBeLessThan(RULES.columns);
  });

  it('climbs a stair all the way out', () => {
    const game = createGame(never);
    // A staircase up to the rim, then back down the other way is irrelevant:
    // he only needs one route up.
    for (let col = 0; col < RULES.columns; col += 1) fill(game, col, col + 1);
    stand(game, 0, 1);
    for (let i = 0; i < 60 && game.outcome === 'playing'; i += 1) {
      paces(game, 1);
    }
    expect(game.climber.row).toBeLessThan(RULES.rows - 1);
    expect(game.best).toBeGreaterThan(0);
  });
});

describe('a stone landing on him', () => {
  it('shoves him off his feet instead of carrying him', () => {
    const game = createGame(never);
    stand(game, 4, 1);
    game.piece = { kind: 'single', mark: 'plain', cells: [[0, 0]], col: 4, row: 0 };
    hardDrop(game);
    expect(game.climber.col).not.toBe(4);
    expect(game.events.some((e) => e.kind === 'knocked')).toBe(true);
  });

  it('cannot be used to ride a tower up the shaft', () => {
    // Dropping every stone on his head is the obvious cheat: the stone lands
    // on the surface he is standing on, so without the shove he would rise a
    // row per stone and never need a stair at all. He does creep up the heap
    // he is being buried in, which is fair, but nothing like one for one.
    const STONES = 28;
    const game = createGame(never);
    stand(game, 4, 1);
    for (let i = 0; i < STONES; i += 1) {
      game.piece = { kind: 'single', mark: 'plain', cells: [[0, 0]], col: game.climber.col, row: 0 };
      hardDrop(game);
    }
    paces(game, 60);
    const dumped = heightOf(game.climber.row);
    expect(dumped).toBeLessThan(STONES / 3);

    // The same stones spent on a stair, which is what the game is asking for.
    const stair = createGame(never);
    let spent = 0;
    for (let col = 0; col < RULES.columns && spent + col + 1 <= STONES; col += 1) {
      fill(stair, col, col + 1);
      spent += col + 1;
    }
    stand(stair, 0, 1);
    paces(stair, 60);
    expect(heightOf(stair.climber.row)).toBeGreaterThan(dumped);
  });
});

describe('a falling stone', () => {
  it('comes to rest on top of what is already there', () => {
    const game = createGame(never);
    fill(game, 3, 4);
    const piece = {
      kind: 'single' as const,
      mark: 'plain' as const,
      cells: [[0, 0]] as readonly Offset[],
      col: 3,
      row: 0,
    };
    expect(restingRow(game, piece)).toBe(RULES.rows - 5);
  });

  it('refuses a sideways move into a wall rather than sliding along it', () => {
    const game = createGame(never);
    game.piece = { kind: 'single', mark: 'plain', cells: [[0, 0]], col: 0, row: 2 };
    expect(movePiece(game, -1)).toBe(false);
    expect(game.piece.col).toBe(0);
    expect(movePiece(game, 1)).toBe(true);
    expect(game.piece.col).toBe(1);
  });

  it('fills exactly the cells of its own shape', () => {
    const game = createGame(never);
    game.piece = {
      kind: 'corner',
      mark: 'plain',
      cells: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      col: 2,
      row: 0,
    };
    hardDrop(game);
    expect(cellAt(game, RULES.rows - 2, 2)).toBe(true);
    expect(cellAt(game, RULES.rows - 1, 2)).toBe(true);
    expect(cellAt(game, RULES.rows - 1, 3)).toBe(true);
    expect(cellAt(game, RULES.rows - 2, 3)).toBe(false);
  });
});

describe('turning a stone', () => {
  it('comes back to where it started after four quarter turns', () => {
    for (const shape of [
      [[0, 0]],
      [
        [0, 0],
        [0, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ] as readonly (readonly Offset[])[]) {
      let turned = shape;
      for (let i = 0; i < 4; i += 1) turned = rotate(turned);
      expect([...turned].sort()).toEqual([...shape].sort());
    }
  });

  it('swaps a bar between lying down and standing up', () => {
    const flat: readonly Offset[] = [
      [0, 0],
      [0, 1],
    ];
    expect(widthOf(flat)).toBe(2);
    expect(widthOf(rotate(flat))).toBe(1);
  });

  it('nudges off a wall rather than refusing the turn', () => {
    const game = createGame(never);
    game.piece = {
      kind: 'bar',
      mark: 'plain',
      cells: rotate([
        [0, 0],
        [0, 1],
      ]),
      col: RULES.columns - 1,
      row: 2,
    };
    expect(rotatePiece(game)).toBe(true);
    expect(game.piece?.col).toBe(RULES.columns - 2);
  });

  it('refuses a turn with no room for it at all', () => {
    const game = createGame(never);
    for (let col = 0; col < RULES.columns; col += 1) fill(game, col, RULES.rows - 3);
    // Standing bar in a one-row gap: no rotation and no nudge can fit.
    game.piece = {
      kind: 'bar',
      mark: 'plain',
      cells: rotate([
        [0, 0],
        [0, 1],
      ]),
      col: 4,
      row: 2,
    };
    for (let col = 0; col < RULES.columns; col += 1) {
      if (col !== 4) game.cells[2 * RULES.columns + col] = true;
    }
    expect(rotatePiece(game)).toBe(false);
  });
});

describe('the water', () => {
  it('holds off at the start, so the first stone is a decision', () => {
    const game = createGame(never);
    game.spawnIn = Infinity;
    step(game, RULES.waterDelay * 0.9, never);
    expect(game.waterRow).toBe(RULES.rows);
  });

  it('rises once it starts, and quickens as the run goes on', () => {
    const early = createGame(never);
    early.spawnIn = Infinity;
    step(early, RULES.waterDelay, never);
    const before = early.waterRow;
    step(early, 1, never);
    const earlyRise = before - early.waterRow;

    const late = createGame(never);
    late.spawnIn = Infinity;
    late.elapsed = RULES.waterDelay + 90;
    const was = late.waterRow;
    step(late, 1, never);
    expect(was - late.waterRow).toBeGreaterThan(earlyRise);
  });

  it('drowns him when it reaches his row and not before', () => {
    const game = createGame(never);
    game.spawnIn = Infinity;
    game.waterRow = game.climber.row + 0.01;
    step(game, 0, never);
    expect(game.outcome).toBe('playing');
    game.waterRow = game.climber.row;
    step(game, 0, never);
    expect(game.outcome).toBe('drowned');
  });

  it('stops the game dead once it has him', () => {
    const game = createGame(never);
    game.waterRow = 0;
    step(game, 0.1, never);
    expect(game.outcome).toBe('drowned');
    const stillness = { ...game.climber };
    step(game, 1, never);
    expect(game.climber).toEqual(stillness);
    expect(game.events).toHaveLength(0);
  });
});

describe('getting out', () => {
  it('ends the run the moment he is over the rim', () => {
    const game = createGame(never);
    game.spawnIn = Infinity;
    game.climber.row = RULES.exitRow;
    step(game, 0, never);
    expect(game.outcome).toBe('out');
    expect(game.best).toBe(heightOf(RULES.exitRow));
  });
});

describe('a breaker', () => {
  it('takes the top off the column it lands in, and one off each neighbour', () => {
    const game = createGame(never);
    for (const col of [2, 3, 4]) fill(game, col, 5);
    game.piece = { kind: 'single', mark: 'breaker', cells: [[0, 0]], col: 3, row: 0 };
    hardDrop(game);
    expect(RULES.rows - surfaceRow(game, 3)).toBe(5 - RULES.breakOwn);
    expect(RULES.rows - surfaceRow(game, 2)).toBe(5 - RULES.breakNeighbour);
    expect(RULES.rows - surfaceRow(game, 4)).toBe(5 - RULES.breakNeighbour);
  });

  it('leaves no stone of its own behind', () => {
    const game = createGame(never);
    const before = game.cells.filter(Boolean).length;
    game.piece = { kind: 'single', mark: 'breaker', cells: [[0, 0]], col: 3, row: 0 };
    hardDrop(game);
    expect(game.cells.filter(Boolean).length).toBe(before);
    expect(game.events.some((e) => e.kind === 'shatter')).toBe(true);
  });

  it('knocks a two-high wall down to a step he can take, which is what it is for', () => {
    const game = createGame(never);
    fill(game, 5, 2);
    stand(game, 4, 1);
    paces(game, 1);
    expect(game.climber.col).toBe(4); // turned away from the wall

    game.piece = { kind: 'single', mark: 'breaker', cells: [[0, 0]], col: 5, row: 0 };
    hardDrop(game);
    stand(game, 4, 1);
    paces(game, 1);
    expect(game.climber.col).toBe(5);
  });

  it('brings him down with the ground if he is standing on what it breaks', () => {
    const game = createGame(never);
    fill(game, 4, 6);
    stand(game, 4, 1);
    const was = game.climber.row;
    game.piece = { kind: 'single', mark: 'breaker', cells: [[0, 0]], col: 4, row: 0 };
    hardDrop(game);
    expect(game.climber.row).toBeGreaterThan(was);
    expect(game.climber.row).toBe(surfaceRow(game, 4) - 1);
    expect(game.events.some((e) => e.kind === 'fell')).toBe(true);
  });

  it('never leaves him standing on air', () => {
    const game = createGame(never);
    for (let col = 0; col < RULES.columns; col += 1) fill(game, col, 4 + (col % 3));
    for (let col = 0; col < RULES.columns; col += 1) {
      stand(game, col, 1);
      game.piece = { kind: 'single', mark: 'breaker', cells: [[0, 0]], col, row: 0 };
      hardDrop(game);
      expect(game.climber.row).toBe(surfaceRow(game, game.climber.col) - 1);
    }
  });
});

describe('losing', () => {
  it('pins him when a stone lands on him in a pit with no way out', () => {
    const game = createGame(never);
    // Walls two high on both sides: nowhere he could have stepped to.
    fill(game, 3, 2);
    fill(game, 5, 2);
    stand(game, 4, 1);
    game.piece = { kind: 'single', mark: 'plain', cells: [[0, 0]], col: 4, row: 0 };
    hardDrop(game);
    expect(game.outcome).toBe('crushed');
    expect(game.events.some((e) => e.kind === 'crushed')).toBe(true);
  });

  it('only shoves him when one side is within his reach', () => {
    const game = createGame(never);
    fill(game, 3, 2);
    fill(game, 5, 1); // a step he could have taken
    stand(game, 4, 1);
    game.piece = { kind: 'single', mark: 'plain', cells: [[0, 0]], col: 4, row: 0 };
    hardDrop(game);
    expect(game.outcome).toBe('playing');
    expect(game.climber.col).toBe(5);
  });

  it('ends the run when the shaft is full to the rim', () => {
    const game = createGame(never);
    for (let col = 0; col < RULES.columns; col += 1) fill(game, col, RULES.rows);
    game.piece = null;
    game.spawnIn = 0.001;
    step(game, 0.01, never);
    expect(game.outcome).toBe('buried');
    expect(game.events.some((e) => e.kind === 'buried')).toBe(true);
  });

  it('does not bury him while there is still room at the rim', () => {
    const game = createGame(never);
    for (let col = 0; col < RULES.columns; col += 1) fill(game, col, RULES.rows - 3);
    game.piece = null;
    game.spawnIn = 0.001;
    step(game, 0.01, never);
    expect(game.outcome).toBe('playing');
    expect(game.piece).not.toBeNull();
  });
});

describe('a swift stone', () => {
  it('comes down faster than an ordinary one', () => {
    const plain = createGame(never);
    plain.piece = { kind: 'single', mark: 'plain', cells: [[0, 0]], col: 4, row: 0 };
    step(plain, 0.1, never);

    const swift = createGame(never);
    swift.piece = { kind: 'single', mark: 'swift', cells: [[0, 0]], col: 4, row: 0 };
    step(swift, 0.1, never);

    expect(swift.piece?.row).toBeGreaterThan(plain.piece?.row ?? 0);
  });

  it('is still the shape it says it is', () => {
    expect(shapeOf('square')).toHaveLength(4);
    expect(shapeOf('single')).toHaveLength(1);
  });
});
