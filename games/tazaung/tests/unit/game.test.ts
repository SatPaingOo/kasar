/**
 * The rules, headlessly. `game.ts` is pure and takes its randomness as an
 * argument, so every one of these is deterministic without a clock or a seed
 * helper of its own.
 *
 * These cover the judgment calls — the ones where a plausible alternative was
 * tried and turned out to break the game — rather than the happy path.
 */

import { describe, expect, it } from 'vitest';

import {
  BOONS,
  RULES,
  begin,
  cellAt,
  createGame,
  huskSpeedAt,
  moveWizard,
  nightProgress,
  pileCount,
  requestFire,
  spawnIntervalAt,
  step,
  surfaceRow,
} from '../../src/game.js';
import type { Boon, GameState } from '../../src/game.js';

const STEP = 1 / 120;

/** Never random: every test that spawns says exactly what it wants. */
const fixed = (value: number) => () => value;

/** Hands back the given values in order, then repeats the last one. */
function scripted(values: readonly number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
}

function started(random: () => number = fixed(0)): GameState {
  const state = createGame(random);
  begin(state);
  return state;
}

function put(state: GameState, column: number, row: number): void {
  state.pile[row * RULES.columns + column] = true;
}

function at(state: GameState, column: number): void {
  state.wizardColumn = column;
  state.targetColumn = column;
}

/** Runs until `done`, or fails the test rather than looping forever. */
function until(state: GameState, done: () => boolean, label: string, maxSteps = 2000): void {
  for (let i = 0; i < maxSteps; i += 1) {
    requestFire(state);
    step(state, STEP);
    if (done()) return;
  }
  throw new Error(`never happened: ${label}`);
}

describe('begin', () => {
  it('leaves the game untouched until the night starts', () => {
    const state = createGame(fixed(0));
    for (let i = 0; i < 600; i += 1) step(state, STEP);

    expect(state.phase).toBe('intro');
    expect(state.elapsed).toBe(0);
    expect(state.husks).toHaveLength(0);
    expect(state.light).toBe(RULES.lightStart);
  });

  it('does nothing when the night is already running', () => {
    const state = started();
    state.elapsed = 12;
    begin(state);
    expect(state.elapsed).toBe(12);
  });
});

describe('a spark travelling up a column', () => {
  it('stops at the pile, leaving the sky above it alone', () => {
    const state = started();
    put(state, 3, RULES.rows - 1);
    state.husks.push({ id: 900, column: 3, speed: 0, boon: null, y: 2 });
    at(state, 3);

    until(state, () => state.events.some((e) => e.kind === 'chain'), 'the spark reaching the pile');

    // The husk in the air was shielded by what is already on the floor.
    expect(state.husks.map((husk) => husk.id)).toContain(900);
  });

  it('reaches a falling husk when the column is clear', () => {
    const state = started();
    state.husks.push({ id: 901, column: 3, speed: 0, boon: null, y: 2 });
    at(state, 3);

    until(state, () => state.events.some((e) => e.kind === 'relit'), 'the spark reaching the husk');
    expect(state.husks.map((husk) => husk.id)).not.toContain(901);
  });
});

