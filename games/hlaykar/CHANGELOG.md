# Changelog — Hlaykar

Keep a Changelog, newest first.

## [0.4.0] — 2026-10-03

### Added

- An ending for each of the four ways a run can finish, played before the
  result card rather than behind it. Getting out is the long one: he steps off
  the rim, walks away across it and fades as daylight floods down the shaft he
  just climbed out of. The water closing over him sends up bubbles and keeps
  rising until there is nothing but water. A stone pinning him shakes the
  screen, throws a cloud of dust and darkens. Filling the shaft just puts the
  light out, from the rim downwards.
- `src/ending.ts`, which decides the shape of an ending over time and knows
  nothing about canvas, so the timing can be tested.
- A key already on its way down when the run ends no longer skips the ending.

### Changed

- Bubbles are drawn over the water rather than under it. Under it is where
  they are, and where the water washed them out completely.
- No row clearing, settled: a full row here is a flat row, a flat row is a
  floor he paces on, and clearing one would lower the stack and so lower him.
  The breaker is the release valve instead.

## [0.3.0] — 2026-10-03

### Added

- Dust and chips when a breaker goes off. Two things, because a breaking stone
  is two things: chips of the stone thrown out and falling, and dust that
  hangs and spreads and goes nowhere. Chips alone read as a firework and dust
  alone reads as smoke.
- The wreckage keeps settling through a pause and past the end of a run, which
  is the only thing in the game that outlives the run that made it.

### Changed

- The shatter event now carries the cells that went rather than a count of
  them, so the dust comes off the stones that actually broke.
- Chips are drawn a shade lighter than the stones they came off, because at
  the stones' own colour they vanished into the stack they were flying over.

## [0.2.0] — 2026-10-03

### Added

- Sound, synthesised at runtime with no audio file: stone on stone, his steps
  and the brighter note when one of them is a step up, the break, the fall,
  and an ending for each way to lose. A bed of filtered noise under all of it
  rises in pitch and volume with the water, so the thing chasing him is
  audible before it is close. `M` mutes.
- Two more ways to lose. A stone that lands on him when he is in a pit with
  walls on both sides pins him, because he can only be shoved somewhere he
  could have stepped; and filling the shaft to the rim ends the run, which
  also closes a hole where a stone with no room to spawn quietly vanished.
- Breakers: about one stone in ten comes apart instead of stacking, taking the
  top off the column it lands in and one off each neighbour. It is a digging
  tool rather than a tidying one — what it is for is knocking a two-high wall
  down to a step he can take — and it will drop him if you break the ground he
  is standing on.
- Swift stones, which come down about two and a half times as fast.
- Marks on the stones and on the next-stone preview, so what is coming can be
  planned for rather than reacted to. A breaker also shows exactly which
  stones it would take, from the same function that takes them.
- The run pauses when the page is hidden or loses focus, instead of drowning
  him while nobody is watching.

### Changed

- The water starts gentler and accelerates about four times harder. With three
  ways to lose, a flat rise meant a good player never saw the water at all.

## [0.1.0] — 2026-10-03

### Added

- The shaft: water rising under a man who cannot swim, and stones falling from
  the rim for you to build him a way out with.
- A climber who climbs by himself, steps up exactly one, never descends, and
  turns around at anything else — which is what makes the thing you are
  building a stair rather than a floor.
- A stone landing on him knocks him off his feet instead of carrying him, so
  the game cannot be beaten by dropping everything on his head.
- Four stones — single, bar, corner, square — with a quarter turn and a nudge
  off the wall, and a ghost showing where the one in the air will land.
- Water that holds off for five seconds and then quickens, drawn over the
  climber so being caught by it looks like being caught by it.
- A stick figure drawn entirely in code, written for this game: two-bone IK on
  the legs, arms swung from the shoulder, and both arms over his head while he
  hauls himself up a ledge.
- Title, pause and result screens in English and Burmese, wrapped to the
  screen — and shrunk first, because Burmese arrives as one unbreakable run.
- Keyboard and touch: drag to aim and let go to drop, tap to turn.
