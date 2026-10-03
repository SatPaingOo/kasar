/**
 * The rules, headlessly.
 *
 * Nothing here runs the player's code — that needs a worker and a clock and is
 * the browser's problem. This module takes the results of a run and decides
 * what they do, which is exactly the part worth checking.
 *
 * The last block is the one that matters most: it runs each rung's own answer
 * against its own hidden cases. A rung whose stated answer does not pass is
 * unwinnable, and that is a bug no amount of playing would reliably catch.
 */

import { describe, expect, it } from 'vitest';

import { LEVELS } from '../../src/levels.js';
import {
  RULES,
  advance,
  casesOf,
  createGame,
  levelAt,
  levelCount,
  resolve,
  same,
  score,
  standing,
  takeHint,
} from '../../src/game.js';
import type { Game, RunResult } from '../../src/game.js';

/** Results that answer every case correctly. */
function allRight(game: Game): RunResult[] {
  return casesOf(game).map((one) => ({ value: one.want, error: null }));
}

/** Results that answer none of them. */
function allWrong(game: Game): RunResult[] {
  return casesOf(game).map(() => ({ value: -999, error: null }));
}

describe('comparing an answer', () => {
  it('accepts the same number and the same list', () => {
    expect(same(4, 4)).toBe(true);
    expect(same([1, 2], [1, 2])).toBe(true);
  });

  it('refuses a right number in the wrong shape', () => {
    // A rung that asked for a list has not been answered by a bare number,
    // and saying so is most of what the early rungs teach.
    expect(same(4, [4])).toBe(false);
    expect(same([4], 4)).toBe(false);
  });

  it('refuses a list of the wrong length or the wrong order', () => {
    expect(same([1, 2], [1, 2, 3])).toBe(false);
    expect(same([1, 2], [2, 1])).toBe(false);
  });

  it('refuses nothing at all', () => {
    expect(same(null, 4)).toBe(false);
    expect(same(4, null)).toBe(false);
  });
});

describe('a submit', () => {
  it('takes down the cases it got right', () => {
    const game = createGame();
    resolve(game, allRight(game));
    expect(game.solved.every((d) => d)).toBe(true);
    expect(standing(game)).toBe(0);
  });

  it('costs one life however many cases were wrong', () => {
    const game = createGame();
    resolve(game, allWrong(game));
    expect(game.lives).toBe(RULES.lives - 1);
  });

  it('keeps what was already right, so a fix is not a fresh start', () => {
    const game = createGame();
    const cases = casesOf(game);
    const partial: RunResult[] = cases.map((one, i) => ({
      value: i < 2 ? one.want : -1,
      error: null,
    }));
    resolve(game, partial);
    expect(game.solved.filter((d) => d)).toHaveLength(2);
    expect(game.lives).toBe(RULES.lives - 1);

    game.phase = 'writing';
    resolve(game, allRight(game));
    expect(game.solved.every((d) => d)).toBe(true);
    // Only the two that were still standing landed the second time.
    expect(game.events.filter((e) => e.kind === 'hit')).toHaveLength(2);
  });

  it('lands nothing new for work already done', () => {
    const game = createGame();
    resolve(game, allRight(game));
    game.phase = 'writing';
    resolve(game, allRight(game));
    expect(game.events.filter((e) => e.kind === 'hit')).toHaveLength(0);
    expect(game.attempts.every((a) => a.repeat)).toBe(true);
  });

  it('reports code that threw rather than silently counting it wrong', () => {
    const game = createGame();
    const thrown = casesOf(game).map(() => ({ value: null, error: 'x is not defined' }));
    resolve(game, thrown);
    expect(game.events.some((e) => e.kind === 'broke')).toBe(true);
    expect(game.attempts[0]?.error).toBe('x is not defined');
  });

  it('survives fewer results than cases', () => {
    const game = createGame();
    resolve(game, []);
    expect(game.attempts).toHaveLength(casesOf(game).length);
    expect(game.phase).toBe('resolving');
  });
});