describe('relighting a cluster in the pile', () => {
  it('lifts everything touching it and nothing that is not', () => {
    const state = started();
    for (let column = 1; column <= 4; column += 1) put(state, column, RULES.rows - 1);
    for (let row = RULES.rows - 4; row <= RULES.rows - 2; row += 1) put(state, 4, row);
    put(state, 7, RULES.rows - 1); // on its own, touching nothing
    at(state, 2);

    until(state, () => state.events.some((e) => e.kind === 'chain'), 'a chain');

    const chain = state.events.find((event) => event.kind === 'chain');
    expect(chain?.kind === 'chain' ? chain.size : 0).toBe(7);
    expect(cellAt(state.pile, 7, RULES.rows - 1)).toBe(true);
  });

  it('costs light for every husk it wakes, rather than paying any', () => {
    const state = started();
    for (let column = 0; column < 5; column += 1) put(state, column, RULES.rows - 1);
    at(state, 2);
    const before = state.light;

    until(state, () => state.events.some((e) => e.kind === 'chain'), 'a chain');

    // Priced like catching, the best play became letting everything land.
    expect(state.light).toBeLessThan(before - RULES.chainCostPerHusk * 4);
  });

  it('packs what is left down onto the floor', () => {
    const state = started();
    put(state, 4, RULES.rows - 1);
    put(state, 4, RULES.rows - 2);
    put(state, 6, RULES.rows - 5); // floating, with nothing beneath it
    at(state, 4);

    until(state, () => state.events.some((e) => e.kind === 'chain'), 'a chain');

    expect(cellAt(state.pile, 6, RULES.rows - 1)).toBe(true);
    expect(cellAt(state.pile, 6, RULES.rows - 5)).toBe(false);
  });
});

describe('the lantern', () => {
  it('pays more for a catch than the spark that bought it', () => {
    expect(RULES.relightGain).toBeGreaterThan(RULES.shotCost);
  });

  it('burns down on its own with nothing happening', () => {
    const state = started();
    const before = state.light;
    for (let i = 0; i < 120; i += 1) step(state, STEP);
    expect(state.light).toBeLessThan(before);
  });

  it('goes out, and that ends the night', () => {
    const state = started();
    // Less than one step's worth of burn, so this step takes it under.
    state.light = RULES.burnPerSecond * STEP * 0.5;
    step(state, STEP);

    expect(state.light).toBe(0);
    expect(state.phase).toBe('ended');
    expect(state.events.some((event) => event.kind === 'ended')).toBe(true);
  });

  it('is not drained at all while a ward is up', () => {
    const state = started();
    for (let column = 0; column < RULES.columns; column += 1) put(state, column, RULES.rows - 1);
    state.ward = RULES.wardSeconds;
    const before = state.light;

    for (let i = 0; i < 60; i += 1) step(state, STEP);
    expect(state.light).toBe(before);
  });
});

describe('sunrise', () => {
  it('arrives at the end of the night and beats the dark to it', () => {
    const state = started();
    state.elapsed = RULES.nightSeconds - STEP / 2;
    state.light = 0.0001; // low enough that the dark would otherwise take it

    step(state, STEP);
    expect(state.phase).toBe('dawn');
  });

  it('reports how far through the night it is, and never past the end', () => {
    const state = started();
    state.elapsed = RULES.nightSeconds / 2;
    expect(nightProgress(state)).toBeCloseTo(0.5);

    state.elapsed = RULES.nightSeconds * 4;
    expect(nightProgress(state)).toBe(1);
  });
});

describe('difficulty', () => {
  it('runs on elapsed time, not on how many husks have spawned', () => {
    // Ramping per spawn compounds: faster spawns ramp faster still.
    expect(spawnIntervalAt(0)).toBeGreaterThan(spawnIntervalAt(60));
    expect(huskSpeedAt(0)).toBeLessThan(huskSpeedAt(60));
  });

  it('passes what one wand can answer before the night is over', () => {
    // By sunrise the sky asks for more husks a second than 1/fireDelay can
    // answer, so the last stretch cannot be kept up with however well it is
    // played. It has not quite reached the floor by then, and need not have.
    const atDawn = spawnIntervalAt(RULES.nightSeconds);
    expect(1 / atDawn).toBeGreaterThan(1 / RULES.fireDelay);
    expect(atDawn).toBeLessThan(RULES.spawnIntervalStart * 0.1);
  });

  it('holds both ramps at their floor and ceiling', () => {
    expect(spawnIntervalAt(10_000)).toBe(RULES.spawnIntervalMin);
    expect(huskSpeedAt(10_000)).toBe(RULES.huskSpeedMax);
  });
});

