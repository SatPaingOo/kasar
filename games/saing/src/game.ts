/**
 * Saing — rules.
 *
 * He sits in the middle of a pat waing, the circle of tuned drums that leads a
 * Burmese saing ensemble. The circle plays a phrase; the player plays it back
 * — the same drums, in the same order, in the same rhythm. Right, and the
 * music carries on into a phrase one beat longer. Wrong, and the music
 * stumbles, he loses one of three, and the same phrase comes round again.
 *
 * Every phrase in a section is the one before it with one more beat on the
 * end, the way the old memory game grows by a note a round: you only ever
 * have to learn the new beat. Every few rounds a drum joins the circle, the
 * tempo lifts, and a fresh phrase begins.
 *
 * Order is judged strictly and timing generously. A strike on the wrong drum
 * breaks the phrase whenever it lands; a strike on the right drum counts if it
 * is anywhere near its beat, and how near only decides the points. That
 * balance is on purpose: a phone screen answers a tap 50 to 100 ms late, and
 * Bluetooth headphones play the call a fifth of a second late, so a judge as
 * strict about timing as it is about order would be judging the hardware.
 * It also learns the lag — see `lag` in RULES.
 *
 * Deliberately not another game about a figure going somewhere. The other
 * games on the shelf are about where he gets to; here he does not move from
 * the middle of the circle, and the thing being played is the ear.
 *
 * This module is pure: no audio, no canvas, no DOM, no clock, and no
 * Math.random unless the caller hands one in. Time arrives as an argument, in
 * seconds, and everything the ear and the renderer need is readable state.
 */

export const RULES = {
  /** Broken this many times and the circle stops. */
  lives: 3,
  /** Beats of bell alone before the first phrase, so the pulse is in the ear before anything is asked of it. */
  countIn: 4,
  /** Beats of bell after a broken answer, before the same phrase comes round again. */
  breath: 2,
  /** Beats a drum that has just joined gets to itself. */
  join: 4,
  /**
   * The call and the answer each run this many beats past the phrase's last
   * beat, so there is always a rest to turn round in. Without one, a phrase
   * that filled its bar asked for the answer's first note on the very next
   * beat after the call's last — which is music, and is also impossible the
   * first time you hear it.
   */
  tail: 1,

  /**
   * The piece, section by section. Each phrase is `from` beats long at the
   * start of its section and grows by one beat a round up to `to`; `split` is
   * the chance that a beat holds two notes instead of one.
   */
  sections: [
    { drums: 3, bpm: 80, from: 2, to: 4, split: 0 },
    { drums: 4, bpm: 86, from: 2, to: 5, split: 0.2 },
    { drums: 5, bpm: 92, from: 3, to: 6, split: 0.25 },
    { drums: 6, bpm: 98, from: 3, to: 7, split: 0.3 },
    { drums: 7, bpm: 104, from: 4, to: 7, split: 0.3 },
    { drums: 8, bpm: 110, from: 4, to: 8, split: 0.3 },
  ],

  /**
   * A strike counts for a note if it lands within this share of the gap to
   * the neighbouring note on either side — measured from the beat as this
   * player hears it, which is the beat plus their lag.
   */
  reach: 0.6,
  /** And never further from it than this, in seconds, however slow the music is. */
  widest: 0.3,
  /** Off by no more than this, in seconds, and it was on the beat; no more than `near`, and it was close. */
  onBeat: 0.06,
  near: 0.13,
  /**
   * How long after a note's window closes the game waits before calling it
   * missed. A tap is judged by when it happened, not by when it was handed
   * over, and a tap can happen just before a frame and arrive just after.
   */
  grace: 0.05,

  /**
   * The lag the judge learns and forgives.
   *
   * Every player is late by something the game cannot see — the screen, the
   * speaker, the headphones — and a phone adds up to a fifth of a second to
   * every strike. So the judge keeps a running guess at how late this player
   * hits, moves it a little towards each accepted strike, and judges the next
   * one around the beat as they hear it. A steady player who is steadily late
   * is a steady player. It cannot be used to cheat: it only ever moves by a
   * share of the last strike, and only inside these bounds.
   */
  lag: { rate: 0.25, least: -0.05, most: 0.25 },

  points: { on: 3, near: 2, loose: 1, kept: 5 },
} as const;

