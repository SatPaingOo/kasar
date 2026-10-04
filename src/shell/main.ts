/**
 * Kasar — the shelf.
 *
 * Reads games.json and renders a card per game. That is the whole job: it
 * never loads, mounts or talks to a game, because a game here is a page of
 * its own at its own URL. Nothing a game does can break this, and this
 * imposes nothing on a game beyond having a folder and a game.json.
 */

import { deepen, inkOn } from './colour.js';
import { pickLang } from './lang.js';
import type { Lang } from './lang.js';
import { startWalker } from './walker.js';

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
  /** Either side of the author's name, which is a link and the same in both languages. */
  made: {
    en: ['Every picture and every sound here is made in code, by ', '.'],
    my: ['ဒီက ပုံတိုင်း၊ အသံတိုင်းကို ', ' က code နဲ့ ရေးထားတယ်။'],
  },
  rights: { en: '© 2026 · All rights reserved', my: '© 2026 · မူပိုင်ခွင့် အားလုံး ရယူထားသည်' },
  source: { en: 'source ↗', my: 'source code ↗' },
  empty: { en: 'No games on the shelf yet.', my: 'စင်ပေါ်မှာ ဂိမ်း မရှိသေးဘူး' },
  broken: { en: 'Could not read the shelf.', my: 'စင်ကို မဖတ်နိုင်ဘူး' },
} as const;

const SWITCH: Readonly<Record<Lang, string>> = { en: 'မြန်မာ', my: 'English' };

/** The shelf's readout, in the masthead: how much is on it. */
function countLabel(n: number): string {
  if (lang === 'my') return `ဂိမ်း ${n} ခု`;
  return `${String(n).padStart(2, '0')} ${n === 1 ? 'game' : 'games'}`;
}

let lang: Lang = pickLang([navigator.language, ...navigator.languages]);
let games: readonly GameEntry[] = [];
let problem: 'empty' | 'broken' | null = null;

const shelf = document.querySelector<HTMLUListElement>('#shelf');
const tagline = document.querySelector<HTMLParagraphElement>('#tagline');
const langButton = document.querySelector<HTMLButtonElement>('#lang');
const counter = document.querySelector<HTMLSpanElement>('#count');
const madeBefore = document.querySelector<HTMLSpanElement>('#made-before');
const madeAfter = document.querySelector<HTMLSpanElement>('#made-after');
const rights = document.querySelector<HTMLSpanElement>('#rights');
const source = document.querySelector<HTMLAnchorElement>('#source');

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
  dot.className = 'tick';
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
  if (madeBefore !== null) madeBefore.textContent = TEXT.made[lang][0];
  if (madeAfter !== null) madeAfter.textContent = TEXT.made[lang][1];
  if (rights !== null) rights.textContent = TEXT.rights[lang];
  if (source !== null) source.textContent = TEXT.source[lang];
  if (counter !== null) counter.textContent = countLabel(games.length);
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

  // Draw the rest of the rack, so a shelf with one game on it looks like a
  // shelf with room rather than a page that half loaded.
  for (let i = games.length; i < 4; i += 1) {
    const slot = document.createElement('li');
    slot.className = 'slot';
    slot.setAttribute('aria-hidden', 'true');
    shelf.append(slot);
  }
}

langButton?.addEventListener('click', () => {
  lang = lang === 'en' ? 'my' : 'en';
  render();
});

// He has nothing to do with the shelf's contents, so he starts before the
// fetch and keeps going whether or not it succeeds.
const walkway = document.querySelector<HTMLElement>('#walkway');
if (walkway !== null) startWalker(walkway);

try {
  const response = await fetch('./games.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(String(response.status));
  const data = (await response.json()) as { games?: readonly GameEntry[] };
  games = data.games ?? [];
} catch {
  problem = 'broken';
}

render();
