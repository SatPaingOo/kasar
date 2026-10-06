# Changelog — the shelf

Keep a Changelog, newest first. This file covers the shelf itself; each game
keeps its own, because each game carries its own version.

## [Unreleased]

## [0.5.1] — 2026-10-06

### Changed

- The blurb on every card is rewritten. Five of them in a column all read
  the same way — a scene, a full stop, an instruction — and gave the setting
  rather than the decision, which is the part of each of these games worth a
  sentence. Tazaung's best idea, that the spark you relight the sky with is
  spent out of your own lantern, was not on its card at all, and Hman's never
  said it teaches TypeScript. Each now leads with what your hands do, or the
  rule that binds them, and says what it costs. The Burmese drops the pronoun
  throughout, as Burmese does, and keeps one register instead of wandering
  between ကိုယ့် and မင်း.

## [0.5.0] — 2026-10-04

### Added

- A footer. Its top line is the ground: the floor Tote Tote walks on at the
  bottom of the page, where before there was only the bottom of the window.
  It says what is true of everything here — every picture and every sound
  is made in code, by Sat Paing Oo — with the copyright, all rights
  reserved, and a link to the source.
- The shelf's figure has a name: Tote Tote, တုတ်တုတ် — he is a stick figure.
- A cat lives at the foot of the page, in a basket at the left-hand end of
  the floor. Mostly it sleeps; now and then it gets up, wanders a little way
  and comes back. It does not climb ladders, so the floor is all the world it
  has — and every few minutes he goes down to see it, wherever anyone is
  looking: it comes to him to be stroked, follows him about, curls up beside
  him when he sits, and when he climbs away it watches him go and goes home.
  That is the reason he goes all the way down the page at all.
- Visitors, one at a time and not always one. Nobody appears from nowhere:
  there are two ways into the page — a ladder down from the roof above the
  top of it, beside the readout, and a door on the floor at the right-hand
  end — and a visitor comes in by one and goes out by the same one.
- A friend — smaller than he is, quicker, with a tuft of hair — comes in by
  whichever way he is nearer, finds him, calls his name, and he says hello.
  It keeps him company for a minute or so, walking where he walks, climbing
  after him, sitting down cross-legged beside him when he sits on the end of
  a card; then they say goodbye, wave, and it goes home the way it came.
- A bird needs no way: it flies in from off the screen on any side and off
  it on any side. It comes to play with him — sings, hops about, and every so
  often rides on his head wherever he goes, up and down the ladders too — or
  with the cat, which stalks it and pounces, and never catches it.
- He waits for whoever is coming: seeing a visitor arrive, he says "!" and
  stops where he is instead of leading it a chase up and down the ladders.
- They talk mostly in signs, ♪ ! ? … ♥ zZ, which need no translating; his
  name, hello, goodbye and the cat's meow are the only words, said in the
  page's language.
- The visitors, the cat, the door and the basket are all the shelf's own, in
  its grey line; none of them is borrowed from a game.

### Changed

- The credit has moved from the masthead to the footer, still linking to the
  portfolio, so the masthead is the name and the tagline and nothing else.
  "All rights reserved" is what the repository already means, having no
  licence; it would have to go if one were added.

## [0.4.1] — 2026-10-04

### Fixed

- The walker's layer could hold the page fifteen pixels wider than the
  window, with a scrollbar to show for it: it was given the page's width in
  pixels, and kept it after a vertical scrollbar arrived and took its share
  until the next frame — which a hidden tab never gets. Its width is left to
  the stylesheet now, and a hidden tab re-measures on a timer instead.

## [0.4.0] — 2026-10-04

### Changed

- The shelf's figure has the whole page now, not a strip of floor along the
  bottom of the window. He walks the tops of the cards and hops the gaps
  between them, climbs ladders between the rows, leaps up onto the rule
  under the masthead, climbs onto the title and jumps down off the readout,
  sits on the end of a card with his legs over the edge, and looks down over
  one. He picks what he wants to do and plans his way there, rather than
  wandering. Somewhere on screen is six times as likely as somewhere off it,
  and a few seconds out of sight sends him back; resting, he keeps out from
  in front of the words.
