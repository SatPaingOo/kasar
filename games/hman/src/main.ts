/**
 * The loop, the canvas, the desk and the keyboard.
 *
 * Everything that decides anything is in game.ts; running what was typed is in
 * runner.ts; what the keys do to the text is in editing.ts. This wires them to
 * the page, and it is the only file that knows there is a DOM.
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
import { adviseOn, whyMissed } from './advice.js';
import { draw } from './render.js';
import { DOWN, blowSeconds, swingAt } from './beat.js';
import { MUTE_LABEL, createSound } from './sound.js';
import { lineCount, onBackspace, onEnter, onTab, onType, toggleComment } from './editing.js';
import type { Edit } from './editing.js';
import { tokenize } from './highlight.js';
import { CHAPTERS, LEVELS } from './levels.js';
import { nextUnbeaten, openUpTo, readProgress, withCleared, withDraft, writeProgress } from './progress.js';
import type { Progress, Store } from './progress.js';
import { readSignature } from './types.js';
import type { Signature } from './types.js';
import { callOf, show } from './values.js';
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
const headEl = need<HTMLElement>('#head');
const bodyEl = need<HTMLTextAreaElement>('#body');
const colourEl = need<HTMLElement>('#paint');
const gutterEl = need<HTMLElement>('#gutter');
const submitEl = need<HTMLButtonElement>('#submit');
const hintEl = need<HTMLButtonElement>('#hint');
const resetEl = need<HTMLButtonElement>('#reset');
const muteEl = need<HTMLButtonElement>('#mute');
const saysEl = need<HTMLElement>('#says');
const keysEl = need<HTMLElement>('#keys');
const hintsEl = need<HTMLElement>('#hints');
const curtainEl = need<HTMLElement>('#curtain');
const curtainTitleEl = need<HTMLElement>('#curtainTitle');
const curtainLeadEl = need<HTMLElement>('#curtainLead');
const curtainBodyEl = need<HTMLElement>('#curtainBody');
const lessonEl = need<HTMLElement>('#lesson');
const lessonTextEl = need<HTMLElement>('#lessonText');
const lessonAltEl = need<HTMLElement>('#lessonAlt');
const lessonAltLabelEl = need<HTMLElement>('#lessonAltLabel');
const lessonCodeEl = need<HTMLElement>('#lessonCode');
const curtainNextEl = need<HTMLElement>('#curtainNext');
const curtainGoEl = need<HTMLButtonElement>('#curtainGo');
const curtainAltEl = need<HTMLButtonElement>('#curtainAlt');
const mapEl = need<HTMLElement>('#map');
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

/** The browser's storage, or nothing if it is refused — a private window, say. */
function storage(): Store | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const store = storage();
const ids = LEVELS.map((level) => level.id);
let progress: Progress = readProgress(store);
let saving = 0;
/** Written a moment after typing stops, not on every key. */
function saveSoon(): void {
  window.clearTimeout(saving);
  saving = window.setTimeout(() => writeProgress(store, progress), 400);
}
function saveNow(): void {
  window.clearTimeout(saving);
  writeProgress(store, progress);
}

let game: Game = createGame();
let sig: Signature = readSignature(levelAt(0)?.signature ?? '');
let view: View = { width: 1, height: 1 };
let clock = 0;
let busy = false;
/**
 * True while the worker is still running the player's code.
 *
 * `busy` was once set before awaiting the worker, and the loop reads an empty
 * queue plus `busy` as "the fight has finished" — so between pressing Strike
 * and the code coming back, the loop decided the fight was over, let the desk
 * go and moved past the moment where clearing a rung is noticed. In a page
 * running at sixty frames a second the loop always won, which is why it never
 * worked for a player; in a throttled one the worker usually won, which is why
 * it kept passing here.
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
/** The line of the box the last mistake was on, marked in the gutter. */
let badLine: number | null = null;
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

// ── The editor ─────────────────────────────────────────────────────────

/** Colour a piece of code into an element, a span per token. */
function colour(into: HTMLElement, text: string, trailing: boolean): void {
  const pieces = document.createDocumentFragment();
  for (const token of tokenize(
    text,
    sig.params.map((p) => p.name),
  )) {
    if (token.tone === 'plain') {
      pieces.append(token.text);
      continue;
    }
    const span = document.createElement('span');
    span.className = `t-${token.tone}`;
    span.textContent = token.text;
    pieces.append(span);
  }
  // A <pre> does not give an empty last line any height, and a textarea does,
  // so without this the colour is one line short whenever the text ends in a
  // newline — and everything typed on that line has nothing under it.
  if (trailing) pieces.append('\n ');
  into.replaceChildren(pieces);
}

