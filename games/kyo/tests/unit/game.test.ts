/**
 * The rules, headlessly. `game.ts` is pure and takes its randomness as an
 * argument, so every one of these is deterministic without a clock.
 *
 * The rope is the whole game, so most of this is about the rope: that it pulls
 * and never pushes, that letting go really does let go, and that the same run
 * comes out the same whatever frame rate it is played at.
 */

import { describe, expect, it } from 'vitest';

import { RULES, bandAt, createGame, grab, groundAt, leanOf, progress, release, step } from '../../src/game.js';
import type { Game } from '../../src/game.js';

const still = (): number => 0.5;

/** Hang him on a single anchor with nothing else in the sky. */
function hung(length = 5): Game {
  const game = createGame(still);
  game.anchors = [{ x: 0, y: 5 }];
  game.stockedTo = 1e9;
  game.figure = { x: 0, y: 5 + length, vx: 0, vy: 0 };
  game.rope = { x: 0, y: 5, length };
  return game;
}

function run(game: Game, seconds: number, dt = 1 / 60): Game {
  for (let i = 0; i < Math.round(seconds / dt); i += 1) step(game, dt, still);
  return game;
}

describe('the rope', () => {
  it('holds him at its length instead of letting him fall through it', () => {
    const game = hung(5);
    game.figure.vx = 6;
    run(game, 2);
    const dist = Math.hypot(game.figure.x - 0, game.figure.y - 5);
    expect(dist).toBeLessThanOrEqual(5 + 1e-6);
  });

  it('pulls but never pushes, so slack is a free fall', () => {
    // Started well inside the circle, the rope must not shove him outwards.
    const game = hung(8);
    game.figure = { x: 0, y: 6, vx: 0, vy: 0 };
    const before = game.figure.y;
    step(game, 1 / 60, still);
    expect(game.figure.y).toBeGreaterThan(before);
    expect(Math.hypot(game.figure.x, game.figure.y - 5)).toBeLessThan(8);
  });

  it('swings him: let go of a still man and he ends up moving', () => {
    const game = hung(5);
    game.figure = { x: 4, y: 5 + 3, vx: 0, vy: 0 };
    run(game, 0.6);
    expect(Math.hypot(game.figure.vx, game.figure.vy)).toBeGreaterThan(1);
  });

  it('does not wind itself up for ever', () => {
    const game = hung(5);
    game.figure.vx = 10;
    run(game, 25);
    const speed = Math.hypot(game.figure.vx, game.figure.vy);
    expect(Number.isFinite(speed)).toBe(true);
    expect(speed).toBeLessThan(40);
  });
});

describe('letting go', () => {
  it('keeps the speed he had, which is the whole point of the timing', () => {
    const game = hung(5);
    game.figure.vx = 7;
    game.figure.vy = -2;
    release(game);
    expect(game.rope).toBeNull();
    expect(game.figure.vx).toBe(7);
    expect(game.figure.vy).toBe(-2);
  });

  it('is refused when there is nothing to let go of', () => {
    const game = hung(5);
    release(game);
    expect(release(game)).toBe(false);
  });

  it('leaves him on a falling arc rather than holding him up', () => {
    const game = hung(5);
    game.figure.vx = 8;
    game.figure.vy = -6;
    release(game);
    run(game, 1.2);
    expect(game.figure.vy).toBeGreaterThan(0);
    expect(game.figure.x).toBeGreaterThan(0);
  });
});

describe('throwing a rope', () => {
  it('takes the one furthest ahead, not the one nearest', () => {
    const game = hung(5);
    release(game);
    game.figure = { x: 0, y: 8, vx: 0, vy: 0 };
    game.anchors = [
      { x: -1, y: 4 },
      { x: 2, y: 4 },
      { x: 4, y: 4 },
    ];
    expect(grab(game)).toBe(true);
    expect(game.rope?.x).toBe(4);
  });

  it('will not grab something level with him or below', () => {
    const game = hung(5);
    release(game);
    game.figure = { x: 0, y: 8, vx: 0, vy: 0 };
    game.anchors = [
      { x: 1, y: 8 },
      { x: 2, y: 12 },
    ];
    expect(grab(game)).toBe(false);
    expect(game.rope).toBeNull();
  });

  it('will not grab further than he can throw', () => {
    const game = hung(5);
    release(game);
    game.figure = { x: 0, y: 8, vx: 0, vy: 0 };
    game.anchors = [{ x: RULES.reach + 2, y: 4 }];
    expect(grab(game)).toBe(false);
  });

  it('reports a miss, so a wasted press can be heard', () => {
    const game = hung(5);
    release(game);
    game.anchors = [];
    grab(game);
    expect(game.events.some((e) => e.kind === 'miss')).toBe(true);
  });

  it('is refused while he is already holding one', () => {
    const game = hung(5);
    game.anchors = [{ x: 1, y: 2 }];
    expect(grab(game)).toBe(false);
  });

  it('sets the rope to the length it actually is', () => {
    const game = hung(5);
    release(game);
    game.figure = { x: 0, y: 8, vx: 0, vy: 0 };
    game.anchors = [{ x: 3, y: 4 }];
    grab(game);
    expect(game.rope?.length).toBeCloseTo(5);
  });
});

