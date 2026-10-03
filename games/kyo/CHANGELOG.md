# Changelog — Kyo

Keep a Changelog, newest first.

## [0.2.0] — 2026-10-03

### Added

- Sound, synthesised at runtime with no audio file: the catch, the rush of air
  when he lets go, the flat empty note of a throw that caught nothing, and an
  ending for each way a run can finish. A short rope catches higher than a long
  one, which is the only free way to hear how much swing you have just bought.
- Wind under all of it, driven by how fast he is going rather than by the
  clock. On a rope you cannot see your own speed and speed is the whole thing
  you are managing, so the wind is the instrument that reports it. Silent when
  he is still. `M` mutes.
- An ending for both ways a run finishes, played before the result card rather
  than behind it. Across, he sails on into light opening over the far side.
  Falling, the screen shakes, dust blooms where he hit and the gorge closes
  over him.
- `src/ending.ts`, which decides the shape of an ending over time and knows
  nothing about canvas, so the timing can be tested.
- A press already on its way down when he fell no longer skips the ending.

## [0.1.0] — 2026-10-03

### Added

- The gorge: one button, held to swing and released to fly, and a man who
  cannot climb and cannot stop.
- A rope solved as a position constraint rather than a spring, so it pulls and
  never pushes and cannot be made to explode. Physics on a fixed step whatever
  the frame rate, which is why a swing feels the same everywhere and why the
  headless balance runs are worth anything.
- A gorge that descends, because a rope only ever spends height and a level
  one is unplayable however well it is played.
- Anchors stocked ahead procedurally and forgotten behind, spreading further
  apart the further across he gets. The ones he could actually take are lit.
- A figure of his own, hanging from one hand, legs trailing by how fast he is
  going, tucked while he flies.
- Title, pause and result screens in English and Burmese, wrapped to the
  screen and shrunk first, because Burmese arrives as one unbreakable run.
- The run pauses when the page is hidden or loses focus.
