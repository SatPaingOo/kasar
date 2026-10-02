/**
 * The loop, the canvas and the hands on it.
 *
 * Everything that decides anything is in game.ts; this reads input, advances
 * the clock and asks render.ts to paint. It is also the only file that knows
 * this is a browser.
 */

import { RULES, createGame, dropBy, hardDrop, movePiece, rotatePiece, step } from './game.js';
import type { Game } from './game.js';
import { columnAt, draw, layout } from './render.js';
import type { Phase, View } from './render.js';
import { TEXT, pickLang } from './strings.js';

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

let touch = false;
let view: View = layout(1, 1);
let game: Game = createGame();
let phase: Phase = 'title';
let clock = 0;
/** Rows per second of extra fall while the drop key is held. */
let soft = 0;

/**
 * Measured from the box the browser gives the canvas, never from the canvas's
 * own width and height — those are the backing store, which this function
 * sets, and reading them back makes the shaft grow by the pixel ratio every
 * time it is called.
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
  view = layout(width, height);
}

function begin(): void {
  game = createGame();
  phase = 'playing';
  soft = 0;
}

/** The one button the title and end screens have. */
function advance(): void {
  if (phase === 'title' || phase === 'over') begin();
  else if (phase === 'paused') phase = 'playing';
}

function pause(): void {
  if (phase === 'playing') phase = 'paused';
  else if (phase === 'paused') phase = 'playing';
}

window.addEventListener('keydown', (event) => {
  const key = event.key;
  if (key === 'p' || key === 'P') {
    pause();
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

  if (key === 'ArrowLeft') movePiece(game, -1);
  else if (key === 'ArrowRight') movePiece(game, 1);
  else if (key === 'ArrowUp' || key === 'z' || key === 'Z') rotatePiece(game);
  else if (key === 'ArrowDown') soft = RULES.fallRate * 7;
  else if (key === ' ') hardDrop(game);
  else return;
  event.preventDefault();
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowDown') soft = 0;
});

/*
 * Touch: drag to aim and let go to drop, tap to turn. Letting go is the drop
 * because the stone is already where you put it — asking for a second,
 * separate tap to confirm it put a whole extra beat into every placement.
 */
let aiming = false;
let startX = 0;
let moved = false;

canvas.addEventListener('pointerdown', (event) => {
  touch = event.pointerType === 'touch';
  if (phase !== 'playing') {
    advance();
    return;
  }
  aiming = true;
  moved = false;
  startX = event.clientX;
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

canvas.addEventListener('pointermove', (event) => {
  if (!aiming || game.piece === null) return;
  if (Math.abs(event.clientX - startX) > view.cell * 0.4) moved = true;
  const want = columnAt(view, event.clientX);
  // Walk it across rather than teleporting, so a wall still stops it.
  let guard = RULES.columns;
  while (guard-- > 0 && game.piece.col !== want) {
    if (!movePiece(game, game.piece.col < want ? 1 : -1)) break;
  }
});

canvas.addEventListener('pointerup', (event) => {
  if (!aiming) return;
  aiming = false;
  if (phase !== 'playing') return;
  if (moved) hardDrop(game);
  else rotatePiece(game);
  event.preventDefault();
});

canvas.addEventListener('pointercancel', () => {
  aiming = false;
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

function frame(dt: number): void {
  clock += dt;
  if (phase === 'playing') {
    step(game, dt);
    if (soft > 0) dropBy(game, soft * dt);
    if (game.outcome !== 'playing') phase = 'over';
  }
  draw(ctx, view, game, { lang, phase, time: clock, touch });
}

let last = performance.now();
function tick(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  frame(dt);
  requestAnimationFrame(tick);
}

// Held in a variable: an unreferenced ResizeObserver may be collected even
// while it is observing, and then the shaft never re-measures.
const watcher = new ResizeObserver(() => resize());
watcher.observe(canvas);
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(tick);
