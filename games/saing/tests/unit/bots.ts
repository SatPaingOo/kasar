/**
 * Players made of numbers, for settling the balance headlessly.
 *
 * Each one plays the whole piece against the real rules on a simulated
 * clock: frames every sixtieth of a second, strikes handed over when they
 * happen, and the music moved on in between — the same order of calls the
 * page makes.
 */

import { createGame, drumsAt, noteTime, step, strike } from '../../src/game.js';
import type { Game, Grade, Rand } from '../../src/game.js';

/** A small seeded generator, so a run can be played again exactly. */
export function seeded(seed: number): Rand {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A normal draw, for the spread of a human hand. */
function gauss(rand: Rand): number {
  const u = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export interface Hands {
  /** How late every strike is, in seconds: the screen, the speaker, the player. */
  readonly lateness: number;
  /** How far either way a strike wanders, one standard deviation, in seconds. */
  readonly jitter: number;
  /**
   * How many notes of a phrase are remembered the first time it is heard,
   * and how many more each time it comes round again. Unset: all of them.
   * Past what is remembered, the drum is a guess — the rhythm is still kept.
   */
  readonly memory?: number;
  readonly learns?: number;
}

export interface Run {
  readonly finished: boolean;
  readonly kept: number;
  readonly score: number;
  readonly grades: Record<Grade, number>;
  readonly seconds: number;
}

const FRAME = 1 / 60;
const LIMIT = 1800;

function result(game: Game, seconds: number): Run {
  return {
    finished: game.outcome === 'finished',
    kept: game.kept,
    score: game.score,
    grades: { ...game.grades },
    seconds,
  };
}

/** Play a whole piece with a pair of hands, and a memory if one is given. */
export function play(seed: number, hands: Hands): Run {
  const rand = seeded(seed);
  const game = createGame(seeded(seed * 7919 + 1), 0);
  const planned = new Set<number>();
  const heard = new Map<number, number>();
  let taps: { at: number; drum: number }[] = [];

  let time = 0;
  while (game.outcome === 'playing' && time < LIMIT) {
    time += FRAME;
    const answer = game.answer;
    if (answer !== null && answer.state === 'open' && !planned.has(answer.start)) {
      planned.add(answer.start);
      const times = heard.get(answer.round) ?? 0;
      heard.set(answer.round, times + 1);
      const notes = game.piece[answer.round]?.notes ?? [];
      const known = hands.memory === undefined ? Infinity : hands.memory + (hands.learns ?? 0) * times;
      const n = drumsAt(game, answer.start);
      let previous = -Infinity;
      taps = notes.map((note, i) => {
        let at = noteTime(game, answer, i) + hands.lateness + gauss(rand) * hands.jitter;
        // A hand cannot strike two notes in the wrong order, however it wanders.
        at = Math.max(at, previous + 0.02);
        previous = at;
        const drum = i < known ? note.drum : Math.floor(rand() * n);
        return { at, drum };
      });
    }
    while (taps.length > 0 && (taps[0]?.at ?? Infinity) <= time) {
      const tap = taps.shift();
      if (tap !== undefined) strike(game, tap.drum, tap.at);
      // A broken phrase is played again from the call; the rest of these
      // strikes belong to an answer that is over.
      if (game.answer !== null && game.answer.state === 'open' && !planned.has(game.answer.start)) taps = [];
    }
    step(game, time);
  }
  return result(game, time);
}

/** Strikes at random, on random drums, about `rate` times a second. */
export function flail(seed: number, rate = 2): Run {
  const rand = seeded(seed);
  const game = createGame(seeded(seed * 7919 + 1), 0);
  let time = 0;
  let next = 0.5;
  while (game.outcome === 'playing' && time < LIMIT) {
    time += FRAME;
    while (next <= time) {
      strike(game, Math.floor(rand() * drumsAt(game, next)), next);
      next += -Math.log(Math.max(1e-9, rand())) / rate;
    }
    step(game, time);
  }
  return result(game, time);
}

/**
 * Knows every phrase by heart and ignores the rhythm: starts on the beat and
 * then plays the rest as fast as a hand can. The memory game this grew from
 * would let it win.
 */
export function rush(seed: number): Run {
  const game = createGame(seeded(seed * 7919 + 1), 0);
  const planned = new Set<number>();
  let taps: { at: number; drum: number }[] = [];
  let time = 0;
  while (game.outcome === 'playing' && time < LIMIT) {
    time += FRAME;
    const answer = game.answer;
    if (answer !== null && answer.state === 'open' && !planned.has(answer.start)) {
      planned.add(answer.start);
      const notes = game.piece[answer.round]?.notes ?? [];
      taps = notes.map((note, i) => ({ at: answer.start + i * 0.12, drum: note.drum }));
    }
    while (taps.length > 0 && (taps[0]?.at ?? Infinity) <= time) {
      const tap = taps.shift();
      if (tap !== undefined) strike(game, tap.drum, tap.at);
    }
    step(game, time);
  }
  return result(game, time);
}
