/**
 * The loop, the canvas and the one button.
 *
 * Everything that decides anything is in game.ts; this reads input, advances
 * the clock and asks render.ts to paint. It is also the only file that knows
 * this is a browser.
 */

import { createGame, grab, release, step } from './game.js';
import type { Game } from './game.js';
import { draw, layout } from './render.js';
import type { Phase, View } from './render.js';
import { TEXT, pickLang } from './strings.js';
import { createSound } from './sound.js';

const stage = document.querySelector<HTMLCanvasElement>('#stage');
const context = stage?.getContext('2d') ?? null;
if (stage === null || context === null) throw new Error('no canvas');
// Re-bound with the null gone: narrowing in this scope does not follow the
// name into the handlers and the loop below.
const canvas: HTMLCanvasElement = stage;
const ctx: CanvasRenderingContext2D = context;

const lang = pickLang([navigator.language, ...navigator.languages]);
document.documentElement.lang = lang;
document.title = TEXT[lang].title;

let game: Game = createGame();
let view: View = layout(1, 1, game);
let phase: Phase = 'title';
let clock = 0;
let overFor = 0;
let touch = false;
let last = performance.now();
const sound = createSound();

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
  if (width === view.width && height === view.height && canvas.width === Math.round(width * ratio)) {
    return;
  }
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  view = layout(width, height, game);
}

function begin(): void {
  game = createGame();
  phase = 'playing';
  overFor = 0;
}

/** The one button the title and end screens have. */
function advance(): void {
  // A press already on its way down when he fell would otherwise skip straight
  // past the moment he fell.
  if (phase === 'over' && overFor < 0.6) return;
  if (phase === 'title' || phase === 'over') begin();
  else if (phase === 'paused') phase = 'playing';
}

function pause(): void {
  if (phase === 'playing') phase = 'paused';
  else if (phase === 'paused') phase = 'playing';
}

/*
 * One button, and it means the same thing every time: down is hold on, up is
 * let go. There is nothing to aim and nothing to choose — the rope goes to
 * whatever is furthest ahead within reach — so the only thing the player is
 * ever deciding is when.
 */
/**
 * Hand the rules' events to the ear and clear them.
 *
 * A grab or a release happens between frames, outside `step`, and `step`
 * empties the list at the top of the next one — so every path that can make an
 * event drains it straight away rather than leaving it to be collected later
 * and silently thrown away.
 */
function drain(): void {
  for (const event of game.events) sound.play(event);
  game.events = [];
}

function press(): void {
  sound.unlock();
  if (phase !== 'playing') {
    advance();
    return;
  }
  grab(game);
  drain();
}

function lift(): void {
  if (phase !== 'playing') return;
  release(game);
  drain();
}

window.addEventListener('keydown', (event) => {
  const key = event.key;
  sound.unlock();
  if (key === 'm' || key === 'M') {
    sound.toggle();
    event.preventDefault();
    return;
  }
  if (key === 'p' || key === 'P') {
    pause();
    event.preventDefault();
    return;
  }
  if (key !== ' ' && key !== 'Enter' && key !== 'ArrowUp' && key !== 'w') return;
  // Held keys repeat; only the first one down is a press.
  if (!event.repeat) press();
  event.preventDefault();
});

window.addEventListener('keyup', (event) => {
  const key = event.key;
  if (key !== ' ' && key !== 'Enter' && key !== 'ArrowUp' && key !== 'w') return;
  lift();
  event.preventDefault();
});

canvas.addEventListener('pointerdown', (event) => {
  touch = event.pointerType === 'touch';
  canvas.setPointerCapture(event.pointerId);
  press();
  event.preventDefault();
});

canvas.addEventListener('pointerup', (event) => {
  lift();
  event.preventDefault();
});

canvas.addEventListener('pointercancel', () => lift());
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

/*
 * A hidden page gets no animation frames, so the loop stops — which is right,
 * but coming back to find him already on the floor is not.
 */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && phase === 'playing') phase = 'paused';
  last = performance.now();
});
window.addEventListener('blur', () => {
  if (phase === 'playing') phase = 'paused';
});

function frame(dt: number): void {
  clock += dt;
  if (phase === 'playing') {
    step(game, dt);
    drain();
    if (game.outcome !== 'swinging') {
      phase = 'over';
      overFor = 0;
    }
  } else if (phase === 'over') {
    overFor += dt;
  }
  // On a rope you cannot see your own speed, and speed is the whole thing
  // being managed, so the wind is what reports it.
  const speed = Math.hypot(game.figure.vx, game.figure.vy);
  sound.wind(phase === 'playing' ? speed : 0);
  // The camera is rebuilt every frame because the whole world slides past.
  view = layout(view.width, view.height, game);
  draw(ctx, view, game, { lang, phase, time: clock, touch, overFor });
}

function tick(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  frame(dt);
  requestAnimationFrame(tick);
}

// Held in a variable: an unreferenced ResizeObserver may be collected even
// while it is observing, and then the canvas never re-measures.
const watcher = new ResizeObserver(() => resize());
watcher.observe(canvas);
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(tick);
