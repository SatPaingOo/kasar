/**
 * Tazaung — drawing.
 *
 * Reads game state, writes pixels, decides nothing.
 *
 * The scene starts at dusk and readable, and darkens only as the lantern
 * fails. Starting at night hid the game: the player could not see what was
 * falling, and the loss of light meant nothing because there was none to lose.
 */

import { RULES, cellAt, nightProgress, surfaceRow } from "./game.js";
import type { Boon, GameEvent, GameState } from "./game.js";
import { createWizard, drawWizard, updateWizard } from "./character.js";
import type { Wizard } from "./character.js";
import { drawScroll } from "./scroll.js";
import type { Rect, ScrollArt, ScrollLine } from "./scroll.js";
import { clock, fontStack, t } from "./strings.js";
import { advanceMotes, drawMotes, emitForEvents, trailRising } from "./particles.js";
import type { Mote } from "./particles.js";

export interface Viewport {
  /** Canvas size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Side of one grid cell, in CSS pixels. */
  readonly cell: number;
  /** Top-left of the grid, in CSS pixels. */
  readonly originX: number;
  readonly originY: number;
}

/**
 * The night, as colour. The sky is the clock: how far through it you are is
 * the one thing the player can read without being told, and reaching the last
 * stop is the win.
 */
const NIGHT: readonly { readonly at: number; readonly top: readonly number[]; readonly bottom: readonly number[] }[] = [
  { at: 0,    top: [0x7e, 0x9a, 0xc4], bottom: [0xf0, 0xd2, 0xa8] }, // dusk
  { at: 0.22, top: [0x3c, 0x4e, 0x7e], bottom: [0x8a, 0x7c, 0x8e] }, // last of the light
  { at: 0.5,  top: [0x0a, 0x0e, 0x22], bottom: [0x16, 0x1c, 0x3a] }, // deep night
  { at: 0.78, top: [0x10, 0x16, 0x3a], bottom: [0x33, 0x2a, 0x55] }, // the turn
  { at: 0.93, top: [0x2b, 0x3c, 0x76], bottom: [0xa5, 0x6c, 0x74] }, // first light
  { at: 1,    top: [0x8d, 0xb4, 0xdd], bottom: [0xff, 0xcf, 0x96] }, // sunrise
];
const INK_LIT = "#141821";
const INK_DARK = "#e4ebfb";

const COLORS = {
  husk: "#3d4458",
  huskDead: "#848ea6",
  spark: "#ffd98a",
  rising: "#ffeec2",
  star: "#fff4d6",
  flame: "#ffc24d",
  ground: "#2a2f3f",
} as const;

const mixChannel = (from: number, to: number, t: number): number => Math.round(from + (to - from) * t);

/** The sky for this point in the night, between its two nearest keyframes. */
function skyAt(progress: number): { readonly top: string; readonly bottom: string } {
  let lower = NIGHT[0];
  let upper = NIGHT[NIGHT.length - 1];
  for (let i = 0; i < NIGHT.length - 1; i += 1) {
    const a = NIGHT[i];
    const b = NIGHT[i + 1];
    if (a === undefined || b === undefined) continue;
    if (progress >= a.at && progress <= b.at) {
      lower = a;
      upper = b;
      break;
    }
  }
  if (lower === undefined || upper === undefined) return { top: "#0a0e22", bottom: "#161c3a" };

  const span = upper.at - lower.at;
  const t = span <= 0 ? 0 : (progress - lower.at) / span;
  return { top: mixColor(lower.top, upper.top, t), bottom: mixColor(lower.bottom, upper.bottom, t) };
}

