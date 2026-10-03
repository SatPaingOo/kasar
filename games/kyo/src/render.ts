/**
 * Drawing the gorge.
 *
 * Nothing here decides anything: it reads the game and paints it. The one
 * judgment it makes is the camera, because the whole world slides past and the
 * player has to be able to see far enough ahead to pick the moment to let go.
 */

import { RULES, bandAt, groundAt, leanOf, progress } from './game.js';
import type { Game } from './game.js';
import { drawFigure } from './figure.js';
import { TEXT } from './strings.js';
import type { Lang } from './strings.js';

const JADE = {
  skyHigh: '#9ec4c0',
  skyLow: '#d8ddc4',
  hazeFar: '#7f9c92',
  wallFar: '#4c6456',
  wallNear: '#2b3a31',
  floor: '#1b2620',
  anchor: '#3c5243',
  anchorLit: '#8fbf9f',
  rope: '#e6efdf',
  figure: '#1a2420',
  ink: '#22302a',
  inkDim: '#5c7064',
  veil: 'rgba(227, 233, 214, 0.78)',
  rim: '#3f7a56',
} as const;

export interface View {
  /** Pixels per world unit. */
  readonly unit: number;
  /** World point at the top-left of the canvas. */
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

export type Phase = 'title' | 'playing' | 'paused' | 'over';

export interface Ui {
  readonly lang: Lang;
  readonly phase: Phase;
  readonly time: number;
  readonly touch: boolean;
  readonly overFor: number;
}

/** He sits this far across the screen, so most of the view is what is coming. */
const AHEAD = 0.34;
const HUD = 44;
/** At least this much world has to be visible, or there is nothing to aim at. */
const SEE_WIDE = 30;
const SEE_TALL = 24;

export function layout(width: number, height: number, game: Game): View {
  const unit = Math.max(4, Math.min(width / SEE_WIDE, (height - HUD) / SEE_TALL));
  return {
    unit,
    originX: game.figure.x - (width * AHEAD) / unit,
    // He sits a little above the middle, because what he needs to see is the
    // ground coming up at him.
    originY: game.figure.y - (height * 0.42) / unit,
    width,
    height,
  };
}

const sx = (view: View, x: number): number => (x - view.originX) * view.unit;
const sy = (view: View, y: number): number => (y - view.originY) * view.unit;

/**
 * The far side of the gorge: two ridges of rock, each sliding past slower than
 * he does so there is some sense of moving at all.
 *
 * Drawn as rolling humps rather than as the rectangles that were here first —
 * blocks on a horizon read as a city skyline, which is the one thing a gorge
 * is not.
 */
function ridge(
  ctx: CanvasRenderingContext2D,
  view: View,
  speed: number,
  colour: string,
  alpha: number,
  amp: number,
  base: number,
): void {
  const drift = view.originX * speed;
  const top = sy(view, bandAt(view.originX) + base);

  ctx.fillStyle = colour;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(0, view.height);
  for (let px = 0; px <= view.width + 24; px += 24) {
    const t = (px + drift) * 0.011;
    const lift = (Math.sin(t) * 0.62 + Math.sin(t * 2.37 + 1.7) * 0.38) * amp;
    ctx.lineTo(px, top - lift);
  }
  ctx.lineTo(view.width + 24, view.height);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawDistance(ctx: CanvasRenderingContext2D, view: View): void {
  const sky = ctx.createLinearGradient(0, 0, 0, view.height);
  sky.addColorStop(0, JADE.skyHigh);
  sky.addColorStop(1, JADE.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.width, view.height);

  ridge(ctx, view, 0.12, JADE.hazeFar, 0.3, view.unit * 2.6, -6);
  ridge(ctx, view, 0.3, JADE.wallFar, 0.28, view.unit * 1.8, 1);
}

/** The floor of the gorge, falling away as it goes. */
function drawFloor(ctx: CanvasRenderingContext2D, view: View): void {
  const left = view.originX;
  const right = view.originX + view.width / view.unit;

  ctx.fillStyle = JADE.wallNear;
  ctx.beginPath();
  ctx.moveTo(sx(view, left), sy(view, groundAt(left)));
  ctx.lineTo(sx(view, right), sy(view, groundAt(right)));
  ctx.lineTo(view.width, view.height);
  ctx.lineTo(0, view.height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = JADE.floor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx(view, left), sy(view, groundAt(left)));
  ctx.lineTo(sx(view, right), sy(view, groundAt(right)));
  ctx.stroke();
}

function drawAnchors(ctx: CanvasRenderingContext2D, view: View, game: Game): void {
  const reach = RULES.reach;
  const figure = game.figure;

  for (const anchor of game.anchors) {
    const px = sx(view, anchor.x);
    const py = sy(view, anchor.y);
    if (px < -40 || px > view.width + 40) continue;

    // A stem up out of the top of the frame, so they read as hanging from
    // something rather than floating.
    ctx.strokeStyle = JADE.wallFar;
    ctx.lineWidth = Math.max(1.5, view.unit * 0.1);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - view.unit * 0.3, py - view.height);
    ctx.stroke();

    // The ones he could actually take are lit. Everything else is scenery,
    // and telling them apart is most of knowing when to press.
    const within =
      anchor.x > figure.x &&
      figure.y - anchor.y >= RULES.minRise &&
      Math.hypot(anchor.x - figure.x, anchor.y - figure.y) <= reach;

    ctx.fillStyle = within ? JADE.anchorLit : JADE.anchor;
    ctx.beginPath();
    ctx.arc(px, py, view.unit * (within ? 0.34 : 0.24), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, view: View, game: Game, ui: Ui): void {
  const t = TEXT[ui.lang];
  const base = Math.max(11, Math.min(15, view.unit * 0.5));

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = JADE.inkDim;
  ctx.font = `500 ${base * 0.78}px system-ui, sans-serif`;
  ctx.fillText(t.across, 46, HUD * 0.42);

  ctx.fillStyle = JADE.ink;
  ctx.font = `600 ${base * 1.5}px system-ui, sans-serif`;
  ctx.fillText(`${Math.round(progress(game) * 100)}%`, 46, HUD * 0.9);

  // A bar for the crossing, because a percentage alone does not say how much
  // is left in a way you can glance at mid-swing.
  const barX = 46;
  const barY = HUD * 0.98;
  const barW = view.width - barX - 20;
  ctx.fillStyle = JADE.inkDim;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(barX, barY, barW, 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = JADE.rim;
  ctx.fillRect(barX, barY, barW * progress(game), 2);
}

function veil(ctx: CanvasRenderingContext2D, view: View): void {
  ctx.fillStyle = JADE.veil;
  ctx.fillRect(0, 0, view.width, view.height);
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
  const maxWidth = view.width * 0.88;
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

export function draw(ctx: CanvasRenderingContext2D, view: View, game: Game, ui: Ui): void {
  drawDistance(ctx, view);
  drawFloor(ctx, view);
  drawAnchors(ctx, view, game);

  const figure = game.figure;
  const fx = sx(view, figure.x);
  const fy = sy(view, figure.y);

  const rope = game.rope;
  if (rope !== null) {
    ctx.strokeStyle = JADE.rope;
    ctx.lineWidth = Math.max(1.5, view.unit * 0.07);
    ctx.beginPath();
    ctx.moveTo(sx(view, rope.x), sy(view, rope.y));
    ctx.lineTo(fx, fy);
    ctx.stroke();
  }

  const speed = Math.hypot(figure.vx, figure.vy);
  drawFigure(
    ctx,
    fx,
    fy,
    view.unit,
    {
      lean: leanOf(game),
      held: rope !== null,
      speed,
      facing: figure.vx >= 0 ? 1 : -1,
      time: ui.time,
    },
    JADE.figure,
  );

  drawHud(ctx, view, game, ui);

  const t = TEXT[ui.lang];
  if (ui.phase === 'title') {
    veil(ctx, view);
    centred(ctx, view, [
      [t.title, Math.min(42, view.width * 0.12), JADE.ink],
      [t.premise, Math.min(16, view.width * 0.045), JADE.inkDim],
      [t.howHold, Math.min(15, view.width * 0.042), JADE.ink],
      [t.howLet, Math.min(15, view.width * 0.042), JADE.rim],
      [ui.touch ? t.howTouch : t.howKeys, Math.min(14, view.width * 0.04), JADE.inkDim],
      [t.begin, Math.min(18, view.width * 0.05), JADE.ink],
    ]);
  } else if (ui.phase === 'paused') {
    veil(ctx, view);
    centred(ctx, view, [
      [t.paused, Math.min(30, view.width * 0.085), JADE.ink],
      [t.resume, Math.min(15, view.width * 0.042), JADE.inkDim],
    ]);
  } else if (ui.phase === 'over') {
    veil(ctx, view);
    const won = game.outcome === 'across';
    centred(ctx, view, [
      [won ? t.over : t.fallen, Math.min(30, view.width * 0.085), won ? JADE.rim : JADE.ink],
      [
        won ? `${t.overWhy} ${Math.round(game.elapsed)}s` : `${t.reached} ${Math.round(progress(game) * 100)}%`,
        Math.min(16, view.width * 0.045),
        JADE.inkDim,
      ],
      [t.again, Math.min(18, view.width * 0.05), JADE.ink],
    ]);
  }
}
