/**
 * The fight, which is the only part on the canvas.
 *
 * Everything the player reads or types is ordinary DOM below this — a canvas
 * cannot take typing.
 *
 * The first version of this drew two small figures nudging each other and
 * nothing else, and you could not tell who had hit whom or why. What was
 * missing was never the animation: it was the answer. So a blow now carries
 * the case it came from and holds it up afterwards, the mirror is a row of
 * blocks that visibly loses one, and a life that goes is seen going.
 */

import { RULES, standing } from './game.js';
import type { Game } from './game.js';
import { fallAt, swingAt } from './beat.js';
import { drawFigure } from './figure.js';
import { TEXT } from './strings.js';
import type { Lang } from './strings.js';
import type { Value } from './levels.js';

const INK = {
  far: '#1b1726',
  floor: '#241e33',
  him: '#e8e3f2',
  mirror: '#6f6490',
  accent: '#b9a0e0',
  right: '#9ad8a8',
  wrong: '#d98a8a',
  dim: '#6b6482',
  spent: '#332c47',
} as const;

export interface View {
  readonly width: number;
  readonly height: number;
}

/** One case, played out. */
export interface Blow {
  readonly landed: boolean;
  readonly parts: readonly number[];
  readonly got: Value | null;
  readonly want: Value;
  readonly error: string | null;
}

export interface Ui {
  readonly lang: Lang;
  readonly time: number;
  /** The blow being played, or null between them. */
  readonly blow: Blow | null;
  /** Seconds into that blow. */
  readonly since: number;
  /** Seconds since he went down, or null while he is on his feet. */
  readonly downFor: number | null;
}

const show = (value: Value | null): string => (value === null ? '—' : JSON.stringify(value));

/** The blocks the mirror is made of: one per case, and one goes per hit. */
function drawShell(ctx: CanvasRenderingContext2D, game: Game, cx: number, y: number, flashing: boolean): void {
  const count = game.solved.length;
  if (count === 0) return;
  const w = 16;
  const gap = 4;
  const total = count * w + (count - 1) * gap;
  let x = cx - total / 2;

  for (let i = 0; i < count; i += 1) {
    const gone = game.solved[i] === true;
    if (gone) {
      ctx.strokeStyle = INK.spent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 7);
    } else {
      ctx.fillStyle = flashing ? INK.accent : INK.mirror;
      ctx.fillRect(x, y, w, 8);
    }
    x += w + gap;
  }
}

