/**
 * The loop, the canvas, the desk and the keyboard.
 *
 * Everything that decides anything is in game.ts; running what was typed is in
 * runner.ts. This wires the two to the page, and it is the only file that
 * knows there is a DOM.
 */

import {
  advance,
  carryOn,
  casesOf,
  createGame,
  hasNext,
  levelAt,
  levelCount,
  resolve,
  retry,
  score,
  takeHint,
} from './game.js';
import type { Game } from './game.js';
import { run } from './runner.js';
import { adviseOn } from './advice.js';
import { draw } from './render.js';
import { DOWN, blowSeconds, swingAt } from './beat.js';
import { MUTE_LABEL, createSound } from './sound.js';
import { lineCount, onBackspace, onBracket, onEnter, onTab } from './editing.js';
import type { Blow, View } from './render.js';
import { TEXT, pickLang } from './strings.js';
import type { Lang } from './strings.js';

function need<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (found === null) throw new Error(`missing ${selector}`);
  return found;
}

const canvas = need<HTMLCanvasElement>('#stage');
const ctx = canvas.getContext('2d');
if (ctx === null) throw new Error('no canvas');
const paint: CanvasRenderingContext2D = ctx;

const conceptEl = need<HTMLElement>('#concept');
const briefEl = need<HTMLElement>('#brief');
const shownEl = need<HTMLElement>('#shown');
const signatureEl = need<HTMLElement>('#signature');
const bodyEl = need<HTMLTextAreaElement>('#body');
const submitEl = need<HTMLButtonElement>('#submit');
const hintEl = need<HTMLButtonElement>('#hint');
const saysEl = need<HTMLElement>('#says');
const hintsEl = need<HTMLElement>('#hints');
const curtainEl = need<HTMLElement>('#curtain');
const curtainTitleEl = need<HTMLElement>('#curtainTitle');
const curtainLeadEl = need<HTMLElement>('#curtainLead');
const curtainBodyEl = need<HTMLElement>('#curtainBody');
const curtainGoEl = need<HTMLButtonElement>('#curtainGo');
const muteEl = need<HTMLButtonElement>('#mute');
const gutterEl = need<HTMLElement>('#gutter');
const buildEl = need<HTMLElement>('#build');

/**
 * Which build is on screen.
 *
 * Read out of the shelf's own manifest rather than written here, so it cannot
 * drift from the version the game actually ships as — and shown in the corner,
 * because a whole round of "nothing has changed" turned out to be an old copy
 * of the page and there was no way to tell by looking.
 */
async function showBuild(): Promise<void> {
  try {
    const response = await fetch('../../games.json', { cache: 'no-store' });
    const data = (await response.json()) as { games?: readonly { id: string; version: string }[] };
    const mine = data.games?.find((g) => g.id === 'hman');
    buildEl.textContent = mine === undefined ? '' : `v${mine.version}`;
  } catch {
    buildEl.textContent = '';
  }
}

const lang: Lang = pickLang([navigator.language, ...navigator.languages]);
document.documentElement.lang = lang;
document.title = TEXT[lang].title;
const t = TEXT[lang];

let game: Game = createGame();
let view: View = { width: 1, height: 1 };
let clock = 0;
let busy = false;
/**
 * True while the worker is still running the player's code.
 *
 * This is the whole bug. `busy` was set before awaiting the worker, and the
 * loop reads an empty queue plus `busy` as "the fight has finished" — so
 * between pressing Strike and the code coming back, the loop decided the fight
 * was over, let the desk go and moved past the moment where clearing a rung is
 * noticed. By the time the real result arrived the loop had already finished
 * with it, so the mirror never fell and no card ever came.
 *
 * It depended on who got there first. In a page running at sixty frames a
 * second the loop always wins, which is why it never worked for a player; in a
 * throttled one the worker usually wins, which is why it kept passing here.
 */
let awaiting = false;

/** The blows from the last submit, played one at a time. */
let queue: Blow[] = [];
let blow: Blow | null = null;
let since = 0;
/** Whether this blow has already sounded, so it lands once and not every frame. */
let rang = false;
/** How many blows of this submit have already been thrown. */
let thrown = 0;
/** How long the blow on screen lasts. */
let span = 0;
const sound = createSound();

function resize(): void {
  const ratio = window.devicePixelRatio || 1;
  const box = canvas.getBoundingClientRect();
  const width = Math.round(box.width) || window.innerWidth;
  const height = Math.round(box.height) || 200;
  if (width === view.width && height === view.height && canvas.width === Math.round(width * ratio)) return;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  paint.setTransform(ratio, 0, 0, ratio, 0, 0);
  view = { width, height };
}

