# Hman

**Status:** S1 Prototype · active · last reviewed 2026-10-03 · v0.2.0

မှန် — correct.

You are given a signature and two worked examples. You write the body. What
you return is what he does: a right answer lands on the thing he is fighting,
a wrong one lands on him. The thing he is fighting is the version of him that
got it wrong, which is the same figure flipped and in a colder ink.

**Binding constraint:** one person, `$0`, no artist, no runtime dependency.
That rules out a TypeScript compiler in the page, which decides the shape of
the whole thing — see below.

## Running it

From the repository root:

```bash
npm run play
```

Then open `games/hman/`. Keyboard only, so it does not work on a phone — the
only one on the shelf that does not.

## Playing it

Write the body, then **Strike** (or `Ctrl`/`Cmd` + `Enter`).

Every case that comes back right takes one more of the mirror down. A submit
with anything wrong in it costs one life, however much was wrong — so a first
attempt that gets three of four is progress to edit, not a mauling to start
over. What you already got right stays down.

**Hints** never block and never cost a life. Being stuck with no way to ask is
how someone stops playing a thing meant to teach them. They cost score, and
the result screen says how many were taken.

## The ladder does not start at "variable"

Every rung has to produce a value that can be drawn as a move. Declaring a
variable returns nothing — there is nothing to animate and nothing to be right
or wrong about on screen — so the textbook order and the game fight each other
at exactly the place a syllabus thinks is easiest.

So it starts at the first thing that produces something visible, and a variable
arrives at the rung where it first makes the answer easier rather than at the
rung where it would be named:

| rung | the move | what it is really teaching |
|---|---|---|
| a value | give back the first part | return, indexing from 0 |
| both ends | first plus last | `length`, and why a variable helps |
| a choice | the heavier of the first two | a condition |
| all of them | every part, doubled | doing one thing to each |

## Running what was typed

In a worker, built from a blob so it travels with the page.

Two things make that enough. The only code it ever runs is code typed by the
person at the keyboard — never from a URL, a file or anyone else — so it can do
nothing they could not already do in the console. And `while (true)` is a thing
beginners write constantly: on the main thread it kills the tab with no way
back, and in a worker it costs one submit, because a terminated worker is
simply gone. Measured at **1010 ms to recover, page alive**.

Anything that comes back which is not a number or a list of numbers becomes
`null` and counts as a miss, which is both safe and the honest answer to "that
is not what was asked for".

## It is TypeScript above the box and JavaScript inside it

There is no type checking, and there will not be one here. `tsc` in the page
is a large runtime dependency and this shelf has none.

So the signature above the box is TypeScript — reading it and satisfying it is
most of what relearning the language actually is — and the box itself runs as
JavaScript. Writing `const x: number` in the box fails, and `src/advice.ts`
catches it by name, because the engine's own words for it are
`Missing initializer in const declaration` for a declaration and
`Unexpected token ':'` for a parameter: two unrelated messages for one mistake,
neither mentioning types. It reads the source instead, and leaves object
literals and conditionals alone, colons and all.

## Layout

| file | what it is |
|---|---|
| `src/levels.ts` | the ladder: briefs, examples, hidden cases and hints, in both languages |
| `src/game.ts` | the rules. Pure, and it never runs anything — it takes the results of a run and decides what they do |
| `src/runner.ts` | the worker, the blob and the timeout. The only part that executes anything |
| `src/advice.ts` | what to say when the code did not run. String work only, so it is testable |
| `src/beat.ts` | the timing of one blow. No canvas, so it is testable |
| `src/sound.ts` | every sound, made from oscillators and one noise buffer |
| `src/figure.ts` | the man, drawn in code. Drawn twice: the second is him, flipped and colder |
| `src/render.ts` | the fight. The only thing on the canvas |
| `src/main.ts` | the loop, the desk and the keyboard |

The split that matters is `game.ts` never executing anything. Running code
needs a worker and a clock and is therefore the browser's problem; the damage
model is not, so the whole of it plays out headlessly in the tests.

## Showing what happened

The first version drew two small figures nudging each other for a third of a
second and nothing else. It animated correctly and it was useless: you could
not tell who had hit whom, or why, which is the only thing the game exists to
show you.

What was missing was never the animation. It was the answer. A blow now
carries the case it came from and holds it up afterwards —
`[6, 6, 1, 9] → 99 ✗`, and what was needed under it — and most of a blow is
that hold rather than the swing. The mirror is a row of blocks, one per case,
so a hit visibly takes one; a life that goes is drawn going.

Sound is the other half of it, and this is the only game on the shelf with
nothing running underneath. The other three always have something happening.
Here you are thinking most of the time, and the silence is what makes a blow
land when it comes.

## Still to come

- More rungs. Six to eight was the plan; there are four.
- An ending worth watching, for both ways a run can finish.
- Whether this belongs on the shelf at all. It is here to find that out: if it
  gets replayed to practise rather than to play, it wants to be its own thing,
  with more languages and saved progress — and a Python runtime is ten
  megabytes of WebAssembly, which this shelf cannot have.
