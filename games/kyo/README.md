# Kyo

**Status:** S1 Prototype · active · last reviewed 2026-10-03 · v0.1.0

ကြိုး — a rope.

A gorge, and a man crossing it on one. Hold the button and he is attached and
swinging; let go and the rope is gone and he carries whatever speed the swing
gave him. Press again and he throws a new rope at whatever is in reach ahead
and above.

So the whole game is **when to let go**. Early in the arc he goes up and slow;
late he goes out and fast and low. There is nothing else to decide and nothing
else to press.

**Deliberately not a third falling-things game.** Tazaung has you shooting what
comes down at you and Hlaykar has you stacking it, both in one column with a
threat rising from below. A third of those would have made the shelf a genre
rather than a shelf. Here nothing falls, he is going somewhere, and you are
holding one button instead of aiming or placing.

**Binding constraint:** one person, `$0`, no artist. Every pixel is drawn in
code — no sprite sheet, no image file, no runtime dependency.

## Running it

From the repository root:

```bash
npm run play
```

Then open `games/kyo/`.

## Playing it

| | |
|---|---|
| hold `␣` | swing |
| let go | fly |
| `P` | pause |

On a touch screen it is the same one button: hold anywhere, let go.

The rope always goes to the furthest anchor ahead that is within reach and
above him. There is nothing to aim.

## The gorge goes down, and that is not decoration

A rope only ever **spends** height. A pendulum keeps the energy it was given,
a swing turns height into speed and speed back into height, and nothing
anywhere puts any back. Measured on a level gorge — with the air resistance
taken out altogether, which made no difference — the best line still put him
on the floor inside seventy lengths.

So the gorge descends with him, a shade slower than he falls. Crossing it is a
descent he has to stay ahead of rather than a walk he has to not trip on, and
the floor falling away is why a shallow sink can be outrun and a dive cannot.

## Layout

| file | what it is |
|---|---|
| `src/game.ts` | the rules and the physics. Pure: no canvas, no DOM, no clock, randomness arrives as an argument |
| `src/figure.ts` | the man, drawn in code. His own figure — this game may not reach into the other two |
| `src/render.ts` | reads the game and paints it; decides the camera and nothing else |
| `src/strings.ts` | everything the player reads, in English and Burmese |
| `src/main.ts` | the loop, the canvas and the one button |
| `tests/unit/` | the rules, headlessly |

The rope is solved as a position constraint rather than as a spring: pull him
back onto the circle and take away the part of his velocity carrying him off
it. A spring needs tuning to stop it wobbling and a stiff one explodes; this
cannot do either. Physics runs on a fixed step whatever the frame rate, which
is both why the swing feels the same on any machine and why the headless
balance runs mean anything.

## Balance

Settled by simulation. Two bots play it headlessly: one that lets go climbing
and catches the next rope at the top of its arc, and one that presses at
random. At the committed numbers the careful bot gets across 11 times in 16 in
about 68 seconds, and the careless one never passes 44 of 1700.

Three things were measured rather than guessed, and all three were wrong at
first:

- **Letting go at the bottom of the swing loses.** It is the obvious move — he
  is fastest there — but he is also moving level, so the arc that follows only
  goes down, and every cycle ends lower than the last.
- **Throwing backwards is a trap.** The anchor in reach the instant after he
  lets go is always the one he just let go of. One eager press put him back
  where he was, and a run could loop there for six hundred seconds. The rope
  goes forwards only.
- **Reach has to span a gap from the bottom of a swing.** At 7.5 that was
  geometrically impossible and the only way across was to creep from anchor to
  anchor with no speed at all.

## Still to come

- Sound. There is none yet.
- An ending worth watching, for both ways a run can finish.
