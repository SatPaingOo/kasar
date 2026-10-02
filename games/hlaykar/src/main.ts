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
import { createSound } from './sound.js';
import { burst, stepMotes } from './dust.js';
import type { Mote } from './dust.js';

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

const sound = createSound();
let last = performance.now();
let touch = false;
let view: View = layout(1, 1);
let game: Game = createGame();
let phase: Phase = 'title';
let clock = 0;
/** Rows per second of extra fall while the drop key is held. */
let soft = 0;
let motes: Mote[] = [];

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
  motes = [];
}

/**
 * Hand the rules' events to the ear and clear them.
 *
 * Anything the player does between frames — a hard drop, a turn — lands its
 * events outside `step`, and `step` empties the list at the top of the next
 * frame. So every path that can produce one drains it straight away rather
 * than leaving it to be collected later and silently thrown away.
 */
function drain(): void {
  for (const event of game.events) {
    sound.play(event);
    if (event.kind === 'shatter') burst(motes, event.at);
  }
  game.events = [];
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
  if (phase !== 'playing') {
    if (key === ' ' || key === 'Enter') {
      advance();
      event.preventDefault();
    }
    return;
  }

  if (key === 'ArrowLeft') {
    if (movePiece(game, -1)) sound.play({ kind: 'move' });
  } else if (key === 'ArrowRight') {
    if (movePiece(game, 1)) sound.play({ kind: 'move' });
  } else if (key === 'ArrowUp' || key === 'z' || key === 'Z') {
    if (rotatePiece(game)) sound.play({ kind: 'turn' });
  } else if (key === 'ArrowDown') {
    soft = RULES.fallRate * 7;
  } else if (key === ' ') {
    hardDrop(game);
    drain();
  } else return;
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
  sound.unlock();
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
  let shifted = false;
  while (guard-- > 0 && game.piece.col !== want) {
    if (!movePiece(game, game.piece.col < want ? 1 : -1)) break;
    shifted = true;
  }
  if (shifted) sound.play({ kind: 'move' });
});

canvas.addEventListener('pointerup', (event) => {
  if (!aiming) return;
  aiming = false;
  if (phase !== 'playing') return;
  if (moved) {
    hardDrop(game);
    drain();
  } else if (rotatePiece(game)) {
    sound.play({ kind: 'turn' });
  }
  event.preventDefault();
});

canvas.addEventListener('pointercancel', () => {
  aiming = false;
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

/*
 * A hidden page gets no animation frames at all, so the loop simply stops —
 * which is right, nobody wants the water rising while they are reading
 * something else. What is not right is coming back to find the run already
 * lost, so going away pauses it properly and the clock is restarted on the
 * way back in rather than being handed one enormous frame.
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
    if (soft > 0) dropBy(game, soft * dt);
    drain();
    if (game.outcome !== 'playing') phase = 'over';
  }
  // The water is the only sound that never stops, and it climbs with itself.
  sound.ambience(phase === 'playing' ? (RULES.rows - game.waterRow) / RULES.rows : 0);
  // The wreckage keeps settling while the game is paused or over, which is
  // the one thing in here that outlives the run that made it.
  stepMotes(motes, dt);
  draw(ctx, view, game, { lang, phase, time: clock, touch }, motes);
}

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