/** Numbers down the side, with the line of the last mistake marked. */
function drawGutter(): void {
  const lines = lineCount(bodyEl.value);
  const rows = document.createDocumentFragment();
  for (let i = 1; i <= lines; i += 1) {
    const row = document.createElement('div');
    row.textContent = String(i);
    if (i === badLine) row.className = 'bad';
    rows.append(row);
  }
  gutterEl.replaceChildren(rows);
}

/** The box is as tall as what is in it, so nothing ever scrolls out of sight. */
function grow(): void {
  bodyEl.style.height = 'auto';
  const extra = bodyEl.offsetHeight - bodyEl.clientHeight;
  bodyEl.style.height = `${bodyEl.scrollHeight + extra}px`;
}

function refresh(): void {
  colour(colourEl, bodyEl.value, true);
  drawGutter();
  grow();
  colourEl.scrollLeft = bodyEl.scrollLeft;
}

/** The text changed: the old mistake no longer applies, and it is worth keeping. */
function edited(): void {
  badLine = null;
  refresh();
  const level = levelAt(game.level);
  if (level !== undefined) {
    progress = withDraft(progress, level.id, bodyEl.value);
    saveSoon();
  }
}

/**
 * Put an edit into the box the way typing would be.
 *
 * `insertText` is old and marked as such, and it is still the only way to put
 * text into a textarea that the browser's own undo knows about. Setting the
 * value throws the whole history away, which is what the first version did:
 * the first bracket it closed for you was the last thing Ctrl+Z could reach.
 */
function apply(edit: Edit): void {
  bodyEl.focus();
  bodyEl.setSelectionRange(edit.from, edit.to);
  let done: boolean;
  try {
    if (edit.insert.length > 0) done = document.execCommand('insertText', false, edit.insert);
    else done = edit.from === edit.to || document.execCommand('delete');
  } catch {
    done = false;
  }
  if (!done) bodyEl.setRangeText(edit.insert, edit.from, edit.to, 'end');
  bodyEl.setSelectionRange(edit.start, edit.end);
  // insertText fires its own input event; the fallback does not.
  if (!done) edited();
}

function markLine(line: number | null): void {
  badLine = line !== null && line >= 1 && line <= lineCount(bodyEl.value) ? line : null;
  drawGutter();
}

// ── The desk ───────────────────────────────────────────────────────────

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
  sig = readSignature(level.signature);

  const chapter = CHAPTERS[level.chapter];
  conceptEl.textContent = `${t.chapter} ${level.chapter + 1}${chapter === undefined ? '' : ` · ${chapter[lang]}`} — ${level.concept[lang]}`;
  briefEl.textContent = level.brief[lang];

  shownEl.replaceChildren();
  const label = document.createElement('span');
  label.textContent = `${t.examples}:`;
  shownEl.append(label);
  for (const one of level.shown) {
    const bit = document.createElement('span');
    // In full: a record or a grid cut in the middle is no example at all.
    bit.textContent = `${callOf(one.args, 400)} → ${show(one.want, 400)}`;
    shownEl.append(bit);
  }

  colour(headEl, [...sig.above, `${sig.head} {`].join('\n'), false);
  bodyEl.value = progress.drafts[level.id] ?? level.starter;
  badLine = null;
  refresh();
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
  resetEl.disabled = busy || game.phase !== 'writing';
}

/**
 * Say why the first wrong case was wrong, as specifically as can be known.
 * The fight shows what came back; this says what to do about it.
 */
function explainMiss(source: string): void {
  const missed = game.attempts.find((a) => !a.hit);
  if (missed === undefined) {
    say(t.cleared, 'good');
    return;
  }
  const call = callOf(missed.args);
  const why = whyMissed({ got: missed.got, type: missed.type, error: missed.error }, sig.returns, source);
  switch (why.kind) {
    case 'threw': {
      markLine(missed.line);
      const at = badLine === null ? '' : ` (${t.onLine(badLine)})`;
      say(`${call} — ${t.threw}${at}: ${missed.error ?? ''}`, 'bad');
      return;
    }
    case 'deep':
      say(`${call} — ${t.deep}`, 'bad');
      return;
    case 'noReturn':
      say(`${call} — ${t.noReturn}`, 'bad');
      return;
    case 'notThere':
      say(`${call} — ${t.notThere}`, 'bad');
      return;
    case 'nan':
      say(`${call} — ${t.nan}`, 'bad');
      return;
    case 'promise':
      say(`${call} → ${missed.seen}. ${t.promised(sig.returnsText, missed.type)}`, 'bad');
      return;
    case 'value':
      say(t.gaveBack(call, missed.seen, show(missed.want)), 'bad');
      return;
  }
}

