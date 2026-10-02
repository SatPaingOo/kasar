/**
 * Tazaung — sound.
 *
 * Every sound is synthesised at runtime: oscillators, envelopes and one noise
 * buffer. There is no audio file, for the same reason there is no sprite
 * sheet.
 *
 * The drone is the lantern. Its gain and pitch follow the light, so the world
 * goes quiet as it goes dark, and silence is the ending.
 *
 * Browsers refuse to start audio before the player has touched something, so
 * nothing is built until `unlock` is called from a real input event.
 */

import type { Boon, GameEvent } from './game.js';

/**
 * Levels, measured rather than guessed: the whole mix was tapped at the master
 * gain while playing and peaked at 0.065 — about eight times too quiet, with
 * shots sitting below the drone instead of over it. These are set so an
 * ordinary relight lands near 0.26 peak and a sunrise near 0.55.
 *
 * `chime` splits a level across its partials as level/(index + 1.6), so a
 * two-partial cue reaches about 0.76 of its level and a four-partial one
 * about 1.26. The limiter below absorbs whatever overlaps.
 */
const MIX = {
  master: 0.7,
  drone: 0.085,
  shot: 0.13,
  relight: 0.5,
  boon: 0.8,
  /**
   * Much larger than the rest because `thud` is a lowpassed noise burst: at
   * 0.38 it measured 0.074 peak, barely over the drone, so the one sound that
   * means you failed was the one nobody would hear.
   */
  land: 1.3,
  chain: 0.66,
  dawn: 0.9,
  scroll: 0.5,
} as const;

interface Rig {
  readonly context: AudioContext;
  readonly master: GainNode;
  readonly droneGain: GainNode;
  readonly droneLow: OscillatorNode;
  readonly droneHigh: OscillatorNode;
  readonly noise: AudioBuffer;
}

let rig: Rig | undefined;
let muted = false;

/** Build the audio graph. Safe to call on every input; it only acts once. */
export function unlock(): void {
  if (rig !== undefined) {
    if (rig.context.state === 'suspended') void rig.context.resume();
    return;
  }

  const context = new AudioContext();
  // Created inside a gesture, but a context can still come up suspended. The
  // branch above only resumes on a *later* unlock, so without this a context
  // that started suspended would stay silent for the whole session.
  void context.resume();
  context.addEventListener('statechange', () => {
    if (context.state === 'suspended') void context.resume();
  });

  // A limiter on the end, so raising the cues cannot clip when several land
  // together — a chain, three relights and the drone can overlap freely.
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.18;
  limiter.connect(context.destination);

  const master = context.createGain();
  master.gain.value = muted ? 0 : MIX.master;
  master.connect(limiter);

  const droneGain = context.createGain();
  droneGain.gain.value = 0;
  droneGain.connect(master);

  // Two detuned oscillators beat slowly against each other, which reads as a
  // flame rather than a test tone.
  const droneLow = context.createOscillator();
  droneLow.type = 'sine';
  droneLow.frequency.value = 110;
  droneLow.connect(droneGain);
  droneLow.start();

  const droneHigh = context.createOscillator();
  droneHigh.type = 'triangle';
  droneHigh.frequency.value = 165.5;
  const droneHighGain = context.createGain();
  droneHighGain.gain.value = 0.35;
  droneHigh.connect(droneHighGain).connect(droneGain);
  droneHigh.start();

  const frames = Math.floor(context.sampleRate * 0.4);
  const noise = context.createBuffer(1, frames, context.sampleRate);
  const channel = noise.getChannelData(0);
  for (let i = 0; i < frames; i += 1) channel[i] = Math.random() * 2 - 1;

  rig = { context, master, droneGain, droneLow, droneHigh, noise };
}