function mixColor(
  from: readonly [number, number, number] | readonly number[],
  to: readonly [number, number, number] | readonly number[],
  t: number,
): string {
  const r = mixChannel(from[0] ?? 0, to[0] ?? 0, t);
  const g = mixChannel(from[1] ?? 0, to[1] ?? 0, t);
  const b = mixChannel(from[2] ?? 0, to[2] ?? 0, t);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Fit the grid inside the canvas, leaving a margin for the sky to breathe. */
export function layout(width: number, height: number): Viewport {
  const cell = Math.min(width / (RULES.columns + 1.5), height / (RULES.rows + 1.5));
  return {
    width,
    height,
    cell,
    originX: (width - cell * RULES.columns) / 2,
    originY: height - cell * RULES.rows - cell * 0.6,
  };
}

export function columnAt(view: Viewport, x: number): number {
  return Math.floor((x - view.originX) / view.cell);
}

export const wizard: Wizard = createWizard();

const motes: Mote[] = [];
/** Knocked by landings and chains, eased back to nothing. */
let shake = 0;

export function advanceVisuals(
  state: GameState,
  events: readonly GameEvent[],
  view: Viewport,
  dt: number,
  time: number,
): void {
  updateWizard(wizard, state, events, view, dt, time);

  shake = Math.max(shake * Math.exp(-9 * dt), emitForEvents(motes, events, view, wizard.wandTip));
  if (shake < 0.05) shake = 0;

  // A trail behind each light on its way home, thinned so a big cluster does
  // not emit one per light per frame.
  if (state.phase === "playing") {
    for (const rising of state.risings) {
      if (Math.random() < 0.35) trailRising(motes, view, rising.column, rising.y);
    }
  }
  advanceMotes(motes, dt);
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: Viewport,
  time: number,
  scrollOpen: number,
  showHow: boolean,
): void {
  const dusk = 1 - state.light;
  const night = nightProgress(state);
  // Ink is chosen for contrast against the sky actually behind him. Ramping
  // it on elapsed time alone left him at luminance 55 on a sky of about the
  // same, and the figure disappeared into the middle of the night.
  const ink = inkFor(skyAt(night).bottom);
  // Opposite end from the ink. `inkFor` returns rgb(), never hex, so this
  // must parse it as such or the halo is the same colour every time.
  const haloInk =
    luminance(parseRgb(ink)) > 0.5 ? "rgba(8, 10, 18, 0.55)" : "rgba(246, 249, 255, 0.5)";

  // The sky is drawn unshaken, or the knock would show as a gap at the edge.
  drawSky(ctx, state, view, time, night);

  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
  }
  drawGround(ctx, view, night, ink);
  drawPile(ctx, state, view, dusk, ink);
  drawHusks(ctx, state, view, dusk, ink);
  drawRisings(ctx, state, view);
  drawAim(ctx, state, view, dusk);
  drawSparks(ctx, state, view);
  drawWizard(ctx, wizard, view, time, ink, haloInk);
  drawLantern(ctx, state, view);
  drawActiveBoons(ctx, state, view, time);
  drawMotes(ctx, motes);
  ctx.restore();

  drawVignette(ctx, state, view);
  const rules = showHow && state.phase === "intro";
  drawScroll(
    ctx,
    view,
    rules ? HOW_LINES() : scrollLines(state),
    scrollOpen,
    ink,
    time,
    rules ? HOW_ART : undefined,
  );
}

