/**
 * Drawing the circle.
 *
 * Nothing here decides anything: it reads the game and paints it. What it is
 * careful about is that everything the ear is told, the eye is told too — the
 * drums light as the call plays them, the frame pulses on the beat, and a row
 * of dots under the circle spells out the rhythm — so the game can be played
 * with the sound off.
 */

import { RULES, drumsAt, spanAt } from './game.js';
import type { Game, Span, Why } from './game.js';
import { CIRCLE, KEYS, angleOf } from './circle.js';
import { drawFigure } from './figure.js';
import type { Hand, Point } from './figure.js';
import { TEXT } from './strings.js';
import type { Lang } from './strings.js';

/** Red lacquer and gold leaf, which is what a pat waing's frame is made of. */
const LACQUER = {
  stageHigh: '#241113',
  stageLow: '#0e0708',
  spot: '255, 214, 160',
  floor: '#2a1612',
  mat: '#5b1c18',
  matEdge: '#a8792f',
  wallIn: '#4a1414',
  wallOut: '#8f2a22',
  wallShade: '#5e1a16',
  gold: '#d6a443',
  goldDim: '#8a6a2e',
  goldLit: '#ffdb86',
  skin: '#e8d8b8',
  skinDim: '#b9a888',
  paste: '#4b3a2c',
  wood: '#8a4f24',
  woodDark: '#5a3216',
  call: '255, 214, 120',
  mine: '235, 122, 95',
  wrong: '150, 140, 140',
  figure: '#f2e8d6',
  ink: '#f2e8d6',
  inkDim: '#a8968a',
  veil: 'rgba(14, 7, 8, 0.8)',
} as const;

export type Phase = 'title' | 'playing' | 'paused' | 'over';

export interface Ring {
  readonly cx: number;
  /** The rim, where the drum heads sit. */
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  /** How tall the frame is, in pixels. */
  readonly wall: number;
}

export interface View {
  readonly width: number;
  readonly height: number;
  readonly ring: Ring;
}

/** A drum struck by the player, for its flash and his hand. */
export interface Struck {
  readonly drum: number;
  readonly at: number;
  readonly good: boolean;
}

/** A word that rises off a drum and fades: on, early, late. */
export interface Word {
  readonly drum: number;
  readonly at: number;
  readonly text: string;
}

export interface Ui {
  readonly lang: Lang;
  readonly phase: Phase;
  /** The game's clock, in seconds. */
  readonly time: number;
  /** Wall time, for anything that moves while the game is not running. */
  readonly clock: number;
  readonly touch: boolean;
  readonly overFor: number;
  readonly struck: readonly Struck[];
  readonly words: readonly Word[];
  /** Why the last phrase broke, and when, while it is still worth saying. */
  readonly broke: { readonly why: Why; readonly at: number } | null;
  readonly best: number;
  readonly muted: boolean;
}

const HUD = 52;
const STATUS = 30;
const DOTS = 40;

export function layout(width: number, height: number): View {
  // Seen from higher up on a tall screen, so a phone held upright gets a
  // rounder circle instead of a thin band across its middle.
  const squash = Math.max(0.5, Math.min(0.72, (height / Math.max(1, width)) * 0.4));
  const roomTall = Math.max(60, (height - HUD - STATUS - DOTS - 40) / (2 + 0.32 + 0.15));
  const rx = Math.max(60, Math.min(width * 0.43, 330, roomTall / squash));
  const ry = rx * squash;
  const wall = ry * 0.32;
  const needed = HUD + STATUS + ry * 1.15 + ry + wall + DOTS + 16;
  const cy = HUD + STATUS + ry * 1.15 + Math.max(0, (height - needed) / 2);
  return { width, height, ring: { cx: width / 2, cy, rx, ry, wall } };
}

/** Screen coordinates to the ring's own, which is what `drumAt` takes. */
export function toRing(view: View, x: number, y: number): Point {
  const r = view.ring;
  return { x: (x - r.cx) / r.rx, y: (y - r.cy) / r.ry };
}

const ease = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

