# Changelog — the shelf

Keep a Changelog, newest first. This file covers the shelf itself; each game
keeps its own, because each game carries its own version.

## [Unreleased]

### Changed

- The shelf no longer borrows Tazaung's night sky, lantern glyph and drifting
  embers. It is greyscale with a faint grid, and every colour on the page now
  comes from a game's own accent and poster.
- A masthead readout of how many games are on the shelf, and the remaining
  rack slots drawn, so one game does not read as a page that half loaded.
- Burmese is no longer upper-cased or letter-spaced, which mangles the script.

### Removed

- `src/shell/sky.ts`, the animated starfield.

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
