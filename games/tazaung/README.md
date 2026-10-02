# Tazaung

**Status:** S0 Sketch · active · last reviewed 2026-10-02

The sky used to be full of lights. They are going out one by one and falling as
cold husks. A wizard holding the last lit lantern relights what he can with his
wand — but the spark comes out of his own lantern, so every rescue costs him
light, and every husk he misses lands and piles up around him, draining what is
left. He cannot win: lights go out faster than one person can relight them. The
question is only how long he keeps his lantern burning, and how much of the sky
he puts back before it goes out. The lights he saved stay up there, and at the
end they are the only score shown.

**Binding constraint:** one person, `$0`, no artist. Every pixel is drawn in
code — no sprite sheet, no image file, no audio file, no runtime dependency.
That is the reason for a stick figure and for procedural animation, and it is
the first thing to defend when the scope starts to grow.

## Running it

This game lives on the Kasar shelf, and the shelf owns the build:

```bash
cd ../..          # the repository root
npm install
npm run play      # build everything, then serve on http://localhost:5190
```

The game is then at <http://localhost:5190/games/tazaung/>. To rebuild only
this game while working on it:

```bash
npx tsc -p games/tazaung/tsconfig.json --watch
```

A server is needed because browsers refuse ES modules over `file://`.

## Controls

| | |
|---|---|
| `←` `→` or `A` `D` | move between columns |
| `Space`, `↑` or `W` | relight (hold to keep firing) |
| `R` | restart |
| `M` | mute |
| `L` | switch language |
| `P` or `Esc` | pause |
| tap / drag | aim at a column and fire; tap again to restart |

## How it works

The wand's spark hits the **first thing in its column**, so a pile shields the
sky above it — a column left to grow stops answering. Relighting a husk in the
pile spreads to everything touching it, and the whole cluster lifts off at once
while the pile collapses into the gap. That is the only way to get a large
amount of light back, and it is also the move that leaves the rest of the sky
unattended.

The board is 8 columns by 13 rows, and the night is 240 seconds long.

**Keep the lantern lit until sunrise and you win.** The sky is the clock —
dusk, deep night, the turn, first light, sunrise — so how far through you are
is readable without being told. Making the game winnable was the fix for its
worst problem: with no finish line, every level of play drowned at the same
wall around 3.5 minutes and skill moved the result by about six percent.

| | effect on the lantern |
|---|---|
| each spark fired | small cost |
| the lantern simply burning | small continuous cost |
| each husk sitting in the pile | continuous drain, scaled by how many |
| husk relit in the air | gain, a little more than the spark cost |
| cluster lifted out of the pile | **cost per husk** — see below |

A chain pays no light. Its reward is the drain it removes and the lane it
reopens, and it is charged for every husk it wakes. Anything cheaper made
failure profitable: one spark cleared a cluster of any size, so the worse the
pile got the bigger the rescue, and in simulation a careless player outlived a
careful one by 655s to 399s. A cluster large enough can take the last of the
lantern with it.

Difficulty runs on elapsed time, not on spawn count — ramping per spawn
compounds and runs away inside a minute. The spawn rate passes the wand's own
`1/fireDelay` ceiling at almost exactly the moment the sun comes up, so the
last stretch of the night is the hardest part of the game.

## Motes

The small stuff, all of it circles with a velocity and a life, warm ones drawn
additively: a relit light comes apart into drifting sparks instead of
vanishing, a husk landing throws cold dust that falls, a cluster lifting off
trails its way up, each boon bursts in its own colour, and the wand sheds a
few sparks as it fires. A landing knocks the view a little and a big chain
shoves it, with the sky drawn outside the shake so no gap shows at the edge.

The array is capped at 420 and the oldest are dropped, so a twenty-husk chain
on a slow machine costs a bounded amount of work.

The motes made a standing problem obvious: the wizard stands inside his own
lantern light, so choosing his ink from the sky alone is not enough — against
a bright glow a light figure disappears, and against the night a dark one
does. He is now drawn twice, a wider stroke in the opposite colour under the
real one, which also keeps him readable under a burst.

## Pause

`P`, `Esc`, or losing focus. It is a real phase rather than a flag in the
loop, so the scroll and the audio agree with it without being told separately:
the clock stops because `step` already returns early for anything that is not
`playing`, and the drone falls silent for the same reason.

Going away pauses; coming back never un-pauses on its own.

## The scroll

The game has one interface and it is the same object three times: the title
before the night, and the result after it either way. It unrolls — two rolled
ends slide apart, the paper sags between them, the words fade in once it has
opened — and it is drawn in the same ink and line weight as the wizard. A
parchment texture was the obvious thing to reach for and would have been the
first element in the game that is neither line art nor sky.

The intro doubles as the gesture the browser needs before any audio can exist,
so nothing has to ask for permission.

The endings are watched, not announced. When the lantern goes out he sits down
— the wand comes to rest across his lap, the lantern gutters out, and the
lights he returned stay in the sky above him — and only after a beat of that
does the scroll open. At sunrise he stands and holds the lantern out to it.

Words are the only ones in the game: a title, one line of purpose and the two
results, in `en` and `my` (canon 04/06). Burmese needs a font that has it, so
the stack asks for Myanmar Text, Noto Sans Myanmar and Padauk before falling
back.

## The five lights that never went out

About one husk in thirteen is still burning. What kind of light it was decides
what catching it does — one extra field on a husk, not a new system. Each has
its own silhouette (shape first, colour second, so they read in the dark), its
own sound, and a visible effect on the board rather than an icon in a corner.