export type Section = (typeof RULES.sections)[number];

/** A note in a phrase: which drum, and how many beats in from the phrase's start. */
export interface Note {
  readonly drum: number;
  readonly beat: number;
}

export interface Round {
  readonly section: number;
  /** How many beats long the phrase is. */
  readonly beats: number;
  readonly notes: readonly Note[];
}

/**
 * A stretch of the music, in beats of one tempo.
 *
 * - `count`: bell alone, before the first phrase or after a pause
 * - `call`: the circle plays the phrase
 * - `answer`: the player plays it back
 * - `breath`: bell alone, after a broken answer
 * - `join`: a drum that has just joined, sounding on its own
 */
export type SpanKind = 'count' | 'call' | 'answer' | 'breath' | 'join';

export interface Span {
  readonly kind: SpanKind;
  /** Seconds. */
  readonly start: number;
  /** How many beats it runs, which a break can cut short. */
  beats: number;
  /** Seconds per beat. */
  readonly beat: number;
  /** The round it belongs to, which is also what decides how many drums are in the circle. */
  readonly round: number;
  /** Cues handed to the ear up to here, in seconds, so none is handed over twice. */
  heard: number;
}

export type Grade = 'on' | 'near' | 'loose';
export type Why = 'wrong' | 'rushed' | 'missed';

export interface Answer {
  readonly round: number;
  /** When its first beat falls, in seconds. */
  readonly start: number;
  readonly beat: number;
  /** The next note to be played. */
  next: number;
  state: 'open' | 'kept' | 'broken';
}

export type Outcome = 'playing' | 'finished' | 'stopped';

export type Event =
  /** Struck when nothing was being asked for — playing along with the call, say. Free. */
  | { readonly kind: 'stray'; readonly drum: number }
  /** `off` is seconds after the beat as this player hears it; negative is early. */
  | { readonly kind: 'hit'; readonly drum: number; readonly grade: Grade; readonly off: number }
  /** `drum` is what was struck, or null when nothing was. */
  | { readonly kind: 'broken'; readonly why: Why; readonly drum: number | null; readonly expected: number }
  | { readonly kind: 'kept'; readonly round: number }
  | { readonly kind: 'finished' }
  | { readonly kind: 'stopped' };

/** Something for the ear, at a time in seconds: a drum, or the bell (si) or the clapper (wa) keeping time. */
export type Cue =
  | { readonly at: number; readonly kind: 'drum'; readonly drum: number }
  | { readonly at: number; readonly kind: 'si' | 'wa' };

export interface Game {
  readonly piece: readonly Round[];
  /** The round being learned. */
  round: number;
  /** Every stretch of music decided so far, oldest first. The last ones are still to come. */
  spans: Span[];
  answer: Answer | null;
  lives: number;
  score: number;
  /** Rounds played back right. */
  kept: number;
  /** How many strikes landed at each grade, for the card at the end. */
  grades: Record<Grade, number>;
  /** The judge's guess at how late this player hits, in seconds. */
  lag: number;
  /** The latest time the game has been told about. */
  time: number;
  outcome: Outcome;
  events: Event[];
}

export type Rand = () => number;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const sectionOf = (game: Game, round: number): Section => {
  const section = RULES.sections[game.piece[round]?.section ?? 0];
  if (section === undefined) throw new Error(`no section for round ${round}`);
  return section;
};

const beatOf = (section: Section): number => 60 / section.bpm;

/**
 * One section's phrase at its full length, which every round in the section
 * plays a beginning of.
 *
 * A walk over the drums rather than a draw from them: mostly a step to a
 * neighbour, sometimes a leap, and never the same drum three times running.
 * A phrase of independent draws is a phone number; a phrase that moves is a
 * tune, and a tune is what can be remembered.
 */