async function strike(): Promise<void> {
  if (busy || game.phase !== 'writing') return;
  busy = true;
  awaiting = true;
  submitEl.disabled = true;
  hintEl.disabled = true;
  resetEl.disabled = true;

  const source = bodyEl.value;
  const outcome = await run(
    source,
    sig.params.map((p) => p.name),
    casesOf(game),
  );
  awaiting = false;

  if (outcome.fatal !== null) {
    // Nothing ran, so nothing is resolved — this is a miss, not a maul.
    const advice = adviseOn(source, outcome.fatal);
    markLine(outcome.line);
    const at = badLine === null ? '' : ` (${t.onLine(badLine)})`;
    if (advice === 'loop') say(t.looping, 'bad');
    else if (advice === 'annotation') say(`${t.annotation}${at}`, 'bad');
    else say(`${t.threw}${at}: ${outcome.fatal}`, 'bad');
    busy = false;
    submitEl.disabled = false;
    drawHints();
    return;
  }

  resolve(game, outcome.results);
  const level = levelAt(game.level);
  // Read from the events rather than the phase: the guard at the top has
  // already narrowed the phase to 'writing' as far as the compiler can tell.
  if (game.events.some((e) => e.kind === 'cleared') && level !== undefined) {
    progress = withCleared(withDraft(progress, level.id, source), level.id);
    saveNow();
  }

  /*
   * Every blow carries the case it came from, because the case is the part
   * worth watching: a lunge says something happened, the call says what.
   *
   * But only the hits and the *first* miss are played. Four identical failures
   * in a row told the player nothing the first had not, and while they played
   * nothing could be pressed.
   */
  const fresh = game.attempts.filter((a) => !a.repeat);
  const landed = fresh.filter((a) => a.hit);
  const firstMiss = fresh.find((a) => !a.hit);
  const played = firstMiss === undefined ? landed : [...landed, firstMiss];
  queue = played.map((a) => ({ landed: a.hit, args: a.args, seen: a.seen, want: a.want, error: a.error }));
  if (queue.length === 0) {
    const first = game.attempts[0];
    if (first !== undefined) {
      queue = [{ landed: true, args: first.args, seen: first.seen, want: first.want, error: null }];
    }
  }

  explainMiss(source);
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

// ── The curtain ────────────────────────────────────────────────────────

/** What the big button on the curtain does right now. */
type Mode = 'title' | 'cleared' | 'down' | 'won';
let mode: Mode = 'title';
/** Where the title's main button starts the run. */
let startAt = 0;

function openCurtain(next: Mode): void {
  mode = next;
  lessonEl.hidden = true;
  mapEl.hidden = true;
  curtainAltEl.hidden = true;
  curtainNextEl.textContent = '';
  curtainBodyEl.textContent = '';
  curtainEl.hidden = false;
  curtainEl.scrollTop = 0;
}

/**
 * Every rung, by chapter, as buttons. The ones that can be started are live;
 * the rest are drawn anyway, because a ladder you can see the top of is one
 * worth climbing.
 */
function drawMap(): void {
  const open = openUpTo(progress, ids);
  const rows = document.createDocumentFragment();
  const heading = document.createElement('div');
  heading.className = 'pick';
  heading.textContent = t.pick;
  rows.append(heading);
  CHAPTERS.forEach((chapter, c) => {
    const row = document.createElement('div');
    row.className = 'chapter';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = `${t.chapter} ${c + 1} · ${chapter[lang]}`;
    row.append(name);
    LEVELS.forEach((level, i) => {
      if (level.chapter !== c) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(i + 1);
      button.title = level.concept[lang];
      button.disabled = i > open;
      if (progress.cleared.includes(level.id)) button.classList.add('done');
      if (i === startAt) button.classList.add('here');
      button.addEventListener('click', () => {
        sound.unlock();
        begin(i);
      });
      row.append(button);
    });
    rows.append(row);
  });
  mapEl.replaceChildren(rows);
  mapEl.hidden = false;
}

/**
 * The rung is beaten. Said out loud, with what it was and what comes next,
 * and left for the player to step through — this is the only reward the game
 * has, and naming what was just done is the part that teaches.
 */
function showCleared(): void {
  const level = levelAt(game.level);
  const next = levelAt(game.level + 1);
  openCurtain('cleared');
  curtainTitleEl.textContent = t.cleared;
  curtainLeadEl.textContent = `${t.rungDone} ${game.level + 1}/${levelCount()}`;

  if (level !== undefined) {
    lessonTextEl.textContent = level.lesson[lang];
    lessonEl.hidden = false;
    if (level.another === undefined) {
      lessonAltEl.hidden = true;
    } else {
      lessonAltLabelEl.textContent = `${t.another}:`;
      colour(lessonCodeEl, level.another, false);
      lessonAltEl.hidden = false;
    }
  }

  if (next !== undefined && level !== undefined) {
    const nextChapter = CHAPTERS[next.chapter];
    const thisChapter = CHAPTERS[level.chapter];
    curtainNextEl.textContent =
      next.chapter !== level.chapter && nextChapter !== undefined && thisChapter !== undefined
        ? `${t.chapterDone(thisChapter[lang])} ${t.nextChapter} ${nextChapter[lang]}`
        : `${t.nextUp} ${next.concept[lang]}`;
  }
  curtainGoEl.textContent = hasNext(game) ? t.goOn : t.finish;
  curtainGoEl.focus();
}

function showEnd(): void {
  const won = game.phase === 'won';
  openCurtain(won ? 'won' : 'down');
  curtainTitleEl.textContent = won ? t.won : t.down;
  curtainLeadEl.textContent = won ? t.wonWhy(levelCount()) : `${t.downWhy} ${game.level + 1}/${levelCount()}`;
  curtainBodyEl.textContent = `${score(game)} · ${game.hintsTaken} ${t.hintsTaken}`;
  curtainGoEl.textContent = won ? t.again : t.sameRung;
  curtainGoEl.focus();
}

function showTitle(): void {
  openCurtain('title');
  curtainTitleEl.textContent = t.title;
  curtainLeadEl.textContent = t.premise;
  curtainBodyEl.textContent = `${t.howWrite} ${t.howWrong} ${t.howJs}`;
  startAt = nextUnbeaten(progress, ids);
  const returning = progress.cleared.length > 0;
  curtainGoEl.textContent = returning ? t.carryOn(startAt + 1) : t.begin;
  curtainAltEl.textContent = t.fromStart;
  curtainAltEl.hidden = !returning || startAt === 0;
  drawMap();
}

function begin(start: number): void {
  game = createGame(start);
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
resetEl.textContent = t.reset;
keysEl.textContent = t.keys;
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
/** Back to what the rung started with — as an edit, so it can be undone. */
resetEl.addEventListener('click', () => {
  const level = levelAt(game.level);
  if (level === undefined || busy) return;
  const starter = level.starter;
  apply({ from: 0, to: bodyEl.value.length, insert: starter, start: starter.length, end: starter.length });
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
  if (mode === 'cleared') {
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
  if (mode === 'down') {
    // Beaten by a rung, you get that rung again — not the whole run from the
    // bottom, and not an empty box either: what you wrote is what you fix.
    retry(game);
    downFor = null;
    queue = [];
    blow = null;
    busy = false;
    curtainEl.hidden = true;
    showRung();
    say('');
    submitEl.disabled = false;
    bodyEl.focus();
    return;
  }
  if (mode === 'won') {
    showTitle();
    return;
  }
  begin(startAt);
});
curtainAltEl.addEventListener('click', () => {
  sound.unlock();
  begin(0);
});

// ── Keys ───────────────────────────────────────────────────────────────

bodyEl.addEventListener('scroll', () => {
  colourEl.scrollLeft = bodyEl.scrollLeft;
});
bodyEl.addEventListener('input', edited);

bodyEl.addEventListener('keydown', (event) => {
  if (event.isComposing) return;
  const mod = event.ctrlKey || event.metaKey;

  if (event.key === 'Escape') {
    skip();
    return;
  }
  // Ctrl/Cmd+Enter submits, because reaching for the mouse mid-thought is the
  // one thing a box like this must not make you do.
  if (event.key === 'Enter' && mod) {
    event.preventDefault();
    void strike();
    return;
  }
  if (mod && (event.key === '/' || event.code === 'Slash')) {
    event.preventDefault();
    apply(toggleComment(bodyEl.value, bodyEl.selectionStart, bodyEl.selectionEnd));
    return;
  }
  if (mod || event.altKey) return;

  const start = bodyEl.selectionStart;
  const end = bodyEl.selectionEnd;
  let edit: Edit | null = null;

  if (event.key === 'Tab') edit = onTab(bodyEl.value, start, end, event.shiftKey);
  else if (event.key === 'Enter' && !event.shiftKey) edit = onEnter(bodyEl.value, start, end);
  else if (event.key === 'Backspace') edit = onBackspace(bodyEl.value, start, end);
  else if (event.key.length === 1) edit = onType(bodyEl.value, start, end, event.key);

  if (event.key === 'Tab') event.preventDefault();
  if (edit !== null) {
    event.preventDefault();
    apply(edit);
  }
});

// ── The loop ───────────────────────────────────────────────────────────

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

window.addEventListener('pagehide', saveNow);

const watcher = new ResizeObserver(() => resize());
watcher.observe(canvas);
window.addEventListener('resize', resize);
resize();
showRung();
showTitle();
void showBuild();
requestAnimationFrame(tick);
