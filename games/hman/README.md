# Hman

**Status:** S1 Prototype · active · last reviewed 2026-10-03 · v0.6.0

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

Where you got to is kept — the rungs beaten and what was in the box for each —
in the browser's own storage, and nothing leaves the machine. Coming back,
the title offers to carry on, and every rung up to one past the furthest
beaten can be gone back to from the map on it. Seventy-five rungs is not one
sitting, and a ladder that started from the bottom every time the tab closed
would only ever be climbed as far as one evening reaches.

Every case that comes back right takes one more of the mirror down. A submit
with anything wrong in it costs one life, however much was wrong — so a first
attempt that gets three of four is progress to edit, not a mauling to start
over. What you already got right stays down.

**Lives belong to the rung, not to the run.** Run out and he goes down, and
you get that rung again with what is below it still cleared. Five lives across
the whole run sounds generous and was not: someone relearning a language tries
things, so the run kept restarting at the first rung and the later ones were
never reached at all.

The fight plays the hits and the first miss only — four identical failures
told you nothing the first had not — and it can be skipped by clicking it or
pressing Escape.

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
rung where it would be named.

Seventy-five rungs in thirteen chapters, ordered so that logic comes before
vocabulary: by the end of the third chapter someone can write a loop that
totals, counts, finds and builds, and only then is `map` named — as the short
way of saying the loop they just wrote. The types chapter comes straight after
objects rather than at the end, because narrowing and unions are the part of
TypeScript that is not JavaScript, and they need something to narrow.

| chapter | rungs | what it is really teaching |
|---|---|---|
| Values and lists | 1–5 | indexing from 0, `length` and the last index, a name for a value, `Math.floor`, and that `number` and `number[]` are different promises |
| Choosing | 6–10 | `?:` and `if`, a comparison *is* a boolean, `else if`, `&&` and inclusive edges, the empty list and `??` against `\|\|` |
| Again and again | 11–17 | the accumulator, counting with an `if` inside, where a loop starts, returning early with an index, the empty list being `true` for "all", building a list with `push`, and `map` |
| Array methods | 18–24 | `filter`, a closure over a limit, `find` and `??`, `includes`, `sort` and why it sorts `10` before `9`, a `Set` spread back into a list, and a chain of three |
| Text | 25–31 | strings never change, indexing past the end of one, counting in either case, `split` and `join`, normalising before comparing, `'4' + '1'`, and a template literal |
| Things with names | 32–38 | a type alias as a promise, plucking a field, filtering whole objects, keeping the best object, `reduce` to a number, a copy with one field changed, and a record as a dictionary |
| Shapes of things | 39–45 | a union narrowed by `typeof`, an optional field, a tuple, literal types and `switch`, a discriminated union, a generic, and `unknown` |
| Moves of your own | 46–50 | a helper named once, composition, an optional parameter, a closure with state, and a table of functions |
| Himself again | 51–55 | the base case, the argument that shrinks, correct-and-slow, and two over a type that mentions itself |
| Rows and columns | 56–60 | rows, a column, the diagonal by index, transpose, and a cell's neighbours with `?.` at the edges |
| Doing it well | 61–66 | binary search, a `Map` of what has been seen, insertion, merging, √n, and Euclid |
| One on top of another | 67–69 | the stack: brackets, undo, and a calculator that reads its numbers first |
| Small programs | 70–75 | FizzBuzz, words in untidy text, run-length encoding, a Caesar shift and `%` with negatives, Roman numerals from a table, and when greedy is safe |

**A rung is named only after it is beaten.** Its label says what is being
asked — "how many", "the heaviest" — never which tool does it. The card that
comes up when the mirror falls is where "that was a filter" gets said, with
another way to write it underneath. Doing it first and being told what it was
called afterwards is how it gets remembered; being told first turns every rung
into a quiz about a word.

**The hidden cases are where the traps are.** The worked examples are always
the easy shape. The fight underneath has the empty list, the zero, the list
of negatives, the value on the edge — because that is where code actually
breaks, and finding out by being hit by it is the lesson. The tests hold each
rung to this: `parts[0] || -1` must lose to `[0, 5]`, a biggest that starts
at 0 must lose to a list of negatives.

**Every rung's answer is run by the tests**, exactly as its last hint writes
it, against every case — and so is the other way its lesson shows. A rung
whose own answer did not pass would be unwinnable, and playing would only find
that by someone getting stuck on a correct solution.

## Running what was typed

In a worker, built from a blob so it travels with the page. The player's code
is written into that blob as the body of a function, rather than handed to
`new Function`, and that is entirely for line numbers: a syntax error from
`new Function` says what is wrong and never where, while one in a worker's
own script comes back with its line, and so does the stack of anything that
throws. The line is marked in the gutter.

It runs in strict mode, because TypeScript does. Assigning to a name that was
never declared quietly makes a global in sloppy JavaScript and is an error
everywhere TypeScript is used, so a misspelt variable would pass here and fail
for real.

Two things make that enough. The only code it ever runs is code typed by the
person at the keyboard — never from a URL, a file or anyone else — so it can do
nothing they could not already do in the console. And `while (true)` is a thing
beginners write constantly: on the main thread it kills the tab with no way
back, and in a worker it costs one submit, because a terminated worker is
simply gone. Measured at **1010 ms to recover, page alive**.

An answer can be anything JSON could carry — a number, a string, a boolean, a
list, a record. Anything else — `undefined`, `NaN`, a `Set`, a function —
counts as a miss, and what the player is told about it is the point:

- **nothing came back**: with no `return` in the box, that is the mistake;
  with one there, what was returned was not there — an index one past the
  end, a property spelt wrong. Telling someone looking straight at their
  `return` that it is missing is how advice stops being read.
- **`NaN`**: nearly always a number added to `undefined`.
- **the wrong shape**: the signature is read for its return type, so a list
  where a number was promised is called what it is, in TypeScript's words —
  "the signature promises `number[]`, and this gave back `number`" — before
  anything is said about which number it was.

## The box is an editor

A textarea, transparent, laid over a `<pre>` that carries the colour. The
textarea does the typing, the selection and the undo; the `<pre>` underneath
is only drawn, letter for letter, which is why the highlighter's one rule is
that its pieces put back together are exactly its input. The signature is the
editor's first line and the closing brace its last, because that is what the
box is — the inside of a function.

Enter carries the indent and opens a block properly between braces; brackets
and quotes close themselves where that is wanted and step over where they are
already closed; Tab and Shift+Tab indent; Ctrl+/ turns lines off; and Ctrl+Z
works. That last one is not free: setting a textarea's value throws its undo
history away, so every edit goes in through `insertText`, the one way to put
text into a textarea that the browser's own undo knows about.

There is no completion and no type checking, and both are deliberate. Typing
out `parts.filter` is part of learning it, and type checking is a compiler.

## It is TypeScript above the box and JavaScript inside it

There is no type checking, and there will not be one here. `tsc` in the page
is a large runtime dependency and this shelf has none.

What there is instead is a reader for the signature, `src/types.ts`, which
understands the types the ladder uses — unions, literals, tuples, optional
fields, records, generics, and an alias that mentions itself — and holds what
comes back to them. Narrowing, a discriminated union and `unknown` are all
checked at run time without a compiler, because narrowing *is* ordinary
JavaScript that TypeScript reads. A type the reader does not understand is
not checked at all, which is the safe way round: it never blames a right
answer.

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
| `src/levels.ts` | the ladder: chapters, briefs, examples, hidden cases, hints and lessons, in both languages |
| `src/game.ts` | the rules. Pure, and it never runs anything — it takes the results of a run and decides what they do |
| `src/values.ts` | what an answer can be: cleaning, comparing, showing, and its type in TypeScript's words |
| `src/types.ts` | reading the signature: parameter names, the head line, and the return type as a promise to check |
| `src/runner.ts` | the worker, the blob and the timeout. The only part that executes anything |
| `src/advice.ts` | why an answer was wrong, and the line an error is on. String work only, so it is testable |
| `src/highlight.ts` | the colour under the code: a scanner, not a parser |
| `src/progress.ts` | what survives closing the tab, with the storage passed in so it can be tested |
| `src/beat.ts` | the timing of a blow, a topple and the end of a won run. No canvas, so it is testable |
| `src/editing.ts` | what makes the box an editor: indent, brackets, line counting. String work, so it is testable |
| `src/sound.ts` | every sound, made from oscillators and one noise buffer |
| `src/figure.ts` | the man, drawn in code. Drawn twice: the second is him, flipped and colder |
| `src/render.ts` | the fight. The only thing on the canvas |
| `src/main.ts` | the loop, the desk and the keyboard |

The split that matters is `game.ts` never executing anything. Running code
needs a worker and a clock and is therefore the browser's problem; the damage
model is not, so the whole of it plays out headlessly in the tests.

## Beating a rung is the only reward, so it is an event

It used to happen between two frames: the level advanced, the desk rebuilt
itself, and nothing said so. The mirror did not fall either — it lost blocks
off a bar and went on standing, so the thing you were fighting never actually
lost. And it was slow: four correct cases were four full blows with the desk
locked throughout, so a correct answer took over six seconds to report itself,
which reads as nothing having happened at all.

Clearing is its own state now. The mirror topples, the room brightens, and a
card names the rung you beat and the one coming next; you leave it by choosing
to. The first blow of a submit keeps its full beat and the hits after it are
quick, because they are all the same good news — but a miss always keeps its
beat, since the miss is the one carrying something to read.

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

The desk is locked while the blows play, so the fight finishing is not
optional. It used to be advanced only by animation frames, which meant a
backgrounded tab — or one throw inside the drawing, which stops the loop
scheduling the next frame — left the run stuck with nothing to press. A timer
drives it when frames are not arriving, and the drawing is wrapped so a fault
in it cannot take the run down.

Winning the whole run is the one ending that does not happen per rung. The
mirror does not get up again: it comes apart, the pieces go up and out of the
room, and he is left in it alone, arms up — the version of him that kept
getting it wrong is not coming back. Losing a rung keeps its own ending: he
topples, the light goes, and you get that rung again.

Sound is the other half of it, and this is the only game on the shelf with
nothing running underneath. The other three always have something happening.
Here you are thinking most of the time, and the silence is what makes a blow
land when it comes.

## Still to come

- The difficulty curve, which only playing can settle. Every rung is proved
  solvable and every trap proved to spring, by the tests; whether a rung is
  too easy or too hard where it sits is not something a test can say.
- The edge of what fits here. Everything that can be checked without a
  compiler is on the ladder. Asking the player to *write* types — an alias, an
  interface, an annotation — needs `tsc` in the page, and that is the point
  at which this stops being a shelf game.
- Whether this belongs on the shelf at all. It is here to find that out: if it
  gets replayed to practise rather than to play, it wants to be its own thing,
  with more languages and saved progress — and a Python runtime is ten
  megabytes of WebAssembly, which this shelf cannot have.
