/**
 * Tazaung — rules.
 *
 * The sky is going out. Dead lights fall as cold husks. The wizard spends his
 * own lantern to relight them; the ones he misses pile up and smother him.
 *
 * This module is pure: no canvas, no DOM, no timers, no Math.random unless the
 * caller hands one in. Everything the renderer needs is readable state.
 */

export const RULES = {
  columns: 8,
  rows: 13,

  /** Row the wizard stands on, counted from the top. */
  wizardRow: 12,
  /** The dark has closed over the lantern once a column's pile reaches here. */
  buriedRow: 2,

  lightStart: 0.75,
  lightMax: 1,

  /**
   * The night is this long. Keep the lantern lit to the end of it and the sun
   * comes up — that is the win, and the sky itself counts it down.
   *
   * An unwinnable game turned out to be the reason skill did not matter: with
   * no finish line, every level of play drowned at the same wall and the run
   * was really just a timer.
   */
  nightSeconds: 240,

  /**
   * Not every light that falls has gone out. One in this many is still
   * burning, and what kind of light it was decides what catching it does.
   * They are a rare variant of the husk already falling, not a new system:
   * one extra field, and the spark that catches them is the ordinary spark.
   */
  boonChance: 0.075,
  /** Every boon gives this much light on top of whatever else it does. */
  boonGain: 0.07,

  /** ember — the wand runs hot. */
  surgeSeconds: 5,
  surgeFireScale: 0.42,
  /** hush — the sky falls slowly. */
  hushSeconds: 6,
  hushScale: 0.42,
  /** ward — a glass round the lantern; nothing drains it. */
  wardSeconds: 8,

  /**
   * The economy. A relight nets a little more than the spark that bought it,
   * so good play pays — but the lantern burns down on its own and the sky
   * empties faster than one wand can answer, so it only ever buys time.
   */
  shotCost: 0.005,
  relightGain: 0.009,
  /**
   * Light spent per husk in a cluster lifted out of the pile. A chain pays no
   * light at all — its reward is the drain it removes and the lane it reopens,
   * and it is charged for every husk it wakes.
   *
   * Anything cheaper makes failure profitable: one spark used to clear a
   * cluster of any size, so the worse the pile got, the bigger the rescue, and
   * a careless player outlived a careful one. Now a mess costs what it weighs.
   * A cluster large enough can take the last of the lantern with it.
   */
  chainCostPerHusk: 0.01,
  /** The lantern burning down, with nothing else happening. */
  burnPerSecond: 0.012,
  /** Light drained each second, per husk sitting in the pile. */
  drainPerHusk: 0.0016,

  fireDelay: 0.14,
  /** One column per this many seconds — the same ceiling for keys and touch. */
  moveDelay: 0.11,

  /** Rows per second. */
  sparkSpeed: 30,
  riseSpeed: 11,

  /**
   * Difficulty runs on elapsed time, not on how many husks have spawned.
   * Ramping per spawn compounds: faster spawns ramp faster still, and the
   * curve runs away within a minute.
   */
  huskSpeedStart: 2.4,
  huskSpeedMax: 6,
  huskSpeedRampSeconds: 90,
  spawnIntervalStart: 0.9,
  /** Past the wand's own 1/fireDelay ceiling, so the end is not optional. */
  spawnIntervalMin: 0.07,
  spawnDecaySeconds: 95,
} as const;

/** Seconds between husks, falling away as the sky empties faster. */
export const spawnIntervalAt = (elapsed: number): number =>
  Math.max(RULES.spawnIntervalMin, RULES.spawnIntervalStart * Math.exp(-elapsed / RULES.spawnDecaySeconds));

/** Rows per second a husk falls, rising with elapsed time. */
export const huskSpeedAt = (elapsed: number): number =>
  Math.min(RULES.huskSpeedMax, RULES.huskSpeedStart * (1 + elapsed / RULES.huskSpeedRampSeconds));

/** A dead light falling out of the sky. */
/**
 * A light that never went out, and what kind it was.
 *
 * - `ember`  the wand runs hot, firing far faster
 * - `beacon` one free spark up every column at once
 * - `hush`   the whole sky falls slowly for a while
 * - `bloom`  the entire pile lights and lifts off, free
 * - `ward`   a glass round the lantern: nothing drains it
 */
export type Boon = 'ember' | 'beacon' | 'hush' | 'bloom' | 'ward';

export const BOONS: readonly Boon[] = ['ember', 'beacon', 'hush', 'bloom', 'ward'];

export interface Husk {
  readonly id: number;
  readonly column: number;
  readonly speed: number;
  /** Still burning, and what it does when caught. Null is an ordinary husk. */
  readonly boon: Boon | null;
  y: number;
}