interface Placed {
  readonly i: number;
  readonly x: number;
  readonly y: number;
  /** Half the width of the head, in pixels. */
  readonly r: number;
  readonly angle: number;
  /** 0 to 1, for a drum still arriving. */
  readonly here: number;
}

/** Where every drum in the circle is at time `t`, sliding round to make room when one joins. */
export function placeDrums(view: View, game: Game, t: number): Placed[] {
  const ring = view.ring;
  const n = drumsAt(game, t);
  const s = spanAt(game, t);
  const arriving = s !== null && s.kind === 'join' ? ease((t - s.start) / 0.9) : 1;
  const placed: Placed[] = [];
  for (let i = 0; i < n; i += 1) {
    const newest = i === n - 1 && arriving < 1;
    const a =
      arriving >= 1 || newest || n <= 1
        ? angleOf(i, n)
        : angleOf(i, n - 1) + (angleOf(i, n) - angleOf(i, n - 1)) * arriving;
    placed.push({
      i,
      x: ring.cx + Math.cos(a) * ring.rx * CIRCLE.inset,
      y: ring.cy + Math.sin(a) * ring.ry * CIRCLE.inset,
      // The low drums are the big ones, and the near ones look it.
      r: ring.rx * (0.125 - i * 0.007) * (1 + Math.sin(a) * 0.1),
      angle: a,
      here: newest ? arriving : 1,
    });
  }
  return placed;
}

/** How brightly each drum is lit by the circle playing it, 0 to 1. */
function callGlow(game: Game, t: number, drum: number): number {
  let glow = 0;
  for (const s of game.spans) {
    if (s.start > t) break;
    if (t - (s.start + s.beats * s.beat) > 0.6) continue;
    const times: number[] = [];
    if (s.kind === 'call') {
      for (const note of game.piece[s.round]?.notes ?? []) {
        if (note.drum === drum) times.push(s.start + note.beat * s.beat);
      }
    } else if (s.kind === 'join' && drum === drumsAt(game, s.start) - 1) {
      times.push(s.start, s.start + 2 * s.beat);
    }
    for (const at of times) {
      const since = t - at;
      if (since >= 0 && since < 0.45) glow = Math.max(glow, 1 - since / 0.45);
    }
  }
  return glow;
}

/** Which way he should be listening: towards the last drum the call played, fading. */
function listening(game: Game, t: number): number {
  let latest = -Infinity;
  let drum = -1;
  for (const s of game.spans) {
    if (s.kind !== 'call' || s.start > t) continue;
    for (const note of game.piece[s.round]?.notes ?? []) {
      const at = s.start + note.beat * s.beat;
      if (at <= t && at > latest) {
        latest = at;
        drum = note.drum;
      }
    }
  }
  if (drum < 0) return 0;
  const fade = Math.max(0, 1 - (t - latest) / 0.9);
  return Math.cos(angleOf(drum, drumsAt(game, t))) * fade;
}

/** 1 on the beat, falling away before the next — the pulse the frame shows. */
function pulse(s: Span | null, t: number): { readonly beat: number; readonly first: boolean } {
  if (s === null || t < s.start) return { beat: 0, first: false };
  const b = (t - s.start) / s.beat;
  const whole = Math.floor(b);
  if (whole >= s.beats) return { beat: 0, first: false };
  return { beat: Math.exp(-(b - whole) * 5), first: whole === 0 && s.kind !== 'breath' };
}

function drawStage(ctx: CanvasRenderingContext2D, view: View, light: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, view.height);
  sky.addColorStop(0, LACQUER.stageHigh);
  sky.addColorStop(1, LACQUER.stageLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.width, view.height);

  const r = view.ring;
  const spot = ctx.createRadialGradient(r.cx, r.cy, r.rx * 0.1, r.cx, r.cy + r.wall, r.rx * 1.7);
  spot.addColorStop(0, `rgba(${LACQUER.spot}, ${0.16 * light})`);
  spot.addColorStop(1, `rgba(${LACQUER.spot}, 0)`);
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, view.width, view.height);
}

