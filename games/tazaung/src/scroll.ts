/**
 * Tazaung — the scroll.
 *
 * The game's only interface: the title before the night, and the result
 * after it. It is drawn in the same ink and the same line weight as the
 * wizard, with no parchment texture and no fill of its own beyond a wash of
 * the sky behind it. A brown paper rectangle would be the first thing in the
 * game that is not either line art or sky.
 *
 * It unrolls: two rollers slide apart, the sheet grows between them, and the
 * words fade in once it has opened.
 */

import { fontStack } from "./strings.js";
import type { Viewport } from "./render.js";

export interface ScrollLine {
  readonly text: string;
  /** Relative to the scroll's own size: 1 is the body, larger is a heading. */
  readonly scale: number;
  /** Dimmed lines sit back; the call to action pulses. */
  readonly dim?: boolean;
  readonly pulse?: boolean;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A band in the middle of the sheet that the caller draws into. The rules
 * page uses it to show the game's own pieces rather than describe them, so
 * the scroll stays the only interface and nothing has to be worded twice.
 */
export interface ScrollArt {
  readonly rows: number;
  readonly draw: (
    ctx: CanvasRenderingContext2D,
    band: Rect,
    ink: string,
    time: number,
  ) => void;
}

const EASE_OUT = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * @param open 0 is fully rolled up, 1 fully open.
 */
export function drawScroll(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  lines: readonly ScrollLine[],
  open: number,
  ink: string,
  time: number,
  art?: ScrollArt,
): void {
  const progress = Math.max(0, Math.min(1, open));
  if (progress <= 0.001) return;

  const unroll = EASE_OUT(progress);
  const cx = view.width / 2;
  // Placed after the height is known, so a tall rules sheet cannot run off
  // the top of the screen and lose its heading.
  let cy = view.height * (art === undefined ? 0.42 : 0.36);

  const full = Math.min(view.width * 0.86, view.cell * (art === undefined ? 9.5 : 11));
  const height = Math.min(
    view.height * (art === undefined ? 0.4 : 0.66),
    view.cell * (1.6 + lines.length * 1.15 + (art?.rows ?? 0) * 1.85),
  );
  cy = Math.max(cy, height / 2 + view.cell * 0.85);
  const width = full * unroll;
  const half = width / 2;
  const rollerR = view.cell * 0.17;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1.6, view.cell * 0.055);

  // The sheet, with its long edges bowed so it reads as paper hanging between
  // two rollers rather than as a framed rectangle.
  if (width > rollerR * 2) {
    const sag = Math.min(view.cell * 0.3, width * 0.045);
    const top = cy - height / 2;
    const bottom = cy + height / 2;

    ctx.beginPath();
    ctx.moveTo(cx - half, top);
    ctx.quadraticCurveTo(cx, top + sag, cx + half, top);
    ctx.lineTo(cx + half, bottom);
    ctx.quadraticCurveTo(cx, bottom + sag, cx - half, bottom);
    ctx.closePath();

    ctx.fillStyle = "rgba(248, 239, 219, 0.2)";
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // A rolled-up end at each side: a capsule standing past the sheet, with the
  // curl of the paper showing at its top.
  for (const side of [-1, 1] as const) {
    drawRoller(ctx, cx + side * half, cy, rollerR, height / 2 + rollerR * 1.1, unroll * side * 5);
  }
  ctx.restore();

  if (unroll < 0.92) return;
  const fade = (unroll - 0.92) / 0.08;

  if (art === undefined) {
    drawLines(ctx, view, lines, cx, cy, height, fade, ink, time);
    return;
  }

  // With an art band the text splits around it: everything but the last line
  // stacks above, and the last line — always the call to action — sits below.
  const top = cy - height / 2;
  const headings = lines.slice(0, -1);
  const footer = lines[lines.length - 1];
  const headSpace = view.cell * (0.5 + headings.length * 1.15);
  const footSpace = view.cell * 1.3;

  headings.forEach((line, index) => {
    drawLine(ctx, view, line, cx, top + view.cell * (0.85 + index * 1.15), fade, ink, time);
  });
  if (footer !== undefined) {
    drawLine(ctx, view, footer, cx, cy + height / 2 - footSpace * 0.5, fade, ink, time);
  }

  ctx.save();
  ctx.globalAlpha = fade;
  art.draw(
    ctx,
    {
      x: cx - half * 0.92,
      y: top + headSpace,
      width: half * 1.84,
      height: height - headSpace - footSpace,
    },
    ink,
    time,
  );
  ctx.restore();
}

function drawRoller(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  reach: number,
  spin: number,
): void {
  // The roll itself: one capsule, filled so it sits in front of the sheet.
  ctx.fillStyle = "rgba(240, 228, 203, 0.3)";
  ctx.beginPath();
  ctx.roundRect(x - radius, y - reach, radius * 2, reach * 2, radius);
  ctx.fill();
  ctx.stroke();

  // The curl of paper still wound on it, turning as it opens.
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = Math.max(1.1, radius * 0.28);
  for (const end of [-1, 1] as const) {
    const cy = y + end * (reach - radius);
    ctx.beginPath();
    ctx.arc(x, cy, radius * 0.5, spin, spin + Math.PI * 1.4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  lines: readonly ScrollLine[],
  cx: number,
  cy: number,
  height: number,
  fade: number,
  ink: string,
  time: number,
): void {
  const step = height / (lines.length + 1);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ink;

  lines.forEach((line, index) => {
    const size = view.cell * 0.34 * line.scale;
    ctx.font = fontStack(size, line.scale > 1.4 ? 600 : 400);
    const breathe = line.pulse === true ? 0.65 + 0.35 * Math.sin(time * 3) : 1;
    ctx.globalAlpha = Math.min(1, fade) * (line.dim === true ? 0.6 : 1) * breathe;
    ctx.fillText(line.text, cx, cy - height / 2 + step * (index + 1));
  });

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  line: ScrollLine,
  cx: number,
  y: number,
  fade: number,
  ink: string,
  time: number,
): void {
  const size = view.cell * 0.34 * line.scale;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ink;
  ctx.font = fontStack(size, line.scale > 1.4 ? 600 : 400);
  const breathe = line.pulse === true ? 0.65 + 0.35 * Math.sin(time * 3) : 1;
  ctx.globalAlpha = Math.min(1, fade) * (line.dim === true ? 0.6 : 1) * breathe;
  ctx.fillText(line.text, cx, y);
  ctx.restore();
}
