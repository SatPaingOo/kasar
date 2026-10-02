/**
 * Everything you hear, made at runtime.
 *
 * No audio file, same as everything else here: oscillators, one noise buffer,
 * and envelopes. A limiter sits on the output because a stone landing on the
 * same frame as a shatter and a step will otherwise clip, and clipping is the
 * one artefact that makes a small synthesised mix sound broken rather than
 * quiet.
 *
 * The context is not built until the player has touched something — browsers
 * refuse to start audio before a gesture, and a refused context stays dead for
 * the rest of the page.
 */

import type { Event } from './game.js';

/**
 * What can be heard: everything the rules report, plus the two things the
 * player does that the rules do not record.
 *
 * Moving and turning a stone are deliberately not game events. `step` clears
 * the event list at the top of every frame, so anything pushed outside a step
 * would be thrown away before the renderer or this ever saw it — the same trap
 * that once ate the shot in Tazaung.
 */
export type Cue = Event | { readonly kind: 'move' } | { readonly kind: 'turn' };

/**
 * Peak gain per voice, before the limiter.
 *
 * Measured rather than guessed: each cue is rendered on its own through an
 * OfflineAudioContext and its peak read off the buffer. The short ones reach
 * only about a third of the number set here — the envelope is over before the
 * waveform has made up its mind — so the first set of levels, chosen by eye,
 * put the step and the move cues at 0.016 and 0.029, which is silence on a
 * laptop speaker. Nothing here should sit under about 0.05 rendered.
 */
const LEVEL = {
  move: 0.34,
  turn: 0.46,
  land: 0.68,
  step: 0.2,
  climb: 0.4,
  blocked: 0.24,
  knocked: 0.42,
  shatter: 0.85,
  fell: 0.45,
  drowned: 0.6,
  crushed: 0.75,
  buried: 0.7,
  out: 0.5,
  ambience: 0.3,
} as const;

export interface Sound {
  /** Called from a real gesture; safe to call again. */
  unlock(): void;
  play(cue: Cue): void;
  /** How high the water is, 0 to 1, driving the bed under everything. */
  ambience(level: number): void;
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

    // A limiter, not a compressor doing taste: a high ratio, a low knee and a
    // quick release, purely so simultaneous voices cannot sum past 1.
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

    // The water, always there once it starts, rising in pitch as it fills the
    // shaft. It is the only sound in the game that never stops.
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 320;
    filter.Q.value = 0.7;
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

  /** A tone with an envelope, which is most of what is here. */
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

  /** A burst of noise through a sweeping filter: stone on stone. */
  function crack(peak: number, from: number, to: number, length: number, type: BiquadFilterType): void {
    if (ctx === null || master === null || noise === null || muted) return;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), now + length);
    filter.Q.value = 1.1;

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
      case 'land': {
        // Bigger stones land lower, which is the whole of the weight model.
        const pitch = 150 - event.cells * 14;
        tone('sine', pitch, pitch * 0.55, LEVEL.land, 0.004, 0.012, 0.16);
        crack(LEVEL.land * 0.42, 2200, 420, 0.1, 'bandpass');
        break;
      }
      case 'shatter':
        crack(LEVEL.shatter, 4800, 300, 0.34, 'bandpass');
        tone('triangle', 240, 70, LEVEL.shatter * 0.5, 0.004, 0.02, 0.3);
        break;
      case 'step':
        // A pace is almost nothing; taking a step up is the sound that
        // matters, because it is the only progress in the game.
        if (event.climbed) tone('triangle', 520, 700, LEVEL.climb, 0.004, 0.006, 0.09);
        else tone('sine', 420, 360, LEVEL.step, 0.003, 0.004, 0.05);
        break;
      case 'blocked':
        tone('sine', 150, 120, LEVEL.blocked, 0.004, 0.006, 0.07);
        break;
      case 'knocked':
        tone('square', 220, 130, LEVEL.knocked, 0.004, 0.01, 0.12);
        break;
      case 'fell':
        tone('sawtooth', 300, 90, LEVEL.fell, 0.005, 0.01, 0.2 + event.rows * 0.03);
        break;
      case 'move':
        tone('square', 900, 900, LEVEL.move, 0.002, 0.004, 0.03);
        break;
      case 'turn':
        tone('square', 640, 980, LEVEL.turn, 0.002, 0.004, 0.05);
        break;
      case 'drowned':
        tone('sine', 220, 50, LEVEL.drowned, 0.02, 0.1, 1.2);
        crack(LEVEL.drowned * 0.5, 700, 90, 1.1, 'lowpass');
        break;
      case 'crushed':
        tone('square', 120, 40, LEVEL.crushed, 0.003, 0.05, 0.6);
        crack(LEVEL.crushed * 0.6, 1600, 120, 0.4, 'bandpass');
        break;
      case 'buried':
        tone('sawtooth', 90, 34, LEVEL.buried, 0.02, 0.2, 1.1);
        break;
      case 'out': {
        // The only sound in the game that goes up and stays up.
        const climb = [523, 659, 784, 1047];
        climb.forEach((hz, i) => {
          window.setTimeout(() => tone('triangle', hz, hz, LEVEL.out, 0.01, 0.07, 0.3), i * 110);
        });
        break;
      }
    }
  }

  return {
    unlock(): void {
      build();
      if (ctx !== null && ctx.state === 'suspended') void ctx.resume();
    },
    play,
    ambience(level: number): void {
      if (ctx === null || bed === null || bedFilter === null) return;
      const target = muted ? 0 : Math.max(0, Math.min(1, level)) * LEVEL.ambience;
      bed.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
      bedFilter.frequency.setTargetAtTime(240 + level * 520, ctx.currentTime, 0.6);
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
