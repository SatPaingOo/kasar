import { describe, expect, it } from 'vitest';

import { WALK, createWalker, stepWalker } from '../../../src/shell/walk.js';
import type { WalkerState } from '../../../src/shell/walk.js';

const WIDTH = 1200;

/** A random() that is not random, so a run can be reasoned about. */
function sequence(values: readonly number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0.5;
}

function walking(over: Partial<WalkerState> = {}): WalkerState {
  return {
    x: 600,
    facing: 1,
    speed: 0,
    phase: 0,
    targetX: 900,
    restFor: 0,
    startled: 0,
    ...over,
  };
}

function run(state: WalkerState, steps: number, pointerX: number | null, random = () => 0.5): WalkerState {
  for (let i = 0; i < steps; i += 1) {
    stepWalker(state, { width: WIDTH, pointerX, dt: 1 / 60, random });
  }
  return state;
}

describe('createWalker', () => {
  it('puts him on the shelf, not past the end of it', () => {
    for (const r of [0, 0.5, 1]) {
      const state = createWalker(WIDTH, () => r);
      expect(state.x).toBeGreaterThanOrEqual(WALK.margin);
      expect(state.x).toBeLessThanOrEqual(WIDTH - WALK.margin);
    }
  });

  it('starts him standing still', () => {
    expect(createWalker(WIDTH, () => 0.5).speed).toBe(0);
  });

  it('copes with a window too narrow to hold him', () => {
    const state = createWalker(10, () => 0.5);
    expect(Number.isFinite(state.x)).toBe(true);
  });
});

describe('stepWalker', () => {
  it('walks towards its target', () => {
    const state = run(walking({ x: 600, targetX: 900 }), 60, null);
    expect(state.x).toBeGreaterThan(600);
    expect(state.x).toBeLessThanOrEqual(900);
    expect(state.facing).toBe(1);
  });

  it('turns to face the way it is going', () => {
    expect(run(walking({ x: 600, targetX: 200 }), 10, null).facing).toBe(-1);
  });

  it('stands still while resting', () => {
    const state = walking({ restFor: 2, targetX: 900 });
    run(state, 30, null);
    expect(state.x).toBe(600);
    expect(state.speed).toBe(0);
  });

  it('rests on arrival, then picks somewhere else worth walking to', () => {
    const state = walking({ x: 600, targetX: 602 });
    stepWalker(state, { width: WIDTH, pointerX: null, dt: 1 / 60, random: () => 0.5 });
    expect(state.restFor).toBeGreaterThan(0);
    expect(Math.abs(state.targetX - state.x)).toBeGreaterThan(60);
  });

  it('only advances the walk cycle while it is moving', () => {
    const resting = walking({ restFor: 5 });
    run(resting, 30, null);
    expect(resting.phase).toBe(0);

    const moving = walking({ targetX: 900 });
    run(moving, 30, null);
    expect(moving.phase).toBeGreaterThan(0);
  });
});

describe('the pointer', () => {
  it('sends him the other way', () => {
    const fromRight = run(walking({ x: 600 }), 30, 650);
    expect(fromRight.x).toBeLessThan(600);

    const fromLeft = run(walking({ x: 600 }), 30, 550);
    expect(fromLeft.x).toBeGreaterThan(600);
  });

  it('gets him up off a rest', () => {
    const state = walking({ x: 600, restFor: 10 });
    run(state, 30, 620);
    expect(state.x).toBeLessThan(600);
  });

  it('makes him hurry', () => {
    const strolling = run(walking({ targetX: 900 }), 20, null);
    const fleeing = run(walking({ x: 600 }), 20, 650);
    expect(fleeing.speed).toBeGreaterThan(strolling.speed);
  });

  it('is ignored once it is far enough away', () => {
    // Resting, so he cannot walk into range of the pointer he is ignoring.
    const state = walking({ x: 600, restFor: 10 });
    run(state, 5, 600 + WALK.startleRange + 1);
    expect(state.startled).toBe(0);
    expect(state.x).toBe(600);
  });

  it('stops bothering him shortly after it leaves', () => {
    const state = walking({ x: 600 });
    run(state, 30, 650);
    expect(state.startled).toBeGreaterThan(0);
    run(state, Math.ceil(WALK.startleSeconds * 60) + 2, null);
    expect(state.startled).toBe(0);
  });

  it('cannot chase him off the shelf', () => {
    // The pointer sits on top of him and follows, every frame, from both
    // sides and at both edges. He must never leave the shelf.
    const random = sequence([0.03, 0.97, 0.5, 0.11, 0.84]);
    for (const start of [WALK.margin, 300, WIDTH / 2, WIDTH - WALK.margin]) {
      const state = walking({ x: start });
      for (let i = 0; i < 2000; i += 1) {
        const chase = state.x + (i % 2 === 0 ? 1 : -1) * 5;
        stepWalker(state, { width: WIDTH, pointerX: chase, dt: 1 / 60, random });
        expect(state.x).toBeGreaterThanOrEqual(WALK.margin);
        expect(state.x).toBeLessThanOrEqual(WIDTH - WALK.margin);
      }
    }
  });

  it('keeps him on a shelf narrower than his own margins', () => {
    const state = walking({ x: 5, targetX: 5 });
    for (let i = 0; i < 200; i += 1) {
      stepWalker(state, { width: 30, pointerX: 10, dt: 1 / 60, random: () => 0.5 });
      expect(Number.isFinite(state.x)).toBe(true);
    }
  });
});
