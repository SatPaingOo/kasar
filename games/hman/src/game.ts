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
import type { Case, Level } from './levels.js';
import { same, show } from './values.js';
import type { Value } from './values.js';

export { same };

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

/**
 * `cleared` is its own state, not a step inside advancing.
 *
 * Beating a rung used to move straight on to the next one, quietly, between
 * two frames — so the player saw the desk change and nothing else, and could
 * not tell whether anything had happened at all. Winning a rung is the only
 * reward this game has. It gets a state of its own, which the mirror falls
 * over in and the player leaves by choosing to.
 */
export type Phase = 'writing' | 'resolving' | 'cleared' | 'won' | 'down';

/** One case, after the code has been run against it. */
export interface Attempt {
  readonly args: readonly Value[];
  readonly want: Value;
  /** What came back, or null if it threw, never finished, or was not a value. */
  readonly got: Value | null;
  /** How what came back reads on screen, whatever it was. */
  readonly seen: string;
  /** Its type, in TypeScript's words. */
  readonly type: string;
  readonly error: string | null;
  /** The line of the box it threw on, when the engine said. */
  readonly line: number | null;
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

/** A run, starting on any rung — the first, or one already reached. */
export function createGame(start: number = 0): Game {
  const level = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(start)));
  const first = LEVELS[level];
  return {
    level,
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

/** A rough type for a result that arrived without one — only ever in tests. */
function kindOf(value: Value | null): string {
  if (value === null) return 'undefined';
  if (Array.isArray(value)) return 'list';
  return typeof value;
}

/** What the browser has to run, in the order the cases are in. */
export function casesOf(game: Game): readonly Case[] {
  return LEVELS[game.level]?.cases ?? [];
}

export interface RunResult {
  readonly value: Value | null;
  readonly error: string | null;
  /** How it reads on screen. Worked out from `value` when it is missing. */
  readonly seen?: string;
  /** Its type, in TypeScript's words. Worked out from `value` when missing. */
  readonly type?: string;
  /** The line of the box it threw on. */
  readonly line?: number;
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
      args: one.args,
      want: one.want,
      got: result.value,
      seen: result.seen ?? (result.value === null ? 'undefined' : show(result.value)),
      type: result.type ?? kindOf(result.value),
      error: result.error,
      line: result.line ?? null,
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
    game.phase = 'cleared';
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
 * Back to the desk after a submit that did not finish the rung. Separate from
 * `resolve` because the rung has to stay on screen while its blows play.
 */
export function carryOn(game: Game): Game {
  if (game.phase !== 'resolving') return game;
  game.phase = 'writing';
  return game;
}

/** Whether there is another rung after this one. */
export function hasNext(game: Game): boolean {
  return game.level + 1 < LEVELS.length;
}

/**
 * Step up to the next rung. Only from `cleared`, and only when the player
 * says so, because this is the one moment worth making them notice.
 */
export function advance(game: Game): Game {
  if (game.phase !== 'cleared') return game;

  const next = game.level + 1;
  if (next >= LEVELS.length) {
    game.phase = 'won';
    game.events = [{ kind: 'won' }];
    return game;
  }

  game.level = next;
  // Lives belong to the rung, so a new rung gets them all back. It used to
  // carry over whatever the last rung had left, which made one bad rung cost
  // the next one too.
  game.lives = RULES.lives;
  game.solved = new Array<boolean>(LEVELS[next]?.cases.length ?? 0).fill(false);
  game.hintsShown = 0;
  game.attempts = [];
  game.phase = 'writing';
  return game;
}
