/**
 * Tazaung — canvas, input and the loop.
 *
 * Fixed timestep so the rules run identically whatever the display does, with
 * drawing left on whatever frame rate the browser gives us.
 */

import { aimWizard, begin, createGame, moveWizard, pause, requestFire, resumePlay, step } from './game.js';
import type { GameEvent } from './game.js';
import { advanceVisuals, columnAt, draw, layout } from './render.js';
import { playBegin, playEvents, playScroll, toggleMute, unlock, updateSound } from './sound.js';
import { detectLang, setLang, toggleLang } from './strings.js';
import type { Viewport } from './render.js';

const STEP = 1 / 120;
/** Never simulate more than this after a stall; drop the time instead. */
const MAX_FRAME = 0.25;

/** Narrow once at the boundary, so nothing downstream carries a null. */
function required<T>(value: T | null, missing: string): T {
  if (value === null) throw new Error(missing);
  return value;
}

const canvas = required(document.querySelector<HTMLCanvasElement>('#stage'), 'missing #stage canvas');
const ctx = required(canvas.getContext('2d'), '2d canvas context unavailable');

let state = createGame();
let view: Viewport = layout(1, 1);
const held = new Set<string>();

function resize(): void {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  view = layout(width, height);
}

/**
 * After the lantern goes out he sits for a moment before the scroll opens, so
 * the ending is something you watch rather than a panel that appears over it.
 */
const BEAT_DARK = 2.6;
const BEAT_DAWN = 3.4;
const UNROLL_SECONDS = 0.7;

let endedAt = Number.POSITIVE_INFINITY;
let scrollOpen = 1;

/**
 * The rules are shown to a first-time player instead of the plain title, and
 * on `H` after that. Nobody is made to read them twice, and nobody has to
 * guess what a pile does on their first run.
 */
const SEEN_KEY = 'tazaung.seen';

function hasPlayedBefore(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // Private windows and blocked storage: just show the rules.
    return false;
  }
}

function rememberPlayed(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Nothing to do; the rules simply show again next time.
  }
}

let showHow = !hasPlayedBefore();

const beatSeconds = (): number => (state.phase === 'dawn' ? BEAT_DAWN : BEAT_DARK);

function restart(): void {
  state = createGame();
  endedAt = Number.POSITIVE_INFINITY;
  scrollOpen = 1;
}

/** Any press or tap: open the night, carry on from a pause, or start again. */
function advancePhase(): void {
  if (state.phase === 'intro') {
    begin(state);
    rememberPlayed();
    showHow = false;
    playBegin();
    return;
  }
  if (state.phase === 'paused') {
    resumePlay(state);
    return;
  }
  if (state.phase !== 'playing' && scrollOpen > 0.9) restart();
}

function togglePause(): void {
  if (state.phase === 'playing') {
    held.delete('fire');
    pause(state);
    playScroll();
    return;
  }
  if (state.phase === 'paused') resumePlay(state);
}

/**
 * The canvas can change size without the window doing so — an embedded pane,
 * a split view, a flex layout. Listening only to window resize left the
 * backing store stale and the whole scene stretched and cropped.
 */
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(() => {
    resize();
  }).observe(canvas);
} else {
  window.addEventListener('resize', resize);
}

window.addEventListener('keydown', (event) => {
  unlock();
  switch (event.key) {
    case 'ArrowLeft':
    case 'a':
      moveWizard(state, -1);
      break;
    case 'ArrowRight':
    case 'd':
      moveWizard(state, 1);
      break;
    case ' ':
    case 'ArrowUp':
    case 'w':
      held.add('fire');
      event.preventDefault();
      break;
    case 'r':
      restart();
      break;
    case 'm':
      unlock();
      toggleMute();
      break;
    case 'l':
      toggleLang();
      break;
    case 'h':
      if (state.phase === 'intro') showHow = !showHow;
      break;
    case 'p':
    case 'Escape':
      unlock();
      togglePause();
      break;
    case 'Enter':
      advancePhase();
      break;
    default:
      return;
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'w') held.delete('fire');
});

// Touch and mouse: aim at a column and keep firing while held.
canvas.addEventListener('pointerdown', (event) => {
  unlock();
  canvas.setPointerCapture(event.pointerId);
  if (state.phase !== 'playing') {
    advancePhase();
    return;
  }
  aimWizard(state, columnAt(view, event.offsetX));
  held.add('fire');
});

canvas.addEventListener('pointermove', (event) => {
  if (!held.has('fire')) return;
  aimWizard(state, columnAt(view, event.offsetX));
});

canvas.addEventListener('pointerup', () => held.delete('fire'));
canvas.addEventListener('pointercancel', () => held.delete('fire'));

let accumulator = 0;
let last = performance.now();
let lastFrameAt = performance.now();
let scheduled = 0;
/** Several steps can run per drawn frame; the visuals must see every event. */
const frameEvents: GameEvent[] = [];

function frame(now: number): void {
  lastFrameAt = now;
  const delta = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  accumulator += delta;

  frameEvents.length = 0;
  while (accumulator >= STEP) {
    if (held.has('fire')) requestFire(state);
    step(state, STEP);
    frameEvents.push(...state.events);
    accumulator -= STEP;
  }

  if (state.phase === 'intro' || state.phase === 'paused') {
    scrollOpen = Math.min(1, scrollOpen + delta / UNROLL_SECONDS);
  } else if (state.phase === 'playing') {
    endedAt = Number.POSITIVE_INFINITY;
    scrollOpen = Math.max(0, scrollOpen - delta / UNROLL_SECONDS);
  } else {
    if (endedAt === Number.POSITIVE_INFINITY) endedAt = now;
    const waited = (now - endedAt) / 1000;
    if (waited > beatSeconds()) {
      if (scrollOpen === 0) playScroll();
      scrollOpen = Math.min(1, scrollOpen + delta / UNROLL_SECONDS);
    }
  }

  playEvents(frameEvents);
  updateSound(state.light, state.phase === 'playing');

  advanceVisuals(state, frameEvents, view, Math.max(delta, 1 / 240), now / 1000);
  draw(ctx, state, view, now / 1000, scrollOpen, showHow);
  schedule();
}

function schedule(): void {
  scheduled = requestAnimationFrame(frame);
}

/**
 * A browser can stop delivering animation frames while still reporting the
 * page as visible — an embedded pane that is not painting does exactly that.
 * The loop then never reschedules and the game is frozen for good: nothing
 * moves and no sound is ever played, because every cue is emitted from here.
 *
 * Timers keep running when frames do not, so this steps the game itself once
 * frames have stopped for a second. It degrades to a few frames a second
 * instead of stopping, and MAX_FRAME keeps the catch-up bounded.
 */
setInterval(() => {
  const now = performance.now();
  if (now - lastFrameAt < 1000) return;
  cancelAnimationFrame(scheduled);
  frame(now);
}, 500);

// Going away pauses; coming back never un-pauses on its own, or hiding a
// paused game would toggle it straight back into play.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.phase === 'playing') togglePause();
});
window.addEventListener('blur', () => {
  if (state.phase === 'playing') togglePause();
});

setLang(detectLang());
resize();
schedule();
