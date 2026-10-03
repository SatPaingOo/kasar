/**
 * What the end-to-end run checks in Saing, and how it tells a pass.
 *
 * Saing is played by ear, so it is checked by ear. Nothing in the page is
 * asked anything and the game has no hook for this: EAR wraps the audio
 * context's oscillators before the context exists — the page builds it on the
 * first key — and so hears every sound the page schedules, at its time on the
 * audio clock. A call is the drums between one clapper and the next, its
 * answer starts at that next clapper, and EAR plays each call back by key,
 * that far later, the way a player would.
 *
 * Which tests the path a player depends on and no unit test can reach: that
 * the call really is scheduled on the audio clock, at the pitches and times
 * the rules say; that a key reaches the judge with its own time stamp; and
 * that a phrase played back in time is kept, and one played wrong is not.
 * Whether it was kept is heard too: a kept phrase is followed by the same one
 * with more on the end, and a broken one by itself again.
 *
 * The judgments live here and are tested; the browser plumbing does not.
 */

/**
 * The drums' pitches, low to high, as `games/saing/src/sound.ts` has them —
 * a test reads that file and holds the two together. The fundamental of each
 * drum starts `GLIDE` sharp and settles, so that is what is listened for.
 */
export const PITCH = [196, 220, 246.9, 293.7, 329.6, 392, 440, 493.9] as const;
export const GLIDE = 1.16;
/** The clapper's crack: a triangle starting here, on the first beat of every call and answer. */
export const CLAPPER = 760;
/** The keys for the drums, low to high. */
export const KEYS = 'asdfghjk';

/** What the live region says when a phrase breaks on a wrong drum, and when a drum joins — in either language. */
export const SAYS = {
  wrong: ['Wrong drum', 'ပတ်မှားတယ်'],
  joins: ['A drum joins', 'ပတ်တစ်လုံး ဝင်လာပြီ'],
} as const;

/**
 * Which call to answer with one wrong drum, counting from one: the second,
 * so the first shows a kept phrase and the third shows the broken one coming
 * round again.
 */
export const WRONG_ON = 2;
/**
 * Calls to hear before judging: the first section's three phrases, the one
 * played again after the break, the drum joining, and the first phrase it is
 * in. About half a minute of music.
 */
export const CALLS = 6;

export interface Heard {
  /** Each call as heard, the drums in order. A drum joining sounds like a call of its own. */
  readonly calls: readonly (readonly number[])[];
  /** Everything the page's live region said, in order. */
  readonly said: readonly string[];
  /** How far after its due time each of our strikes went out, in milliseconds. */
  readonly slips: readonly number[];
  /** The audio context's state, or null if the page never made one. */
  readonly state: string | null;
}

export interface Verdict {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: unknown;
}

const grows = (longer: readonly number[] | undefined, shorter: readonly number[] | undefined): boolean =>
  longer !== undefined &&
  shorter !== undefined &&
  longer.length > shorter.length &&
  shorter.every((drum, i) => longer[i] === drum);

const same = (a: readonly number[] | undefined, b: readonly number[] | undefined): boolean =>
  a !== undefined && b !== undefined && a.length === b.length && a.every((drum, i) => b[i] === drum);

export function judgeEar(heard: Heard): Verdict[] {
  const out: Verdict[] = [];
  const check = (name: string, ok: boolean, detail?: unknown): void => {
    out.push(ok || detail === undefined ? { name, ok } : { name, ok, detail });
  };
  const [first, second, third, fourth, joining, after] = heard.calls;
  // The slips are in here so that a failure can be told apart from a busy
  // runner sending our strikes late, which is the harness's doing.
  const brief = { state: heard.state, calls: heard.calls, said: heard.said, latest: Math.max(0, ...heard.slips) };

  check(
    'the circle plays its call on the audio clock',
    heard.state === 'running' && first !== undefined && first.length >= 2,
    brief,
  );
  check('a phrase played back in time is kept: the next is the same with more on the end', grows(second, first), brief);
  check(
    'a wrong drum breaks it, says so, and the same phrase comes round again',
    same(third, second) && heard.said.some((s) => (SAYS.wrong as readonly string[]).includes(s)),
    brief,
  );
  check('played right the second time, it is kept', grows(fourth, third), brief);
  // The fourth drum is drum 3; it sounds twice on its own as it joins, and
  // the phrase after that is a new one, not the last one grown.
  check(
    'a drum joins after the first section, sounds on its own, and leads a new phrase',
    heard.said.some((s) => (SAYS.joins as readonly string[]).includes(s)) &&
      same(joining, [3, 3]) &&
      after !== undefined &&
      after.includes(3) &&
      !grows(after, fourth),
    brief,
  );
  return out;
}

/**
 * In the page, before the first key: listens to the audio graph and answers
 * every call. `window.__ear.report()` returns a `Heard`.
 */
export const EAR = String.raw`
(() => {
  const PITCH = ${JSON.stringify(PITCH)};
  const GLIDE = ${GLIDE};
  const CLAPPER = ${CLAPPER};
  const KEYS = ${JSON.stringify(KEYS)};
  const WRONG_ON = ${WRONG_ON};
  const log = [];
  const calls = [];
  const said = [];
  const slips = [];
  const answered = new Set();
  let context = null;
  // Our own strikes are drums too, and must not be heard as the next call.
  let striking = false;

  const make = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () {
    const ctx = this;
    context = ctx;
    const osc = make.call(ctx);
    let first = null;
    const set = osc.frequency.setValueAtTime.bind(osc.frequency);
    osc.frequency.setValueAtTime = (value, at) => {
      if (first === null) first = value;
      return set(value, at);
    };
    const start = osc.start.bind(osc);
    osc.start = (when = 0) => {
      if (!striking && first !== null) {
        const drum = PITCH.findIndex((p) => Math.abs(p * GLIDE - first) < 0.5);
        const due = performance.now() + (when - ctx.currentTime) * 1000;
        if (osc.type === 'sine' && drum >= 0) log.push({ kind: 'drum', drum, due });
        else if (osc.type === 'triangle' && Math.abs(first - CLAPPER) < 1) log.push({ kind: 'wa', due });
      }
      return start(when);
    };
    return osc;
  };

  const say = document.getElementById('say');
  if (say) new MutationObserver(() => said.push(say.textContent || '')).observe(say, { childList: true, characterData: true, subtree: true });

  function listen() {
    const claps = log.filter((e) => e.kind === 'wa');
    for (let k = 0; k + 1 < claps.length; k += 1) {
      const from = claps[k].due;
      const to = claps[k + 1].due;
      if (answered.has(to)) continue;
      const notes = log.filter((e) => e.kind === 'drum' && e.due >= from - 1 && e.due < to - 1);
      if (notes.length === 0) continue;
      answered.add(to);
      calls.push(notes.map((n) => n.drum));
      const wrong = calls.length === WRONG_ON;
      notes.forEach((note, i) => {
        const drum = wrong && i === 1 ? (note.drum + 1) % 3 : note.drum;
        const due = note.due + (to - from);
        setTimeout(() => {
          slips.push(Math.round(performance.now() - due));
          striking = true;
          window.dispatchEvent(new KeyboardEvent('keydown', { key: KEYS[drum], bubbles: true }));
          striking = false;
        }, Math.max(0, due - performance.now()));
      });
    }
    setTimeout(listen, 30);
  }
  listen();

  window.__ear = {
    report: () => ({ calls: calls.map((c) => c.slice()), said: said.slice(), slips: slips.slice(), state: context ? context.state : null }),
  };
})();
`;
