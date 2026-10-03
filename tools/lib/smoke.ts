/**
 * The shelf and every game on it, opened and poked: the smoke test.
 *
 * Hman has a deep end-to-end run because it has been deeply wrong. The others
 * have never had anything — whether the shelf links to a game that loads was
 * checked by opening it, by hand, sometimes. This is the shallow version for
 * all of them at once, the same few questions for each: does it load without
 * an error, is anything drawn, is it moving, does it survive being pressed,
 * and does it fit a phone. A game that a deploy broke fails here.
 *
 * Every game draws on a canvas and runs a loop, so those are what is asked
 * about; nothing here knows how any one game is played.
 *
 * The judgments are pure and tested; the in-page parts are strings, because
 * they run in a browser and the tools are typed for Node.
 */

/** A canvas, summed up: enough to tell drawn from blank, and moving from still. */
export interface Frame {
  readonly width: number;
  readonly height: number;
  /** A hash of every pixel. Any change anywhere changes it. */
  readonly hash: number;
  /** Distinct colours in a sample of the pixels. */
  readonly colours: number;
}

/** Drawn means a canvas with size and more than one colour on it. */
export const isDrawn = (frame: Frame | null): boolean =>
  frame !== null && frame.width > 0 && frame.height > 0 && frame.colours >= 2;

/** Moving means two frames a moment apart are not the same picture. */
export const isMoving = (before: Frame | null, after: Frame | null): boolean =>
  before !== null && after !== null && isDrawn(after) && before.hash !== after.hash;

/** No errors — and there was something listening for them. */
export const noErrors = (errors: readonly string[] | null): boolean => errors !== null && errors.length === 0;

export interface Card {
  readonly href: string;
  readonly title: string;
}

export interface Listed {
  readonly id: string;
  readonly href: string;
}

/**
 * Every game the manifest lists has a card on the shelf linking to its folder,
 * and there is no card for anything else.
 */
export function cardsMatch(cards: readonly Card[], games: readonly Listed[]): boolean {
  if (cards.length !== games.length) return false;
  const linked = cards.map((card) => card.href.replace(/^\.\//, '').replace(/\/?$/, '/'));
  return games.every((game) => linked.includes(game.href.replace(/\/?$/, '/')));
}

/**
 * Put at the start of every page, before the page's own scripts, so an error
 * thrown while the page is still starting is caught too.
 */
export const CATCHER = String.raw`
(() => {
window.__kasarErrors = [];
const note = (what) => { try { window.__kasarErrors.push(String(what).slice(0, 300)); } catch {} };
window.addEventListener('error', (event) => note(event.message || (event.error && event.error.message) || 'error'));
window.addEventListener('unhandledrejection', (event) => note('unhandled: ' + ((event.reason && event.reason.message) || event.reason)));
const before = console.error.bind(console);
console.error = (...args) => { note(args.map(String).join(' ')); before(...args); };
})();
`;

/** In the page: the errors so far, and a summary of the biggest canvas. */
export const SAMPLER = String.raw`
window.SMOKE = (() => {
  // Null, not empty, when nothing was watching: a check for errors that was
  // never listening must not pass for having heard none.
  const errors = () => (Array.isArray(window.__kasarErrors) ? window.__kasarErrors.slice() : null);
  const frame = () => {
    const canvases = [...document.querySelectorAll('canvas')];
    if (canvases.length === 0) return null;
    const canvas = canvases.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
    if (canvas.width === 0 || canvas.height === 0) return { width: 0, height: 0, hash: 0, colours: 0 };
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 1) hash = Math.imul(hash ^ data[i], 16777619) >>> 0;
    const seen = new Set();
    for (let i = 0; i < data.length && seen.size < 64; i += 4 * 97) {
      seen.add((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]);
    }
    return { width: canvas.width, height: canvas.height, hash, colours: seen.size };
  };
  const cards = () =>
    [...document.querySelectorAll('a[href*="games/"]')].map((a) => ({ href: a.getAttribute('href') || '', title: (a.textContent || '').trim().slice(0, 40) }));
  const wide = () => document.documentElement.scrollWidth > innerWidth + 1;
  const centre = () => {
    const canvas = [...document.querySelectorAll('canvas')][0];
    if (!canvas) return { x: innerWidth / 2, y: innerHeight / 2 };
    const r = canvas.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  return { errors, frame, cards, wide, centre };
})();
`;