/** A spark leaving the wand, carrying light up the column. */
export interface Spark {
  readonly id: number;
  readonly column: number;
  y: number;
}

/** A relit light on its way back to the sky. */
export interface Rising {
  readonly id: number;
  readonly column: number;
  y: number;
}

export type GameEvent =
  | { readonly kind: 'shot'; readonly column: number }
  | { readonly kind: 'relit'; readonly column: number; readonly row: number }
  | { readonly kind: 'boon'; readonly boon: Boon; readonly column: number; readonly row: number }
  | { readonly kind: 'dawn' }
  | { readonly kind: 'chain'; readonly column: number; readonly row: number; readonly size: number }
  | { readonly kind: 'landed'; readonly column: number; readonly row: number }
  | { readonly kind: 'ended' };

/**
 * `intro` waits on the scroll before the night starts; it is also what gives
 * the browser the gesture it needs before any audio can be built.
 */
export type Phase = 'intro' | 'playing' | 'paused' | 'ended' | 'dawn';

export interface GameState {
  phase: Phase;
  /** 0 is dark, 1 is a full lantern. */
  light: number;
  elapsed: number;
  /** Lights sent back to the sky. The only score there is. */
  saved: number;
  wizardColumn: number;
  /** Where the wizard is walking to. He never teleports. */
  targetColumn: number;
  moveCooldown: number;
  /** columns * rows, row 0 at the top. True where a cold husk sits. */
  readonly pile: boolean[];
  readonly husks: Husk[];
  readonly sparks: Spark[];
  readonly risings: Rising[];
  /** Emitted by the last step, for the renderer and the audio to react to. */
  readonly events: GameEvent[];
  /** Set by input, consumed by the next step. */
  fireRequested: boolean;
  fireCooldown: number;
  /** Seconds left on each boon that runs on a timer. */
  surge: number;
  hush: number;
  ward: number;
  spawnTimer: number;
  nextId: number;
  readonly random: () => number;
}

const cellIndex = (column: number, row: number): number => row * RULES.columns + column;

const inBounds = (column: number, row: number): boolean =>
  column >= 0 && column < RULES.columns && row >= 0 && row < RULES.rows;

/** Occupied? Anything outside the grid counts as empty. */
export const cellAt = (pile: readonly boolean[], column: number, row: number): boolean =>
  inBounds(column, row) && pile[cellIndex(column, row)] === true;

/** Topmost occupied row in a column, or RULES.rows when the column is clear. */
export const surfaceRow = (pile: readonly boolean[], column: number): number => {
  for (let row = 0; row < RULES.rows; row += 1) {
    if (cellAt(pile, column, row)) return row;
  }
  return RULES.rows;
};

export const pileCount = (pile: readonly boolean[]): number =>
  pile.reduce((total, occupied) => (occupied ? total + 1 : total), 0);

export function createGame(random: () => number = Math.random): GameState {
  return {
    phase: 'intro',
    light: RULES.lightStart,
    elapsed: 0,
    saved: 0,
    wizardColumn: Math.floor(RULES.columns / 2),
    targetColumn: Math.floor(RULES.columns / 2),
    moveCooldown: 0,
    pile: new Array<boolean>(RULES.columns * RULES.rows).fill(false),
    husks: [],
    sparks: [],
    risings: [],
    events: [],
    fireRequested: false,
    fireCooldown: 0,
    surge: 0,
    hush: 0,
    ward: 0,
    spawnTimer: RULES.spawnIntervalStart,
    nextId: 1,
    random,
  };
}

/** Leave the scroll and start the night. */
export function begin(state: GameState): void {
  if (state.phase !== 'intro') return;
  state.phase = 'playing';
}

/** Stop the clock. A real phase, so the scroll and the audio agree with it. */
export function pause(state: GameState): void {
  if (state.phase !== 'playing') return;
  state.phase = 'paused';
  state.fireRequested = false;
}

export function resumePlay(state: GameState): void {
  if (state.phase !== 'paused') return;
  state.phase = 'playing';
}

const clampColumn = (column: number): number => Math.min(RULES.columns - 1, Math.max(0, Math.round(column)));

export function moveWizard(state: GameState, delta: number): void {
  if (state.phase !== 'playing') return;
  state.targetColumn = clampColumn(state.wizardColumn + delta);
}

export function aimWizard(state: GameState, column: number): void {
  if (state.phase !== 'playing') return;
  state.targetColumn = clampColumn(column);
}

