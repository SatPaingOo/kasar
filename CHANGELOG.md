# Changelog — the shelf

Keep a Changelog, newest first. This file covers the shelf itself; each game
keeps its own, because each game carries its own version.

## [Unreleased]

### Added

- Saing, the fifth game: a circle of tuned drums plays a phrase and you play
  it back by ear. The shelf needed no change to take it — the manifest, the
  build, the stage and the smoke test all found it by its folder.

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