/** Paper opening: a short filtered noise sweep, no sample needed. */
export function playScroll(): void {
  if (rig === undefined) return;
  const { context, master, noise } = rig;
  const now = context.currentTime;

  const source = context.createBufferSource();
  source.buffer = noise;
  source.playbackRate.value = 0.7;

  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(900, now);
  filter.frequency.exponentialRampToValueAtTime(2600, now + 0.45);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(MIX.scroll, now + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

  source.connect(filter).connect(gain).connect(master);
  source.start(now);
  source.stop(now + 0.55);
}

/** Stepping off the scroll into the night. */
export function playBegin(): void {
  chime([293.66, 440, 587.33], 1.1, MIX.boon * 0.7);
}

export function toggleMute(): boolean {
  muted = !muted;
  if (rig !== undefined) {
    rig.master.gain.setTargetAtTime(muted ? 0 : MIX.master, rig.context.currentTime, 0.05);
  }
  return muted;
}

/** The lantern's own voice: quieter and lower as the light fails. */
export function updateSound(light: number, playing: boolean): void {
  if (rig === undefined) return;
  const now = rig.context.currentTime;
  const level = playing ? MIX.drone * (0.15 + light * 0.85) : 0;
  rig.droneGain.gain.setTargetAtTime(level, now, 0.12);
  rig.droneLow.frequency.setTargetAtTime(96 + light * 24, now, 0.3);
  rig.droneHigh.frequency.setTargetAtTime(144 + light * 36, now, 0.3);
}

export function playEvents(events: readonly GameEvent[]): void {
  if (rig === undefined) return;
  for (const event of events) {
    switch (event.kind) {
      case 'shot':
        blip(660, 0.07, MIX.shot, 'square', -220);
        break;
      case 'relit':
        chime([523.25, 783.99], 0.3, MIX.relight);
        break;
      case 'boon':
        playBoon(event.boon);
        break;
      case 'landed':
        thud();
        break;
      case 'chain':
        chime([261.63, 392, 523.25, 659.25].slice(0, 2 + Math.min(2, event.size / 3)), 0.9, MIX.chain);
        break;
      case 'ended':
        fadeOut();
        break;
      case 'dawn':
        chime([392, 493.88, 587.33, 783.99], 2.4, MIX.dawn);
        break;
      default:
        break;
    }
  }
}

/** One voice per boon, so you hear which light you caught before you see it. */
function playBoon(boon: Boon): void {
  switch (boon) {
    case 'ember':
      // Bright and fast: it makes the wand hot.
      chime([659.25, 987.77, 1318.51], 0.5, MIX.boon);
      blip(1200, 0.12, MIX.boon * 0.4, 'sawtooth', 500);
      return;
    case 'beacon':
      // Wide and bell-like: it reaches every column at once.
      chime([392, 587.33, 880, 1174.66], 1.3, MIX.boon);
      return;
    case 'hush':
      // Downward and soft: the sky slows.
      sweepDown(620, 190, 1.1, MIX.boon * 0.9);
      return;
    case 'bloom':
      // A rising arpeggio: the whole pile goes home.
      arpeggio([329.63, 415.3, 493.88, 659.25, 830.61], 0.11, 0.7, MIX.boon * 0.8);
      return;
    case 'ward':
      // Two hard, glassy strikes: something closes around the lantern.
      chime([1046.5, 1567.98], 0.9, MIX.boon * 0.75);
      blip(2093, 0.08, MIX.boon * 0.25, 'sine', -200);
      return;
    default:
      return;
  }
}

/** A single voice gliding down — used for the hush. */
function sweepDown(from: number, to: number, seconds: number, level: number): void {
  if (rig === undefined) return;
  const { context, master } = rig;
  const now = context.currentTime;

  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(to, now + seconds);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(level, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

  osc.connect(gain).connect(master);
  osc.start(now);
  osc.stop(now + seconds + 0.05);
}

/** Notes one after another rather than together — used for the bloom. */
function arpeggio(notes: readonly number[], stepSeconds: number, tail: number, level: number): void {
  if (rig === undefined) return;
  const { context, master } = rig;
  const base = context.currentTime;

  notes.forEach((frequency, index) => {
    const start = base + index * stepSeconds;
    const osc = context.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tail);

    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + tail + 0.05);
  });
}

function blip(frequency: number, seconds: number, level: number, shape: OscillatorType, sweep: number): void {
  if (rig === undefined) return;
  const { context, master } = rig;
  const now = context.currentTime;

  const osc = context.createOscillator();
  osc.type = shape;
  osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + sweep), now + seconds);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(level, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

  osc.connect(gain).connect(master);
  osc.start(now);
  osc.stop(now + seconds + 0.02);
}

/** A warm stack of partials with a soft tail — a light coming back on. */
function chime(partials: readonly number[], seconds: number, level: number): void {
  if (rig === undefined) return;
  const { context, master } = rig;
  const now = context.currentTime;

  partials.forEach((frequency, index) => {
    const osc = context.createOscillator();
    osc.type = index === 0 ? 'sine' : 'triangle';
    osc.frequency.value = frequency;

    const gain = context.createGain();
    const share = level / (index + 1.6);
    const start = now + index * 0.035;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(share, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);

    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  });
}

/** Something cold hitting the pile. */
function thud(): void {
  if (rig === undefined) return;
  const { context, master, noise } = rig;
  const now = context.currentTime;

  const source = context.createBufferSource();
  source.buffer = noise;

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(420, now);
  filter.frequency.exponentialRampToValueAtTime(110, now + 0.18);

  const gain = context.createGain();
  gain.gain.setValueAtTime(MIX.land, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  source.connect(filter).connect(gain).connect(master);
  source.start(now);
  source.stop(now + 0.25);
}

function fadeOut(): void {
  if (rig === undefined) return;
  rig.droneGain.gain.setTargetAtTime(0, rig.context.currentTime, 0.25);
}