function melody(section: Section, newest: number | null, rand: Rand): Note[] {
  const notes: Note[] = [];
  let last = -1;
  let before = -1;
  let splitLast = false;
  let newestHeard = newest === null;

  const pick = (forceNewest: boolean): number => {
    if (forceNewest && newest !== null) return newest;
    const allowed = (d: number): boolean => d >= 0 && d < section.drums && !(d === last && last === before);
    if (last >= 0 && rand() < 0.65) {
      const steps = [-2, -1, 1, 2].map((s) => last + s).filter(allowed);
      const step = steps[Math.floor(rand() * steps.length)];
      if (step !== undefined) return step;
    }
    const any = Array.from({ length: section.drums }, (_, d) => d).filter(allowed);
    return any[Math.floor(rand() * any.length)] ?? 0;
  };

  for (let b = 0; b < section.to; b += 1) {
    // Never the first beat, and never two in a row: two notes to a beat is
    // the hardest thing here to hear, and a phrase must open on something
    // plain.
    const split: boolean = b > 0 && !splitLast && rand() < section.split;
    splitLast = split;
    const count = split ? 2 : 1;
    for (let k = 0; k < count; k += 1) {
      // The drum that has just joined is played in the first phrase it is
      // in, on its last note at the latest — otherwise a new drum can sit
      // unplayed through half a section, and the whole point of it arriving
      // is lost.
      const closing = b === section.from - 1 && k === count - 1;
      const drum = pick(closing && !newestHeard);
      if (drum === newest) newestHeard = true;
      notes.push({ drum, beat: b + k * 0.5 });
      before = last;
      last = drum;
    }
  }
  return notes;
}

/** The whole piece: every round of every section, in the order they are played. */
export function compose(rand: Rand): Round[] {
  const rounds: Round[] = [];
  RULES.sections.forEach((section, s) => {
    const phrase = melody(section, s === 0 ? null : section.drums - 1, rand);
    for (let beats = section.from; beats <= section.to; beats += 1) {
      rounds.push({ section: s, beats, notes: phrase.filter((note) => note.beat < beats) });
    }
  });
  return rounds;
}

export const spanEnd = (span: Span): number => span.start + span.beats * span.beat;

/** When a note of an answer falls, before anyone's lag. */
export function noteTime(game: Game, answer: Answer, index: number): number {
  const note = game.piece[answer.round]?.notes[index];
  return note === undefined ? Infinity : answer.start + note.beat * answer.beat;
}

/**
 * The stretch of time in which a strike counts for a note, in seconds.
 *
 * Centred on the beat as this player hears it, and reaching most of the way
 * to the neighbouring notes on either side but never past them — so a strike
 * always belongs to one note and never to two.
 */
export function windowOf(game: Game, answer: Answer, index: number): { readonly from: number; readonly to: number } {
  const round = game.piece[answer.round];
  const at = noteTime(game, answer, index);
  if (round === undefined || index >= round.notes.length) return { from: Infinity, to: Infinity };
  const before = index === 0 ? RULES.tail * answer.beat : at - noteTime(game, answer, index - 1);
  const after =
    index === round.notes.length - 1
      ? answer.start + (round.beats + RULES.tail) * answer.beat - at
      : noteTime(game, answer, index + 1) - at;
  const centre = at + game.lag;
  return {
    from: centre - Math.min(RULES.reach * before, RULES.widest),
    to: centre + Math.min(RULES.reach * after, RULES.widest),
  };
}

function span(kind: SpanKind, start: number, beats: number, section: Section, round: number): Span {
  return { kind, start, beats, beat: beatOf(section), round, heard: start };
}

/** Decide a call and the answer that follows it, starting at `start`. */
function callAt(game: Game, round: number, start: number): void {
  const section = sectionOf(game, round);
  const phrase = game.piece[round];
  if (phrase === undefined) return;
  const length = phrase.beats + RULES.tail;
  const call = span('call', start, length, section, round);
  const answer = span('answer', spanEnd(call), length, section, round);
  game.spans.push(call, answer);
  game.answer = { round, start: answer.start, beat: answer.beat, next: 0, state: 'open' };
}

