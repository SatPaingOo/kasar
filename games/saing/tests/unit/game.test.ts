/**
 * The rules, headlessly. `game.ts` is pure, takes its randomness as an
 * argument and its time as a number, so every one of these is deterministic
 * without a clock or a speaker.
 */

import { describe, expect, it } from 'vitest';

import {
  RULES,
  bestPossible,
  compose,
  createGame,
  drumsAt,
  hear,
  noteTime,
  restart,
  spanAt,
  spanEnd,
  step,
  strike,
  windowOf,
} from '../../src/game.js';
import type { Answer, Game } from '../../src/game.js';
import { seeded } from './bots.js';

const fresh = (seed = 1): Game => createGame(seeded(seed), 0);

function open(game: Game): Answer {
  const answer = game.answer;
  if (answer === null || answer.state !== 'open') throw new Error('no answer open');
  return answer;
}

/** Strike every note of the open answer, `late` seconds after its beat. */
function answerIt(game: Game, late = 0): void {
  const answer = open(game);
  const notes = game.piece[answer.round]?.notes ?? [];
  notes.forEach((note, i) => {
    const at = noteTime(game, answer, i) + late;
    step(game, at);
    strike(game, note.drum, at);
  });
}

describe('the piece', () => {
  const pieces = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => compose(seeded(seed)));

  it('has one round for every phrase length in every section', () => {
    const rounds = RULES.sections.reduce((sum, s) => sum + s.to - s.from + 1, 0);
    for (const piece of pieces) expect(piece).toHaveLength(rounds);
  });

  it('grows by one beat a round, each phrase the last one with something on the end', () => {
    for (const piece of pieces) {
      piece.forEach((round, i) => {
        const before = piece[i - 1];
        if (before === undefined || before.section !== round.section) return;
        expect(round.beats).toBe(before.beats + 1);
        expect(round.notes.slice(0, before.notes.length)).toEqual(before.notes);
        expect(round.notes.length).toBeGreaterThan(before.notes.length);
      });
    }
  });

  it('uses only the drums in the circle, and starts every phrase on its first beat', () => {
    for (const piece of pieces) {
      for (const round of piece) {
        const drums = RULES.sections[round.section]?.drums ?? 0;
        for (const note of round.notes) {
          expect(note.drum).toBeGreaterThanOrEqual(0);
          expect(note.drum).toBeLessThan(drums);
          expect(note.beat).toBeLessThan(round.beats);
        }
        expect(round.notes[0]?.beat).toBe(0);
      }
    }
  });

  it('plays a drum that has just joined in the first phrase it is in', () => {
    for (const piece of pieces) {
      piece.forEach((round, i) => {
        if (i === 0 || piece[i - 1]?.section === round.section) return;
        const newest = (RULES.sections[round.section]?.drums ?? 0) - 1;
        expect(round.notes.some((note) => note.drum === newest)).toBe(true);
      });
    }
  });

  it('never plays the same drum three times running', () => {
    for (const piece of pieces) {
      for (const round of piece) {
        for (let i = 2; i < round.notes.length; i += 1) {
          const [a, b, c] = [round.notes[i - 2], round.notes[i - 1], round.notes[i]];
          expect(a?.drum === b?.drum && b?.drum === c?.drum).toBe(false);
        }
      }
    }
  });

  it('never splits the first beat, and never two beats in a row', () => {
    for (const piece of pieces) {
      for (const round of piece) {
        const split = new Set(round.notes.filter((n) => n.beat % 1 !== 0).map((n) => Math.floor(n.beat)));
        expect(split.has(0)).toBe(false);
        for (const b of split) expect(split.has(b + 1)).toBe(false);
      }
    }
  });

  it('comes out the same from the same random numbers', () => {
    expect(compose(seeded(42))).toEqual(compose(seeded(42)));
    expect(compose(seeded(42))).not.toEqual(compose(seeded(43)));
  });
});

