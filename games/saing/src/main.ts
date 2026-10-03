/**
 * The loop, the canvas, the drums under the player's hands, and the ear.
 *
 * Everything that decides anything is in game.ts; this reads input, keeps the
 * clock, hands cues to the ear ahead of time and asks render.ts to paint. It
 * is also the only file that knows this is a browser.
 *
 * The game's clock here is the wall clock, not a sum of frame times. A rhythm
 * game cannot let a slow frame slow the music down, and a strike is judged by
 * the moment the browser says it happened, which is on the wall clock too.
 */

import { createGame, drumsAt, hear, restart, spanAt, step, strike } from './game.js';
import type { Game, SpanKind, Why } from './game.js';
import { drumAt, drumForKey } from './circle.js';
import { draw, layout, toRing } from './render.js';
import type { Phase, Struck, View, Word } from './render.js';
import { TEXT, pickLang } from './strings.js';
import { createSound } from './sound.js';

const stage = document.querySelector<HTMLCanvasElement>('#stage');
const context = stage?.getContext('2d') ?? null;
if (stage === null || context === null) throw new Error('no canvas');
// Re-bound with the null gone: narrowing in this scope does not follow the
// name into the handlers and the loop below.
const canvas: HTMLCanvasElement = stage;
const ctx: CanvasRenderingContext2D = context;
const say = document.querySelector<HTMLElement>('#say');

const lang = pickLang([navigator.language, ...navigator.languages]);
const t = TEXT[lang];
document.documentElement.lang = lang;
document.title = t.title;

const BEST_KEY = 'kasar.saing.best';

function readBest(): number {
  try {
    const raw = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number): void {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // A private window, say. The best score is a nicety.
  }
}

/** Seconds on the wall clock. */
const wall = (): number => performance.now() / 1000;

let game: Game = createGame();
let view: View = layout(1, 1);
let phase: Phase = 'title';
/** The game's clock is the wall clock less this, so that a pause can stop it. */
let zero = wall();
let pausedAt = 0;
let overFor = 0;
let best = readBest();
let touch = window.matchMedia('(pointer: coarse)').matches;
let struck: Struck[] = [];
let words: Word[] = [];
let broke: { why: Why; at: number } | null = null;
let shown: SpanKind | null = null;
let last = wall();
const sound = createSound();

const now = (): number => (phase === 'paused' ? pausedAt : wall() - zero);

/**
 * The game time an input event happened at. Its own time stamp, when the
 * browser gives one on the same clock as performance.now, rather than the
 * moment it was handed over — which can be a frame later.
 */
function stamp(ms: number): number {
  const perf = performance.now();
  const used = Number.isFinite(ms) && ms > 0 && Math.abs(perf - ms) < 1000 ? ms : perf;
  return used / 1000 - zero;
}

function announce(text: string): void {
  if (say !== null) say.textContent = text;
}

/**
 * Measured from the box the browser gives the canvas, never from the canvas's
 * own width and height — those are the backing store, which this sets, and
 * reading them back grows the view by the pixel ratio every time.
 */
function resize(): void {
  const ratio = window.devicePixelRatio || 1;
  const box = canvas.getBoundingClientRect();
  const width = Math.round(box.width) || window.innerWidth;
  const height = Math.round(box.height) || window.innerHeight;
  if (width === view.width && height === view.height && canvas.width === Math.round(width * ratio)) return;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  view = layout(width, height);
}

function begin(): void {
  sound.unlock();
  zero = wall();
  // A moment's lead, so the first beat of the count is not lost to a context
  // still waking up.
  game = createGame(Math.random, 0.4);
  struck = [];
  words = [];
  broke = null;
  shown = null;
  phase = 'playing';
  overFor = 0;
}

/** The one button the title, pause and end screens have. */
function advance(): void {
  // A strike already on its way down when the music stopped would otherwise
  // skip straight past the ending.
  if (phase === 'over' && overFor < 1.4) return;
  if (phase === 'title' || phase === 'over') begin();
  else if (phase === 'paused') resume();
}

function pause(): void {
  if (phase !== 'playing') return;
  pausedAt = wall() - zero;
  phase = 'paused';
  announce(t.paused);
}

/** The pulse the player was holding is gone after a pause, so the phrase starts again from a count. */
function resume(): void {
  if (phase !== 'paused') return;
  zero = wall() - pausedAt;
  phase = 'playing';
  restart(game, now());
  shown = null;
}