export function createGame(rand: Rand = Math.random, start = 0): Game {
  const game: Game = {
    piece: compose(rand),
    round: 0,
    spans: [],
    answer: null,
    lives: RULES.lives,
    score: 0,
    kept: 0,
    grades: { on: 0, near: 0, loose: 0 },
    lag: 0,
    time: start,
    outcome: 'playing',
    events: [],
  };
  const count = span('count', start, RULES.countIn, sectionOf(game, 0), 0);
  game.spans.push(count);
  callAt(game, 0, spanEnd(count));
  return game;
}

/** The span playing at time `t`, or the last one decided if the music has run past them all. */
export function spanAt(game: Game, t: number): Span | null {
  let found: Span | null = null;
  for (const s of game.spans) {
    if (s.start <= t) found = s;
    else break;
  }
  return found ?? game.spans[0] ?? null;
}

/** How many drums are in the circle at time `t`. */
export function drumsAt(game: Game, t: number): number {
  const s = spanAt(game, t);
  return sectionOf(game, s?.round ?? game.round).drums;
}

/** The answer was played back right: the music carries on into the next round. */
function keep(game: Game, answer: Answer): void {
  const round = game.piece[answer.round];
  answer.state = 'kept';
  game.kept += 1;
  game.score += RULES.points.kept;
  game.events.push({ kind: 'kept', round: answer.round });

  const next = answer.round + 1;
  if (next >= game.piece.length) {
    game.round = answer.round;
    game.outcome = 'finished';
    game.events.push({ kind: 'finished' });
    return;
  }
  game.round = next;
  const end = answer.start + ((round?.beats ?? 0) + RULES.tail) * answer.beat;
  const now = game.piece[next];
  if (now !== undefined && round !== undefined && now.section !== round.section) {
    const join = span('join', end, RULES.join, sectionOf(game, next), next);
    game.spans.push(join);
    callAt(game, next, spanEnd(join));
  } else {
    callAt(game, next, end);
  }
}

/**
 * The answer went wrong at time `at`: the phrase is cut at the next beat, and
 * after a breath it comes round again.
 */
function breakAt(game: Game, answer: Answer, why: Why, drum: number | null, at: number): void {
  const round = game.piece[answer.round];
  const expected = round?.notes[answer.next]?.drum ?? 0;
  answer.state = 'broken';
  game.lives -= 1;
  game.events.push({ kind: 'broken', why, drum, expected });

  // The answer stops on the next beat line, not where the mistake was:
  // music that stops between beats is music that has fallen over, and the
  // breath and the call after it have to land on the grid the bell is keeping.
  const answerSpan = game.spans.find((s) => s.kind === 'answer' && s.start === answer.start);
  const when = Math.max(at, game.time);
  const beatsIn = Math.max(1, Math.ceil((when - answer.start) / answer.beat - 1e-9));
  if (answerSpan !== undefined) answerSpan.beats = Math.min(answerSpan.beats, beatsIn);
  const cut = answer.start + beatsIn * answer.beat;

  if (game.lives <= 0) {
    game.outcome = 'stopped';
    game.events.push({ kind: 'stopped' });
    return;
  }
  const breath = span('breath', cut, RULES.breath, sectionOf(game, answer.round), answer.round);
  game.spans.push(breath);
  callAt(game, answer.round, spanEnd(breath));
}

/** Call every note whose window closed before `limit` and was never struck. */
function settle(game: Game, limit: number): void {
  const answer = game.answer;
  if (answer === null || answer.state !== 'open' || game.outcome !== 'playing') return;
  const round = game.piece[answer.round];
  if (round === undefined || answer.next >= round.notes.length) return;
  const window = windowOf(game, answer, answer.next);
  if (window.to < limit) breakAt(game, answer, 'missed', null, window.to);
}

/** Move the game on to time `now`, in seconds. */
export function step(game: Game, now: number): void {
  if (game.outcome !== 'playing') return;
  game.time = Math.max(game.time, now);
  settle(game, now - RULES.grace);
  // Nothing long over matters, and a list that only grows is a leak.
  while (game.spans.length > 4 && spanEnd(game.spans[0] as Span) < now - 4) game.spans.shift();
}

