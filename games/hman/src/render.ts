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

import { RULES, levelCount, standing } from './game.js';
import type { Game } from './game.js';
import { fallAt, swingAt, winAt } from './beat.js';
import { drawFigure } from './figure.js';
import { TEXT } from './strings.js';
import type { Lang } from './strings.js';
import { callOf, show } from './values.js';
import type { Value } from './values.js';

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
  readonly args: readonly Value[];
  /** What came back, as it reads — `undefined` and `NaN` included. */
  readonly seen: string;
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
  /** Seconds since the mirror went down, or null while it still stands. */
  readonly clearedFor: number | null;
  /** Seconds since the last rung of all was beaten, or null before then. */
  readonly wonFor: number | null;
  /** How long the blow on screen lasts. */
  readonly span: number;
}

const MONO = 'ui-monospace, Menlo, Consolas, monospace';

/**
 * Write one line of the caption, smaller if it has to be, so it is never cut
 * off at the edges. A record or a long list makes a much longer line than the
 * numbers the first rungs dealt in.
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  room: number,
): void {
  let px = size;
  ctx.font = `${weight} ${px}px ${MONO}`;
  while (px > 9 && ctx.measureText(text).width > room) {
    px -= 1;
    ctx.font = `${weight} ${px}px ${MONO}`;
  }
  ctx.fillText(text, x, y);
}

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

/**
 * The mirror coming apart at the very end: pieces thrown up and out of the
 * room, fading as they go. Placed by index rather than at random, so the end
 * of a run looks the same every time it is won.
 */
function drawPieces(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, run: number): void {
  if (run <= 0 || run >= 1) return;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const count = 18;
  for (let i = 0; i < count; i += 1) {
    const spread = (i / (count - 1) - 0.5) * 1.9;
    const angle = -Math.PI / 2 + spread;
    const speed = 0.55 + ((i * 37) % 11) / 11;
    const far = run * unit * 2.4 * speed;
    const px = x + Math.cos(angle) * far;
    const py = y + Math.sin(angle) * far - run * run * unit * 0.6;
    const turn = i * 1.7 + run * 5;
    const half = 3 + (i % 4);
    ctx.globalAlpha = (1 - run) * (0.55 + (i % 3) * 0.15);
    ctx.strokeStyle = i % 2 === 0 ? INK.mirror : INK.accent;
    ctx.beginPath();
    ctx.moveTo(px - Math.cos(turn) * half, py - Math.sin(turn) * half);
    ctx.lineTo(px + Math.cos(turn) * half, py + Math.sin(turn) * half);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
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

  const room = view.width - 24;
  const call = callOf(blow.args, 64);

  if (blow.error !== null) {
    ctx.fillStyle = INK.wrong;
    fitText(ctx, `${call}  ✗  ${t.threw}`, mid, base, big, 600, room);
    ctx.fillStyle = INK.dim;
    fitText(ctx, blow.error, mid, base + big * 1.25, big * 0.76, 400, room);
  } else if (blow.landed) {
    ctx.fillStyle = INK.right;
    fitText(ctx, `${call}  →  ${blow.seen}  ✓`, mid, base, big, 600, room);
  } else {
    ctx.fillStyle = INK.wrong;
    fitText(ctx, `${call}  →  ${blow.seen}  ✗`, mid, base, big, 600, room);
    ctx.fillStyle = INK.dim;
    fitText(ctx, `${t.wanted} ${show(blow.want, 64)}`, mid, base + big * 1.25, big * 0.76, 400, room);
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function draw(ctx: CanvasRenderingContext2D, view: View, game: Game, ui: Ui): void {
  const t = TEXT[ui.lang];
  const blow = ui.blow;
  const going = ui.downFor === null ? null : fallAt(ui.downFor);
  const beaten = ui.clearedFor === null ? null : fallAt(ui.clearedFor);
  const winning = ui.wonFor === null ? null : winAt(ui.wonFor);
  const settling = going !== null || beaten !== null || winning !== null;
  const swing = blow === null || settling ? null : swingAt(ui.since, blow.landed ? 1 : 1.5, ui.span);
  const hitting = blow !== null && blow.landed;
  const struck = swing?.struck === true;

  ctx.save();
  const shake = swing?.shake ?? going?.shake ?? beaten?.shake ?? 0;
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
    ground - (winning?.hop ?? 0) * unit * 0.14,
    unit,
    {
      facing: 1,
      lunge: hitting ? reach : 0,
      recoil: blow !== null && !hitting && struck ? reach : 0,
      fall: going?.over ?? 0,
      time: ui.time,
      cheer: winning?.cheer ?? 0,
    },
    INK.him,
  );

  // At the very end the mirror does not get up again: it lies where the last
  // rung put it, and goes.
  if (winning === null || winning.fade < 1) {
    if (winning !== null) ctx.globalAlpha = 1 - winning.fade;
    drawFigure(
      ctx,
      mid + gap,
      ground,
      unit,
      {
        facing: -1,
        lunge: blow !== null && !hitting ? reach : 0,
        recoil: hitting && struck ? reach : 0,
        fall: winning !== null ? 1 : (beaten?.over ?? 0),
        time: ui.time + 1.3,
      },
      INK.mirror,
    );
    ctx.globalAlpha = 1;
  }
  if (winning !== null) drawPieces(ctx, mid + gap, ground - unit * 0.2, unit, winning.shards);

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

  if (winning === null) drawShell(ctx, game, mid + gap, 16, hitting && struck && swing !== null && swing.flash > 0.3);
  drawLives(ctx, game, mid - gap, 20, blow !== null && !hitting && struck);

  ctx.font = '500 11px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = INK.dim;
  ctx.textAlign = 'left';
  ctx.fillText(`${t.rung} ${game.level + 1}/${levelCount()}`, 10, view.height - 8);
  ctx.textAlign = 'right';
  ctx.fillText(`${t.standing} ${Math.round(standing(game) * game.solved.length)}`, view.width - 10, view.height - 8);
  ctx.textAlign = 'left';

  // The light goes out of the room as he goes down — and comes up when the
  // thing he is fighting is the one that falls.
  if (going !== null && going.dim > 0) {
    ctx.fillStyle = `rgba(12, 9, 18, ${going.dim})`;
    ctx.fillRect(0, 0, view.width, view.height);
  }
  if (beaten !== null && beaten.dim > 0 && winning === null) {
    ctx.fillStyle = `rgba(185, 160, 224, ${beaten.dim * 0.4})`;
    ctx.fillRect(0, 0, view.width, view.height);
  }
  if (winning !== null) {
    ctx.fillStyle = `rgba(185, 160, 224, ${0.16 + winning.glow})`;
    ctx.fillRect(0, 0, view.width, view.height);
    if (winning.caption > 0) {
      ctx.globalAlpha = winning.caption;
      ctx.fillStyle = INK.him;
      ctx.textAlign = 'center';
      ctx.font = `600 ${Math.max(16, Math.min(26, view.width * 0.05))}px ${MONO}`;
      ctx.fillText(`${levelCount()} / ${levelCount()}`, mid, view.height * 0.8);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();

  if (blow !== null && swing !== null) drawCaption(ctx, view, blow, swing.caption, t);
}