function say(message: string, tone: 'plain' | 'good' | 'bad' = 'plain'): void {
  saysEl.textContent = message;
  saysEl.className = `says${tone === 'plain' ? '' : ` ${tone}`}`;
}

/** Which rung the desk is currently showing, so it is not rebuilt under them. */
let onDesk = -1;

/**
 * Put a rung on the desk.
 *
 * Only when it is a different rung. Rebuilding it after every submit would
 * drop what they had written back to the starter line, which is exactly the
 * moment they most want it kept: a submit that got three cases out of four is
 * a thing to edit, not to start again.
 */
function showRung(): void {
  const level = levelAt(game.level);
  if (level === undefined) return;
  if (onDesk === game.level) {
    drawHints();
    return;
  }
  onDesk = game.level;

  conceptEl.textContent = level.concept[lang];
  briefEl.textContent = level.brief[lang];
  signatureEl.textContent = level.signature;

  shownEl.replaceChildren();
  const label = document.createElement('span');
  label.textContent = `${t.examples}:`;
  shownEl.append(label);
  for (const one of level.shown) {
    const bit = document.createElement('span');
    bit.textContent = `[${one.parts.join(', ')}] → ${JSON.stringify(one.want)}`;
    shownEl.append(bit);
  }

  bodyEl.value = level.starter;
  drawGutter();
  drawHints();
  say('');
}

function drawHints(): void {
  const level = levelAt(game.level);
  hintsEl.replaceChildren();
  if (level === undefined) return;

  for (let i = 0; i < game.hintsShown; i += 1) {
    const hint = level.hints[i];
    if (hint === undefined) continue;
    const row = document.createElement('div');
    const text = hint[lang];
    // The deepest hint is code, so it is set as code.
    if (i === level.hints.length - 1) {
      const pre = document.createElement('code');
      pre.textContent = text;
      row.append(pre);
    } else {
      row.textContent = text;
    }
    hintsEl.append(row);
  }

  const spent = game.hintsShown >= level.hints.length;
  hintEl.disabled = spent || busy || game.phase !== 'writing';
  hintEl.textContent = spent ? t.noMoreHints : t.hint;
}

async function strike(): Promise<void> {
  if (busy || game.phase !== 'writing') return;
  busy = true;
  awaiting = true;
  submitEl.disabled = true;
  hintEl.disabled = true;

  const source = bodyEl.value;
  const outcome = await run(source, casesOf(game));
  awaiting = false;

  if (outcome.fatal !== null) {
    // Nothing ran, so nothing is resolved — this is a miss, not a maul.
    const advice = adviseOn(source, outcome.fatal);
    if (advice === 'loop') say(t.looping, 'bad');
    else if (advice === 'annotation') say(t.annotation, 'bad');
    else say(`${t.threw}: ${outcome.fatal}`, 'bad');
    busy = false;
    submitEl.disabled = false;
    drawHints();
    return;
  }

  resolve(game, outcome.results);
  /*
   * Every blow carries the case it came from, because the case is the part
   * worth watching: a lunge says something happened, the numbers say what.
   *
   * But only the hits and the *first* miss are played. Four identical failures
   * in a row told the player nothing the first had not, and while they played
   * nothing could be pressed — six seconds of being unable to touch the thing
   * you are trying to fix, which is most of why this felt stuck rather than
   * slow.
   */
  const fresh = game.attempts.filter((a) => !a.repeat);
  const landed = fresh.filter((a) => a.hit);
  const firstMiss = fresh.find((a) => !a.hit);
  const shown = firstMiss === undefined ? landed : [...landed, firstMiss];
  queue = shown.map((a) => ({ landed: a.hit, parts: a.parts, got: a.got, want: a.want, error: a.error }));
  if (queue.length === 0) {
    const first = game.attempts[0];
    if (first !== undefined) {
      queue = [{ landed: true, parts: first.parts, got: first.got, want: first.want, error: null }];
    }
  }

  const missed = game.attempts.find((a) => !a.hit);
  if (missed === undefined) {
    say(t.cleared, 'good');
  } else if (missed.error !== null) {
    say(`${t.threw}: ${missed.error}`, 'bad');
  } else {
    say(
      `[${missed.parts.join(', ')}] — ${t.got} ${JSON.stringify(missed.got)}, ${t.wanted} ${JSON.stringify(missed.want)}`,
      'bad',
    );
  }
}