- The ladders are the shelf's own — two thin rails in the grid's grey, not
  rope, which is Kyo's — and stand only in the gutters and margins, never
  across a card or a line of text. Placed by the layout, so a phone gets them
  down its margins and a wide screen in the gutters.
- He draws over the page now rather than behind it, still taking no click,
  on a canvas that moves with him inside a layer the size of the page: he
  scrolls with the page instead of a frame behind it, and cannot make it any
  wider or longer.

## [0.3.0] — 2026-10-03

### Added

- Saing, the fifth game: a circle of tuned drums plays a phrase and you play
  it back by ear. The shelf needed no change to take it — the manifest, the
  build, the stage and the smoke test all found it by its folder.
- `npm run e2e` plays Saing by ear. A script in the page wraps the audio
  context's oscillators before the page makes one, hears every sound it
  schedules, and plays each call back by key; whether a phrase was kept is
  heard too, so the game needs no hook for it. It plays the first section
  with one phrase wrong on purpose, and the drum that joins.

### Fixed

- CI's end-to-end job starts a sound server with a sink that goes nowhere.
  Without one, Firefox on the runner never let an audio context leave
  "suspended", and a game played by ear could not be heard.

## [0.2.0] — 2026-10-03

All of this was already live — `main` deploys as it lands — and was still
filed under Unreleased, with the version at 0.1.0. The shelf walker was not
in here at all.

### Added

- Someone lives on the shelf: a stick figure that walks along the bottom of
  it by himself and steps out of the cursor's way. Written for the shelf and
  sharing nothing with any game's figure.
- The shelf credits its author and links back to the portfolio.
- `npm run e2e`. It smoke-tests the shelf and every game on it — each one
  opens without an error, draws, keeps drawing, survives a click and a key,
  and fits a phone — and then plays Hman through, in the installed Firefox
  and Chrome, over their own remote protocols, with no dependency.
- CI runs it as a job of its own, with `--all` so a missing browser fails
  rather than being skipped, and keeps the screenshots when it fails.
- Tests for the shelf and the tools, and a typecheck of everything, tools and
  tests included.

### Changed

- Deploying waits for every check. It was its own workflow, started by the
  same push and racing CI rather than waiting for it — it repeated lint and
  the unit tests but not the end-to-end run, and nothing stopped it when CI
  failed. It is now the last job of CI, on `main` only, needing all the
  others to pass.
- The shelf no longer borrows Tazaung's night sky, lantern glyph and drifting
  embers. It is greyscale with a faint grid, and every colour on the page now
  comes from a game's own accent and poster. Tazaung has a poster of its own.
- A masthead readout of how many games are on the shelf, and the remaining
  rack slots drawn, so one game does not read as a page that half loaded.
- Burmese is no longer upper-cased or letter-spaced, which mangles the script.
- The README lists all four games on the shelf. It still listed only the
  first.
- Everything is formatted with the canon Prettier config.

### Fixed

- The walker moonwalked: his feet lifted on the wrong half of the stride, so
  he walked backwards while going forwards.

### Removed

- `src/shell/sky.ts`, the animated starfield.
- `.github/workflows/pages.yml`, folded into CI as its deploy job.

## [0.1.0] — 2026-10-02

### Added

- A shelf that reads `games.json` and renders a card per game, in English and
  Burmese, with each card carrying its game's accent colour.
- A night sky behind it: stars and drifting warm lights on a canvas, drawn in
  code, honouring `prefers-reduced-motion`.
- `tools/manifest.ts` — builds `games.json` by scanning `games/*/game.json`,
  so adding a game is dropping a folder in.
- `tools/build-games.ts` — compiles every game with its own tsconfig.
- `tools/stage.ts` — collects only what the site is into `site/`.
- `tools/serve.ts` — dev static server that serves folder indexes.
- CI on `dev` and `main`; Pages deploy from `main`.
