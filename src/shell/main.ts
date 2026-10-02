/**
 * Kasar — the shelf.
 *
 * Reads games.json and renders a card per game. That is the whole job: it
 * never loads, mounts or talks to a game, because a game here is a page of
 * its own at its own URL. Nothing a game does can break this, and this
 * imposes nothing on a game beyond having a folder and a game.json.
 */

import { startSky } from './sky.js';

type Lang = 'en' | 'my';

interface Localized {
  readonly en: string;
  readonly my: string;
}

interface GameEntry {
  readonly id: string;
  readonly version: string;
  readonly title: Localized;
  readonly blurb: Localized;
  readonly accent: string;
  readonly year: number;
  readonly href: string;
  readonly poster: string | null;
}

const TEXT = {
  tagline: { en: 'Small games, one at a time.', my: 'ဂိမ်းလေးများ၊ တစ်ခုချင်းစီ' },
  empty: { en: 'No games on the shelf yet.', my: 'စင်ပေါ်မှာ ဂိမ်း မရှိသေးဘူး' },
  broken: { en: 'Could not read the shelf.', my: 'စင်ကို မဖတ်နိုင်ဘူး' },
} as const;

const SWITCH: Readonly<Record<Lang, string>> = { en: 'မြန်မာ', my: 'English' };

function detect(): Lang {
  const tags = [navigator.language, ...navigator.languages];
  return tags.some((tag) => tag?.toLowerCase().startsWith('my')) ? 'my' : 'en';
}

function parseHex(hex: string): readonly [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const value = Number.parseInt(full, 16);
  return Number.isNaN(value) ? [143, 166, 200] : [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** A darker partner for the accent, so a poster is a gradient and not a slab. */
function deepen(hex: string): string {
  const [r, g, b] = parseHex(hex);
  const mix = (channel: number): number => Math.round(channel * 0.34 + 26 * 0.66);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** Dark text on a light accent, light text on a dark one. */
function inkOn(hex: string): string {
  const [r, g, b] = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55 ? '#171a24' : '#f4f7ff';
}

let lang: Lang = detect();
let games: readonly GameEntry[] = [];
let problem: keyof typeof TEXT | null = null;

const shelf = document.querySelector<HTMLUListElement>('#shelf');
const tagline = document.querySelector<HTMLParagraphElement>('#tagline');
const langButton = document.querySelector<HTMLButtonElement>('#lang');
const sky = document.querySelector<HTMLCanvasElement>('#sky');

function card(game: GameEntry): HTMLLIElement {
  const item = document.createElement('li');

  const link = document.createElement('a');
  link.className = 'card';
  link.href = game.href;
  link.style.setProperty('--accent', game.accent);
  link.style.setProperty('--accent-deep', deepen(game.accent));

  const poster = document.createElement('div');
  poster.className = 'poster';
  poster.style.color = inkOn(game.accent);
  if (game.poster !== null) {
    poster.style.backgroundImage = `url("${game.poster}")`;
  } else {
    // No poster is a normal state, not a gap: the title on the game's own
    // colour is a card, and nothing has to be drawn or kept up to date.
    const label = document.createElement('span');
    label.textContent = game.title[lang];
    poster.append(label);
  }

  const body = document.createElement('div');
  body.className = 'body';

  const name = document.createElement('h2');
  name.className = 'name';
  name.textContent = game.title[lang];

  const blurb = document.createElement('p');
  blurb.className = 'blurb';
  blurb.textContent = game.blurb[lang];

  const meta = document.createElement('p');
  meta.className = 'meta';
  const dot = document.createElement('span');
  dot.className = 'dot';
  const text = document.createElement('span');
  text.textContent = `v${game.version} · ${game.year}`;
  meta.append(dot, text);

  body.append(name, blurb, meta);
  link.append(poster, body);
  item.append(link);
  return item;
}

function render(): void {
  if (tagline !== null) tagline.textContent = TEXT.tagline[lang];
  if (langButton !== null) langButton.textContent = SWITCH[lang];
  document.documentElement.lang = lang;
  if (shelf === null) return;

  shelf.replaceChildren();

  if (problem !== null || games.length === 0) {
    const note = document.createElement('li');
    note.className = 'empty';
    note.textContent = TEXT[problem ?? 'empty'][lang];
    shelf.append(note);
    return;
  }

  for (const game of games) shelf.append(card(game));
}

langButton?.addEventListener('click', () => {
  lang = lang === 'en' ? 'my' : 'en';
  render();
});

if (sky !== null) startSky(sky);

try {
  const response = await fetch('./games.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(String(response.status));
  const data = (await response.json()) as { games?: readonly GameEntry[] };
  games = data.games ?? [];
} catch {
  problem = 'broken';
}

render();
