/**
 * Drawing the shaft.
 *
 * Nothing here decides anything: it reads the game and paints it. The one
 * judgment it does make is the layout, because the shaft is nine by sixteen
 * whatever shape the window is, and everything else is measured from the cell
 * size that falls out of that.
 *
 * The water is painted last, over the climber, so that being caught by it
 * looks like being caught by it.
 */

import { RULES, heightOf, restingRow, surfaceRow } from './game.js';
import type { Game, Offset, Piece } from './game.js';
import { CELLS_TALL, drawClimber } from './climber.js';
import { TEXT } from './strings.js';
import type { Lang } from './strings.js';

const IRON = {
  skyTop: '#090d14',
  skyLow: '#0d1621',
  shaft: '#111a26',
  grid: '#17212f',
  wall: '#1d2835',
  stone: '#596675',
  stoneTop: '#7f8d9d',
  stoneEdge: '#39434f',
  falling: '#9db0c4',
  fallingTop: '#c2d2e2',
  ghost: 'rgba(157, 176, 196, 0.2)',
  water: 'rgba(28, 92, 120, 0.62)',
  waterLine: '#86b9cf',
  climber: '#eef3fa',
  rim: '#86b9cf',
  ink: '#c9d5e4',
  inkDim: '#6d7c8e',
  veil: 'rgba(7, 11, 17, 0.84)',
} as const;

export interface View {
  readonly cell: number;
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

const HUD = 46;
/** Room the page's back arrow takes out of the top-left corner. */
const BACK_LINK = 46;
const PAD = 10;

export function layout(width: number, height: number): View {
  const cell = Math.max(6, Math.min((width - PAD * 2) / RULES.columns, (height - HUD - PAD * 2) / RULES.rows));
  return {
    cell,
    originX: (width - cell * RULES.columns) / 2,
    originY: HUD + (height - HUD - cell * RULES.rows) / 2,
    width,
    height,
  };
}

export type Phase = 'title' | 'playing' | 'paused' | 'over';

export interface Ui {
  readonly lang: Lang;
  readonly phase: Phase;
  readonly time: number;
  readonly touch: boolean;
}

const x = (view: View, col: number): number => view.originX + col * view.cell;
const y = (view: View, row: number): number => view.originY + row * view.cell;

function stone(ctx: CanvasRenderingContext2D, view: View, col: number, row: number, face: string, top: string): void {
  const c = view.cell;
  const px = x(view, col);
  const py = y(view, row);
  const inset = Math.max(0.5, c * 0.045);

  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.roundRect(px + inset, py + inset, c - inset * 2, c - inset * 2, c * 0.16);
  ctx.fill();

  // A lighter top edge, so a stack reads as steps rather than as one mass.
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.roundRect(px + inset, py + inset, c - inset * 2, Math.max(1, c * 0.17), c * 0.08);
  ctx.fill();

  ctx.strokeStyle = IRON.stoneEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(px + inset, py + inset, c - inset * 2, c - inset * 2, c * 0.16);
  ctx.stroke();
}

function shape(
  ctx: CanvasRenderingContext2D,
  view: View,
  cells: readonly Offset[],
  col: number,
  row: number,
  face: string,
  top: string,
): void {
  for (const [r, c] of cells) stone(ctx, view, col + c, row + r, face, top);
}

function drawShaft(ctx: CanvasRenderingContext2D, view: View): void {
  const w = view.cell * RULES.columns;
  const h = view.cell * RULES.rows;

  ctx.fillStyle = IRON.shaft;
  ctx.fillRect(view.originX, view.originY, w, h);

  ctx.strokeStyle = IRON.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let col = 1; col < RULES.columns; col += 1) {
    ctx.moveTo(Math.round(x(view, col)) + 0.5, view.originY);
    ctx.lineTo(Math.round(x(view, col)) + 0.5, view.originY + h);
  }
  for (let row = 1; row < RULES.rows; row += 1) {
    ctx.moveTo(view.originX, Math.round(y(view, row)) + 0.5);
    ctx.lineTo(view.originX + w, Math.round(y(view, row)) + 0.5);
  }
  ctx.stroke();

