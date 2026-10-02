/**
 * Kasa — the shelf.
 *
 * Reads games.json and renders a card per game. That is the whole job: it
 * never loads, mounts or talks to a game, because a game here is a page of
 * its own at its own URL. Nothing a game does can break this, and this
 * imposes nothing on a game beyond having a folder and a game.json.
 */

type Lang = "en" | "my";

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
  tagline: { en: "Small games, one at a time.", my: "ဂိမ်းလေးများ၊ တစ်ခုချင်းစီ" },
  empty: { en: "No games on the shelf yet.", my: "စင်ပေါ်မှာ ဂိမ်း မရှိသေးဘူး" },
  broken: { en: "Could not read the shelf.", my: "စင်ကို မဖတ်နိုင်ဘူး" },
  footer: {
    en: "Each game stands on its own. Add a folder under games/ and it appears here.",
    my: "ဂိမ်းတစ်ခုချင်း သီးခြားရပ်တည်တယ်။ games/ အောက်မှာ folder တစ်ခု ထည့်လိုက်ရင် ဒီမှာ ပေါ်လာမယ်။",
  },
} as const;

const SWITCH: Readonly<Record<Lang, string>> = { en: "မြန်မာ", my: "English" };

function detect(): Lang {
  const tags = [navigator.language, ...navigator.languages];
  return tags.some((tag) => tag?.toLowerCase().startsWith("my")) ? "my" : "en";
}

let lang: Lang = detect();
let games: readonly GameEntry[] = [];
let problem: keyof typeof TEXT | null = null;

const shelf = document.querySelector<HTMLUListElement>("#shelf");
const tagline = document.querySelector<HTMLParagraphElement>("#tagline");
const footer = document.querySelector<HTMLElement>("#footer");
const langButton = document.querySelector<HTMLButtonElement>("#lang");

function card(game: GameEntry): HTMLLIElement {
  const item = document.createElement("li");

  const link = document.createElement("a");
  link.className = "card";
  link.href = game.href;

  const poster = document.createElement("div");
  poster.className = "poster";
  poster.style.background = game.accent;
  if (game.poster !== null) {
    poster.style.backgroundImage = `url("${game.poster}")`;
    poster.textContent = "";
  } else {
    // No poster is a normal state, not a gap: the title on the game's own
    // colour is a card, and nothing has to be drawn or kept up to date.
    poster.textContent = game.title[lang];
  }

  const body = document.createElement("div");
  body.className = "body";

  const name = document.createElement("h2");
  name.className = "name";
  name.textContent = game.title[lang];

  const blurb = document.createElement("p");
  blurb.className = "blurb";
  blurb.textContent = game.blurb[lang];

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = `v${game.version} · ${game.year}`;

  body.append(name, blurb, meta);
  link.append(poster, body);
  item.append(link);
  return item;
}

function render(): void {
  if (tagline !== null) tagline.textContent = TEXT.tagline[lang];
  if (footer !== null) footer.textContent = TEXT.footer[lang];
  if (langButton !== null) langButton.textContent = SWITCH[lang];
  document.documentElement.lang = lang;
  if (shelf === null) return;

  shelf.replaceChildren();

  if (problem !== null || games.length === 0) {
    const note = document.createElement("li");
    note.className = "empty";
    note.textContent = TEXT[problem ?? "empty"][lang];
    shelf.append(note);
    return;
  }

  for (const game of games) shelf.append(card(game));
}

langButton?.addEventListener("click", () => {
  lang = lang === "en" ? "my" : "en";
  render();
});

try {
  const response = await fetch("./games.json", { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  const data = (await response.json()) as { games?: readonly GameEntry[] };
  games = data.games ?? [];
} catch {
  problem = "broken";
}

render();