describe('the music', () => {
  it('counts in, then calls, then waits for the answer, back to back', () => {
    const game = fresh();
    const [count, call, answer] = game.spans;
    expect(count?.kind).toBe('count');
    expect(count?.beats).toBe(RULES.countIn);
    expect(call?.kind).toBe('call');
    expect(answer?.kind).toBe('answer');
    expect(call?.start).toBeCloseTo(spanEnd(count!));
    expect(answer?.start).toBeCloseTo(spanEnd(call!));
    // The call and the answer each leave a beat of rest after the phrase.
    expect(call?.beats).toBe((game.piece[0]?.beats ?? 0) + RULES.tail);
    expect(game.answer?.start).toBe(answer?.start);
  });

  it('keeps every beat with the bell and starts every phrase on the clapper', () => {
    const game = fresh();
    const call = game.spans[1]!;
    const cues = hear(game, spanEnd(game.spans[2]!));
    const ticks = cues.filter((c) => c.kind !== 'drum');
    const beats = game.spans.slice(0, 3).reduce((sum, s) => sum + s.beats, 0);
    expect(ticks).toHaveLength(beats);
    const claps = ticks.filter((c) => c.kind === 'wa').map((c) => c.at);
    expect(claps).toEqual(game.spans.slice(0, 3).map((s) => s.start));

    const drums = cues.filter((c) => c.kind === 'drum');
    const notes = game.piece[0]?.notes ?? [];
    expect(drums.map((c) => (c.kind === 'drum' ? c.drum : -1))).toEqual(notes.map((n) => n.drum));
    expect(drums.map((c) => c.at)).toEqual(notes.map((n) => call.start + n.beat * call.beat));
  });

  it('hands each cue over once, however the asking is cut up', () => {
    const whole = fresh(5);
    const pieces = fresh(5);
    const end = spanEnd(whole.spans[2]!);
    const all = hear(whole, end);
    const bits = [];
    for (let t = 0.05; t < end + 0.1; t += 0.07) bits.push(...hear(pieces, t));
    expect(bits).toEqual(all);
    expect(hear(whole, end)).toEqual([]);
  });

  it('calls nothing in the answer: the player plays it', () => {
    const game = fresh();
    const answer = game.spans[2]!;
    hear(game, answer.start);
    const during = hear(game, spanEnd(answer));
    expect(during.every((c) => c.kind !== 'drum')).toBe(true);
  });
});