describe('the gorge', () => {
  it('always has something ahead of him to aim at', () => {
    const game = createGame(still);
    for (let i = 0; i < 40; i += 1) {
      game.figure.x += 20;
      step(game, 1 / 60, still);
      const ahead = game.anchors.filter((a) => a.x > game.figure.x);
      expect(ahead.length).toBeGreaterThan(0);
    }
  });

  it('forgets what is behind instead of growing for ever', () => {
    const game = createGame(still);
    for (let i = 0; i < 400; i += 1) {
      game.figure.x += 10;
      step(game, 1 / 60, still);
    }
    expect(game.anchors.length).toBeLessThan(40);
  });

  it('spreads them further apart the further across he gets', () => {
    const near = createGame(still);
    const nearGap = (near.anchors[1]?.x ?? 0) - (near.anchors[0]?.x ?? 0);

    const far = createGame(still);
    // Cut him loose first: moved while still roped, the constraint drags him
    // straight back to the anchor, which is the rope doing its job.
    release(far);
    far.figure.x = RULES.distance * 0.9;
    far.stockedTo = RULES.distance * 0.9;
    far.anchors = [];
    step(far, 1 / 60, still);
    const farGap = (far.anchors[1]?.x ?? 0) - (far.anchors[0]?.x ?? 0);

    expect(farGap).toBeGreaterThan(nearGap);
  });

  it('starts him already hanging, so the first press is a release', () => {
    const game = createGame(still);
    expect(game.rope).not.toBeNull();
  });
});

describe('ending it', () => {
  it('ends when he touches the ground', () => {
    const game = hung(5);
    release(game);
    run(game, 6);
    expect(game.outcome).toBe('fallen');
    expect(game.figure.y).toBeLessThanOrEqual(RULES.height);
  });

  it('ends when he is across', () => {
    const game = createGame(still);
    release(game);
    game.figure.x = RULES.distance + 1;
    step(game, 1 / 60, still);
    expect(game.outcome).toBe('across');
    expect(progress(game)).toBe(1);
  });

  it('stops dead once it is over', () => {
    const game = hung(5);
    game.outcome = 'fallen';
    const where = { ...game.figure };
    step(game, 1, still);
    expect(game.figure).toEqual(where);
    expect(game.events).toHaveLength(0);
  });

  it('keeps the furthest he got, not where he fell', () => {
    const game = hung(5);
    release(game);
    game.figure.x = 50;
    step(game, 1 / 60, still);
    game.figure.x = 20;
    step(game, 1 / 60, still);
    expect(game.best).toBeGreaterThanOrEqual(50);
  });
});

describe('the same run at any frame rate', () => {
  it('comes out in the same place, because physics runs on a fixed step', () => {
    const smooth = hung(5);
    smooth.figure.vx = 6;
    const choppy = hung(5);
    choppy.figure.vx = 6;

    // One second, as 120 small frames and as 30 large ones.
    for (let i = 0; i < 120; i += 1) step(smooth, 1 / 120, still);
    for (let i = 0; i < 30; i += 1) step(choppy, 1 / 30, still);

    expect(choppy.figure.x).toBeCloseTo(smooth.figure.x, 6);
    expect(choppy.figure.y).toBeCloseTo(smooth.figure.y, 6);
  });
});

describe('which way he is turned', () => {
  it('hangs from the rope while he has one', () => {
    const game = hung(5);
    game.figure.x = 3;
    expect(leanOf(game)).toBeGreaterThan(0);
    game.figure.x = -3;
    expect(leanOf(game)).toBeLessThan(0);
  });

  it('follows where he is going once he has let go', () => {
    const game = hung(5);
    release(game);
    game.figure.vx = 8;
    game.figure.vy = 4;
    expect(leanOf(game)).toBeGreaterThan(0);
  });
});

describe('the gorge goes down', () => {
  it('drops the floor and the anchors together as it goes on', () => {
    expect(groundAt(100)).toBeGreaterThan(groundAt(0));
    expect(bandAt(100)).toBeGreaterThan(bandAt(0));
    // Both by the same amount: the band keeps its clearance over the floor all
    // the way across, or the far side would be unplayable for a different
    // reason than the near side.
    expect(groundAt(100) - groundAt(0)).toBeCloseTo(bandAt(100) - bandAt(0), 9);
  });

  it('keeps the floor the same depth below the anchors everywhere', () => {
    for (const x of [0, 250, 900, RULES.distance]) {
      expect(groundAt(x) - bandAt(x)).toBeCloseTo(RULES.height - RULES.anchorHigh, 9);
    }
  });

  it('hangs its anchors inside the band, wherever along it they fall', () => {
    const game = createGame(() => 0.5);
    release(game);
    game.figure.x = 800;
    game.stockedTo = 800;
    game.anchors = [];
    step(game, 1 / 60, () => 0.5);
    expect(game.anchors.length).toBeGreaterThan(0);
    for (const anchor of game.anchors) {
      expect(anchor.y).toBeGreaterThanOrEqual(bandAt(anchor.x) - 1e-9);
      expect(anchor.y).toBeLessThan(groundAt(anchor.x));
    }
  });

  it('lets a shallow sink be outrun by the floor falling away', () => {
    const game = createGame(() => 0.5);
    release(game);
    game.figure.x = 400;
    game.figure.y = groundAt(400) - 0.1;
    game.figure.vx = 14;
    game.figure.vy = 0;
    step(game, 1 / 30, () => 0.5);
    expect(game.outcome).toBe('swinging');
  });

  it('ends him on the floor where he is, not where the floor started', () => {
    const game = createGame(() => 0.5);
    release(game);
    game.figure.x = 400;
    game.figure.y = groundAt(400) - 0.1;
    // Falling, and properly: drifting gently down is not enough, because the
    // floor drops away faster than that and he simply outruns it.
    game.figure.vy = 10;
    step(game, 1 / 30, () => 0.5);
    expect(game.outcome).toBe('fallen');
    // He would be nowhere near the near-side floor height.
    expect(game.figure.y).toBeGreaterThan(RULES.height);
  });
});