  ctx.strokeStyle = IRON.wall;
  ctx.lineWidth = 2;
  ctx.strokeRect(view.originX, view.originY, w, h);

  // The rim: the row he has to reach, and the only warm line on the page.
  ctx.strokeStyle = IRON.rim;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(view.originX, y(view, RULES.exitRow + 1));
  ctx.lineTo(view.originX + w, y(view, RULES.exitRow + 1));
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawWater(ctx: CanvasRenderingContext2D, view: View, game: Game, time: number): void {
  const top = y(view, game.waterRow);
  const bottom = view.originY + view.cell * RULES.rows;
  if (top >= bottom) return;

  const w = view.cell * RULES.columns;
  ctx.save();
  ctx.beginPath();
  ctx.rect(view.originX, Math.max(view.originY, top), w, bottom - Math.max(view.originY, top));
  ctx.clip();
  ctx.fillStyle = IRON.water;
  ctx.fillRect(view.originX, view.originY, w, bottom - view.originY);
  ctx.restore();

  if (top < view.originY) return;
  ctx.strokeStyle = IRON.waterLine;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  for (let i = 0; i <= 40; i += 1) {
    const px = view.originX + (w * i) / 40;
    const py = top + Math.sin(time * 1.7 + i * 0.5) * view.cell * 0.055;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawGhost(ctx: CanvasRenderingContext2D, view: View, game: Game, piece: Piece): void {
  const row = restingRow(game, piece);
  ctx.fillStyle = IRON.ghost;
  for (const [r, c] of piece.cells) {
    const px = x(view, piece.col + c);
    const py = y(view, row + r);
    ctx.beginPath();
    ctx.roundRect(px + 1, py + 1, view.cell - 2, view.cell - 2, view.cell * 0.16);
    ctx.fill();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, view: View, game: Game, ui: Ui): void {
  const t = TEXT[ui.lang];
  const base = Math.max(11, Math.min(15, view.cell * 0.42));

  ctx.fillStyle = IRON.inkDim;
  ctx.font = `500 ${base * 0.78}px system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const left = Math.max(view.originX, BACK_LINK);
  ctx.fillText(t.height, left, HUD * 0.42);

  ctx.fillStyle = IRON.ink;
  ctx.font = `600 ${base * 1.5}px system-ui, sans-serif`;
  ctx.fillText(String(heightOf(game.climber.row)), left, HUD * 0.88);

  const right = view.originX + view.cell * RULES.columns;
  ctx.textAlign = 'right';
  ctx.fillStyle = IRON.inkDim;
  ctx.font = `500 ${base * 0.78}px system-ui, sans-serif`;
  ctx.fillText(t.next, right, HUD * 0.42);

  // The next stone, drawn small in the corner rather than named.
  const mini: View = { ...view, cell: Math.min(11, view.cell * 0.42) };
  const cells = SHAPE_PREVIEW[game.next];
  const wide = Math.max(...cells.map(([, c]) => c)) + 1;
  for (const [r, c] of cells) {
    const px = right - (wide - c) * mini.cell;
    const py = HUD * 0.52 + r * mini.cell;
    ctx.fillStyle = IRON.falling;
    ctx.beginPath();
    ctx.roundRect(px + 1, py + 1, mini.cell - 2, mini.cell - 2, mini.cell * 0.2);
    ctx.fill();
  }
}

const SHAPE_PREVIEW: Readonly<Record<Game['next'], readonly Offset[]>> = {
  single: [[0, 0]],
  bar: [
    [0, 0],
    [0, 1],
  ],
  corner: [
    [0, 0],
    [1, 0],
    [1, 1],
  ],
  square: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
};

function veil(ctx: CanvasRenderingContext2D, view: View): void {
  ctx.fillStyle = IRON.veil;
  ctx.fillRect(0, 0, view.width, view.height);
}

const face = (size: number): string => `${size > 20 ? 600 : 400} ${size}px system-ui, sans-serif`;

/**
 * Break a line to fit, and shrink it first if a single word will not.
 *
 * Burmese is written with few spaces, so a sentence can arrive as one
 * unbreakable run; shrinking before wrapping is what keeps it on the screen
 * instead of off both edges of a phone.
 */
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
  const maxWidth = view.width * 0.88;
  const laid = lines.map(([text, size, colour]) => ({
    colour,
    ...fitLine(ctx, text, size, maxWidth),
  }));

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

export function draw(ctx: CanvasRenderingContext2D, view: View, game: Game, ui: Ui): void {
  const sky = ctx.createLinearGradient(0, 0, 0, view.height);
  sky.addColorStop(0, IRON.skyTop);
  sky.addColorStop(1, IRON.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.width, view.height);

  drawShaft(ctx, view);

  for (let row = 0; row < RULES.rows; row += 1) {
    for (let col = 0; col < RULES.columns; col += 1) {
      if (game.cells[row * RULES.columns + col] === true) {
        stone(ctx, view, col, row, IRON.stone, IRON.stoneTop);
      }
    }
  }

  if (game.piece !== null) {
    drawGhost(ctx, view, game, game.piece);
    shape(ctx, view, game.piece.cells, game.piece.col, game.piece.row, IRON.falling, IRON.fallingTop);
  }

  const climber = game.climber;
  const p = climber.progress;
  const col = climber.fromCol + (climber.col - climber.fromCol) * p;
  const row = climber.fromRow + (climber.row - climber.fromRow) * p;
  const climbing = climber.row < climber.fromRow ? 1 - Math.abs(p - 0.5) * 2 : 0;
  drawClimber(
    ctx,
    x(view, col + 0.5),
    y(view, row + 1),
    view.cell,
    {
      facing: climber.facing,
      gait: p < 1 ? 1 : 0,
      climb: climbing,
      progress: p,
      parity: (Math.abs(climber.fromCol) % 2) as 0 | 1,
      time: ui.time,
    },
    IRON.climber,
  );

  drawWater(ctx, view, game, ui.time);
  drawHud(ctx, view, game, ui);

  const t = TEXT[ui.lang];
  if (ui.phase === 'title') {
    veil(ctx, view);
    centred(ctx, view, [
      [t.title, Math.min(40, view.width * 0.11), IRON.ink],
      [t.premise, Math.min(16, view.width * 0.045), IRON.inkDim],
      [t.howRule, Math.min(15, view.width * 0.042), IRON.ink],
      [t.howMove, Math.min(15, view.width * 0.042), IRON.inkDim],
      [ui.touch ? t.howTouch : t.howKeys, Math.min(14, view.width * 0.04), IRON.rim],
      [t.begin, Math.min(18, view.width * 0.05), IRON.ink],
    ]);
  } else if (ui.phase === 'paused') {
    veil(ctx, view);
    centred(ctx, view, [
      [t.paused, Math.min(30, view.width * 0.085), IRON.ink],
      [t.resume, Math.min(15, view.width * 0.042), IRON.inkDim],
    ]);
  } else if (ui.phase === 'over') {
    veil(ctx, view);
    const won = game.outcome === 'out';
    centred(ctx, view, [
      [won ? t.out : t.drowned, Math.min(30, view.width * 0.085), won ? IRON.rim : IRON.ink],
      [
        won ? `${t.outWhy} ${Math.max(0, Math.round(heightOf(game.waterRow)))}` : `${t.drownedWhy} ${game.best}`,
        Math.min(16, view.width * 0.045),
        IRON.inkDim,
      ],
      [t.again, Math.min(18, view.width * 0.05), IRON.ink],
    ]);
  }
}

/** Exported for the one place main.ts needs it: aiming by pointer. */
export function columnAt(view: View, clientX: number): number {
  return Math.max(0, Math.min(RULES.columns - 1, Math.floor((clientX - view.originX) / view.cell)));
}

/** The column the climber is about to try, for anything that wants to hint it. */
export function facingColumn(game: Game): number {
  const next = game.climber.col + game.climber.facing;
  return next < 0 || next >= RULES.columns ? game.climber.col : next;
}

export { surfaceRow, CELLS_TALL };