describe('the run', () => {
  it('moves to the next rung only once the one below is clear', () => {
    const game = createGame();
    resolve(game, allWrong(game));
    advance(game);
    expect(game.level).toBe(0);
    expect(game.phase).toBe('writing');

    resolve(game, allRight(game));
    advance(game);
    expect(game.level).toBe(1);
  });

  it('starts each rung with its own cases standing and no hints showing', () => {
    const game = createGame();
    takeHint(game);
    resolve(game, allRight(game));
    advance(game);
    expect(game.hintsShown).toBe(0);
    expect(game.solved.every((d) => !d)).toBe(true);
    const second = levelAt(1);
    expect(second).toBeDefined();
    expect(game.solved).toHaveLength(second?.cases.length ?? -1);
  });

  it('is won by clearing the last rung', () => {
    const game = createGame();
    for (let i = 0; i < levelCount(); i += 1) {
      resolve(game, allRight(game));
      advance(game);
    }
    expect(game.phase).toBe('won');
    expect(game.cleared).toBe(levelCount());
  });

  it('is lost when the lives run out', () => {
    const game = createGame();
    for (let i = 0; i < RULES.lives; i += 1) {
      game.phase = 'writing';
      resolve(game, allWrong(game));
    }
    expect(game.phase).toBe('lost');
    expect(game.lives).toBe(0);
  });

  it('stops dead once it is over', () => {
    const game = createGame();
    game.phase = 'lost';
    resolve(game, allRight(game));
    expect(game.solved.every((d) => !d)).toBe(true);
  });
});

describe('hints', () => {
  it('come one at a time and run out', () => {
    const game = createGame();
    const available = levelAt(0)?.hints.length ?? 0;
    for (let i = 0; i < available; i += 1) expect(takeHint(game)).toBe(true);
    expect(takeHint(game)).toBe(false);
    expect(game.hintsShown).toBe(available);
  });

  it('never cost a life, because being stuck and unable to ask ends the run', () => {
    const game = createGame();
    takeHint(game);
    takeHint(game);
    expect(game.lives).toBe(RULES.lives);
  });

  it('cost score instead, and the total never goes below nothing', () => {
    const game = createGame();
    resolve(game, allRight(game));
    advance(game);
    const clean = score(game);

    const helped = createGame();
    for (let i = 0; i < 3; i += 1) takeHint(helped);
    resolve(helped, allRight(helped));
    advance(helped);
    expect(score(helped)).toBeLessThan(clean);
    expect(score(helped)).toBeGreaterThanOrEqual(0);

    const hopeless = createGame();
    hopeless.hintsTaken = 999;
    expect(score(hopeless)).toBe(0);
  });

  it('cannot be asked for in the middle of a fight', () => {
    const game = createGame();
    resolve(game, allWrong(game));
    expect(takeHint(game)).toBe(false);
  });
});

describe('every rung', () => {
  it('has two worked examples, hidden cases and three hints', () => {
    for (const level of LEVELS) {
      expect(level.shown).toHaveLength(2);
      expect(level.cases.length).toBeGreaterThanOrEqual(3);
      expect(level.hints).toHaveLength(3);
      expect(level.signature).toContain('function strike');
    }
  });

  it('asks for the shape its signature promises', () => {
    for (const level of LEVELS) {
      const wantsList = level.signature.includes('): number[]');
      for (const one of [...level.shown, ...level.cases]) {
        expect(Array.isArray(one.want)).toBe(wantsList);
      }
    }
  });

  /**
   * The one that matters: each rung's own stated answer, run against its own
   * hidden cases. A rung whose answer does not pass is unwinnable, and playing
   * would only find it by someone getting stuck on a correct solution.
   */
  it('can be solved by the answer its own last hint gives', () => {
    const answers: Readonly<Record<string, (parts: readonly number[]) => unknown>> = {
      value: (parts) => parts[0],
      reach: (parts) => (parts[0] ?? 0) + (parts[parts.length - 1] ?? 0),
      choose: (parts) => ((parts[0] ?? 0) > (parts[1] ?? 0) ? parts[0] : parts[1]),
      every: (parts) => parts.map((n) => n * 2),
    };

    for (const level of LEVELS) {
      const answer = answers[level.id];
      expect(answer, `no answer written for rung ${level.id}`).toBeDefined();
      if (answer === undefined) continue;
      for (const one of [...level.shown, ...level.cases]) {
        expect(same(answer(one.parts) as never, one.want), `${level.id} failed on [${one.parts.join(', ')}]`).toBe(
          true,
        );
      }
    }
  });
});
