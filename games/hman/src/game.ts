/**
 * Hman — rules.
 *
 * မှန် — correct. You write the move and the man carries it out; the thing
 * he is fighting is the version of him that got it wrong, so a right answer
 * lands on it and a wrong one lands on you.
 *
 * The important part is that nothing here runs any code. Running it needs a
 * worker and a clock and is therefore the browser's problem; this module takes
 * the *results* of a run and decides what they do, which is why the whole
 * damage model can be played out headlessly.
 *
 * This module is pure: no canvas, no DOM, no timers, no randomness.
 */

import { LEVELS } from './levels.js';
import type { Case, Level, Value } from './levels.js';

export const RULES = {
  /**
   * Lives for the rung you are on, not for the whole run.
   *
   * They were for the whole run and that was wrong for what this is. Someone
   * relearning a language tries things; five wrong tries across four rungs is
   * nothing, so the run kept ending and restarting at the first rung and the
   * later ones were never reached at all. Going down now costs you the rung
   * you are on and nothing else — the rungs below stay cleared, and you are
   * put back at the top of the one that beat you.
   */
  lives: 3,
  /** A submit with anything wrong in it costs this, however much was wrong. */
  costOfBeingWrong: 1,
  /** Points for clearing a rung, and what each hint takes off the total. */
  perLevel: 100,
  perHint: 15,
  perDown: 25,
} as const;

export type Phase = 'writing' | 'resolving' | 'won' | 'down';

/** One case, after the code has been run against it. */
export interface Attempt {
  readonly parts: readonly number[];
  readonly want: Value;
  /** What came back, or null if it threw or never finished. */
  readonly got: Value | null;
  readonly error: string | null;
  readonly hit: boolean;
  /** Already solved on an earlier submit, so it lands nothing new. */
  readonly repeat: boolean;
}

export interface Game {
  level: number;
  lives: number;
  /** Which cases of the current rung are already down. */
  solved: boolean[];
  /** How many hints are showing on this rung, 0 to 3. */
  hintsShown: number;
  hintsTaken: number;
  cleared: number;
  /** How many times a rung has put him down. */
  downs: number;
  phase: Phase;
  /** The last submit, which is what the fight animates. */
  attempts: Attempt[];
  events: Event[];
}

export type Event =
  | { readonly kind: 'hit'; readonly index: number }
  | { readonly kind: 'hurt'; readonly index: number }
  | { readonly kind: 'broke'; readonly error: string }
  | { readonly kind: 'cleared'; readonly level: number }
  | { readonly kind: 'hint'; readonly depth: number }
  | { readonly kind: 'won' }
  | { readonly kind: 'down' };

export function levelAt(index: number): Level | undefined {
  return LEVELS[index];
}

export function levelCount(): number {
  return LEVELS.length;
}

export function createGame(): Game {
  const first = LEVELS[0];
  return {
    level: 0,
    lives: RULES.lives,
    solved: new Array<boolean>(first?.cases.length ?? 0).fill(false),
    hintsShown: 0,
    hintsTaken: 0,
    cleared: 0,
    downs: 0,
    phase: 'writing',
    attempts: [],
    events: [],
  };
}

/**
 * Two answers are the same answer.
 *
 * Deliberately strict about shape: a rung that asks for a list and is handed a
 * single number has not been answered, even when the number is right, and
 * saying so is most of what the early rungs teach.
 */
export function same(a: Value | null, b: Value | null): boolean {
  if (a === null || b === null) return false;
  const aList = Array.isArray(a);
  const bList = Array.isArray(b);
  if (aList !== bList) return false;
  if (!aList || !bList) return a === b;
  const x = a as readonly number[];
  const y = b as readonly number[];
  if (x.length !== y.length) return false;
  return x.every((n, i) => n === y[i]);
}

/** How much of the mirror is still standing, 0 to 1. */
export function standing(game: Game): number {
  if (game.solved.length === 0) return 0;
  const left = game.solved.filter((done) => !done).length;
  return left / game.solved.length;
}