/** The floor inside the frame, and the mat he sits on. */
function drawFloor(ctx: CanvasRenderingContext2D, view: View): void {
  const r = view.ring;
  ctx.fillStyle = LACQUER.floor;
  ctx.beginPath();
  ctx.ellipse(r.cx, r.cy + r.wall, r.rx, r.ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = LACQUER.mat;
  ctx.strokeStyle = LACQUER.matEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(r.cx, r.cy + r.wall * 0.95, r.rx * 0.36, r.ry * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** A band of the frame between two angles: the rim on top, the floor below. */
function band(ctx: CanvasRenderingContext2D, r: Ring, from: number, to: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(r.cx, r.cy, r.rx, r.ry, 0, from, to, false);
  ctx.ellipse(r.cx, r.cy + r.wall, r.rx, r.ry, 0, to, from, true);
  ctx.closePath();
  ctx.fill();
}

function drawBackWall(ctx: CanvasRenderingContext2D, view: View): void {
  const r = view.ring;
  band(ctx, r, Math.PI, Math.PI * 2, LACQUER.wallIn);
  ctx.strokeStyle = LACQUER.goldDim;
  ctx.lineWidth = Math.max(1.5, r.wall * 0.08);
  ctx.beginPath();
  ctx.ellipse(r.cx, r.cy, r.rx, r.ry, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
}

/**
 * The front of the frame, red lacquer with gold along it, open in the middle
 * where he got in. The flame points along the top brighten on every beat and
 * most on the first of a phrase — the clapper, drawn.
 */
function drawFrontWall(ctx: CanvasRenderingContext2D, view: View, beat: number, first: boolean, tint: string): void {
  const r = view.ring;
  const gapFrom = Math.PI / 2 - CIRCLE.gap / 2;
  const gapTo = Math.PI / 2 + CIRCLE.gap / 2;
  const pieces: readonly (readonly [number, number])[] = [
    [0, gapFrom],
    [gapTo, Math.PI],
  ];
  for (const [from, to] of pieces) {
    band(ctx, r, from, to, LACQUER.wallOut);
    // A darker foot to the wall, so it reads as standing on the floor.
    ctx.strokeStyle = LACQUER.wallShade;
    ctx.lineWidth = Math.max(2, r.wall * 0.18);
    ctx.beginPath();
    ctx.ellipse(r.cx, r.cy + r.wall * 0.88, r.rx, r.ry, 0, from, to);
    ctx.stroke();
    for (const [dy, width] of [
      [0, 0.12],
      [0.62, 0.06],
    ] as const) {
      ctx.strokeStyle = LACQUER.gold;
      ctx.lineWidth = Math.max(1.5, r.wall * width);
      ctx.beginPath();
      ctx.ellipse(r.cx, r.cy + r.wall * dy, r.rx, r.ry, 0, from, to);
      ctx.stroke();
    }
  }

  // Flame points along the rim, all the way round but the opening.
  const count = 26;
  const glow = first ? beat : beat * 0.55;
  for (let k = 0; k <= count; k += 1) {
    const a = gapTo + ((Math.PI * 2 - CIRCLE.gap) * k) / count;
    const x = r.cx + Math.cos(a) * r.rx;
    const y = r.cy + Math.sin(a) * r.ry;
    const front = Math.sin(a) > -0.05;
    const h = r.wall * (front ? 0.42 : 0.3) * (1 + glow * 0.35);
    ctx.fillStyle = glow > 0.05 ? tint : LACQUER.gold;
    ctx.globalAlpha = (front ? 0.95 : 0.55) * (0.65 + glow * 0.35);
    ctx.beginPath();
    ctx.moveTo(x - h * 0.32, y);
    ctx.quadraticCurveTo(x - h * 0.1, y - h * 0.55, x, y - h);
    ctx.quadraticCurveTo(x + h * 0.1, y - h * 0.55, x + h * 0.32, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawDrum(
  ctx: CanvasRenderingContext2D,
  view: View,
  d: Placed,
  lit: { readonly glow: number; readonly colour: string },
  label: string | null,
  behind: boolean,
): void {
  const squash = view.ring.ry / view.ring.rx;
  const r = d.r * (0.6 + d.here * 0.4);
  ctx.globalAlpha = d.here;

  // The barrel, which only shows on the drums at the back: the front of the
  // frame hides the front ones' below the rim.
  if (behind) {
    const depth = r * 0.95;
    ctx.fillStyle = LACQUER.wood;
    ctx.beginPath();
    ctx.ellipse(d.x, d.y + depth, r * 0.86, r * squash * 0.86, 0, 0, Math.PI);
    ctx.lineTo(d.x - r, d.y);
    ctx.ellipse(d.x, d.y, r, r * squash, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = LACQUER.woodDark;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = lit.glow > 0 ? mix(LACQUER.skin, '#fff6dc', lit.glow) : LACQUER.skin;
  ctx.beginPath();
  ctx.ellipse(d.x, d.y, r, r * squash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = LACQUER.skinDim;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // The dab of tuning paste in the middle of the head, which is what gives a
  // pat waing drum its pitch.
  ctx.fillStyle = LACQUER.paste;
  ctx.beginPath();
  ctx.ellipse(d.x, d.y, r * 0.42, r * 0.42 * squash, 0, 0, Math.PI * 2);
  ctx.fill();

  if (lit.glow > 0) {
    ctx.strokeStyle = `rgba(${lit.colour}, ${lit.glow})`;
    ctx.lineWidth = 2.5 + lit.glow * 2;
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, r * 1.08, r * squash * 1.08, 0, 0, Math.PI * 2);
    ctx.stroke();
    const out = 1.1 + (1 - lit.glow) * 0.9;
    ctx.strokeStyle = `rgba(${lit.colour}, ${lit.glow * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, r * out, r * squash * out, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (label !== null) {
    ctx.fillStyle = LACQUER.skin;
    ctx.font = `600 ${Math.max(10, Math.min(15, r * 0.5))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, d.x, d.y + 0.5);
  }
  ctx.globalAlpha = 1;
}

/** Blend two #rrggbb colours. */
function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((k) => parseInt(a.slice(k, k + 2), 16));
  const pb = [1, 3, 5].map((k) => parseInt(b.slice(k, k + 2), 16));
  const c = pa.map((v, k) => Math.round(v + ((pb[k] ?? v) - v) * t));
  return `rgb(${c.join(', ')})`;
}

/** The round the screen is about at time `t`. */
function roundShown(game: Game, t: number): number {
  const s = spanAt(game, t);
  return s === null ? game.round : s.round;
}

/**
 * The rhythm, spelled out: one dot per note, spaced by when it falls, lit as
 * the call plays it and filled as the player plays it back. It says how many
 * notes there are and how they sit against the beat — never which drum.
 */
function drawDots(ctx: CanvasRenderingContext2D, view: View, game: Game, t: number): void {
  const round = roundShown(game, t);
  const phrase = game.piece[round];
  if (phrase === undefined) return;
  const s = spanAt(game, t);
  const r = view.ring;
  const y = r.cy + r.ry + r.wall + DOTS * 0.55;
  const step = Math.min(30, (view.width * 0.8) / Math.max(1, phrase.beats));
  const left = view.width / 2 - (step * (phrase.beats - 1)) / 2;

  // A faint tick per beat underneath, so a split beat reads as one beat.
  ctx.fillStyle = LACQUER.inkDim;
  ctx.globalAlpha = 0.35;
  for (let b = 0; b < phrase.beats; b += 1) ctx.fillRect(left + b * step - 0.5, y + 8, 1, 4);
  ctx.globalAlpha = 1;

  const answer = game.answer;
  phrase.notes.forEach((note, k) => {
    const x = left + note.beat * step;
    let fill: string | null = null;
    if (s !== null && s.kind === 'call' && s.round === round && t >= s.start + note.beat * s.beat) {
      fill = `rgb(${LACQUER.call})`;
    } else if (answer !== null && answer.round === round && (s?.kind === 'answer' || answer.state !== 'open')) {
      if (k < answer.next) fill = `rgb(${LACQUER.mine})`;
    }
    ctx.beginPath();
    ctx.arc(x, y, note.beat % 1 === 0 ? 4.5 : 3.6, 0, Math.PI * 2);
    if (fill !== null) {
      ctx.fillStyle = fill;
      ctx.fill();
    } else {
      ctx.strokeStyle = LACQUER.inkDim;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  });
}

function drawHud(ctx: CanvasRenderingContext2D, view: View, game: Game, ui: Ui): void {
  const t = TEXT[ui.lang];
  const round = Math.min(game.piece.length, roundShown(game, ui.time) + 1);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = LACQUER.inkDim;
  ctx.font = '500 11px system-ui, sans-serif';
  ctx.fillText(t.phrase, 46, HUD * 0.4);
  ctx.fillStyle = LACQUER.ink;
  ctx.font = '600 21px system-ui, sans-serif';
  ctx.fillText(`${round}`, 46, HUD * 0.86);
  const wide = ctx.measureText(`${round}`).width;
  ctx.fillStyle = LACQUER.inkDim;
  ctx.font = '500 13px system-ui, sans-serif';
  ctx.fillText(` / ${game.piece.length}`, 46 + wide, HUD * 0.86);

  // Lives as three small drum heads, the score beside them.
  ctx.textAlign = 'right';
  ctx.fillStyle = LACQUER.inkDim;
  ctx.font = '500 11px system-ui, sans-serif';
  ctx.fillText(ui.muted ? `${t.score} · ${t.muted}` : t.score, view.width - 16, HUD * 0.4);
  ctx.fillStyle = LACQUER.ink;
  ctx.font = '600 21px system-ui, sans-serif';
  ctx.fillText(`${game.score}`, view.width - 16, HUD * 0.86);
  const scoreWide = ctx.measureText(`${game.score}`).width;
  for (let k = 0; k < RULES.lives; k += 1) {
    const x = view.width - 16 - scoreWide - 16 - k * 15;
    ctx.beginPath();
    ctx.ellipse(x, HUD * 0.72, 5.5, 3.6, 0, 0, Math.PI * 2);
    if (RULES.lives - 1 - k < game.lives) {
      ctx.fillStyle = LACQUER.skin;
      ctx.fill();
    } else {
      ctx.strokeStyle = LACQUER.inkDim;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
}

function drawStatus(ctx: CanvasRenderingContext2D, view: View, game: Game, ui: Ui): void {
  if (ui.phase !== 'playing') return;
  const t = TEXT[ui.lang];
  const s = spanAt(game, ui.time);
  let text = '';
  let colour: string = LACQUER.inkDim;
  if (ui.broke !== null && ui.time - ui.broke.at < 1.1) {
    text = t.why[ui.broke.why];
    colour = LACQUER.ink;
  } else if (s !== null) {
    if (s.kind === 'count') text = t.count;
    else if (s.kind === 'call') [text, colour] = [t.listen, `rgb(${LACQUER.call})`];
    else if (s.kind === 'answer') [text, colour] = [t.play, `rgb(${LACQUER.mine})`];
    else if (s.kind === 'breath') text = t.again;
    else text = t.joins;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colour;
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillText(text, view.width / 2, HUD + STATUS * 0.45);
}

const face = (size: number): string => `${size > 20 ? 600 : 400} ${size}px system-ui, sans-serif`;

/** Shrink before wrapping: Burmese arrives as one unbreakable run. */
function fitLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  maxWidth: number,
): { readonly size: number; readonly lines: readonly string[] } {
  let chosen = size;
  const words = text.split(' ');
  for (let guard = 0; guard < 24; guard += 1) {
    ctx.font = face(chosen);
    const widest = Math.max(...words.map((w) => ctx.measureText(w).width));
    if (widest <= maxWidth || chosen <= 9) break;
    chosen -= 1;
  }
  ctx.font = face(chosen);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (line !== '' && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line !== '') lines.push(line);
  return { size: chosen, lines };
}

function centred(
  ctx: CanvasRenderingContext2D,
  view: View,
  lines: readonly (readonly [string, number, string])[],
): void {
  const maxWidth = Math.min(view.width * 0.88, 560);
  const laid = lines.map(([text, size, colour]) => ({ colour, ...fitLine(ctx, text, size, maxWidth) }));
  let total = 0;
  for (const block of laid) total += block.size * 1.45 * block.lines.length + block.size * 0.9;

  let py = view.height / 2 - total / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const block of laid) {
    ctx.font = face(block.size);
    ctx.fillStyle = block.colour;
    for (const line of block.lines) {
      py += block.size * 1.45;
      ctx.fillText(line, view.width / 2, py - block.size * 0.725);
    }
    py += block.size * 0.9;
  }
}

/** A hand's reach for a strike made `since` seconds ago: out fast, back slower. */
function reachFor(since: number): number {
  if (since < 0) return 0;
  if (since < 0.05) return since / 0.05;
  return Math.max(0, 1 - (since - 0.05) / 0.2);
}

export function draw(ctx: CanvasRenderingContext2D, view: View, game: Game, ui: Ui): void {
  const t = ui.phase === 'title' ? 0 : ui.time;
  const ring = view.ring;
  const s = spanAt(game, t);
  const playing = ui.phase === 'playing';
  const { beat, first } = playing ? pulse(s, t) : { beat: 0, first: false };
  const over = ui.phase === 'over';
  const stopped = over && game.outcome === 'stopped';
  const finished = over && game.outcome === 'finished';
  const fall = stopped ? ease(ui.overFor / 1.1) : 0;

  drawStage(ctx, view, 1 - fall * 0.6);
  drawFloor(ctx, view);
  drawBackWall(ctx, view);

  const drums = placeDrums(view, game, t);
  const n = drums.length;
  const lit = (i: number): { glow: number; colour: string } => {
    let glow = playing ? callGlow(game, t, i) : 0;
    let colour: string = LACQUER.call;
    // Behind the title the circle plays to itself, slowly, round and back.
    if (ui.phase === 'title') {
      const beat = ui.clock / 0.6;
      const order = [0, 1, 2, 1];
      if (order[Math.floor(beat) % order.length] === i) glow = 1 - (beat % 1);
    }
    for (const hit of ui.struck) {
      if (hit.drum !== i) continue;
      const g = 1 - (ui.time - hit.at) / 0.4;
      if (g > glow) {
        glow = g;
        colour = hit.good ? LACQUER.mine : LACQUER.wrong;
      }
    }
    // The piece through: every drum flashes in turn, low to high, as the
    // flourish runs up them.
    if (finished) {
      const since = ui.overFor - 0.25 - i * 0.075;
      if (since >= 0 && since < 0.5) [glow, colour] = [Math.max(glow, 1 - since / 0.5), LACQUER.call];
      const last = ui.overFor - 0.25 - n * 0.075 - 0.15;
      if (last >= 0 && last < 0.9) [glow, colour] = [Math.max(glow, 1 - last / 0.9), LACQUER.call];
    }
    return { glow: Math.max(0, glow), colour };
  };
  const label = (i: number): string | null =>
    ui.touch || ui.phase === 'title' ? null : (KEYS[i]?.toUpperCase() ?? null);

  const behind = drums.filter((d) => d.y < ring.cy).sort((a, b) => a.y - b.y);
  const before = drums.filter((d) => d.y >= ring.cy).sort((a, b) => a.y - b.y);
  for (const d of behind) drawDrum(ctx, view, d, lit(d.i), label(d.i), true);

  // His hands: each strike goes to the hand on that side of him, and a drum
  // straight behind him to whichever hand struck less recently.
  const seat: Point = { x: ring.cx, y: ring.cy + ring.wall * 0.85 };
  let left: Hand = { to: null, reach: 0 };
  let right: Hand = { to: null, reach: 0 };
  let leftAt = -Infinity;
  let rightAt = -Infinity;
  for (const hit of ui.struck) {
    const d = drums[hit.drum];
    if (d === undefined) continue;
    const to: Point = { x: d.x - seat.x, y: d.y - seat.y };
    const hand: Hand = { to, reach: reachFor(ui.time - hit.at) };
    const side = Math.abs(to.x) < ring.rx * 0.12 ? (leftAt <= rightAt ? -1 : 1) : Math.sign(to.x);
    if (side < 0 && hit.at >= leftAt) [left, leftAt] = [hand, hit.at];
    else if (side >= 0 && hit.at >= rightAt) [right, rightAt] = [hand, hit.at];
  }
  drawFigure(
    ctx,
    seat.x,
    seat.y,
    ring.ry * 0.86,
    {
      left,
      right,
      nod: beat * (first ? 1 : 0.6),
      listen: playing && s?.kind === 'call' ? listening(game, t) : 0,
      slump: fall,
      lift: finished ? ease((ui.overFor - 0.2) / 0.6) : 0,
    },
    LACQUER.figure,
  );

  drawFrontWall(
    ctx,
    view,
    beat * (1 - fall),
    first,
    s?.kind === 'answer' ? `rgb(${LACQUER.mine})` : `rgb(${LACQUER.call})`,
  );
  for (const d of before) drawDrum(ctx, view, d, lit(d.i), label(d.i), false);

  // Words off the drums: on, early, late.
  for (const word of ui.words) {
    const d = drums[word.drum];
    const since = ui.time - word.at;
    if (d === undefined || since < 0 || since > 0.8) continue;
    ctx.globalAlpha = 1 - since / 0.8;
    ctx.fillStyle = LACQUER.ink;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(word.text, d.x, d.y - d.r - 8 - since * 22);
  }
  ctx.globalAlpha = 1;

  if (ui.phase !== 'title') {
    drawDots(ctx, view, game, t);
    drawHud(ctx, view, game, ui);
    drawStatus(ctx, view, game, ui);
  }

  const text = TEXT[ui.lang];
  if (ui.phase === 'title') {
    ctx.fillStyle = LACQUER.veil;
    ctx.fillRect(0, 0, view.width, view.height);
    centred(ctx, view, [
      [text.title, Math.min(42, view.width * 0.12), LACQUER.ink],
      [text.premise, Math.min(16, view.width * 0.045), LACQUER.inkDim],
      [text.howListen, Math.min(15, view.width * 0.042), LACQUER.ink],
      [text.howGrow, Math.min(15, view.width * 0.042), `rgb(${LACQUER.call})`],
      [ui.touch ? text.howTouch : text.howKeys, Math.min(14, view.width * 0.04), LACQUER.inkDim],
      [text.begin, Math.min(18, view.width * 0.05), `rgb(${LACQUER.mine})`],
    ]);
  } else if (ui.phase === 'paused') {
    ctx.fillStyle = LACQUER.veil;
    ctx.fillRect(0, 0, view.width, view.height);
    centred(ctx, view, [
      [text.paused, Math.min(30, view.width * 0.085), LACQUER.ink],
      [text.resume, Math.min(15, view.width * 0.042), LACQUER.inkDim],
    ]);
  } else if (over) {
    // The card arrives behind the ending, not on top of it.
    const wait = finished ? 1.6 : 1.2;
    const veil = Math.min(1, Math.max(0, (ui.overFor - wait) / 0.4));
    const words = Math.min(1, Math.max(0, (ui.overFor - wait - 0.2) / 0.4));
    ctx.globalAlpha = veil;
    ctx.fillStyle = LACQUER.veil;
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.globalAlpha = words;
    const grades = text.grades
      .replace('{on}', `${game.grades.on}`)
      .replace('{near}', `${game.grades.near}`)
      .replace('{loose}', `${game.grades.loose}`);
    const reached = Math.min(game.piece.length, game.round + 1);
    centred(ctx, view, [
      [
        finished ? text.finished : text.stopped,
        Math.min(30, view.width * 0.085),
        finished ? `rgb(${LACQUER.call})` : LACQUER.ink,
      ],
      [
        finished
          ? `${text.score} ${game.score} · ${text.best} ${Math.max(ui.best, game.score)}`
          : `${text.reached} ${reached} ${text.of} ${game.piece.length} · ${text.score} ${game.score}`,
        Math.min(16, view.width * 0.045),
        LACQUER.ink,
      ],
      [grades, Math.min(14, view.width * 0.04), LACQUER.inkDim],
      [text.replay, Math.min(18, view.width * 0.05), `rgb(${LACQUER.mine})`],
    ]);
    ctx.globalAlpha = 1;
  }
}