/** Walk one column at a time, so touch cannot outrun the keyboard. */
function advanceWizard(state: GameState, dt: number): void {
  state.moveCooldown = Math.max(0, state.moveCooldown - dt);
  if (state.moveCooldown > 0 || state.wizardColumn === state.targetColumn) return;
  state.wizardColumn += Math.sign(state.targetColumn - state.wizardColumn);
  state.moveCooldown = RULES.moveDelay;
}

/**
 * Ask for a spark. The step performs it, so every event a step emits is still
 * there when the renderer reads them; firing straight into state would have
 * them cleared by the step that followed.
 */
export function requestFire(state: GameState): void {
  if (state.phase !== 'playing') return;
  state.fireRequested = true;
}

/** Spend a piece of the lantern to send a spark up the wizard's column. */
function releaseSpark(state: GameState): void {
  if (state.fireCooldown > 0) return;
  if (state.light <= RULES.shotCost) return;

  state.light -= RULES.shotCost;
  state.fireCooldown = RULES.fireDelay * (state.surge > 0 ? RULES.surgeFireScale : 1);
  state.sparks.push({ id: state.nextId, column: state.wizardColumn, y: RULES.wizardRow - 0.5 });
  state.nextId += 1;
  state.events.push({ kind: 'shot', column: state.wizardColumn });
}

export function step(state: GameState, dt: number): void {
  state.events.length = 0;
  if (state.phase !== 'playing') {
    state.fireRequested = false;
    return;
  }

  state.elapsed += dt;
  state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  state.surge = Math.max(0, state.surge - dt);
  state.hush = Math.max(0, state.hush - dt);
  state.ward = Math.max(0, state.ward - dt);
  advanceWizard(state, dt);

  if (state.fireRequested) {
    state.fireRequested = false;
    releaseSpark(state);
  }

  advanceSparks(state, dt);
  advanceHusks(state, dt);
  advanceRisings(state, dt);

  if (state.ward <= 0) {
    state.light -= (RULES.burnPerSecond + RULES.drainPerHusk * pileCount(state.pile)) * dt;
  }
  spawnHusks(state, dt);

  // Sunrise beats the dark: reaching it on the same step is a win, not a loss.
  if (state.elapsed >= RULES.nightSeconds) {
    state.phase = 'dawn';
    state.events.push({ kind: 'dawn' });
    return;
  }
  checkEnd(state);
}

/**
 * Sparks travel up and hit the first thing in their column. A pile shields the
 * sky above it, so a column left to grow stops answering the wand.
 */
function advanceSparks(state: GameState, dt: number): void {
  for (let i = state.sparks.length - 1; i >= 0; i -= 1) {
    const spark = state.sparks[i];
    if (spark === undefined) continue;

    const from = spark.y;
    const to = from - RULES.sparkSpeed * dt;
    spark.y = to;

    const surface = surfaceRow(state.pile, spark.column);
    if (to <= surface && surface < RULES.rows) {
      state.sparks.splice(i, 1);
      chain(state, spark.column, surface);
      continue;
    }

    const hit = lowestHuskBetween(state, spark.column, to, from);
    if (hit !== undefined) {
      state.sparks.splice(i, 1);
      relight(state, hit);
      continue;
    }

    if (to < 0) state.sparks.splice(i, 1);
  }
}

/** The husk nearest the wand within the span a spark crossed this step. */
function lowestHuskBetween(state: GameState, column: number, low: number, high: number): Husk | undefined {
  let found: Husk | undefined;
  for (const husk of state.husks) {
    if (husk.column !== column) continue;
    if (husk.y < low - 0.5 || husk.y > high + 0.5) continue;
    if (found === undefined || husk.y > found.y) found = husk;
  }
  return found;
}

function relight(state: GameState, husk: Husk): void {
  const at = state.husks.indexOf(husk);
  if (at >= 0) state.husks.splice(at, 1);

  state.risings.push({ id: state.nextId, column: husk.column, y: husk.y });
  state.nextId += 1;

  const gain = husk.boon === null ? RULES.relightGain : RULES.boonGain;
  state.light = Math.min(RULES.lightMax, state.light + gain);
  state.events.push({ kind: 'relit', column: husk.column, row: Math.round(husk.y) });

  if (husk.boon === null) return;
  applyBoon(state, husk.boon);
  state.events.push({ kind: 'boon', boon: husk.boon, column: husk.column, row: Math.round(husk.y) });
}

/**
 * Relighting one husk in the pile spreads to everything touching it. The whole
 * cluster lifts off together and the pile collapses into the gap.
 */