| | mark | what it does | while it runs |
|---|---|---|---|
| **ember** | flame | the wand runs hot, firing at 2.4× for 5s | the wand tip sheds sparks |
| **beacon** | lens with rays | one free spark up every column at once | — |
| **hush** | concentric rings | the whole sky falls at 42% speed for 6s | rings sweep across the sky |
| **bloom** | six-point star | the entire pile lights and lifts off, free | — |
| **ward** | hexagon | nothing drains the lantern for 8s | glass around the lantern |

They are a temptation, not a reward. In simulation a bot that chased every one
died at 213s while the same bot ignoring them reached sunrise — crossing the
board costs more than the boon is worth unless it is on your way.

## Sound

Synthesised at runtime: oscillators, envelopes and one noise buffer. No audio
file, for the same reason there is no sprite sheet. Two detuned oscillators
beat against each other as the lantern's drone, and its gain and pitch follow
the light, so the world goes quiet as it goes dark and silence is the ending.
Browsers refuse audio before a real gesture, so nothing is built until the
first key or tap. `M` mutes.

The mix was **measured, not guessed**: the master gain was tapped with an
analyser while playing. The first version peaked at 0.065 across the whole
game — about eight times too quiet, with shots sitting *below* the drone and
`landed`, the one sound that means you failed, at 0.074 and inaudible under it.

Peaks now, post-master:

| | peak | |
|---|---|---|
| drone | 0.061 | the bed |
| shot | 0.112 | fires up to 7/s, so it stays under everything |
| landed | 0.207 | failure has to be felt |
| relit | 0.264 | the main positive feedback |
| chain ×6 | 0.398 | |
| sunrise | 0.646 | loudest thing in the game |

`land` carries a much larger level than the rest (1.3) because `thud` is a
lowpassed noise burst and loses most of it in the filter.

A `DynamicsCompressor` on the output acts as a limiter (−6 dB, ratio 20). The
worst simultaneous case — an 8-chain, three relights, a shot, a landing and a
bloom on one frame — measures 1.15 before it and 0.831 after, with 4 dB of
reduction and no clipping.

## Two things that bite in an embedded pane

Both were found while chasing a reported sound problem that turned out not to
be one, and neither is about audio.

**Frames can stop while the page still calls itself visible.** A pane that is
not painting delivers no animation frames, `visibilityState` says `visible`
throughout, and the loop never reschedules — the game freezes for good. Since
every sound cue is emitted from that loop, the first symptom is silence, not
stillness. A timer checks every 500 ms and steps the game itself once frames
have been missing for a second, so it degrades to a few frames a second
instead of stopping.

**The canvas resizes without the window.** Listening only to `window.resize`
left the backing store stale whenever the pane changed size, and the whole
scene rendered stretched and cropped. A `ResizeObserver` on the canvas fixes
it.

The audio graph also now resumes on creation and on `statechange`: it is built
inside a gesture but can still come up suspended, and the old code only
resumed on a *later* unlock.

## Layout

```text
index.html         canvas + the page
src/game.ts        rules — pure, no canvas, no DOM, injectable random
src/character.ts   the wizard: skeleton, two-bone IK, pendulum, poses
src/render.ts      canvas drawing — reads state, decides nothing
src/scroll.ts      the title and result scroll, unrolling
src/sound.ts       every cue, synthesised; no audio file
src/strings.ts     the few words there are, en + my
src/main.ts        fixed-timestep loop, input, resize
tools/serve.ts     dev-only static server
```

## Look

The scene starts at dusk, readable, and darkens only as the lantern fails.
Starting at night hid the game: the player could not see what was falling, and
losing light meant nothing because there was none to lose.

The wizard is a stick figure drawn entirely in code — joints, lines, two
circles and a triangle. Animation is three things: an idle wave, poses eased
toward a target, and two-bone IK so a hand is told where to go and the elbow
works itself out. The lantern hangs on a damped pendulum and the hat tip trails
the head; that secondary motion is six lines and does most of the work.

Posture reads the lantern directly — standing tall at full light, stooping as
it fails, folded over it at the end. A faint beam marks the lane the wand is
pointing at and stops on whatever the spark would actually hit, because the
rule that a spark stops at the first thing in its column is otherwise
invisible.

## Stage notes

S0 per [canon 02](../SPO/02-PROJECT-LIFECYCLE.md): no git, no CI, no licence,
no test harness. `typecheck` is the only check wired up; `lint`, `format` and
`test` arrive with S2, as does `git init`.

Two deliberate deviations from `SPO/tsconfig.base.json`, both because this runs
in a browser rather than Node: `lib` includes `DOM`, and `types` is empty
instead of `["node"]`. `tools/` is outside `include`, so the dev server is not
typechecked until `@types/node` arrives at S2.

`spo done` cannot run here: it checks a change and git records it, and S0 has
no git. `npm run typecheck` is the check that exists until S2.

### Not built yet

- **Juice.** Husks should dissolve into drifting motes rather than vanish, and
  a chain should visibly lift off as one cluster.
- **A pause.** There is no way to stop a run part way.
- **Sound character.** Levels are measured and balanced, but nobody has
  judged whether the cues actually *sound* good — only how loud they are.
- **Balance by feel.** The numbers below come from bots, not from playing.

### Where the balance stands

Simulated, not played. `idle` does nothing; `spam` fires blindly; the rest
pick targets with varying reaction time and accuracy.

| run | outcome | lights returned |
|---|---|---|
| idle | dark at 26s | 0 |
| spam one column | dark at 15s | 3 |
| beginner | dark at 222s | 944 |
| decent | **sunrise** | 1153 |
| expert, ignores boons | **sunrise** | 1177 |
| expert, chases every boon | dark at 213s | 845 |

Figure-against-sky contrast was sampled from the canvas across a whole
compressed night and stays between 0.31 and 0.61. Ink is picked for contrast
against the sky actually behind the wizard rather than on elapsed time, which
had left him at luminance 55 on a sky of about the same.
