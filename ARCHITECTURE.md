# Kasar — Architecture

Structure, decisions, and the reasons behind them. Naming and layout rules come
from the SPO canon (`spo canon` shows where it is); this document covers what is
specific to this system.

**Last reviewed:** 2026-10-03

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
kasar/
├── index.html            # the shelf itself
├── games.json            # generated from games/*/game.json; gitignored
├── src/shell/            # reads games.json, renders cards — nothing else
├── games/<id>/           # one game, entirely self-contained
├── tools/                # dev scripts: manifest, per-game build, static server, e2e
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

### `main` is a deployment, not a working branch

Canon 09 permits direct commits to `main` in a solo project at S2, on the
grounds that a pull request to yourself is theatre. That reasoning is about
review, and this is not about review: `main` is wired to a public site, so a
commit to it is a publish. Work lands on `dev`, CI gates both, and reaching
`main` is a decision rather than a side effect.

The deploy is the last job of CI and needs every other job to pass. It used
to be a workflow of its own, started by the same push and racing the checks
instead of waiting for them, so the gate between `main` and the site was a
habit — CI green on `dev` first — rather than anything the workflows
enforced.

### Tags carry the name in front of the version

Canon 09 tags `v<semver>` because a repository has one version, held in one
file. Here each game holds its own in its `game.json` and the shelf holds its
own in `package.json`, so a bare `v0.1.0` would be ambiguous the moment there
are two games. Tags are `<name>/v<semver>`, and each has a `CHANGELOG.md`
entry in the same folder as the version it names.

## 5. Deviations from the canon

| Deviation | Why |
|---|---|
| `lib` includes `DOM`, `types` is `[]` | runs in a browser, not Node |
| Not Archetype B | see **Not a monorepo** above |
| No direct commits to `main` | see **`main` is a deployment** above |
| Tags are `<name>/v<semver>` | more than one version per repository |

### The shelf may not borrow a game's visual language

The first shelf was a night sky with drifting embers, a lantern glyph and a
dusk-to-night gradient. All of that is Tazaung's, and with one game on the
shelf it looked deliberate. With a second it would have been a frame fighting
its contents, and a game whose colours clashed with the frame would have
looked broken through no fault of its own.

The shelf is therefore greyscale: a dark surface, a faint grid, mono metadata,
and one neutral focus colour. **Every colour on the page comes from a game's
own `accent` or its `poster.svg`,** and appears only inside that game's card.
The mark is a cartridge slot with a play triangle, which belongs to a shelf
rather than to anything on it.

A game's own identity lives in `games/<id>/poster.svg`, where it cannot reach
the page around it.

The shelf's stick figure in `src/shell/walker.ts` is the first real test of
that rule. Tazaung has a stick figure already, and lifting its `character.ts`
would have been half an hour's work; the shelf's is written separately and
shares nothing — no hat, no wand, no lantern, no colour, a different walk, and
no import across the boundary. Taking the idea is allowed. Taking the file is
how the night sky got here.

He has the whole page now, not a strip of floor along the bottom of the
window: the top of every card, the rule under the masthead, the title and the
readout, the floor, and ladders between them. The rule held there too. A rope
was the obvious way up and is Kyo's, so the ladders are rigid, two thin rails
in the grid's grey; and they stand in the gutters and the margins, never
across a card or a line of text, because a figure in the way of reading is a
shelf getting in the way of its games. The page is turned into that world in
`world.ts`, routes across it are planned in `route.ts`, and what he wants and
does with it is `roam.ts` — all three pure, so that nowhere being cut off and
nothing chasing him off a ledge are tested rather than hoped. He is drawn
over the page but takes no click, on a small canvas that moves inside a layer
the size of the page, so he scrolls with it and can never make it wider.

### Logic the tools decide is split from the scripts that run it

`tools/lib/` holds what each tool judges — which file a request may have,
what counts as a describable game, what belongs in the site — and the script
beside it only reads arguments and writes output. The judgments are the part
worth testing, and testing them through a socket or a build log would prove
much less for much more work.

## 6. Known gaps

- The drawing has no tests: the wizard, the sky, the scroll and the motes are
  checked by looking at them. A canvas assertion needs a native canvas build,
  and a pixel snapshot says something changed, not whether it looks right.
- `src/shell/main.ts` wires the DOM and is not covered; the judgments it used
  to hold were moved to `colour.ts` and `lang.ts`, which are.
- End to end (`npm run e2e`, in Firefox and Chrome, locally and as a CI job)
  plays Hman through and the first section of Saing by ear, but only
  smoke-tests the shelf and the other three games: each loads without an
  error, draws, keeps drawing, survives a click and a key, and fits a phone.
  Whether Tazaung, Hlaykar and Kyo play right is still for their unit tests
  and headless bots, and for playing them.
