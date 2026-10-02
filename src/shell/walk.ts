/**
 * Where the shelf's little figure goes next.
 *
 * Kept apart from the drawing so the one thing worth checking — that he keeps
 * away from the pointer and never walks off the shelf — can be tested without
 * a canvas.
 *
 * This is the shelf's own, not a game's. It knows nothing about any game and
 * imports nothing from `games/`.
 */

export interface WalkerState {
  /** Pixels from the left edge. */
  x: number;
  facing: 1 | -1;
  /** Pixels per second, right now. */
  speed: number;
  /** Walk-cycle angle, advanced by distance so the legs match the pace. */
  phase: number;
  targetX: number;
  /** Seconds left standing still. */
  restFor: number;
  /** Seconds left of hurrying away from the pointer. */
  startled: number;
}

export interface WalkInput {
  /** How wide the shelf is, in pixels. */
  readonly width: number;
  /** Pointer position, or null when it is nowhere near him. */
  readonly pointerX: number | null;
  readonly dt: number;
  readonly random: () => number;
}

export const WALK = {
  /** He keeps this far from either edge. */
  margin: 28,
  strollSpeed: 34,
  fleeSpeed: 118,
  /** A pointer nearer than this startles him. */
  startleRange: 130,
  startleSeconds: 1.1,
  /** How far he tries to get away when startled. */
  fleeDistance: 240,
  restMin: 1.2,
  restMax: 4.5,
  /** Close enough to count as arrived. */
  arriveWithin: 6,
  /** Radians of walk cycle per pixel travelled. */
  phasePerPixel: 0.085,
} as const;

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

export function createWalker(width: number, random: () => number = Math.random): WalkerState {
  const span = Math.max(1, width - WALK.margin * 2);
  const x = WALK.margin + random() * span;
  return {
    x,
    facing: 1,
    speed: 0,
    phase: 0,
    targetX: x,
    restFor: WALK.restMin,
    startled: 0,
  };
}

/** Somewhere new to amble to, never the spot he is already standing on. */
function wander(state: WalkerState, input: WalkInput): number {
  const low = WALK.margin;
  const high = Math.max(low, input.width - WALK.margin);
  for (let tries = 0; tries < 4; tries += 1) {
    const candidate = low + input.random() * (high - low);
    if (Math.abs(candidate - state.x) > 60) return candidate;
  }
  return state.x < (low + high) / 2 ? high : low;
}

/**
 * One step. Mutates and returns the same object, the way the games' own rules
 * do, so a frame does not allocate.
 */
export function stepWalker(state: WalkerState, input: WalkInput): WalkerState {
  const low = WALK.margin;
  const high = Math.max(low, input.width - WALK.margin);

  // A pointer close by sends him off in the other direction. Checked before
  // resting, so he will not sit still while the cursor is on top of him.
  if (input.pointerX !== null && Math.abs(input.pointerX - state.x) < WALK.startleRange) {
    const away = input.pointerX > state.x ? -1 : 1;
    state.startled = WALK.startleSeconds;
    state.restFor = 0;
    state.targetX = clamp(state.x + away * WALK.fleeDistance, low, high);
  }

  state.startled = Math.max(0, state.startled - input.dt);

  if (state.restFor > 0) {
    state.restFor -= input.dt;
    state.speed = 0;
    return state;
  }

  const toGo = state.targetX - state.x;
  if (Math.abs(toGo) <= WALK.arriveWithin) {
    state.x = clamp(state.targetX, low, high);
    state.speed = 0;
    state.restFor = WALK.restMin + input.random() * (WALK.restMax - WALK.restMin);
    state.targetX = wander(state, input);
    return state;
  }

  const direction = toGo > 0 ? 1 : -1;
  state.facing = direction;
  state.speed = state.startled > 0 ? WALK.fleeSpeed : WALK.strollSpeed;

  const travelled = Math.min(state.speed * input.dt, Math.abs(toGo));
  state.x = clamp(state.x + direction * travelled, low, high);
  state.phase += travelled * WALK.phasePerPixel;

  return state;
}

/**
 * Where one foot sits in the walk cycle: `reach` is its position ahead of the
 * hip as a fraction of the stride, `lift` how far off the ground as a fraction
 * of the foot lift.
 *
 * A foot is planted while it travels backwards, because that is the half of
 * the cycle carrying the body forwards, and in the air while it swings
 * forwards. Having those two halves the wrong way round is a moonwalk: the
 * legs still scissor, the figure still moves, and it reads as walking
 * backwards. It is easy to write and hard to see, which is why it is here and
 * tested rather than buried in the drawing.
 */
export function footAt(phase: number): { readonly reach: number; readonly lift: number } {
  return { reach: Math.cos(phase), lift: Math.max(0, -Math.sin(phase)) };
}