function applyBoon(state: GameState, boon: Boon): void {
  switch (boon) {
    case 'ember':
      state.surge = RULES.surgeSeconds;
      return;
    case 'hush':
      state.hush = RULES.hushSeconds;
      return;
    case 'ward':
      state.ward = RULES.wardSeconds;
      return;
    case 'beacon':
      // A free spark up every column at once, paid for by the light itself.
      for (let column = 0; column < RULES.columns; column += 1) {
        state.sparks.push({ id: state.nextId, column, y: RULES.wizardRow - 0.5 });
        state.nextId += 1;
      }
      return;
    case 'bloom':
      // The whole pile wakes and goes home. The only free way out of a mess.
      liftWholePile(state);
      return;
    default:
      return;
  }
}

function liftWholePile(state: GameState): void {
  for (let row = 0; row < RULES.rows; row += 1) {
    for (let column = 0; column < RULES.columns; column += 1) {
      if (!cellAt(state.pile, column, row)) continue;
      state.pile[cellIndex(column, row)] = false;
      state.risings.push({ id: state.nextId, column, y: row });
      state.nextId += 1;
    }
  }
}

function chain(state: GameState, column: number, row: number): void {
  if (!cellAt(state.pile, column, row)) return;

  const cluster: Array<readonly [number, number]> = [];
  const queue: Array<readonly [number, number]> = [[column, row]];
  const seen = new Set<number>([cellIndex(column, row)]);

  while (queue.length > 0) {
    const cell = queue.pop();
    if (cell === undefined) break;
    const [c, r] = cell;
    cluster.push(cell);

    for (const [nc, nr] of [
      [c - 1, r],
      [c + 1, r],
      [c, r - 1],
      [c, r + 1],
    ] as const) {
      const key = cellIndex(nc, nr);
      if (seen.has(key) || !cellAt(state.pile, nc, nr)) continue;
      seen.add(key);
      queue.push([nc, nr]);
    }
  }

  for (const [c, r] of cluster) {
    state.pile[cellIndex(c, r)] = false;
    state.risings.push({ id: state.nextId, column: c, y: r });
    state.nextId += 1;
  }

  settle(state);
  state.light -= RULES.chainCostPerHusk * cluster.length;
  state.events.push({ kind: 'chain', column, row, size: cluster.length });
}

/** Every column keeps its husks packed against the floor. */
function settle(state: GameState): void {
  for (let column = 0; column < RULES.columns; column += 1) {
    let write = RULES.rows - 1;
    for (let row = RULES.rows - 1; row >= 0; row -= 1) {
      if (!cellAt(state.pile, column, row)) continue;
      state.pile[cellIndex(column, row)] = false;
      state.pile[cellIndex(column, write)] = true;
      write -= 1;
    }
  }
}

function advanceHusks(state: GameState, dt: number): void {
  for (let i = state.husks.length - 1; i >= 0; i -= 1) {
    const husk = state.husks[i];
    if (husk === undefined) continue;

    husk.y += husk.speed * (state.hush > 0 ? RULES.hushScale : 1) * dt;
    const resting = surfaceRow(state.pile, husk.column) - 1;
    if (husk.y < resting) continue;

    state.husks.splice(i, 1);
    if (resting < 0) continue;
    state.pile[cellIndex(husk.column, resting)] = true;
    state.events.push({ kind: 'landed', column: husk.column, row: resting });
  }
}

function advanceRisings(state: GameState, dt: number): void {
  for (let i = state.risings.length - 1; i >= 0; i -= 1) {
    const rising = state.risings[i];
    if (rising === undefined) continue;

    rising.y -= RULES.riseSpeed * dt;
    if (rising.y > -1) continue;

    state.risings.splice(i, 1);
    state.saved += 1;
  }
}

const pickBoon = (roll: number): Boon => BOONS[Math.min(BOONS.length - 1, Math.floor(roll * BOONS.length))] ?? 'ember';

function spawnHusks(state: GameState, dt: number): void {
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;

  state.spawnTimer += spawnIntervalAt(state.elapsed);
  state.husks.push({
    id: state.nextId,
    column: Math.floor(state.random() * RULES.columns),
    speed: huskSpeedAt(state.elapsed),
    boon: state.random() < RULES.boonChance ? pickBoon(state.random()) : null,
    y: -1,
  });
  state.nextId += 1;
}

/** 0 at dusk, 1 at sunrise. The sky draws itself from this. */
export const nightProgress = (state: GameState): number => Math.min(1, state.elapsed / RULES.nightSeconds);

function checkEnd(state: GameState): void {
  const buried = Array.from({ length: RULES.columns }, (_unused, column) => surfaceRow(state.pile, column)).some(
    (row) => row <= RULES.buriedRow,
  );

  if (state.light > 0 && !buried) return;

  state.light = 0;
  state.phase = 'ended';
  state.events.push({ kind: 'ended' });
}
