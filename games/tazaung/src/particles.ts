/**
 * Tazaung — motes.
 *
 * The small stuff that makes a hit feel like a hit: a relit light scatters
 * sparks, a husk landing throws cold dust, a cluster lifting off trails its
 * way up. All of it is circles with a velocity and a life, drawn additively
 * for the warm ones, so there is still no image file anywhere.
 *
 * The array is capped. A chain of twenty on a slow machine should cost a
 * bounded amount of work, not whatever the board happens to contain.
 */

import { RULES } from './game.js';
import type { Boon, GameEvent } from './game.js';
import type { Viewport } from './render.js';

export interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds remaining, counted down to zero. */
  life: number;
  readonly maxLife: number;
  readonly size: number;
  readonly color: string;
  /** Warm motes are drawn additively; cold dust is not. */
  readonly warm: boolean;
  readonly gravity: number;
  readonly drag: number;
}

/** Past this, the oldest are dropped rather than the newest refused. */
const CAP = 420;

const WARM = '#ffd98a';
const BRIGHT = '#fff3d2';
const COLD = '#9aa3bd';

const BOON_MOTE: Readonly<Record<Boon, string>> = {
  ember: '#ffb14d',
  beacon: '#b9f0ff',
  hush: '#cfc6ff',
  bloom: '#c9ffb8',
  ward: '#ffeaa0',
};

interface BurstOptions {
  readonly count: number;
  readonly color: string;
  readonly warm: boolean;
  readonly speed: number;
  readonly spread: number;
  readonly life: number;
  readonly size: number;
  readonly gravity: number;
  readonly drag: number;
  /** Radians. 0 is to the right, -PI/2 is straight up. */
  readonly direction: number;
  /** How wide an arc around `direction` the burst covers. */
  readonly arc: number;
}

function burst(motes: Mote[], x: number, y: number, o: BurstOptions): void {
  for (let i = 0; i < o.count; i += 1) {
    const angle = o.direction + (Math.random() - 0.5) * o.arc;
    const speed = o.speed * (0.45 + Math.random() * 0.55);
    const life = o.life * (0.6 + Math.random() * 0.4);
    motes.push({
      x: x + (Math.random() - 0.5) * o.spread,
      y: y + (Math.random() - 0.5) * o.spread,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size: o.size * (0.5 + Math.random() * 0.8),
      color: o.color,
      warm: o.warm,
      gravity: o.gravity,
      drag: o.drag,
    });
  }
  if (motes.length > CAP) motes.splice(0, motes.length - CAP);
}

const centreOf = (view: Viewport, column: number, row: number): { x: number; y: number } => ({
  x: view.originX + (column + 0.5) * view.cell,
  y: view.originY + (row + 0.5) * view.cell,
});

/**
 * Turn this frame's events into motes, and return how hard the view should be
 * knocked. A landing is a small thud; a big cluster going up is a shove.
 */