/** His lives, as marks, because a wrong submit costs a whole one. */
function drawLives(ctx: CanvasRenderingContext2D, game: Game, cx: number, y: number, losing: boolean): void {
  const total = RULES.lives;
  const gap = 13;
  let x = cx - ((total - 1) * gap) / 2;
  for (let i = 0; i < total; i += 1) {
    const left = i < game.lives;
    if (left) {
      ctx.fillStyle = INK.accent;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // The one just lost is drawn broken rather than simply missing.
      ctx.strokeStyle = losing && i === game.lives ? INK.wrong : INK.spent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    x += gap;
  }
}

/** What came off the hit, thrown from the point of contact. */
function drawShards(ctx: CanvasRenderingContext2D, x: number, y: number, run: number, colour: string): void {
  if (run <= 0 || run >= 1) return;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 1 - run;
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2 + 0.4;
    const near = 6 + run * 30;
    const far = near + 7;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * near, y + Math.sin(angle) * near);
    ctx.lineTo(x + Math.cos(angle) * far, y + Math.sin(angle) * far);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * The answer, held under the fight.
 *
 * This is the part that was missing. A lunge says something happened; only
 * this says what was tried, what came back and what was needed.
 */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  view: View,
  blow: Blow,
  rise: number,
  t: (typeof TEXT)[Lang],
): void {
  if (rise <= 0) return;
  const mid = view.width / 2;
  const base = view.height * 0.78 + (1 - rise) * 10;
  const big = Math.max(13, Math.min(18, view.width * 0.034));

  ctx.globalAlpha = rise;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const tried = `[${blow.parts.join(', ')}]`;
  ctx.font = `600 ${big}px ui-monospace, Menlo, Consolas, monospace`;

  if (blow.error !== null) {
    ctx.fillStyle = INK.wrong;
    ctx.fillText(`${tried}  ✗  ${t.threw}`, mid, base);
    ctx.font = `400 ${big * 0.76}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.fillStyle = INK.dim;
    ctx.fillText(blow.error, mid, base + big * 1.25);
  } else if (blow.landed) {
    ctx.fillStyle = INK.right;
    ctx.fillText(`${tried}  →  ${show(blow.got)}  ✓`, mid, base);
  } else {
    ctx.fillStyle = INK.wrong;
    ctx.fillText(`${tried}  →  ${show(blow.got)}  ✗`, mid, base);
    ctx.font = `400 ${big * 0.76}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.fillStyle = INK.dim;
    ctx.fillText(`${t.wanted} ${show(blow.want)}`, mid, base + big * 1.25);
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function draw(ctx: CanvasRenderingContext2D, view: View, game: Game, ui: Ui): void {
  const t = TEXT[ui.lang];
  const blow = ui.blow;
  const going = ui.downFor === null ? null : fallAt(ui.downFor);
  const swing = blow === null || going !== null ? null : swingAt(ui.since, blow.landed ? 1 : 1.5);
  const hitting = blow !== null && blow.landed;
  const struck = swing?.struck === true;

  ctx.save();
  const shake = swing?.shake ?? going?.shake ?? 0;
  if (shake !== 0) ctx.translate(shake, shake * 0.4);

  const sky = ctx.createLinearGradient(0, 0, 0, view.height);
  sky.addColorStop(0, INK.far);
  sky.addColorStop(1, INK.floor);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.width, view.height);

  // A wrong answer washes the whole thing red for a moment; a right one does
  // not need to, because the mirror visibly loses a block.
  if (swing !== null && !hitting && swing.flash > 0) {
    ctx.fillStyle = INK.wrong;
    ctx.globalAlpha = swing.flash * 0.22;
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.globalAlpha = 1;
  }

  const ground = view.height * 0.6;
  ctx.strokeStyle = INK.floor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, ground);
  ctx.lineTo(view.width, ground);
  ctx.stroke();

  const unit = Math.min(view.height * 0.4, 92);
  const gap = Math.min(view.width * 0.26, 128);
  const mid = view.width / 2;
  const reach = swing?.reach ?? 0;

  drawFigure(
    ctx,
    mid - gap,
    ground,
    unit,
    {
      facing: 1,
      lunge: hitting ? reach : 0,
      recoil: blow !== null && !hitting && struck ? reach : 0,
      fall: going?.over ?? 0,
      time: ui.time,
    },
    INK.him,
  );

  drawFigure(
    ctx,
    mid + gap,
    ground,
    unit,
    {
      facing: -1,
      lunge: blow !== null && !hitting ? reach : 0,
      recoil: hitting && struck ? reach : 0,
      fall: 0,
      time: ui.time + 1.3,
    },
    INK.mirror,
  );

  // The point of contact, which is where everything comes off.
  const contact = { x: hitting ? mid + gap * 0.45 : mid - gap * 0.45, y: ground - unit * 0.56 };
  if (swing !== null && swing.flash > 0) {
    ctx.fillStyle = hitting ? INK.accent : INK.wrong;
    ctx.globalAlpha = swing.flash;
    ctx.beginPath();
    ctx.arc(contact.x, contact.y, 7 + swing.flash * 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (swing !== null) {
    drawShards(ctx, contact.x, contact.y, swing.shards, hitting ? INK.accent : INK.wrong);
  }

  drawShell(ctx, game, mid + gap, 16, hitting && struck && swing !== null && swing.flash > 0.3);
  drawLives(ctx, game, mid - gap, 20, blow !== null && !hitting && struck);

  ctx.font = '500 11px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = INK.dim;
  ctx.textAlign = 'left';
  ctx.fillText(`${t.rung} ${game.level + 1}`, 10, view.height - 8);
  ctx.textAlign = 'right';
  ctx.fillText(`${t.standing} ${Math.round(standing(game) * game.solved.length)}`, view.width - 10, view.height - 8);
  ctx.textAlign = 'left';

  // The light goes out of it as he goes down.
  if (going !== null && going.dim > 0) {
    ctx.fillStyle = `rgba(12, 9, 18, ${going.dim})`;
    ctx.fillRect(0, 0, view.width, view.height);
  }

  ctx.restore();

  if (blow !== null && swing !== null) drawCaption(ctx, view, blow, swing.caption, t);
}
