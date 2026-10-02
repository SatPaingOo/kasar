# Kasa — Architecture

Structure, decisions, and the reasons behind them. Naming and layout rules come
from the SPO canon (`spo canon` shows where it is); this document covers what is
specific to this system.

**Last reviewed:** 2026-10-02

---

## 1. Scope and constraint

**What this system must do:** show a shelf of small browser games and get out
of the way. Someone opens the site, sees what is there, picks one, plays it.
Adding a game is dropping a folder in.

**The binding constraint:** one person, `$0`, no artist, no server. Node and
TypeScript only; no runtime dependency, no asset pipeline, everything drawn
and synthesised in code. It has to deploy as static files.

**Explicit non-goals:**

- A game engine, a shared runtime, a scene graph, an entity system
- Accounts, scores, saves on a server, analytics
- A game that cannot be a static page

## 2. Repo map

```text
kasa/
├── index.html            # the shelf itself
├── games.json            # generated from games/*/game.json; gitignored
├── src/shell/            # reads games.json, renders cards — nothing else
├── games/<id>/           # one game, entirely self-contained
├── tools/                # dev scripts: manifest, per-game build, static server
└── dist/shell/           # compiled shelf; gitignored
```

## 3. Layers and the dependency rule

There are no layers, because there are only two kinds of thing and they do not
import each other:

```
shell  →  games.json  ←  games/*/game.json
```

| | Contains | May import |
|---|---|---|
| `src/shell` | the shelf page | nothing but the DOM and `games.json` |
| `games/<id>` | one whole game | nothing outside its own folder |
| `tools` | dev scripts | `node:*` |

**The rule: a game imports nothing from outside its folder, and the shell
imports nothing from a game.** The only thing crossing the line is data — a
`game.json` read at build time — and a URL.

**Enforcement:** each game has its own `tsconfig.json` rooted at its own `src`,
so an import that reaches out of the folder fails to compile.

## 4. Decisions

### No `Game` interface, no mount contract

The first design had one: `mount(canvas, host)` returning something with
`pause`/`resume`/`destroy`, with the shell loading games by dynamic import.
It was dropped before it was written.

With one game to go on, any such interface is shaped around that game. The
next idea may be a DOM puzzle with no canvas and no loop. Canon 09 lists "new
abstractions before the second real use case exists" under what does not help,
and the shell does not actually need one: a link to a page is enough.

The cost of being wrong is also asymmetric. A contract that turns out to fit
badly has to be changed in every game at once; a set of independent folders
never has to be changed at all.

### Each game is a page, not a module

A game is reached at `games/<id>/`, which is a real URL — shareable,
bookmarkable, and backed by its own document. This removes the router, the
loader, and the possibility of one game's crash, leaked timer or stuck audio
context affecting another. The browser's own back button is the way out, and a
game may add a plain `<a>` to the shelf if it wants one.

It also means the shelf cannot break a game by changing: there is nothing to
change.

### Generated manifest, not a hand-kept list

`games.json` is produced by scanning `games/*/game.json`. A central list would
be a second place to describe a game and a thing to forget when adding one.
The generated file is gitignored because it is derived.

### One package, independent versions

A single root `package.json` holds TypeScript so one install covers everything
and there is no compiler per game. Versions live in each `game.json` instead,
so they stay independent of npm and of each other. A game that genuinely needs
its own dependency gets its own `package.json` at that point.

### Not a monorepo

Canon 03 Archetype B (`packages/` + `apps/`, pnpm workspaces) is the nearest
match and is deliberately not used. Workspaces buy independent versioning and
publishing; nothing here is published, and versioning is already handled by
`game.json`. What they would add — a lockfile per package, per-package
tsconfigs, build orchestration — is cost with no return at this size. The
trigger to revisit is a game that needs its own dependency set, or anything
here becoming a published package.

### No bundler

`tsc` emits native ES modules and the browser loads them. Each game's page
loads only its own files, so the count stays small per page. The trigger to
revisit is a single game whose module count makes its first paint slow.

## 5. Deviations from the canon

| Deviation | Why |
|---|---|
| `lib` includes `DOM`, `types` is `[]` | runs in a browser, not Node |
| Not Archetype B | see **Not a monorepo** above |
| `tools/` outside `include` | avoids adding `@types/node` while S2 is young |

## 6. Known gaps

- No `lint`, `format`, `test` or CI yet; `typecheck` is the only check
- `tools/` is not typechecked
- No deployment workflow; the intent is GitHub Pages serving the tree as-is