export function emitForEvents(
  motes: Mote[],
  events: readonly GameEvent[],
  view: Viewport,
  wandTip: { readonly x: number; readonly y: number },
): number {
  const cell = view.cell;
  let shake = 0;

  for (const event of events) {
    switch (event.kind) {
      case 'shot': {
        burst(motes, wandTip.x, wandTip.y, {
          count: 4,
          color: WARM,
          warm: true,
          speed: cell * 1.4,
          spread: cell * 0.1,
          life: 0.22,
          size: cell * 0.045,
          gravity: cell * 0.6,
          drag: 2.4,
          direction: -Math.PI / 2,
          arc: Math.PI * 0.9,
        });
        break;
      }
      case 'relit': {
        // The husk does not vanish, it comes apart and the pieces drift.
        const at = centreOf(view, event.column, event.row);
        burst(motes, at.x, at.y, {
          count: 14,
          color: BRIGHT,
          warm: true,
          speed: cell * 2.2,
          spread: cell * 0.3,
          life: 0.75,
          size: cell * 0.06,
          gravity: -cell * 0.35,
          drag: 1.5,
          direction: -Math.PI / 2,
          arc: Math.PI * 2,
        });
        break;
      }
      case 'landed': {
        const at = centreOf(view, event.column, event.row);
        burst(motes, at.x, at.y + cell * 0.35, {
          count: 10,
          color: COLD,
          warm: false,
          speed: cell * 1.7,
          spread: cell * 0.5,
          life: 0.5,
          size: cell * 0.05,
          gravity: cell * 3.4,
          drag: 2.8,
          direction: -Math.PI / 2,
          arc: Math.PI * 1.1,
        });
        shake = Math.max(shake, cell * 0.07);
        break;
      }
      case 'chain': {
        const at = centreOf(view, event.column, event.row);
        burst(motes, at.x, at.y, {
          count: Math.min(50, 10 + event.size * 4),
          color: BRIGHT,
          warm: true,
          speed: cell * 3.4,
          spread: cell * 0.8,
          life: 1,
          size: cell * 0.07,
          gravity: -cell * 0.6,
          drag: 1.2,
          direction: -Math.PI / 2,
          arc: Math.PI * 2,
        });
        shake = Math.max(shake, cell * (0.06 + Math.min(0.22, event.size * 0.022)));
        break;
      }
      case 'boon': {
        const at = centreOf(view, event.column, event.row);
        burst(motes, at.x, at.y, {
          count: 28,
          color: BOON_MOTE[event.boon],
          warm: true,
          speed: cell * 4,
          spread: cell * 0.2,
          life: 0.9,
          size: cell * 0.065,
          gravity: 0,
          drag: 2.2,
          direction: 0,
          arc: Math.PI * 2,
        });
        shake = Math.max(shake, cell * 0.1);
        break;
      }
      case 'dawn': {
        for (let column = 0; column < RULES.columns; column += 1) {
          const at = centreOf(view, column, RULES.rows - 1);
          burst(motes, at.x, at.y, {
            count: 10,
            color: BRIGHT,
            warm: true,
            speed: cell * 2.6,
            spread: cell * 0.5,
            life: 2.2,
            size: cell * 0.06,
            gravity: -cell * 0.5,
            drag: 0.7,
            direction: -Math.PI / 2,
            arc: Math.PI * 0.6,
          });
        }
        break;
      }
      case 'ended': {
        shake = Math.max(shake, cell * 0.18);
        break;
      }
      default:
        break;
    }
  }
  return shake;
}

/** A rising light leaves a trail, so a cluster going up reads as one movement. */
export function trailRising(motes: Mote[], view: Viewport, column: number, y: number): void {
  const at = centreOf(view, column, y);
  burst(motes, at.x, at.y, {
    count: 1,
    color: WARM,
    warm: true,
    speed: view.cell * 0.25,
    spread: view.cell * 0.18,
    life: 0.4,
    size: view.cell * 0.04,
    gravity: 0,
    drag: 3,
    direction: Math.PI / 2,
    arc: Math.PI * 0.6,
  });
}

export function advanceMotes(motes: Mote[], dt: number): void {
  for (let i = motes.length - 1; i >= 0; i -= 1) {
    const mote = motes[i];
    if (mote === undefined) continue;

    mote.life -= dt;
    if (mote.life <= 0) {
      motes.splice(i, 1);
      continue;
    }

    const slow = Math.exp(-mote.drag * dt);
    mote.vx *= slow;
    mote.vy = mote.vy * slow + mote.gravity * dt;
    mote.x += mote.vx * dt;
    mote.y += mote.vy * dt;
  }
}

export function drawMotes(ctx: CanvasRenderingContext2D, motes: readonly Mote[]): void {
  if (motes.length === 0) return;
  ctx.save();
  let additive = false;

  for (const mote of motes) {
    const fade = mote.life / mote.maxLife;
    if (mote.warm !== additive) {
      ctx.globalCompositeOperation = mote.warm ? 'lighter' : 'source-over';
      additive = mote.warm;
    }
    ctx.globalAlpha = mote.warm ? fade : fade * 0.55;
    ctx.fillStyle = mote.color;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.size * (0.4 + fade * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