export function score(game: Game): number {
  return Math.max(0, game.cleared * RULES.perLevel - game.hintsTaken * RULES.perHint - game.downs * RULES.perDown);
}

/**
 * Show one more hint on this rung.
 *
 * Hints never block and never cost a life: being stuck and unable to ask is
 * how someone stops playing a thing meant to teach them. They cost score, and
 * the result screen says how many were taken.
 */
export function takeHint(game: Game): boolean {
  const level = LEVELS[game.level];
  if (level === undefined || game.phase !== 'writing') return false;
  if (game.hintsShown >= level.hints.length) return false;
  game.hintsShown += 1;
  game.hintsTaken += 1;
  game.events.push({ kind: 'hint', depth: game.hintsShown });
  return true;
}

/** What the browser has to run, in the order the cases are in. */
export function casesOf(game: Game): readonly Case[] {
  return LEVELS[game.level]?.cases ?? [];
}

export interface RunResult {
  readonly value: Value | null;
  readonly error: string | null;
}

/**
 * Take the results of running the player's code and work out what happened.
 *
 * A case that was already down lands nothing new — otherwise resubmitting
 * working code would chip away at the mirror for free. Being wrong costs one
 * life per submit rather than one per case, so a first attempt that gets three
 * of four is progress rather than a mauling.
 */
export function resolve(game: Game, results: readonly RunResult[]): Game {
  game.events = [];
  const level = LEVELS[game.level];
  if (level === undefined || game.phase !== 'writing') return game;

  const attempts: Attempt[] = [];
  let wrong = false;

  level.cases.forEach((one, i) => {
    const result = results[i] ?? { value: null, error: 'nothing came back' };
    const already = game.solved[i] === true;
    const hit = result.error === null && same(result.value, one.want);

    attempts.push({
      parts: one.parts,
      want: one.want,
      got: result.value,
      error: result.error,
      hit,
      repeat: hit && already,
    });

    if (hit) {
      if (!already) {
        game.solved[i] = true;
        game.events.push({ kind: 'hit', index: i });
      }
      return;
    }

    wrong = true;
    game.events.push({ kind: 'hurt', index: i });
    if (result.error !== null) game.events.push({ kind: 'broke', error: result.error });
  });

  game.attempts = attempts;
  game.phase = 'resolving';

  if (wrong) game.lives -= RULES.costOfBeingWrong;

  if (game.lives <= 0) {
    game.lives = 0;
    game.downs += 1;
    game.phase = 'down';
    game.events.push({ kind: 'down' });
    return game;
  }

  if (game.solved.every((done) => done)) {
    game.cleared += 1;
    game.events.push({ kind: 'cleared', level: game.level });
  }

  return game;
}

/**
 * Put him back on his feet, at the top of the rung that beat him.
 *
 * Not back at the beginning. What is below him is cleared and stays cleared;
 * the only thing a rung takes when it wins is that rung.
 */
export function retry(game: Game): Game {
  if (game.phase !== 'down') return game;
  game.lives = RULES.lives;
  game.solved = new Array<boolean>(LEVELS[game.level]?.cases.length ?? 0).fill(false);
  game.hintsShown = 0;
  game.attempts = [];
  game.events = [];
  game.phase = 'writing';
  return game;
}

/**
 * Move on once the fight has finished playing out. Separate from `resolve`
 * because the rung has to stay on screen while its strikes are animating.
 */
export function advance(game: Game): Game {
  if (game.phase !== 'resolving') return game;

  if (!game.solved.every((done) => done)) {
    game.phase = 'writing';
    return game;
  }

  const next = game.level + 1;
  if (next >= LEVELS.length) {
    game.phase = 'won';
    game.events = [{ kind: 'won' }];
    return game;
  }

  game.level = next;
  game.solved = new Array<boolean>(LEVELS[next]?.cases.length ?? 0).fill(false);
  game.hintsShown = 0;
  game.attempts = [];
  game.phase = 'writing';
  return game;
}