/** Hand the rules' events to the eye and the ear, and clear them. */
function drain(at: number): void {
  for (const event of game.events) {
    switch (event.kind) {
      case 'hit':
        words.push({
          drum: event.drum,
          at,
          text: event.grade === 'on' ? t.on : event.off < 0 ? t.early : t.late,
        });
        break;
      case 'broken':
        sound.stumble();
        broke = { why: event.why, at };
        if (event.drum !== null) struck.push({ drum: event.drum, at, good: false });
        announce(t.why[event.why]);
        break;
      case 'kept':
        sound.chime();
        break;
      case 'finished':
        sound.flourish(drumsAt(game, at));
        break;
      case 'stray':
      case 'stopped':
        break;
    }
  }
  game.events = [];
  if (struck.length > 16) struck = struck.slice(-16);
  if (words.length > 12) words = words.slice(-12);
}

/** The player struck a drum at game time `at`. */
function hit(drum: number, at: number): void {
  sound.strike(drum);
  struck.push({ drum, at, good: true });
  strike(game, drum, at);
  drain(at);
}

function onKey(event: KeyboardEvent): void {
  // The way back to the shelf is a link, and Enter on it must still follow it.
  if (event.target instanceof HTMLAnchorElement) return;
  const key = event.key;
  sound.unlock();
  if (key === 'm' || key === 'M') {
    sound.toggle();
    event.preventDefault();
    return;
  }
  if (key === 'p' || key === 'P' || key === 'Escape') {
    if (phase === 'playing') pause();
    else if (phase === 'paused') resume();
    event.preventDefault();
    return;
  }
  if (phase !== 'playing') {
    if (key === ' ' || key === 'Enter') {
      advance();
      event.preventDefault();
    }
    return;
  }
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const at = stamp(event.timeStamp);
  const drum = drumForKey(key, drumsAt(game, at));
  if (drum === null) return;
  touch = false;
  hit(drum, at);
  event.preventDefault();
}

window.addEventListener('keydown', onKey);

canvas.addEventListener('pointerdown', (event) => {
  touch = event.pointerType === 'touch';
  sound.unlock();
  event.preventDefault();
  if (phase !== 'playing') {
    advance();
    return;
  }
  const at = stamp(event.timeStamp);
  const box = canvas.getBoundingClientRect();
  const p = toRing(view, event.clientX - box.left, event.clientY - box.top);
  const drum = drumAt(p.x, p.y, drumsAt(game, at));
  if (drum !== null) hit(drum, at);
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

/*
 * A hidden page gets no animation frames and the music would run on without
 * anyone to answer it, so leaving the page pauses it.
 */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('blur', pause);

const WORDS: Partial<Record<SpanKind, string>> = { count: t.count, join: t.joins, breath: t.again };

function frame(): void {
  const time = now();
  const dt = Math.min(wall() - last, 0.1);
  last = wall();

  if (phase === 'playing') {
    step(game, time);
    drain(time);
    sound.sync(time);
    // Ahead of time, on the audio clock — and nothing stale: cues that came
    // due while the context was still waking are dropped rather than played
    // all at once.
    if (sound.ready) {
      for (const cue of hear(game, time + sound.ahead)) if (cue.at >= time - 0.03) sound.cue(cue);
    }
    // The spoken side: what is starting, for anyone not watching. Not the
    // call and the answer — the clapper says those, and a voice over the
    // drums would hide what it is announcing.
    const kind = spanAt(game, time)?.kind ?? null;
    if (kind !== shown) {
      shown = kind;
      const spoken = kind === null ? undefined : WORDS[kind];
      if (spoken !== undefined) announce(spoken);
    }
    if (game.outcome !== 'playing') {
      phase = 'over';
      overFor = 0;
      if (game.score > best) {
        best = game.score;
        saveBest(best);
      }
      announce(`${game.outcome === 'finished' ? t.finished : t.stopped}. ${t.score} ${game.score}.`);
    }
  } else if (phase === 'over') {
    overFor += dt;
  }

  draw(ctx, view, game, {
    lang,
    phase,
    time,
    clock: wall(),
    touch,
    overFor,
    struck,
    words,
    broke,
    best,
    muted: sound.muted,
  });
}

function tick(): void {
  frame();
  requestAnimationFrame(tick);
}

// Held in a variable: an unreferenced ResizeObserver may be collected even
// while it is observing, and then the canvas never re-measures.
const watcher = new ResizeObserver(() => resize());
watcher.observe(canvas);
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(tick);