/** Perceived brightness, 0 to 1. */
function luminance(rgb: readonly [number, number, number]): number {
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

/** Dark ink on a light sky, light ink on a dark one, crossfaded between. */
function inkFor(sky: string): string {
  const t = Math.max(0, Math.min(1, (0.46 - luminance(parseRgb(sky))) / 0.16));
  return mixColor(hexToRgb(INK_LIT), hexToRgb(INK_DARK), t);
}

function parseRgb(value: string): readonly [number, number, number] {
  const parts = value.match(/\d+/g) ?? [];
  return [Number(parts[0] ?? 0), Number(parts[1] ?? 0), Number(parts[2] ?? 0)];
}

function hexToRgb(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function drawSky(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: Viewport,
  time: number,
  night: number,
): void {
  const tone = skyAt(night);
  const sky = ctx.createLinearGradient(0, 0, 0, view.height);
  sky.addColorStop(0, tone.top);
  sky.addColorStop(1, tone.bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.width, view.height);

  // Stars read against the deep middle of the night, not against dusk or dawn.
  const dusk = Math.min(1, Math.sin(Math.min(1, night) * Math.PI) * 1.6);

  // Every light sent back up stays there. This is the whole score.
  // Only the newest few carry a halo. Past a few dozen, a halo each turns the
  // sky into milk and buries everything drawn over it.
  const haloFrom = Math.max(0, state.saved - 24);
  for (let i = 0; i < state.saved; i += 1) {
    const place = starPlace(i, view);
    const twinkle = 0.5 + 0.5 * Math.sin(time * 1.6 + i * 2.399);
    if (i >= haloFrom) {
      glow(ctx, place.x, place.y, view.cell * 0.4, COLORS.star, twinkle * (0.2 + dusk * 0.5));
    }
    ctx.fillStyle = COLORS.star;
    ctx.globalAlpha = (0.3 + dusk * 0.6) * twinkle;
    ctx.beginPath();
    ctx.arc(place.x, place.y, view.cell * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Deterministic scatter, so a saved light keeps its place in the sky.
 *
 * The band is the sky above the wizard, not `originY`: that is only the few
 * pixels of margin over the grid, so every light he ever returned was being
 * stacked into a strip at the very top of the screen.
 */
function starPlace(index: number, view: Viewport): { readonly x: number; readonly y: number } {
  const a = Math.sin(index * 127.1 + 0.3) * 43758.5453;
  const b = Math.sin(index * 311.7 + 1.7) * 24634.6345;
  const ground = view.originY + RULES.rows * view.cell;
  return {
    x: view.width * (a - Math.floor(a)),
    y: view.cell * 0.4 + (ground - view.cell * 3.2) * (b - Math.floor(b)),
  };
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  night: number,
  ink: string,
): void {
  const y = view.originY + RULES.rows * view.cell;
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.55 + Math.min(1, night) * 0.25;
  ctx.lineWidth = Math.max(1.5, view.cell * 0.06);
  ctx.beginPath();
  ctx.moveTo(view.originX - view.cell * 0.6, y);
  ctx.lineTo(view.originX + RULES.columns * view.cell + view.cell * 0.6, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPile(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: Viewport,
  dusk: number,
  ink: string,
): void {
  for (let row = 0; row < RULES.rows; row += 1) {
    for (let column = 0; column < RULES.columns; column += 1) {
      if (!cellAt(state.pile, column, row)) continue;
      drawHuskBody(
        ctx,
        view.originX + column * view.cell,
        view.originY + row * view.cell,
        view.cell,
        dusk,
        ink,
      );
    }
  }
}

function drawHusks(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: Viewport,
  dusk: number,
  ink: string,
): void {
  for (const husk of state.husks) {
    const x = view.originX + husk.column * view.cell;
    const y = view.originY + husk.y * view.cell;
    if (husk.boon !== null) {
      drawBoonHusk(ctx, husk.boon, x, y, view.cell, performance.now() / 1000);
      continue;
    }
    drawHuskBody(ctx, x, y, view.cell, dusk, ink);
  }
}

/**
 * The five lights that never went out. Each is told apart by shape first and
 * colour second, so they still read when the night is at its darkest.
 */
const BOON_LOOK: Readonly<Record<Boon, { readonly shell: string; readonly core: string }>> = {
  ember: { shell: "#b8560f", core: "#ffd089" },
  beacon: { shell: "#1d6f86", core: "#b9f0ff" },
  hush: { shell: "#4b4694", core: "#cfc6ff" },
  bloom: { shell: "#2f7a43", core: "#c9ffb8" },
  ward: { shell: "#8a6a12", core: "#ffeaa0" },
};

function drawBoonHusk(
  ctx: CanvasRenderingContext2D,
  boon: Boon,
  x: number,
  y: number,
  cell: number,
  time: number,
): void {
  const look = BOON_LOOK[boon];
  const cx = x + cell / 2;
  const cy = y + cell / 2;
  const pulse = 0.78 + 0.22 * Math.sin(time * 5 + x);

  glow(ctx, cx, cy, cell * 1.7 * pulse, look.core, 0.95);

  const inset = cell * 0.12;
  ctx.fillStyle = look.shell;
  ctx.beginPath();
  ctx.roundRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2, cell * 0.24);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = look.core;
  ctx.strokeStyle = look.core;
  ctx.lineWidth = Math.max(1.4, cell * 0.075);
  ctx.lineCap = "round";
  drawBoonMark(ctx, boon, cell * 0.26, time);
  ctx.restore();
}

/** Each mark is a different silhouette, drawn at the origin. */
function drawBoonMark(
  ctx: CanvasRenderingContext2D,
  boon: Boon,
  r: number,
  time: number,
): void {
  switch (boon) {
    case "ember": {
      // A flame: teardrop pointing up.
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.25);
      ctx.quadraticCurveTo(r, -r * 0.1, 0, r);
      ctx.quadraticCurveTo(-r, -r * 0.1, 0, -r * 1.25);
      ctx.fill();
      return;
    }
    case "beacon": {
      // A lens throwing light sideways: three widening bars.
      for (const side of [-1, 1] as const) {
        for (let i = 0; i < 3; i += 1) {
          const span = r * (0.5 + i * 0.35);
          ctx.beginPath();
          ctx.moveTo(side * r * 0.35, -span * 0.45);
          ctx.lineTo(side * r * (0.75 + i * 0.4), -span * 0.45);
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "hush": {
      // Slow concentric rings, breathing.
      for (let i = 1; i <= 2; i += 1) {
        ctx.globalAlpha = 1 - i * 0.28;
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.45 + i * 0.42) * (0.92 + 0.08 * Math.sin(time * 2)), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "bloom": {
      // A six-point star: everything on the ground goes up.
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2);
        ctx.stroke();
      }
      return;
    }
    case "ward": {
      // A hexagon of glass.
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * r * 1.1;
        const py = Math.sin(a) * r * 1.1;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      return;
    }
    default:
      return;
  }
}

/** A lantern that has gone out: a dark shell with a dead wick inside. */
function drawHuskBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  dusk: number,
  ink: string,
): void {
  const inset = cell * 0.14;
  const size = cell - inset * 2;

  ctx.fillStyle = COLORS.husk;
  ctx.globalAlpha = 0.85 + dusk * 0.15;
  ctx.beginPath();
  ctx.roundRect(x + inset, y + inset, size, size, cell * 0.22);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Outlined like the figure, so it reads against any sky.
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1.2, cell * 0.05);
  ctx.stroke();

  ctx.fillStyle = COLORS.huskDead;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(x + cell / 2, y + cell / 2, cell * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * The lane the wand is pointing at, up to whatever it would hit. Without this
 * the core rule — a spark stops at the first thing in its column — is
 * invisible, and the player cannot tell what they are aiming at.
 */
function drawAim(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: Viewport,
  dusk: number,
): void {
  if (state.phase !== "playing") return;

  const column = state.wizardColumn;
  const surface = surfaceRow(state.pile, column);
  let stop = surface;
  for (const husk of state.husks) {
    if (husk.column !== column || husk.y > surface) continue;
    stop = Math.min(stop, husk.y);
  }

  const x = view.originX + (column + 0.5) * view.cell;
  const top = view.originY + Math.max(0, stop) * view.cell;
  const bottom = view.originY + (RULES.wizardRow - 1.1) * view.cell;
  const blocked = stop < RULES.rows;

  const beam = ctx.createLinearGradient(x, bottom, x, top);
  const alpha = blocked ? 0.34 : 0.14;
  beam.addColorStop(0, `rgba(255, 214, 138, ${alpha.toFixed(3)})`);
  beam.addColorStop(0.75, `rgba(255, 214, 138, ${(alpha * 0.35).toFixed(3)})`);
  beam.addColorStop(1, "rgba(255, 214, 138, 0)");
  ctx.strokeStyle = beam;
  ctx.lineWidth = view.cell * 0.3;
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  ctx.lineTo(x, top);
  ctx.stroke();

  // A tick on whatever the spark would actually reach.
  if (!blocked) return;
  ctx.strokeStyle = `rgba(255, 206, 110, ${(0.75 + dusk * 0.25).toFixed(3)})`;
  ctx.lineWidth = Math.max(1.5, view.cell * 0.06);
  ctx.beginPath();
  ctx.moveTo(x - view.cell * 0.3, top + view.cell * 1.05);
  ctx.lineTo(x, top + view.cell * 1.25);
  ctx.lineTo(x + view.cell * 0.3, top + view.cell * 1.05);
  ctx.stroke();
}

function drawRisings(ctx: CanvasRenderingContext2D, state: GameState, view: Viewport): void {
  for (const rising of state.risings) {
    const x = view.originX + (rising.column + 0.5) * view.cell;
    const y = view.originY + (rising.y + 0.5) * view.cell;
    glow(ctx, x, y, view.cell * 1.1, COLORS.rising, 0.95);
    ctx.fillStyle = COLORS.rising;
    ctx.beginPath();
    ctx.arc(x, y, view.cell * 0.19, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSparks(ctx: CanvasRenderingContext2D, state: GameState, view: Viewport): void {
  for (const spark of state.sparks) {
    const x = view.originX + (spark.column + 0.5) * view.cell;
    const y = view.originY + (spark.y + 0.5) * view.cell;
    glow(ctx, x, y, view.cell * 0.8, COLORS.spark, 0.9);
    ctx.fillStyle = COLORS.spark;
    ctx.beginPath();
    ctx.ellipse(x, y, view.cell * 0.08, view.cell * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function lanternPoint(): { readonly x: number; readonly y: number } {
  return wizard.lantern;
}

function drawLantern(ctx: CanvasRenderingContext2D, state: GameState, view: Viewport): void {
  const { x, y } = wizard.lantern;
  const radius = view.cell * 0.17;
  // It goes out with him. Keeping a floor on the glow left the ground lit at
  // the one moment the whole ending is about it not being.
  const alive = 1 - wizard.sit;

  glow(ctx, x, y, view.cell * (1.5 + state.light * 3), COLORS.flame, (0.35 + state.light * 0.65) * alive);
  ctx.fillStyle = COLORS.flame;
  ctx.globalAlpha = (0.25 + state.light * 0.75) * alive;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * The dark closing in. It only ever darkens what is already drawn, so the
 * falling husks stay readable right to the end — the player should lose to
 * the pile, never to not being able to see.
 */
function drawVignette(ctx: CanvasRenderingContext2D, state: GameState, view: Viewport): void {
  const dusk = 1 - state.light;
  if (dusk <= 0.01) return;

  const { x, y } = wizard.lantern;
  const reach = view.cell * (4 + state.light * 14);

  const fade = ctx.createRadialGradient(x, y, 0, x, y, reach);
  fade.addColorStop(0, "rgba(4, 6, 14, 0)");
  fade.addColorStop(0.6, `rgba(4, 6, 14, ${(dusk * 0.2).toFixed(3)})`);
  fade.addColorStop(1, `rgba(4, 6, 14, ${(dusk * 0.55).toFixed(3)})`);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, view.width, view.height);
}

/**
 * What is running right now, shown on the board itself rather than in a
 * corner: a hot wand sheds sparks, a hush ripples across the sky, a ward is
 * glass around the lantern.
 */
function drawActiveBoons(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: Viewport,
  time: number,
): void {
  if (state.hush > 0) {
    const sweep = (1 - state.hush / RULES.hushSeconds) * view.height * 1.4;
    ctx.strokeStyle = `rgba(207, 198, 255, ${(0.1 + 0.12 * Math.sin(time * 3)).toFixed(3)})`;
    ctx.lineWidth = view.cell * 0.4;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(view.width / 2, -view.height * 0.4, sweep + i * view.cell * 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (state.surge > 0) {
    const tip = wizard.wandTip;
    glow(ctx, tip.x, tip.y, view.cell * (1 + 0.4 * Math.sin(time * 18)), "#ffb14d", 1);
  }

  if (state.ward > 0) {
    const { x, y } = wizard.lantern;
    const radius = view.cell * 1.5;
    ctx.strokeStyle = `rgba(255, 234, 160, ${(0.35 + 0.2 * Math.sin(time * 4)).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.5, view.cell * 0.07);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

/**
 * The rules page. It shows the game's own pieces rather than describing them:
 * the husk, the spark, the light going home, a cluster, the five marks. Only
 * the mechanics a player cannot see while playing are here — the spark
 * stopping at the first thing in its column, and what relighting costs.
 */
const HOW_LINES = (): readonly ScrollLine[] => [
  { text: t("howTitle"), scale: 1.5 },
  { text: t("begin"), scale: 0.85, pulse: true },
];

const HOW_ART: ScrollArt = { rows: 4, draw: drawRules };

function drawRules(
  ctx: CanvasRenderingContext2D,
  band: Rect,
  ink: string,
  time: number,
): void {
  const rows = 4;
  const rowHeight = band.height / rows;
  const icon = Math.min(rowHeight * 0.62, band.width * 0.1);
  const left = band.x + icon * 0.2;
  const textX = band.x + band.width * 0.46;

  const captions = [t("ruleRelight"), t("ruleBlocked"), t("ruleChain"), t("ruleBoons")];
  const painters = [ruleRelight, ruleBlocked, ruleChain, ruleBoons];

  // One size that every caption fits in. Burmese and English run to very
  // different widths, and a fixed size pushed the longest past the roller.
  const room = band.x + band.width - textX;
  let size = Math.min(icon * 0.5, band.width * 0.04);
  ctx.save();
  for (const caption of captions) {
    ctx.font = fontStack(size, 400);
    const wide = ctx.measureText(caption).width;
    if (wide > room) size *= room / wide;
  }
  ctx.restore();

  for (let i = 0; i < rows; i += 1) {
    const midY = band.y + rowHeight * (i + 0.5);
    const paint = painters[i];
    if (paint !== undefined) paint(ctx, left, midY, icon, ink, time);

    const caption = captions[i];
    if (caption === undefined) continue;
    ctx.save();
    ctx.fillStyle = ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = fontStack(size, 400);
    ctx.globalAlpha = 0.85;
    ctx.fillText(caption, textX, midY);
    ctx.restore();
  }
}

/** A husk, a spark under it, and the light it becomes. */
function ruleRelight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  ink: string,
): void {
  drawHuskBody(ctx, x, y - size / 2, size, 0.4, ink);
  arrow(ctx, x + size * 1.15, y, size * 0.5, ink);
  glow(ctx, x + size * 2.2, y, size * 0.75, COLORS.rising, 0.9);
  ctx.fillStyle = COLORS.rising;
  ctx.beginPath();
  ctx.arc(x + size * 2.2, y, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

/** A husk on the floor with the lane above it shut. */
function ruleBlocked(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  ink: string,
): void {
  const cx = x + size * 0.75;
  drawHuskBody(ctx, cx - size / 2, y + size * 0.02, size * 0.86, 0.4, ink);

  ctx.save();
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = Math.max(1.2, size * 0.07);
  ctx.lineCap = "round";

  // The floor it rests on.
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.85, y + size * 0.92);
  ctx.lineTo(cx + size * 0.85, y + size * 0.92);
  ctx.stroke();

  // And the way up out of that lane, struck through just above it.
  const by = y - size * 0.42;
  ctx.beginPath();
  ctx.moveTo(cx, by + size * 0.3);
  ctx.lineTo(cx, by - size * 0.26);
  ctx.moveTo(cx - size * 0.2, by - size * 0.06);
  ctx.lineTo(cx, by - size * 0.26);
  ctx.lineTo(cx + size * 0.2, by - size * 0.06);
  ctx.stroke();

  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.3, by + size * 0.26);
  ctx.lineTo(cx + size * 0.3, by - size * 0.3);
  ctx.moveTo(cx + size * 0.3, by + size * 0.26);
  ctx.lineTo(cx - size * 0.3, by - size * 0.3);
  ctx.stroke();
  ctx.restore();
}

/** Three touching husks becoming three lights at once. */
function ruleChain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  ink: string,
): void {
  const small = size * 0.72;
  for (let i = 0; i < 3; i += 1) {
    drawHuskBody(ctx, x + i * small * 0.96, y - small / 2, small, 0.4, ink);
  }
  arrow(ctx, x + size * 2.5, y, size * 0.45, ink);
  for (let i = 0; i < 3; i += 1) {
    const px = x + size * 3.1 + i * small * 0.6;
    glow(ctx, px, y - small * 0.2, small * 0.6, COLORS.rising, 0.8);
    ctx.fillStyle = COLORS.rising;
    ctx.beginPath();
    ctx.arc(px, y - small * 0.2, small * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The five marks, in a row. */
function ruleBoons(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  _ink: string,
  time: number,
): void {
  const step = size * 0.86;
  (["ember", "beacon", "hush", "bloom", "ward"] as const).forEach((boon, i) => {
    const look = BOON_LOOK[boon];
    const cx = x + size * 0.35 + i * step;
    glow(ctx, cx, y, size * 0.55, look.core, 0.7);
    ctx.save();
    ctx.translate(cx, y);
    ctx.fillStyle = look.core;
    ctx.strokeStyle = look.core;
    ctx.lineWidth = Math.max(1.1, size * 0.07);
    ctx.lineCap = "round";
    drawBoonMark(ctx, boon, size * 0.24, time);
    ctx.restore();
  });
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  ink: string,
): void {
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = Math.max(1.2, size * 0.14);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - size * 0.5, y);
  ctx.lineTo(x + size * 0.5, y);
  ctx.moveTo(x + size * 0.12, y - size * 0.3);
  ctx.lineTo(x + size * 0.5, y);
  ctx.lineTo(x + size * 0.12, y + size * 0.3);
  ctx.stroke();
  ctx.restore();
}

/** The scroll says three things at most: what happened, and how it went. */
function scrollLines(state: GameState): readonly ScrollLine[] {
  if (state.phase === "intro") {
    return [
      { text: t("title"), scale: 1.9 },
      { text: t("purpose"), scale: 0.92, dim: true },
      { text: t("begin"), scale: 0.85, pulse: true },
    ];
  }

  if (state.phase === "paused") {
    return [
      { text: t("paused"), scale: 1.5 },
      { text: `${t("lasted")}  ${clock(state.elapsed)}`, scale: 0.9, dim: true },
      { text: t("carryOn"), scale: 0.85, pulse: true },
    ];
  }

  const outcome = state.phase === "dawn" ? t("sunCameUp") : t("wentOut");
  return [
    { text: outcome, scale: 1.5 },
    { text: `${t("lasted")}  ${clock(state.elapsed)}`, scale: 0.95, dim: true },
    { text: `${state.saved}  ${t("returned")}`, scale: 0.95, dim: true },
    { text: t("again"), scale: 0.8, pulse: true },
  ];
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  strength: number,
): void {
  const size = Math.max(1, radius);
  const halo = ctx.createRadialGradient(x, y, 0, x, y, size);
  halo.addColorStop(0, color);
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = Math.max(0, Math.min(1, strength)) * 0.55;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