describe('boons', () => {
  function catchBoon(boon: Boon): GameState {
    const state = started();
    state.husks.push({ id: 500, column: 2, speed: 0, boon, y: 3 });
    at(state, 2);
    until(state, () => state.events.some((e) => e.kind === 'boon'), `catching ${boon}`);
    return state;
  }

  it('spawns every kind across the range of the roll', () => {
    // A spawn draws three times: the column, whether it is a boon at all,
    // and which one. Scripting them covers the whole table rather than
    // trusting a seed to wander through it.
    const spawned = BOONS.map((_boon, index) => {
      const state = createGame(scripted([0, 0, (index + 0.5) / BOONS.length]));
      begin(state);
      state.spawnTimer = 0;
      step(state, STEP);
      return state.husks[0]?.boon;
    });

    expect(spawned).toEqual([...BOONS]);
  });

  it('spawns an ordinary husk when the roll misses', () => {
    const state = createGame(scripted([0, 1]));
    begin(state);
    state.spawnTimer = 0;
    step(state, STEP);

    expect(state.husks[0]?.boon).toBeNull();
  });

  it('ember shortens the wait between sparks', () => {
    const state = catchBoon('ember');
    expect(state.surge).toBeGreaterThan(0);
    expect(RULES.surgeFireScale).toBeLessThan(1);
  });

  it('hush slows what is falling without stopping it', () => {
    const state = catchBoon('hush');
    expect(state.hush).toBeGreaterThan(0);
    expect(RULES.hushScale).toBeGreaterThan(0);
    expect(RULES.hushScale).toBeLessThan(1);
  });

  it('beacon sends a spark up every column at once', () => {
    const state = catchBoon('beacon');
    const columns = new Set(state.sparks.map((spark) => spark.column));
    expect(columns.size).toBe(RULES.columns);
  });

  it('bloom empties the pile and sends all of it home', () => {
    const state = started();
    for (let column = 0; column < RULES.columns; column += 1) put(state, column, RULES.rows - 1);
    const buried = pileCount(state.pile);
    state.husks.push({ id: 501, column: 2, speed: 0, boon: 'bloom', y: 3 });
    at(state, 2);

    // The column is shielded by the pile, so clear just this one lane first.
    state.pile[(RULES.rows - 1) * RULES.columns + 2] = false;
    until(state, () => state.events.some((e) => e.kind === 'boon'), 'catching bloom');

    expect(pileCount(state.pile)).toBe(0);
    expect(state.risings.length).toBeGreaterThanOrEqual(buried - 1);
  });

  it('ward buys time rather than light', () => {
    const state = catchBoon('ward');
    expect(state.ward).toBe(RULES.wardSeconds);
  });
});

describe('the wizard', () => {
  it('walks to a column instead of appearing in it', () => {
    const state = started();
    at(state, 0);
    moveWizard(state, 7);

    step(state, STEP);
    expect(state.wizardColumn).toBe(1);
    expect(state.targetColumn).toBe(7);
  });

  it('cannot be hurried past the move delay', () => {
    const state = started();
    at(state, 0);
    moveWizard(state, 7);

    step(state, STEP);
    const afterFirst = state.wizardColumn;
    step(state, STEP); // well inside the cooldown
    expect(state.wizardColumn).toBe(afterFirst);
  });

  it('cannot fire with less light than the spark costs', () => {
    const state = started();
    state.light = RULES.shotCost / 2;
    requestFire(state);
    step(state, STEP);

    expect(state.sparks).toHaveLength(0);
  });
});

describe('a husk that lands', () => {
  it('rests on what is already there rather than inside it', () => {
    const state = started();
    put(state, 5, RULES.rows - 1);
    state.husks.push({ id: 700, column: 5, speed: 40, boon: null, y: RULES.rows - 4 });

    for (let i = 0; i < 20; i += 1) step(state, STEP);

    expect(cellAt(state.pile, 5, RULES.rows - 2)).toBe(true);
    expect(surfaceRow(state.pile, 5)).toBe(RULES.rows - 2);
  });
});
