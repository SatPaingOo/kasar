# Changelog — Hman

Keep a Changelog, newest first.

## [0.2.0] — 2026-10-03

### Changed

- You can see what happened. The first version threw two small figures at each
  other for a third of a second and showed nothing else, and it was impossible
  to tell who had hit whom or why — which is the only thing the game is for.
  A blow now carries the case it came from and holds it up after landing:
  `[6, 6, 1, 9] → 99 ✗` with what was needed underneath. The hold is the point;
  the swing was never the problem.
- The mirror is a row of blocks, one per case, and a hit takes one visibly. A
  life that goes is drawn going, broken rather than simply missing.
- A blow winds up, lands and holds, over about a second instead of a third of
  one. There is a flash at the point of contact, shards off it, and a shake
  that is harder when the blow is against you.
- The figures no longer stand in a T-pose. Their arms rested at about a
  hundred degrees above horizontal, so neither of them read as fighting; they
  hang now and come up into the strike.
- The eye moved out to the edge of the head. Centred and large it read as one
  eye in the middle of a face rather than as a man looking at something.

### Added

- Sound, synthesised at runtime: the connect, the duller and lower note of
  being hit, a buzz for code that threw, a block breaking, and an ending each
  way. No bed underneath — this game is silent while you think, which is most
  of the time, and the silence is what makes a blow land. A mute button.
- `src/beat.ts`, the timing of one blow, apart from the drawing so that the
  thing that was wrong is the thing under test.

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
