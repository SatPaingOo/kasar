# Changelog — Hman

Keep a Changelog, newest first.

## [0.1.0] — 2026-10-03

### Added

- The fight: a signature and two worked examples, you write the body, and what
  you return is what he does. Right lands on the mirror, wrong lands on him.
- Four rungs — a value, both ends, a choice, all of them — starting at the
  first thing that produces something visible rather than at "variable", which
  returns nothing and so cannot be drawn as a move.
- Hidden cases as the damage: each one that comes back right takes the mirror
  down one, and what is already down stays down, so a fix is not a fresh start.
  A submit with anything wrong costs one life however much was wrong.
- Hints that never block and never cost a life — being stuck with no way to
  ask is how someone stops playing a thing meant to teach them — but do cost
  score, and are counted on the result screen.
- The player's code runs in a worker built from a blob, with a timeout. An
  endless loop costs one submit instead of the tab: measured at 1010 ms to
  recover with the page alive.
- `src/advice.ts`, which names a type annotation in the box from the source
  rather than the error text. A declaration and a parameter produce two
  unrelated engine messages for the same mistake and neither mentions types.
- The man and the mirror: one figure drawn twice, the second flipped and in a
  colder ink, because that is what it is.
- A desk of real DOM under the canvas, since a canvas cannot take typing.
