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

import { CHAPTERS, LEVELS } from '../../src/levels.js';
import { fits, readSignature } from '../../src/types.js';
import { clean } from '../../src/values.js';
import type { Value } from '../../src/values.js';
import {
  RULES,
  advance,
  casesOf,
  createGame,
  levelAt,
  levelCount,
  carryOn,
  resolve,
  retry,
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
  it('goes back to the desk after a submit that did not finish the rung', () => {
    const game = createGame();
    resolve(game, allWrong(game));
    expect(game.phase).toBe('resolving');
    carryOn(game);
    expect(game.level).toBe(0);
    expect(game.phase).toBe('writing');
  });

  it('stops on the rung it just cleared rather than slipping to the next', () => {
    const game = createGame();
    resolve(game, allRight(game));
    // Clearing is its own moment. Nothing moves until the player says so.
    expect(game.phase).toBe('cleared');
    expect(game.level).toBe(0);

    advance(game);
    expect(game.level).toBe(1);
    expect(game.phase).toBe('writing');
  });

  it('will not advance from anywhere but a cleared rung', () => {
    const game = createGame();
    resolve(game, allWrong(game));
    advance(game);
    expect(game.level).toBe(0);
  });

  it('starts each rung with all its lives, whatever the last one cost', () => {
    const game = createGame();
    resolve(game, allWrong(game));
    game.phase = 'writing';
    resolve(game, allRight(game));
    expect(game.lives).toBe(RULES.lives - 1);
    advance(game);
    expect(game.lives).toBe(RULES.lives);
  });

  it('can start on a later rung, for a player coming back to it', () => {
    const game = createGame(3);
    expect(game.level).toBe(3);
    expect(game.solved).toHaveLength(levelAt(3)?.cases.length ?? -1);
    expect(createGame(999).level).toBe(levelCount() - 1);
    expect(createGame(-5).level).toBe(0);
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
      expect(game.phase).toBe('cleared');
      advance(game);
    }
    expect(game.phase).toBe('won');
    expect(game.cleared).toBe(levelCount());
  });

  it('puts him down when the lives run out', () => {
    const game = createGame();
    for (let i = 0; i < RULES.lives; i += 1) {
      game.phase = 'writing';
      resolve(game, allWrong(game));
    }
    expect(game.phase).toBe('down');
    expect(game.lives).toBe(0);
    expect(game.downs).toBe(1);
  });

  it('stops dead once he is down', () => {
    const game = createGame();
    game.phase = 'down';
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

/**
 * Run a body the way the game does: strict, as the inside of a function whose
 * parameters are the ones the signature names. The arguments are copied first,
 * as the worker's are, so an answer that sorts its input in place cannot
 * change the ladder's own data under the next case.
 */
function runBody(params: readonly string[], body: string, args: readonly Value[]): Value | null {
  // Named `strike`, as it is in the worker, so a rung that calls itself can.
  const make = new Function(
    `"use strict";\nconst strike = function (${params.join(', ')}) {\n${body}\n};\nreturn strike;`,
  ) as () => (...given: unknown[]) => unknown;
  return clean(make()(...structuredClone(args)));
}

describe('every rung', () => {
  it('has two worked examples, hidden cases, three hints and a lesson', () => {
    for (const level of LEVELS) {
      expect(level.shown, level.id).toHaveLength(2);
      expect(level.cases.length, level.id).toBeGreaterThanOrEqual(4);
      expect(level.hints, level.id).toHaveLength(3);
      expect(level.signature, level.id).toContain('function strike');
      expect(level.lesson.en.length, level.id).toBeGreaterThan(0);
      expect(level.lesson.my.length, level.id).toBeGreaterThan(0);
      expect(CHAPTERS[level.chapter], level.id).toBeDefined();
    }
  });

  it('has its own id', () => {
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length);
  });

  it('comes in chapter order, with no chapter left empty', () => {
    const chapters = LEVELS.map((level) => level.chapter);
    expect([...chapters].sort((a, b) => a - b)).toEqual(chapters);
    CHAPTERS.forEach((_, c) => expect(chapters).toContain(c));
  });

  it('gives its answer as code, the same in both languages', () => {
    for (const level of LEVELS) {
      const answer = level.hints[level.hints.length - 1];
      expect(answer?.en, level.id).toBe(answer?.my);
    }
  });

  it('has a signature the game can read', () => {
    for (const level of LEVELS) {
      const sig = readSignature(level.signature);
      expect(sig.params.length, level.id).toBeGreaterThan(0);
      expect(sig.returns, `${level.id} returns ${sig.returnsText}`).not.toBeNull();
      for (const param of sig.params) expect(param.type, `${level.id} ${param.name}`).not.toBeNull();
    }
  });

  /**
   * The data keeps the signature's promises. A case whose wanted answer is the
   * wrong type would blame every correct answer for breaking a promise the
   * rung itself broke first.
   */
  it('asks for what its signature promises, and is called with what it says it takes', () => {
    for (const level of LEVELS) {
      const sig = readSignature(level.signature);
      for (const one of [...level.shown, ...level.cases]) {
        expect(fits(one.want, sig.returns), `${level.id} wants ${JSON.stringify(one.want)}`).toBe(true);
        // An optional parameter may be left out of a call, and only that.
        const required = sig.params.filter((p) => !p.optional).length;
        expect(one.args.length, level.id).toBeGreaterThanOrEqual(required);
        expect(one.args.length, level.id).toBeLessThanOrEqual(sig.params.length);
        one.args.forEach((arg, i) => {
          expect(fits(arg, sig.params[i]?.type ?? null), `${level.id} arg ${i}`).toBe(true);
        });
      }
    }
  });

  it('hides cases that are not just the worked examples again', () => {
    for (const level of LEVELS) {
      const shown = level.shown.map((one) => JSON.stringify(one.args));
      const fresh = level.cases.filter((one) => !shown.includes(JSON.stringify(one.args)));
      expect(fresh.length, level.id).toBeGreaterThanOrEqual(3);
    }
  });

  /**
   * The one that matters: each rung's own answer — the code its last hint
   * gives, exactly as a player would type it — run against every case. A rung
   * whose answer does not pass is unwinnable, and playing would only find it
   * by someone getting stuck on a correct solution.
   */
  it('can be solved by the answer its own last hint gives', () => {
    for (const level of LEVELS) {
      const sig = readSignature(level.signature);
      const params = sig.params.map((p) => p.name);
      const answer = level.hints[level.hints.length - 1]?.en ?? '';
      for (const one of [...level.shown, ...level.cases]) {
        const got = runBody(params, answer, one.args);
        expect(same(got, one.want), `${level.id} on ${JSON.stringify(one.args)} gave ${JSON.stringify(got)}`).toBe(
          true,
        );
      }
    }
  });

  it('can be solved the other way its lesson shows, too', () => {
    for (const level of LEVELS) {
      if (level.another === undefined) continue;
      const params = readSignature(level.signature).params.map((p) => p.name);
      for (const one of [...level.shown, ...level.cases]) {
        const got = runBody(params, level.another, one.args);
        expect(same(got, one.want), `${level.id} another way on ${JSON.stringify(one.args)}`).toBe(true);
      }
    }
  });

  it('is not already solved by what the box starts with', () => {
    for (const level of LEVELS) {
      const params = readSignature(level.signature).params.map((p) => p.name);
      const solved = level.cases.every((one) => {
        try {
          return same(runBody(params, level.starter, one.args), one.want);
        } catch {
          return false;
        }
      });
      expect(solved, level.id).toBe(false);
    }
  });
});

/**
 * Plausible wrong answers, each of which its rung must not let through. A
 * hidden case is there to spring a trap, and a trap that never springs is a
 * lesson the rung only claims to teach.
 */
const TRAPS: readonly (readonly [id: string, body: string, why: string])[] = [
  ['fallback', 'return parts[0] || -1;', '|| where ?? was needed, because 0 is not nothing'],
  [
    'biggest',
    'let best = 0;\nfor (const n of parts) if (n > best) best = n;\nreturn best;',
    'a biggest that starts at 0',
  ],
  ['between', 'return n > low && n < high;', 'an edge left out'],
  ['count', 'return parts.filter((n) => n >= 5).length;', 'a count that lets 5 in'],
  ['middle', 'return parts[parts.length / 2];', 'a middle that is not a whole number'],
  ['ends', 'return parts[0];', 'one number where a list was promised'],
  // Array methods
  ['above', 'return parts.filter((n) => n >= limit);', 'a limit that lets itself in'],
  ['firstbig', 'return parts.find((n) => n >= 10) ?? -1;', '10 counted as above 10'],
  ['sorted', 'return parts.sort();', 'sort with no comparison, which sorts as text'],
  ['unique', 'return new Set(parts);', 'a Set handed back where a list was promised'],
  [
    'chain',
    'return parts.filter((n) => n % 2 === 0).map((n) => n * 2).reduce((s, n) => s + n);',
    'reduce with nothing to start from',
  ],
  // Text
  ['initial', 'return word[0].toUpperCase();', 'indexing an empty string and calling on undefined'],
  ['letters', "return [...word].filter((ch) => ch === 'a').length;", 'a capital A left uncounted'],
  ['palindrome', "return word === word.split('').reverse().join('');", 'capitals compared as they are'],
  ['addup', 'return a + b;', '+ joining two strings instead of adding them'],
  ['label', 'return `${name}: ${hits} hits`;', 'one hit called hits'],
  // Things with names
  ['name', 'return f.nmae;', 'a field name spelt wrong'],
  ['strong', 'return crew.filter((f) => f.power >= 5);', 'a power of exactly 5 let in'],
  [
    'strongest',
    'let best = crew[0];\nfor (const f of crew) if (f.power >= best.power) best = f;\nreturn best.name;',
    'the second of two equals taken',
  ],
  [
    'strongest',
    "let best = { name: '', power: 0 };\nfor (const f of crew) if (f.power > best.power) best = f;\nreturn best.name;",
    'a strongest that starts at 0',
  ],
  ['totalpower', 'return crew.reduce((sum, f) => sum + f.power);', 'reduce starting from the first fighter'],
  [
    'tally',
    'const counts = {};\nfor (const m of moves) counts[m] += 1;\nreturn counts;',
    'undefined + 1 on a key not seen yet',
  ],
  // Shapes of things
  ['either', "return typeof guard === 'string' ? Number(guard) : guard;", "a word's digits read as its strength"],
  ['nickname', 'return f.nick || f.name;', '|| skipping an empty nickname'],
  [
    'path',
    "let x = 0;\nlet y = 0;\nfor (const d of path) {\n  switch (d) {\n    case 'up': y += 1;\n    case 'down': y -= 1;\n    case 'left': x -= 1;\n    case 'right': x += 1;\n  }\n}\nreturn [x, y];",
    'a switch with no breaks, falling through',
  ],
  [
    'area',
    "switch (shape.kind) {\n  case 'square': return shape.side * shape.side;\n  case 'rect': return shape.w * shape.h;\n  case 'triangle': return shape.base * shape.height;\n}",
    'a triangle not halved',
  ],
  ['swap', 'const [first, second, ...rest] = items;\nreturn [second, first, ...rest];', 'a list too short to swap'],
  ['what', 'return typeof thing;', "typeof calling a list 'object'"],
  // Moves of your own
  [
    'helper',
    'return [parts.filter((n) => n % 2 === 0).length, parts.filter((n) => n % 2 === 1).length];',
    'n % 2 === 1 missing the negative odd ones',
  ],
  ['twice', 'return (n * 3 - 1) * 2;', 'twice read as doubled'],
  ['times', 'return n * (times || 2);', '|| turning no times at all into twice'],
  [
    'running',
    'return parts.map((n) => {\n  let total = 0;\n  total += n;\n  return total;\n});',
    'a total that starts again on every call',
  ],
  [
    'combo',
    'const moves = { double: (x) => x * 2, inc: (x) => x + 1, square: (x) => x * x };\nlet power = 0;\nfor (const name of combo) power = moves[name](power);\nreturn power;',
    'a combo that ignores where it starts',
  ],
  // Himself again
  ['factorial', 'if (n === 1) return 1;\nreturn n * strike(n - 1);', 'a base case at 1 that 0 never reaches'],
  ['power', 'if (exp === 0) return 1;\nreturn base * strike(base - 1, exp - 1);', 'the wrong argument made smaller'],
  ['fib', 'if (n < 2) return 1;\nreturn strike(n - 1) + strike(n - 2);', 'the 0th counted as 1'],
  ['deepsum', 'return parts.flat().reduce((s, p) => s + p, 0);', 'one level flattened where any depth was promised'],
  ['flatten', 'return parts.flat();', 'flat with no depth, which is one level'],
  // Rows and columns
  ['rowsums', 'return grid.map((row) => row.reduce((sum, n) => sum + n));', 'an empty row with nothing to start from'],
  ['column', 'return grid[c];', 'a row taken where a column was asked for'],
  ['diagonal', 'return grid.map((row) => row[0]);', 'the first column taken for the diagonal'],
  ['transpose', 'return grid[0].map((_, c) => grid.map((row) => row[c]));', 'an empty grid with no first row'],
  [
    'neighbours',
    'let count = 0;\nfor (let dr = -1; dr <= 1; dr += 1) {\n  for (let dc = -1; dc <= 1; dc += 1) {\n    if (dr === 0 && dc === 0) continue;\n    if (grid[r + dr][c + dc] === 1) count += 1;\n  }\n}\nreturn count;',
    'reaching past an edge without ?.',
  ],
  [
    'neighbours',
    'let count = 0;\nfor (let dr = -1; dr <= 1; dr += 1) {\n  for (let dc = -1; dc <= 1; dc += 1) {\n    if (grid[r + dr]?.[c + dc] === 1) count += 1;\n  }\n}\nreturn count;',
    'the cell itself counted',
  ],
];

/** Whether a body gets every hidden case of a rung right. */
function beats(id: string, body: string): boolean {
  const level = LEVELS.find((one) => one.id === id);
  if (level === undefined) throw new Error(`no rung ${id}`);
  const params = readSignature(level.signature).params.map((p) => p.name);
  return level.cases.every((one) => {
    try {
      return same(runBody(params, body, one.args), one.want);
    } catch {
      return false;
    }
  });
}

describe('the traps the hidden cases are there to spring', () => {
  for (const [id, body, why] of TRAPS) {
    it(`catches ${why} (${id})`, () => {
      expect(beats(id, body)).toBe(false);
    });
  }
});

describe('being put down', () => {
  /** Lose the rung the player is standing on. */
  function knockDown(game: Game): void {
    for (let i = 0; i < RULES.lives; i += 1) {
      game.phase = 'writing';
      resolve(game, allWrong(game));
    }
  }

  it('costs the rung you are on and nothing below it', () => {
    const game = createGame();
    resolve(game, allRight(game));
    advance(game);
    expect(game.level).toBe(1);
    expect(game.cleared).toBe(1);

    knockDown(game);
    retry(game);

    // Still on the second rung, with the first still counted.
    expect(game.level).toBe(1);
    expect(game.cleared).toBe(1);
    expect(game.phase).toBe('writing');
  });

  it('puts him back on his feet with the rung standing again', () => {
    const game = createGame();
    const partial = casesOf(game).map((one, i) => ({ value: i === 0 ? one.want : -1, error: null }));
    resolve(game, partial);
    expect(game.solved[0]).toBe(true);

    knockDown(game);
    retry(game);
    expect(game.lives).toBe(RULES.lives);
    expect(game.solved.every((d) => !d)).toBe(true);
    expect(game.hintsShown).toBe(0);
  });

  it('can be played on from, rather than ending the run', () => {
    const game = createGame();
    knockDown(game);
    retry(game);
    resolve(game, allRight(game));
    advance(game);
    expect(game.level).toBe(1);
  });

  it('does nothing unless he is actually down', () => {
    const game = createGame();
    game.lives = 1;
    retry(game);
    expect(game.lives).toBe(1);
  });

  it('is counted, and costs score', () => {
    const clean = createGame();
    resolve(clean, allRight(clean));
    advance(clean);

    const bruised = createGame();
    knockDown(bruised);
    retry(bruised);
    resolve(bruised, allRight(bruised));
    advance(bruised);

    expect(bruised.downs).toBe(1);
    expect(bruised.cleared).toBe(clean.cleared);
    expect(score(bruised)).toBeLessThan(score(clean));
  });
});