/** Walk the blows, then move the run on. */
function playOut(dt: number): void {
  // Nothing has happened yet: the code is still running.
  if (awaiting) return;

  if (blow === null) {
    const next = queue.shift();
    if (next === undefined) {
      if (busy) {
        busy = false;
        thrown = 0;
        if (game.phase === 'down') {
          // He topples first; the card waits until he is on the floor.
          downFor = 0;
          sound.play('lost');
        } else if (game.phase === 'cleared') {
          // So does the mirror, and that is the whole reward for the rung.
          clearedFor = 0;
          sound.play('cleared');
        } else {
          carryOn(game);
          showRung();
          submitEl.disabled = false;
        }
        drawHints();
      }
      return;
    }
    blow = next;
    since = 0;
    rang = false;
    span = blowSeconds(next.landed, thrown);
    thrown += 1;
    return;
  }

  since += dt;
  // The sound belongs at the moment of contact, not at the start of the
  // wind-up: a thud that arrives before the fist does reads as a glitch.
  if (!rang && swingAt(since, 1, span).struck) {
    rang = true;
    if (blow.error !== null) sound.play('broke');
    else if (blow.landed) {
      sound.play('hit');
      sound.play('shatter');
    } else sound.play('miss');
  }

  if (since >= span) {
    blow = null;
    since = 0;
  }
}

/**
 * The rung is beaten. Said out loud, with what comes next named, and left for
 * the player to step through — this is the only reward the game has and it
 * used to happen silently between two frames.
 */
function showCleared(): void {
  const next = levelAt(game.level + 1);
  curtainTitleEl.textContent = t.cleared;
  curtainLeadEl.textContent = `${t.rungDone} ${game.level + 1}/${levelCount()}`;
  curtainBodyEl.textContent = hasNext(game) && next !== undefined ? `${t.nextUp} ${next.concept[lang]}` : '';
  curtainGoEl.textContent = hasNext(game) ? t.goOn : t.finish;
  curtainEl.hidden = false;
}

function showEnd(): void {
  const won = game.phase === 'won';
  curtainTitleEl.textContent = won ? t.won : t.down;
  curtainLeadEl.textContent = won
    ? `${t.wonWhy} ${game.lives} ${t.lives}`
    : `${t.downWhy} ${game.level + 1}/${levelCount()}`;
  curtainBodyEl.textContent = `${score(game)} · ${game.hintsTaken} ${t.hintsTaken}`;
  curtainGoEl.textContent = won ? t.again : t.sameRung;
  curtainEl.hidden = false;
}

function showTitle(): void {
  curtainTitleEl.textContent = t.title;
  curtainLeadEl.textContent = t.premise;
  curtainBodyEl.textContent = `${t.howWrite} ${t.howWrong} ${t.howJs}`;
  curtainGoEl.textContent = t.begin;
  curtainEl.hidden = false;
}

function begin(): void {
  game = createGame();
  onDesk = -1;
  downFor = null;
  clearedFor = null;
  queue = [];
  blow = null;
  busy = false;
  curtainEl.hidden = true;
  submitEl.disabled = false;
  showRung();
  bodyEl.focus();
}

submitEl.textContent = t.submit;
labelMute();
hintEl.textContent = t.hint;
/**
 * Skip the rest of the fight.
 *
 * The desk is locked while it plays, so there has to be a way to cut it short:
 * someone who has already read the answer should not be made to sit through
 * the rest before they can edit.
 */
function skip(): void {
  if (!busy || awaiting) return;
  queue = [];
  blow = null;
  since = 0;
  thrown = 0;
}
canvas.addEventListener('pointerdown', skip);

submitEl.addEventListener('click', () => {
  sound.unlock();
  void strike();
});
hintEl.addEventListener('click', () => {
  sound.unlock();
  if (takeHint(game)) sound.play('hint');
  drawHints();
});

