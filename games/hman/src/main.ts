/**
 * The loop, the canvas, the desk and the keyboard.
 *
 * Everything that decides anything is in game.ts; running what was typed is in
 * runner.ts. This wires the two to the page, and it is the only file that
 * knows there is a DOM.
 */

import { advance, casesOf, createGame, levelAt, levelCount, resolve, score, takeHint } from './game.js';
import type { Game } from './game.js';
import { run } from './runner.js';
import { adviseOn } from './advice.js';
import { draw } from './render.js';
import { BLOW, swingAt } from './beat.js';
import { MUTE_LABEL, createSound } from './sound.js';
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

const lang: Lang = pickLang([navigator.language, ...navigator.languages]);
document.documentElement.lang = lang;
document.title = TEXT[lang].title;
const t = TEXT[lang];

let game: Game = createGame();
let view: View = { width: 1, height: 1 };
let clock = 0;
let busy = false;

/** The blows from the last submit, played one at a time. */
let queue: Blow[] = [];
let blow: Blow | null = null;
let since = 0;
/** Whether this blow has already sounded, so it lands once and not every frame. */
let rang = false;
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
  submitEl.disabled = true;
  hintEl.disabled = true;

  const source = bodyEl.value;
  const outcome = await run(source, casesOf(game));

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
  // Every blow carries the case it came from, because the case is the part
  // worth watching: a lunge says something happened, the numbers say what.
  queue = game.attempts
    .filter((a) => !a.repeat)
    .map((a) => ({ landed: a.hit, parts: a.parts, got: a.got, want: a.want, error: a.error }));
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
  if (blow === null) {
    const next = queue.shift();
    if (next === undefined) {
      if (busy) {
        busy = false;
        advance(game);
        if (game.phase === 'won' || game.phase === 'lost') {
          sound.play(game.phase === 'won' ? 'won' : 'lost');
          showEnd();
        } else {
          if (game.solved.every((d) => d)) sound.play('cleared');
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
    return;
  }

  since += dt;
  // The sound belongs at the moment of contact, not at the start of the
  // wind-up: a thud that arrives before the fist does reads as a glitch.
  if (!rang && swingAt(since).struck) {
    rang = true;
    if (blow.error !== null) sound.play('broke');
    else if (blow.landed) {
      sound.play('hit');
      sound.play('shatter');
    } else sound.play('miss');
  }

  if (since >= BLOW) {
    blow = null;
    since = 0;
  }
}

function showEnd(): void {
  const won = game.phase === 'won';
  curtainTitleEl.textContent = won ? t.won : t.lost;
  curtainLeadEl.textContent = won
    ? `${t.wonWhy} ${game.lives} ${t.lives}`
    : `${t.lostWhy} ${game.cleared}/${levelCount()}`;
  curtainBodyEl.textContent = `${score(game)} · ${game.hintsTaken} ${t.hintsTaken}`;
  curtainGoEl.textContent = t.again;
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
  begin();
});

// Ctrl/Cmd+Enter submits, because reaching for the mouse mid-thought is the
// one thing a box like this must not make you do.
bodyEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void strike();
  }
});

let last = performance.now();
let drawFailed = false;

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
  playOut(dt);
  try {
    draw(paint, view, game, { lang, time: clock, blow, since });
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
requestAnimationFrame(tick);
