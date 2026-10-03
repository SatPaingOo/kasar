/**
 * The fight, which is the only part on the canvas.
 *
 * Everything the player reads or types is ordinary DOM below this — a canvas
 * cannot take typing, and faking a text box on one would be a week of work to
 * arrive back where `<textarea>` already is.
 *
 * What this draws is the consequence of the last submit: he lands a strike for
 * every case that came back right, and takes one for every case that did not.
 */

import { standing } from './game.js';
import type { Game } from './game.js';
import { drawFigure } from './figure.js';
import { TEXT } from './strings.js';
import type { Lang } from './strings.js';

const INK = {
  far: '#1b1726',
  floor: '#241e33',
  him: '#e8e3f2',
  mirror: '#6f6490',
  accent: '#b9a0e0',
  wrong: '#d98a8a',
  dim: '#8a82a0',
} as const;

export interface View {
  readonly width: number;
  readonly height: number;
}

/** One moment of the fight, played out one case at a time. */
export interface Blow {
  /** True when he landed it, false when the mirror did. */
  readonly landed: boolean;
}

export interface Ui {
  readonly lang: Lang;
  /** Seconds, for the standing-still motion. */
  readonly time: number;
  /** The blow being played, or null between them. */
  readonly blow: Blow | null;
  /** 0 to 1 through that blow. */
  readonly swing: number;
}

export function draw(ctx: CanvasRenderingContext2D, view: View, game: Game, ui: Ui): void {
  const t = TEXT[ui.lang];

  const sky = ctx.createLinearGradient(0, 0, 0, view.height);
  sky.addColorStop(0, INK.far);
  sky.addColorStop(1, INK.floor);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.width, view.height);

  const ground = view.height * 0.82;
  ctx.strokeStyle = INK.floor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, ground);
  ctx.lineTo(view.width, ground);
  ctx.stroke();

  // He stands left of centre, the mirror right of it, facing each other.
  const unit = Math.min(view.height * 0.48, 110);
  const gap = Math.min(view.width * 0.3, 150);
  const mid = view.width / 2;

  // A blow runs out and back: nothing at the ends, everything in the middle.
  const swing = ui.blow === null ? 0 : Math.sin(Math.min(1, ui.swing) * Math.PI);
  const heLands = ui.blow?.landed === true;

  drawFigure(
    ctx,
    mid - gap,
    ground,
    unit,
    {
      facing: 1,
      lunge: heLands ? swing : 0,
      recoil: ui.blow !== null && !heLands ? swing : 0,
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
      lunge: ui.blow !== null && !heLands ? swing : 0,
      recoil: heLands ? swing : 0,
      time: ui.time + 1.3,
    },
    INK.mirror,
  );

  // How much of the mirror is still up, which is how many cases are left.
  const barWidth = Math.min(view.width * 0.3, 180);
  const left = standing(game);
  ctx.fillStyle = INK.floor;
  ctx.fillRect(mid + gap - barWidth / 2, 18, barWidth, 4);
  ctx.fillStyle = INK.mirror;
  ctx.fillRect(mid + gap - barWidth / 2, 18, barWidth * left, 4);

  // His lives, as marks rather than a number: a bar would read as health he
  // can lose a sliver of, and he cannot — a wrong submit costs a whole one.
  ctx.fillStyle = INK.accent;
  for (let i = 0; i < game.lives; i += 1) {
    ctx.beginPath();
    ctx.arc(mid - gap - barWidth / 2 + 5 + i * 13, 20, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = `500 11px ${'ui-monospace, monospace'}`;
  ctx.fillStyle = INK.dim;
  ctx.textAlign = 'left';
  ctx.fillText(`${t.rung} ${game.level + 1}`, 12, view.height - 10);
  ctx.textAlign = 'right';
  ctx.fillText(`${t.standing} ${game.solved.filter((d) => !d).length}`, view.width - 12, view.height - 10);
  ctx.textAlign = 'left';
}
