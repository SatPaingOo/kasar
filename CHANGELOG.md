# Changelog — the shelf

Keep a Changelog, newest first. This file covers the shelf itself; each game
keeps its own, because each game carries its own version.

## [Unreleased]

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