/** The player struck `drum` at time `at`, in seconds. */
export function strike(game: Game, drum: number, at: number): void {
  if (game.outcome !== 'playing') return;
  // Anything that ran out before this strike landed ran out first.
  settle(game, at);
  if (game.outcome !== 'playing') return;
  game.time = Math.max(game.time, at);

  const answer = game.answer;
  const round = answer === null ? undefined : game.piece[answer.round];
  if (answer === null || round === undefined || answer.state !== 'open' || answer.next >= round.notes.length) {
    game.events.push({ kind: 'stray', drum });
    return;
  }
  const window = windowOf(game, answer, answer.next);
  // Before the answer has begun, anything struck is playing along with the
  // call, and that is how you learn it.
  if (answer.next === 0 && at < window.from) {
    game.events.push({ kind: 'stray', drum });
    return;
  }
  const expected = round.notes[answer.next]?.drum;
  if (drum !== expected) {
    breakAt(game, answer, 'wrong', drum, at);
    return;
  }
  if (at < window.from) {
    breakAt(game, answer, 'rushed', drum, at);
    return;
  }

  const beatAt = noteTime(game, answer, answer.next);
  const off = at - (beatAt + game.lag);
  const grade: Grade = Math.abs(off) <= RULES.onBeat ? 'on' : Math.abs(off) <= RULES.near ? 'near' : 'loose';
  game.grades[grade] += 1;
  game.score += RULES.points[grade];
  game.lag = clamp(game.lag + (at - beatAt - game.lag) * RULES.lag.rate, RULES.lag.least, RULES.lag.most);
  game.events.push({ kind: 'hit', drum, grade, off });
  answer.next += 1;
  if (answer.next >= round.notes.length) keep(game, answer);
}

/**
 * Start the current round again from a count of bells — after a pause, when
 * the pulse the player was holding has gone. Costs nothing.
 */
export function restart(game: Game, now: number): void {
  if (game.outcome !== 'playing') return;
  game.time = Math.max(game.time, now);
  game.spans = game.spans.filter((s) => spanEnd(s) <= now);
  const count = span('count', now, RULES.countIn, sectionOf(game, game.round), game.round);
  game.spans.push(count);
  callAt(game, game.round, spanEnd(count));
}

/**
 * Everything for the ear from now until `until`, in time order, each handed
 * over once.
 *
 * The bell keeps every beat and the clapper takes the first beat of
 * anything that starts something — the count, a call, an answer, a drum
 * joining — so the ear always knows where a phrase begins. A breath has no
 * clapper: nothing is beginning.
 */
export function hear(game: Game, until: number): Cue[] {
  const cues: Cue[] = [];
  if (game.outcome !== 'playing') return cues;
  for (const s of game.spans) {
    const from = s.heard;
    const end = Math.min(until, spanEnd(s));
    if (end <= from) continue;
    const within = (t: number): boolean => t >= from - 1e-9 && t < end - 1e-9;
    for (let b = 0; b < s.beats; b += 1) {
      const at = s.start + b * s.beat;
      if (!within(at)) continue;
      cues.push({ at, kind: b === 0 && s.kind !== 'breath' ? 'wa' : 'si' });
    }
    if (s.kind === 'call') {
      for (const note of game.piece[s.round]?.notes ?? []) {
        const at = s.start + note.beat * s.beat;
        if (within(at)) cues.push({ at, kind: 'drum', drum: note.drum });
      }
    } else if (s.kind === 'join') {
      const newest = sectionOf(game, s.round).drums - 1;
      for (const b of [0, 2]) {
        const at = s.start + b * s.beat;
        if (b < s.beats && within(at)) cues.push({ at, kind: 'drum', drum: newest });
      }
    }
    s.heard = end;
  }
  return cues.sort((a, b) => a.at - b.at);
}

/** How far through the piece, 0 to 1. */
export const progress = (game: Game): number => game.kept / game.piece.length;

/** The most a perfect run can score, for whoever wants to say how close a run came. */
export function bestPossible(piece: readonly Round[]): number {
  let total = 0;
  for (const round of piece) total += round.notes.length * RULES.points.on + RULES.points.kept;
  return total;
}