function labelMute(): void {
  const [on, off] = MUTE_LABEL[lang];
  muteEl.textContent = sound.muted ? off : on;
}
muteEl.addEventListener('click', () => {
  sound.unlock();
  sound.toggle();
  labelMute();
});
curtainGoEl.addEventListener('click', () => {
  sound.unlock();
  // Beaten by a rung, you get that rung again — not the whole run from the
  // bottom. What is cleared below stays cleared.
  if (game.phase === 'cleared') {
    // Asked before advancing, because afterwards the phase is narrowed to
    // what it was and reading it back to see if the run is over does not
    // compile.
    const wasLast = !hasNext(game);
    advance(game);
    clearedFor = null;
    queue = [];
    blow = null;
    busy = false;
    curtainEl.hidden = true;
    if (wasLast) {
      showEnd();
      return;
    }
    showRung();
    submitEl.disabled = false;
    bodyEl.focus();
    return;
  }
  if (game.phase === 'down') {
    retry(game);
    downFor = null;
    queue = [];
    blow = null;
    busy = false;
    curtainEl.hidden = true;
    onDesk = -1;
    showRung();
    submitEl.disabled = false;
    bodyEl.focus();
    return;
  }
  begin();
});

// Ctrl/Cmd+Enter submits, because reaching for the mouse mid-thought is the
// one thing a box like this must not make you do.
/** Numbers down the side, scrolled with the text. */
function drawGutter(): void {
  const lines = lineCount(bodyEl.value);
  let out = '';
  for (let i = 1; i <= lines; i += 1)
    out += `${i}
`;
  gutterEl.textContent = out;
  gutterEl.scrollTop = bodyEl.scrollTop;
}

/** Put an edit back into the box and leave the caret where it belongs. */
function apply(edit: { readonly text: string; readonly caret: number }): void {
  bodyEl.value = edit.text;
  bodyEl.selectionStart = edit.caret;
  bodyEl.selectionEnd = edit.caret;
  drawGutter();
}

bodyEl.addEventListener('scroll', () => {
  gutterEl.scrollTop = bodyEl.scrollTop;
});
bodyEl.addEventListener('input', drawGutter);

bodyEl.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    skip();
    return;
  }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void strike();
    return;
  }

  const start = bodyEl.selectionStart;
  const end = bodyEl.selectionEnd;

  if (event.key === 'Tab') {
    event.preventDefault();
    apply(onTab(bodyEl.value, start, end, event.shiftKey));
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    apply(onEnter(bodyEl.value, start));
    return;
  }
  if (start === end) {
    if (event.key === 'Backspace') {
      const edit = onBackspace(bodyEl.value, start);
      if (edit !== null) {
        event.preventDefault();
        apply(edit);
      }
      return;
    }
    if (event.key.length === 1) {
      const edit = onBracket(bodyEl.value, start, event.key);
      if (edit !== null) {
        event.preventDefault();
        apply(edit);
      }
    }
  }
});

let last = performance.now();
let drawFailed = false;
/** Seconds since he went down, or null while he is on his feet. */
let downFor: number | null = null;
/** Seconds since the mirror went down, or null while it still stands. */
let clearedFor: number | null = null;

/**
 * One step of the world.
 *
 * Split out of the frame callback on purpose. The desk is locked while the
 * blows play and the blows were advanced only by animation frames, so
 * anything that stopped the frames arriving left the run stuck with the
 * Strike button disabled and nothing the player could press. A backgrounded
 * tab does exactly that, and so does one throw inside the drawing, which
 * takes the whole loop with it and never schedules another frame.
 *
 * So the drawing is wrapped, and progress does not depend on it.
 */
function step(now: number, cap: number): void {
  const dt = Math.min((now - last) / 1000, cap);
  if (dt <= 0) return;
  last = now;
  clock += dt;

  if (downFor !== null) {
    downFor += dt;
    if (downFor >= DOWN && curtainEl.hidden) showEnd();
  }
  if (clearedFor !== null) {
    clearedFor += dt;
    if (clearedFor >= DOWN && curtainEl.hidden) showCleared();
  }
  playOut(dt);
  try {
    draw(paint, view, game, { lang, time: clock, blow, since, downFor, clearedFor, span });
  } catch (err) {
    if (!drawFailed) {
      drawFailed = true;
      console.error('hman: the fight could not be drawn', err);
    }
  }
}

function tick(now: number): void {
  step(now, 0.05);
  requestAnimationFrame(tick);
}

/**
 * Frames are a nicety; finishing the fight is not. If they stop coming the
 * blows still play out, slower and unwatched, and the desk comes back.
 */
window.setInterval(() => {
  const now = performance.now();
  if (now - last > 220) step(now, 0.3);
}, 140);

const watcher = new ResizeObserver(() => resize());
watcher.observe(canvas);
window.addEventListener('resize', resize);
resize();
showRung();
showTitle();
void showBuild();
requestAnimationFrame(tick);
