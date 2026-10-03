/**
 * Everything you hear, made at runtime.
 *
 * No audio file, same as everything else here. A pat waing drum is a struck
 * head with a dab of tuning paste in the middle, and the paste is what gives
 * it a pitch: a fundamental that drops a shade as the head settles, two
 * harmonics over it, a little of the head's own inharmonic ring, and the slap
 * of a palm. The bell (si) and the clapper (wa) keep the time, as they do in a
 * saing ensemble.
 *
 * This is the one game here where sound is the game rather than dressing on
 * it, so two things are done that the others do not need:
 *
 * - The call is scheduled on the audio clock ahead of time, not played when a
 *   frame happens to come round. A frame is sixteen milliseconds of jitter,
 *   and a rhythm played sixteen milliseconds unevenly is a rhythm played
 *   badly — which the player would then be marked down for copying.
 * - The output's own latency is taken off, so the call is heard at the moment
 *   it is drawn and the moment it is judged against.
 *
 * The context is not built until the player has touched something — browsers
 * refuse to start audio before a gesture, and a refused context stays dead.
 */

import type { Cue } from './game.js';

/**
 * Each drum's pitch, low to high: G A B D E over an octave and a half. A
 * five-note scale has no two notes that clash, so every phrase the game makes
 * up is a tune — and low enough to sound like drums, high enough that a
 * phone's speaker still has something to play.
 */
export const PITCH = [196, 220, 246.9, 293.7, 329.6, 392, 440, 493.9] as const;

/**
 * Peak gain per voice, before the limiter.
 *
 * Measured, not chosen by ear: each voice renders on its own through an
 * OfflineAudioContext and its peak comes off the buffer — see the README. The
 * drum is the loud one because it is the thing being listened for; the bell
 * and the clapper sit well under it, because a pulse that competes with the
 * phrase is a pulse that hides it.
 */
const LEVEL = {
  drum: 0.37,
  si: 0.078,
  wa: 0.8,
  stumble: 0.44,
  chime: 0.143,
} as const;

/** The instruments, on any context: a live one to play, an offline one to measure. */
export interface Voices {
  drum(drum: number, when: number, level?: number): void;
  si(when: number): void;
  wa(when: number): void;
  /** The music falling over: a dull thud under a damped drum. */
  stumble(when: number): void;
  /** A small gong, for a phrase played back right. */
  chime(when: number): void;
}

export function createVoices(ctx: BaseAudioContext, out: AudioNode): Voices {
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.5), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Not Math.random: the same noise every time keeps measured levels honest.
  let seed = 7;
  for (let i = 0; i < data.length; i += 1) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }

  /** A sine (or other) partial with a sharp attack and an exponential fall. */
  function partial(
    when: number,
    from: number,
    to: number,
    glide: number,
    peak: number,
    decay: number,
    type: OscillatorType = 'sine',
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, when);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, when + glide);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + decay + 0.02);
  }

  /** A burst of noise through a filter: a palm, a clapper, a thud. */
  function burst(when: number, centre: number, q: number, peak: number, length: number, type: BiquadFilterType): void {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = centre;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, peak), when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(filter).connect(gain).connect(out);
    source.start(when);
    source.stop(when + length + 0.02);
  }

  return {
    drum(drum: number, when: number, level = 1): void {
      const f = PITCH[Math.max(0, Math.min(PITCH.length - 1, drum))] ?? PITCH[0];
      const peak = LEVEL.drum * level;
      // The low drums are bigger and ring longer.
      const ring = 0.62 - drum * 0.035;
      partial(when, f * 1.16, f, 0.05, peak, ring);
      partial(when, f * 2.3, f * 2, 0.04, peak * 0.42, ring * 0.6);
      partial(when, f * 3, f * 3, 0, peak * 0.18, ring * 0.38);
      partial(when, f * 1.59, f * 1.59, 0, peak * 0.14, 0.16);
      burst(when, 1900, 0.8, peak * 0.5, 0.035, 'bandpass');
    },
    si(when: number): void {
      // A small cup bell: bright, inharmonic, and gone before the next beat.
      partial(when, 2350, 2350, 0, LEVEL.si, 0.42);
      partial(when, 3720, 3720, 0, LEVEL.si * 0.5, 0.26);
      partial(when, 5870, 5870, 0, LEVEL.si * 0.3, 0.16);
    },
    wa(when: number): void {
      // Two pieces of bamboo: a crack and almost no ring.
      burst(when, 1250, 2.2, LEVEL.wa, 0.05, 'bandpass');
      partial(when, 760, 640, 0.03, LEVEL.wa * 0.22, 0.05, 'triangle');
    },
    stumble(when: number): void {
      partial(when, 96, 44, 0.3, LEVEL.stumble, 0.34);
      burst(when, 420, 0.7, LEVEL.stumble * 0.6, 0.22, 'lowpass');
      // The wrong note, damped under a palm.
      partial(when + 0.02, 233, 207, 0.06, LEVEL.stumble * 0.35, 0.12, 'triangle');
    },
    chime(when: number): void {
      // Two close partials beat against each other, which is most of what makes
      // a gong sound like a gong.
      partial(when, 784, 784, 0, LEVEL.chime, 1.1);
      partial(when, 789, 789, 0, LEVEL.chime * 0.6, 0.9);
      partial(when, 1568, 1568, 0, LEVEL.chime * 0.25, 0.5);
    },
  };
}

