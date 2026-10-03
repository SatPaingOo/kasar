# Changelog — the shelf

Keep a Changelog, newest first. This file covers the shelf itself; each game
keeps its own, because each game carries its own version.

## [Unreleased]

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
