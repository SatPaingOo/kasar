/**
 * Everything you hear, made at runtime.
 *
 * No audio file, same as everything else here: oscillators, one noise buffer
 * and envelopes, with a limiter on the output so that a catch landing on the
 * same frame as a whoosh cannot clip.
 *
 * The bed under all of it is wind, and it is driven by how fast he is going
 * rather than by the clock. That is the one sound doing real work: on a rope
 * you cannot see your own speed, and speed is the whole thing you are
 * managing, so the wind is the instrument that tells you.
 *
 * The context is not built until the player has touched something — browsers
 * refuse to start audio before a gesture, and a refused context stays dead.
 */

import type { Event } from './game.js';

/**
 * What can be heard: everything the rules report, plus the two the rules do
 * not record, because `step` clears its event list at the top of every frame
 * and anything pushed outside a step would be thrown away before this saw it.
 */
export type Cue = Event | { readonly kind: 'tick' };

/**
 * Peak gain per voice, before the limiter.
 *
 * Measured, not guessed: each cue renders on its own through an
 * OfflineAudioContext and its peak comes off the buffer. The short ones reach
 * only about a third of the number set here, because the envelope is over
 * before the waveform has made up its mind — which is how the first pass at
 * this in Hlaykar ended up with cues at 0.016, i.e. silence. Nothing here
 * should sit under about 0.05 rendered.
 */
const LEVEL = {
  grab: 0.62,
  /**
   * Much larger than the rest because it is a band of noise, and a band of
   * noise through a filter keeps almost none of the gain it was given: at 0.5
   * a slow release rendered at 0.035 and a fast one at 0.054, which is
   * nothing. It is also the cue that matters most — letting go is the whole
   * game — so it is the one that has to be heard over the wind.
   */
  release: 1.4,
  miss: 0.34,
  fallen: 0.78,
  across: 0.5,
  wind: 0.34,
} as const;

/** Speed at which the wind is at full, in world units per second. */
const FULL_TILT = 22;

export interface Sound {
  /** Called from a real gesture; safe to call again. */
  unlock(): void;
  play(cue: Cue): void;
  /** How fast he is going, which is the only thing the wind listens to. */
  wind(speed: number): void;
  toggle(): boolean;
  readonly muted: boolean;
}

export function createSound(): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let bed: GainNode | null = null;
  let bedFilter: BiquadFilterNode | null = null;
  let noise: AudioBuffer | null = null;
  let muted = false;

  function build(): void {
    if (ctx !== null) return;
    let context: AudioContext;
    try {
      context = new AudioContext();
    } catch {
      // No audio here. The game is perfectly playable without it.
      return;
    }

    // A limiter, not a compressor doing taste: a high ratio and a low knee,
    // purely so simultaneous voices cannot sum past one.
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    limiter.connect(context.destination);

    const out = context.createGain();
    out.gain.value = 1;
    out.connect(limiter);

    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.6;
    const level = context.createGain();
    level.gain.value = 0;
    source.connect(filter).connect(level).connect(out);
    source.start();

    ctx = context;
    master = out;
    bed = level;
    bedFilter = filter;
    noise = buffer;
  }

  function tone(
    type: OscillatorType,
    from: number,
    to: number,
    peak: number,
    attack: number,
    hold: number,
    decay: number,
  ): void {
    if (ctx === null || master === null || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + attack + hold + decay);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + attack);
    gain.gain.setValueAtTime(Math.max(0.0001, peak), now + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + hold + decay);

    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + attack + hold + decay + 0.02);
  }

  /** A burst of noise through a sweeping filter: rope, air, impact. */
  function rush(peak: number, from: number, to: number, length: number, type: BiquadFilterType): void {
    if (ctx === null || master === null || noise === null || muted) return;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), now + length);
    filter.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, peak), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);

    source.connect(filter).connect(gain).connect(master);
    source.start(now);
    source.stop(now + length + 0.02);
  }

  function play(event: Cue): void {
    if (ctx === null || muted) return;
    switch (event.kind) {
      case 'grab': {
        // A short rope is a tighter, higher catch than a long one, which is
        // the only free way to hear how much swing you have just bought.
        const pitch = 520 - event.length * 26;
        rush(LEVEL.grab * 0.5, 2600, 700, 0.07, 'bandpass');
        tone('triangle', pitch, pitch * 0.7, LEVEL.grab, 0.003, 0.012, 0.13);
        break;
      }
      case 'release':
        // Faster off the rope is a longer, brighter rush of air.
        rush(LEVEL.release * Math.min(1, 0.4 + event.speed / 26), 900, 2600, 0.22, 'bandpass');
        break;
      case 'miss':
        // A throw that caught nothing: flat, short, and unmistakably a waste.
        tone('square', 190, 120, LEVEL.miss, 0.003, 0.008, 0.07);
        break;
      case 'fallen':
        tone('sine', 150, 38, LEVEL.fallen, 0.004, 0.04, 0.5);
        rush(LEVEL.fallen * 0.7, 1500, 110, 0.45, 'lowpass');
        break;
      case 'across': {
        // The only sound in the game that goes up and stays up.
        const climb = [523, 659, 784, 1047];
        climb.forEach((hz, i) => {
          window.setTimeout(() => tone('triangle', hz, hz, LEVEL.across, 0.01, 0.08, 0.32), i * 120);
        });
        break;
      }
      case 'tick':
        break;
    }
  }

  return {
    unlock(): void {
      build();
      if (ctx !== null && ctx.state === 'suspended') void ctx.resume();
    },
    play,
    wind(speed: number): void {
      if (ctx === null || bed === null || bedFilter === null) return;
      const tilt = Math.max(0, Math.min(1, speed / FULL_TILT));
      const target = muted ? 0 : tilt * tilt * LEVEL.wind;
      bed.gain.setTargetAtTime(target, ctx.currentTime, 0.12);
      bedFilter.frequency.setTargetAtTime(380 + tilt * 900, ctx.currentTime, 0.18);
    },
    toggle(): boolean {
      muted = !muted;
      if (muted && bed !== null && ctx !== null) bed.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      return muted;
    },
    get muted(): boolean {
      return muted;
    },
  };
}
