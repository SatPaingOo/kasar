# Changelog — Hman

Keep a Changelog, newest first.

## [0.4.1] — 2026-10-03

### Fixed

- Nothing happened when you were right. The blows played, the mirror's blocks
  emptied, the status line said so — and then the mirror stayed standing, no
  card came, and the rung never changed.

  A race between the worker and the loop. `busy` was set before awaiting the
  player's code, and the loop reads an empty queue plus `busy` as "the fight
  has finished" — so in the gap between pressing Strike and the code coming
  back, the loop decided the fight was over, released the desk and went past
  the moment where clearing a rung is noticed. By the time the real result
  arrived the loop had already finished with it.

  It came down to who got there first. At sixty frames a second the loop
  always wins, which is why it never worked for a player. In a throttled page
  the worker usually wins, which is why every test here kept passing — the
  tests were run in a page that was not drawing.

## [0.4.0] — 2026-10-03

### Fixed

- Beating a rung did not feel like beating a rung, and often did not look like
  anything at all. Three things were wrong at once.

  Clearing moved straight on to the next rung, quietly, between two frames —
  so the desk changed and nothing announced it. Clearing is its own state now:
  the mirror topples, the room brightens, and a card says which rung was
  beaten and which one is next. You leave it by choosing to.

  The mirror never fell. It lost blocks off a bar and went on standing there,
  so the thing you were fighting never actually lost. It goes over now.

  And it was slow. Four correct cases were four full blows at 0.8s each with
  the desk locked throughout, then a 1.5s topple — a correct answer took over
  six seconds to say so, measured, which reads as nothing having happened. The
  first blow of a submit keeps its beat and the hits after it are quick; a
  miss always keeps its beat, because the miss is the one you have to read.

### Added

- A real editor rather than a bare textarea: line numbers down the side, Tab
  and Shift-Tab to indent, Enter carrying the indent down and going a level
  deeper after an opening bracket, brackets and quotes closing themselves, and
  Backspace taking both halves of an empty pair. All of it in `src/editing.ts`
  as string work, so every one of those can be tested — each is obviously
  right until it eats somebody's code.

## [0.3.0] — 2026-10-03

### Changed

- Lives belong to the rung you are on, not to the whole run. Five across four
  rungs sounds generous and is not: someone relearning a language tries
  things, so the run kept ending and restarting at the first rung and the
  later ones were never reached at all. Going down now costs that rung and
  nothing else — what is cleared below stays cleared, and you are put back at
  the top of the one that beat you.
- Only the hits and the *first* miss are played out. Four identical failures
  in a row told the player nothing the first had not, and nothing could be
  pressed while they played: a fully wrong submit took about six seconds of
  being unable to touch the thing you were trying to fix. It takes 1.3 now.
- A blow is 0.8s rather than 1.05s, and the fight can be skipped by clicking
  it or pressing Escape.
- The lives row drew five marks whatever the rule said. It draws the real
  number.

### Added

- He goes down. A run that ends with the figure quietly replaced by a card
  never says that it was *him* who lost, so he topples — slow off the mark and
  then all at once — the light goes out of the room, and only then does the
  card come up, offering that rung again rather than the whole run.

## [0.2.1] — 2026-10-03

### Fixed

- The run got stuck after the first answer, right or wrong, with the Strike
  button disabled and nothing left to press.

  The desk is locked while the blows play, and the blows were advanced only by
  animation frames — so progress depended entirely on frames arriving. A
  backgrounded tab stops them, and a single throw inside the drawing stops
  them for good, because the loop schedules the next frame at the end and a
  throw means it never gets there.

  The step is out of the frame callback now and a timer drives it when frames
  are not coming, so the fight always finishes and the desk always comes back.
  The drawing is wrapped as well: a drawing fault reports itself once and the
  run carries on without it.

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