describe('playing it back', () => {
  it('keeps a phrase struck right on the beat, scores it, and calls the next one after the rest', () => {
    const game = fresh();
    const answer = open(game);
    const notes = game.piece[0]?.notes.length ?? 0;
    answerIt(game);
    expect(answer.state).toBe('kept');
    expect(game.kept).toBe(1);
    expect(game.round).toBe(1);
    expect(game.grades.on).toBe(notes);
    expect(game.score).toBe(notes * RULES.points.on + RULES.points.kept);
    const next = open(game);
    expect(next.round).toBe(1);
    // The next call starts when the answer's rest is over, not straight away.
    const call = game.spans.find((s) => s.kind === 'call' && s.round === 1)!;
    expect(call.start).toBeCloseTo(answer.start + ((game.piece[0]?.beats ?? 0) + RULES.tail) * answer.beat);
  });

  it('breaks on the wrong drum, costs a life, and brings the same phrase round after a breath', () => {
    const game = fresh();
    const answer = open(game);
    const first = game.piece[0]!.notes[0]!;
    const at = noteTime(game, answer, 0) + 0.01;
    step(game, at);
    strike(game, (first.drum + 1) % 3, at);
    expect(answer.state).toBe('broken');
    expect(game.lives).toBe(RULES.lives - 1);
    expect(game.events.at(-1)).toMatchObject({ kind: 'broken', why: 'wrong', expected: first.drum });

    // The answer stops on the next beat line, and a breath starts there.
    const cut = game.spans.find((s) => s.kind === 'answer')!;
    expect(cut.beats).toBe(1);
    const breath = game.spans.find((s) => s.kind === 'breath')!;
    expect(breath.start).toBeCloseTo(answer.start + answer.beat);
    expect(breath.beats).toBe(RULES.breath);
    const again = open(game);
    expect(again.round).toBe(0);
    expect(game.spans.find((s) => s.kind === 'call' && s.start > breath.start)?.start).toBeCloseTo(spanEnd(breath));
  });

  it('breaks on the right drum struck far too soon', () => {
    const game = fresh();
    const answer = open(game);
    const [one, two] = game.piece[0]!.notes;
    strike(game, one!.drum, noteTime(game, answer, 0));
    // The second note straight after the first, not a beat later.
    strike(game, two!.drum, noteTime(game, answer, 0) + 0.1);
    expect(game.events.at(-1)).toMatchObject({ kind: 'broken', why: 'rushed' });
  });

  it('breaks when nothing is struck, once the window and the grace have passed', () => {
    const game = fresh();
    const answer = open(game);
    const window = windowOf(game, answer, 0);
    step(game, window.to + RULES.grace * 0.5);
    expect(answer.state).toBe('open');
    step(game, window.to + RULES.grace * 1.5);
    expect(answer.state).toBe('broken');
    expect(game.events.at(-1)).toMatchObject({ kind: 'broken', why: 'missed', drum: null });
  });

  it('judges a strike by when it landed, even if the frame came after the window shut', () => {
    const game = fresh();
    const answer = open(game);
    const window = windowOf(game, answer, 0);
    step(game, window.to + RULES.grace * 0.8);
    strike(game, game.piece[0]!.notes[0]!.drum, window.to - 0.01);
    expect(answer.state).toBe('open');
    expect(answer.next).toBe(1);
  });

  it('lets anything be struck while the call plays, wrong drums too', () => {
    const game = fresh();
    const call = game.spans[1]!;
    for (let k = 0; k < 6; k += 1) strike(game, k % 3, call.start + k * 0.2);
    expect(game.lives).toBe(RULES.lives);
    expect(game.events.every((e) => e.kind === 'stray')).toBe(true);
    expect(open(game).next).toBe(0);
  });

  it('counts a first note struck a shade early, while the call is still in its rest', () => {
    const game = fresh();
    const answer = open(game);
    const at = answer.start - 0.08;
    expect(spanAt(game, at)?.kind).toBe('call');
    strike(game, game.piece[0]!.notes[0]!.drum, at);
    expect(answer.next).toBe(1);
  });

  it('stops the circle after the last life', () => {
    const game = fresh();
    for (let k = 0; k < RULES.lives; k += 1) {
      const answer = open(game);
      const window = windowOf(game, answer, 0);
      step(game, window.to + 1);
    }
    expect(game.outcome).toBe('stopped');
    expect(game.lives).toBe(0);
    expect(game.events.at(-1)).toEqual({ kind: 'stopped' });
    expect(hear(game, 1e6)).toEqual([]);
  });

  it('brings a drum in at the new tempo when a section ends, and calls its first phrase after', () => {
    const game = fresh();
    const lastOfFirst = RULES.sections[0].to - RULES.sections[0].from;
    for (let r = 0; r <= lastOfFirst; r += 1) answerIt(game);
    const join = game.spans.find((s) => s.kind === 'join')!;
    expect(join.round).toBe(lastOfFirst + 1);
    expect(join.beat).toBeCloseTo(60 / RULES.sections[1].bpm);
    expect(drumsAt(game, join.start - 0.01)).toBe(RULES.sections[0].drums);
    expect(drumsAt(game, join.start)).toBe(RULES.sections[1].drums);
    const cues = hear(game, spanEnd(join)).filter((c) => c.at >= join.start);
    expect(cues.filter((c) => c.kind === 'drum').map((c) => (c.kind === 'drum' ? c.drum : -1))).toEqual([
      RULES.sections[1].drums - 1,
      RULES.sections[1].drums - 1,
    ]);
    expect(open(game).start).toBeCloseTo(spanEnd(join) + (game.piece[join.round]!.beats + RULES.tail) * join.beat);
  });

  it('finishes when the last phrase is played back', () => {
    const game = fresh();
    while (game.outcome === 'playing') answerIt(game);
    expect(game.outcome).toBe('finished');
    expect(game.kept).toBe(game.piece.length);
    expect(game.score).toBe(bestPossible(game.piece));
    expect(game.events.at(-1)).toEqual({ kind: 'finished' });
  });

  it('starts the round again from a count after a pause, and it costs nothing', () => {
    const game = fresh();
    const answer = open(game);
    strike(game, game.piece[0]!.notes[0]!.drum, noteTime(game, answer, 0));
    restart(game, answer.start + 0.3);
    const count = spanAt(game, answer.start + 0.31)!;
    expect(count.kind).toBe('count');
    expect(count.start).toBeCloseTo(answer.start + 0.3);
    const again = open(game);
    expect(again.next).toBe(0);
    expect(again.start).toBeGreaterThan(spanEnd(count));
    expect(game.lives).toBe(RULES.lives);
  });
});