export interface Sound {
  /** Called from a real gesture; safe to call again. */
  unlock(): void;
  /**
   * Keep the ear's clock lined up with the game's. Called every frame with
   * the game's time in seconds.
   */
  sync(now: number): void;
  /** How far ahead the game should hand over cues, in seconds. */
  readonly ahead: number;
  /** A cue at a time on the game's clock. */
  cue(cue: Cue): void;
  /** Struck by the player, now. */
  strike(drum: number): void;
  stumble(): void;
  chime(): void;
  /** The piece is through: a run up every drum and the gong. */
  flourish(drums: number): void;
  toggle(): boolean;
  readonly muted: boolean;
  /** The context exists and is running, so a cue handed over now will be heard. */
  readonly ready: boolean;
}

export function createSound(): Sound {
  let ctx: AudioContext | null = null;
  let voices: Voices | null = null;
  let muted = false;
  /** Audio-clock time minus game time, smoothed. */
  let offset: number | null = null;
  /** How late the output plays what it is given, in seconds. */
  let latency = 0;

  function build(): void {
    if (ctx !== null) return;
    let context: AudioContext;
    try {
      context = new AudioContext({ latencyHint: 'interactive' });
    } catch {
      // No audio here. The circle still lights up, and the game is playable
      // by eye.
      return;
    }
    // A limiter, not a compressor doing taste: a high ratio and a low knee,
    // purely so that a phrase landing on a bell and a gong cannot clip.
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    limiter.connect(context.destination);

    ctx = context;
    voices = createVoices(context, limiter);
  }

  /** The audio-clock time a game time is heard at, or now if it has passed. */
  function when(at: number): number {
    if (ctx === null) return 0;
    const target = at + (offset ?? ctx.currentTime - at) - latency;
    return Math.max(ctx.currentTime, target);
  }

  return {
    unlock(): void {
      build();
      if (ctx !== null && ctx.state === 'suspended') void ctx.resume();
    },
    sync(now: number): void {
      if (ctx === null || ctx.state !== 'running') {
        offset = null;
        return;
      }
      const raw = ctx.currentTime - now;
      // The audio clock moves in steps of a render quantum and the frame
      // clock in steps of a frame; smoothing the gap between them keeps the
      // schedule even, and a jump — after a suspend — is taken at once.
      offset = offset === null || Math.abs(raw - offset) > 0.05 ? raw : offset + (raw - offset) * 0.05;
      const reported = ctx.outputLatency;
      const output = typeof reported === 'number' && Number.isFinite(reported) ? reported : ctx.baseLatency;
      latency = Math.max(0, Math.min(0.3, Number.isFinite(output) ? output : 0));
    },
    get ahead(): number {
      return 0.12 + latency;
    },
    cue(cue: Cue): void {
      if (voices === null || muted) return;
      const t = when(cue.at);
      if (cue.kind === 'drum') voices.drum(cue.drum, t);
      else if (cue.kind === 'si') voices.si(t);
      else voices.wa(t);
    },
    strike(drum: number): void {
      if (ctx === null || voices === null || muted) return;
      voices.drum(drum, ctx.currentTime);
    },
    stumble(): void {
      if (ctx === null || voices === null || muted) return;
      voices.stumble(ctx.currentTime);
    },
    chime(): void {
      if (ctx === null || voices === null || muted) return;
      voices.chime(ctx.currentTime + 0.02);
    },
    flourish(drums: number): void {
      if (ctx === null || voices === null || muted) return;
      const start = ctx.currentTime + 0.25;
      for (let i = 0; i < drums; i += 1) voices.drum(i, start + i * 0.075, 0.8);
      voices.drum(drums - 1, start + drums * 0.075 + 0.15, 1);
      voices.chime(start + drums * 0.075 + 0.15);
      voices.drum(0, start + drums * 0.075 + 0.15, 0.9);
    },
    toggle(): boolean {
      muted = !muted;
      return muted;
    },
    get muted(): boolean {
      return muted;
    },
    get ready(): boolean {
      return ctx !== null && ctx.state === 'running';
    },
  };
}
