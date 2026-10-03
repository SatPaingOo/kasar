/**
 * Everything you hear, made at runtime.
 *
 * No audio file, same as the rest of the shelf. A limiter on the output so
 * that four blows resolving in a row cannot clip.
 *
 * There is no bed here and there should not be. The other three games have
 * something running underneath because something is always happening in them;
 * this one is silent while you think, which is most of the time, and the
 * silence is what makes a blow land.
 */

import type { Lang } from './strings.js';

export type Cue = 'hit' | 'miss' | 'broke' | 'shatter' | 'cleared' | 'won' | 'lost' | 'hint';

/**
 * Peak gain per voice, before the limiter.
 *
 * Measured rather than guessed, the same way as the other three: each cue
 * renders alone through an OfflineAudioContext and its peak comes off the
 * buffer. Short cues reach about a third of the number set here, so these look
 * larger than they sound.
 */
const LEVEL: Readonly<Record<Cue, number>> = {
  hit: 0.72,
  miss: 0.8,
  // Quieter than being hit. A sawtooth sustains, so this rendered at 0.68
  // against a hit's 0.33 — code that threw was the loudest thing in the game,
  // which is the wrong thing to shout about.
  broke: 0.26,
  shatter: 0.6,
  cleared: 0.55,
  won: 0.55,
  lost: 0.75,
  hint: 0.34,
};

export interface Sound {
  unlock(): void;
  play(cue: Cue): void;
  toggle(): boolean;
  readonly muted: boolean;
}

export function createSound(): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let muted = false;

  function build(): void {
    if (ctx !== null) return;
    let context: AudioContext;
    try {
      context = new AudioContext();
    } catch {
      return;
    }

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

    ctx = context;
    master = out;
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
    delay = 0,
  ): void {
    if (ctx === null || master === null || muted) return;
    const now = ctx.currentTime + delay;
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

  function play(cue: Cue): void {
    if (ctx === null || muted) return;
    switch (cue) {
      case 'hit':
        // Solid and over: a connect, not a crunch.
        tone('sine', 190, 88, LEVEL.hit, 0.003, 0.012, 0.14);
        rush(LEVEL.hit * 0.45, 3200, 900, 0.06, 'bandpass');
        break;
      case 'miss':
        // Lower and uglier than a hit, so the two are never confused.
        tone('square', 130, 54, LEVEL.miss, 0.004, 0.03, 0.26);
        rush(LEVEL.miss * 0.5, 900, 180, 0.22, 'lowpass');
        break;
      case 'broke':
        // Code that threw: a buzz rather than a blow, because nothing landed.
        tone('sawtooth', 210, 180, LEVEL.broke, 0.004, 0.09, 0.1);
        break;
      case 'shatter':
        rush(LEVEL.shatter, 5200, 1400, 0.2, 'bandpass');
        break;
      case 'cleared':
        [523, 784].forEach((hz, i) => tone('triangle', hz, hz, LEVEL.cleared, 0.008, 0.05, 0.22, i * 0.1));
        break;
      case 'won':
        [523, 659, 784, 1047].forEach((hz, i) => tone('triangle', hz, hz, LEVEL.won, 0.01, 0.08, 0.3, i * 0.13));
        break;
      case 'lost':
        tone('sawtooth', 160, 44, LEVEL.lost, 0.02, 0.12, 0.9);
        rush(LEVEL.lost * 0.5, 700, 90, 0.8, 'lowpass');
        break;
      case 'hint':
        tone('sine', 880, 1170, LEVEL.hint, 0.006, 0.02, 0.14);
        break;
    }
  }

  return {
    unlock(): void {
      build();
      if (ctx !== null && ctx.state === 'suspended') void ctx.resume();
    },
    play,
    toggle(): boolean {
      muted = !muted;
      return muted;
    },
    get muted(): boolean {
      return muted;
    },
  };
}

/** Exported only so the mute button can say which state it is in. */
export const MUTE_LABEL: Readonly<Record<Lang, readonly [string, string]>> = {
  en: ['Sound on', 'Sound off'],
  my: ['အသံ ဖွင့်', 'အသံ ပိတ်'],
};