describe('the lag', () => {
  it('learns a steady player who is steadily late, and stops marking them down for it', () => {
    const game = fresh();
    const late = 0.15;
    const grades: string[] = [];
    for (let r = 0; r < 4; r += 1) {
      answerIt(game, late);
      grades.push(...game.events.filter((e) => e.kind === 'hit').map((e) => (e.kind === 'hit' ? e.grade : '')));
      game.events = [];
    }
    expect(game.lag).toBeCloseTo(late, 1);
    expect(grades.slice(0, 2)).not.toContain('on');
    expect(grades.slice(-4).every((g) => g === 'on')).toBe(true);
  });

  it('never learns past its bounds, however late the strikes come', () => {
    const game = fresh();
    // Every strike as late as its window allows, so the guess is dragged
    // later every time it is accepted.
    for (let r = 0; r < 6 && game.outcome === 'playing'; r += 1) {
      const answer = open(game);
      const notes = game.piece[answer.round]!.notes;
      for (let i = 0; i < notes.length; i += 1) {
        const at = windowOf(game, answer, i).to - 0.001;
        step(game, at);
        strike(game, notes[i]!.drum, at);
      }
      expect(answer.state).toBe('kept');
    }
    expect(game.lag).toBeGreaterThan(RULES.lag.most - 0.02);
    expect(game.lag).toBeLessThanOrEqual(RULES.lag.most);
  });

  it('centres the window on the beat as this player hears it', () => {
    const game = fresh();
    const answer = open(game);
    const plain = windowOf(game, answer, 1);
    game.lag = 0.1;
    const lagged = windowOf(game, answer, 1);
    expect(lagged.from - plain.from).toBeCloseTo(0.1);
    expect(lagged.to - plain.to).toBeCloseTo(0.1);
  });

  it('gives every note a window that stops short of its neighbours', () => {
    for (const seed of [1, 2, 3]) {
      const game = fresh(seed);
      while (game.outcome === 'playing') {
        const answer = open(game);
        const n = game.piece[answer.round]!.notes.length;
        for (let i = 0; i + 1 < n; i += 1) {
          // A strike in this note's window can never be meant for the next
          // one, nor one in the next one's for this.
          expect(windowOf(game, answer, i).to).toBeLessThan(noteTime(game, answer, i + 1) + game.lag);
          expect(windowOf(game, answer, i + 1).from).toBeGreaterThan(noteTime(game, answer, i) + game.lag);
        }
        answerIt(game);
      }
    }
  });
});
