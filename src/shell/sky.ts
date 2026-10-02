/**
 * Kasar — the sky behind the shelf.
 *
 * Stars and a few drifting lights on a canvas, so the page the games sit on
 * is the same kind of thing they are: drawn in code, no image anywhere.
 *
 * It borrows nothing from any game — the shelf may not import from games/ —
 * but it rhymes with them on purpose: the lights drift upward, the way a
 * relit one goes home.
 */

interface Star {
  x: number;
  y: number;
  readonly size: number;
  readonly phase: number;
  readonly speed: number;
  readonly warm: boolean;
}

const STAR_COUNT = 110;
const WARM_IN = 7;

let stars: Star[] = [];
let frame = 0;
let motion = true;

/** Deterministic, so the sky is the same on every visit. */
function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function populate(width: number, height: number): void {
  stars = Array.from({ length: STAR_COUNT }, (_unused, i) => ({
    x: seeded(i, 1) * width,
    y: seeded(i, 2) * height,
    size: 0.6 + seeded(i, 3) * (i % WARM_IN === 0 ? 2.2 : 1.1),
    phase: seeded(i, 4) * Math.PI * 2,
    speed: 2 + seeded(i, 5) * 9,
    warm: i % WARM_IN === 0,
  }));
}

export function startSky(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;

  motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width = 0;
  let height = 0;

  function resize(): void {
    const ratio = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    populate(width, height);
  }

  // The canvas tracks its own box, not the window: the shelf grows with the
  // number of games, and a window-only listener misses that.
  new ResizeObserver(() => {
    resize();
  }).observe(canvas);
  resize();

  let last = performance.now();

  function paint(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (ctx === null) return;

    ctx.clearRect(0, 0, width, height);

    // A warm band low down, as if something were still lit below the horizon.
    const horizon = ctx.createRadialGradient(
      width / 2,
      height * 1.05,
      0,
      width / 2,
      height * 1.05,
      Math.max(width, height) * 0.75,
    );
    horizon.addColorStop(0, 'rgba(255, 198, 120, 0.16)');
    horizon.addColorStop(0.45, 'rgba(255, 170, 110, 0.05)');
    horizon.addColorStop(1, 'rgba(255, 170, 110, 0)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, width, height);

    frame += 1;
    for (const star of stars) {
      if (motion) {
        star.y -= star.speed * dt;
        if (star.y < -4) star.y = height + 4;
      }

      const twinkle = 0.45 + 0.55 * Math.sin(frame * 0.012 + star.phase);
      const colour = star.warm ? '255, 214, 150' : '226, 234, 255';

      if (star.warm) {
        const halo = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 7);
        halo.addColorStop(0, `rgba(${colour}, ${(0.33 * twinkle).toFixed(3)})`);
        halo.addColorStop(1, 'rgba(255, 214, 150, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 7, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = `rgba(${colour}, ${(0.5 * twinkle).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(paint);
  }

  requestAnimationFrame(paint);
}
