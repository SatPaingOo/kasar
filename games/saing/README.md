# Saing

**Status:** S1 Prototype · active · last reviewed 2026-10-03 · v0.1.0

ဆိုင်း — the Burmese drum-and-gong ensemble, and the circle of tuned drums at
the heart of it, the pat waing.

He sits in the middle of the circle. The circle plays a phrase; you play it
back — the same drums, in the same order, in the same rhythm. Right, and the
music carries on into a phrase one beat longer. Wrong, and the music stumbles,
he loses one of three, and the same phrase comes round again.

Every phrase in a section is the one before it with one more beat on the end,
the way the old memory game grows by a note a round, so you only ever have to
learn the new beat. Every few phrases a drum joins the circle, the tempo
lifts, and a new phrase begins. Twenty-five phrases make the piece; three
minutes or so, played straight through.

**Deliberately not another game about getting somewhere.** Tazaung, Hlaykar
and Kyo are about where he gets to, and Hman is about writing. Here he never
moves from the middle of the circle, and the thing being played is the ear.

**Binding constraint:** one person, `$0`, no artist, no audio file. Every
pixel is drawn in code and every sound is synthesised at runtime — no sprite
sheet, no sample, no runtime dependency.

## Running it

From the repository root:

```bash
npm run play
```

Then open `games/saing/`.

## Playing it

| | |
|---|---|
| `A` `S` `D` `F` `G` `H` `J` `K` | the drums, low to high — or `1` to `8` |
| `P` or `Esc` | pause |
| `M` | mute |

The drums run left to right the way the keys do: the lowest at the front on
the left, round the back, to the highest at the front on the right. A drum
that joins is always the next one up, so a key never changes its drum.

On a touch screen, tap a drum — or anywhere on its side of the circle. Every
drum owns a whole wedge of the screen out to the edge, so a tap does not have
to land on a drum head, only on the right side of it. A tap on him, in the
middle, strikes nothing.

Anything struck while the circle is playing is free: playing along with the
call is how you learn it.

## Order strictly, timing generously

A strike on the wrong drum breaks the phrase whenever it lands. A strike on
the right drum counts if it lands most of the way towards the notes either
side of it, and how near the beat it was only decides the points — on the
beat, close, or loose.

That balance is on purpose. A phone answers a tap 50 to 100 ms late, and
Bluetooth headphones play the call a fifth of a second late, so a judge as
strict about timing as it is about order would be judging the hardware. It
also **learns the lag**: it keeps a running guess at how late this player
strikes, moves it a quarter of the way towards each strike it accepts, and
judges the next one around the beat as they hear it. A steady player who is
steadily late is a steady player. The guess stays between 50 ms early and
250 ms late.

What the rhythm still has to be: right. A player who knows every note but
plays them as fast as they can, the way the old memory game lets you, breaks
on the second note every time.

## The clock

This is the one game here where sound is the game rather than dressing on it,
and that changed how time is kept.

- **The music runs on the wall clock, not on frames.** A slow frame must not
  slow the music down, so the game's time is the wall clock less any time
  spent paused, and a strike is judged by the moment the browser stamped it —
  not by the frame it was handed over on, which can be one later.
- **The call is scheduled ahead, on the audio clock.** The rules hand over
  every cue a little before it is due, and the ear schedules each one at its
  exact time. Played when a frame came round, a rhythm would be sixteen
  milliseconds uneven, and the player would be marked down for copying it.
- **The output's latency is taken off**, so the call is heard at the moment
  the drum lights and the moment it is judged against.
- A note is not called missed until 50 ms after its window shuts, because a
  strike that landed in time can arrive a frame late.
- After a pause the phrase starts again from a count of bells, at no cost.
  The pulse the player was holding is gone, and it would be unfair to ask
  them to pick it up mid-phrase.

## Playable with the sound off

Everything the ear is told, the eye is told too. The drums light as the call
plays them. The flame points round the rim brighten on every beat, and most
on the first beat of a phrase, where the clapper sounds. A row of dots under
the circle spells the rhythm out — one per note, spaced by when it falls, lit
as the call plays it and filled as you play it back — saying how many notes
and how they sit against the beat, never which drum.

And the other way: the clapper marks the start of every call and every
answer, so the game is playable by ear without looking. A live region says
when a drum joins, when a phrase broke and why, and how the piece ended. It
says nothing during the call or the answer, because a voice over the drums
would hide what it was announcing.

## Layout

| file | what it is |
|---|---|
| `src/game.ts` | the rules: the piece, the spans of music, the judge. Pure — no audio, no canvas, no clock; time and randomness arrive as arguments |
| `src/circle.ts` | where the drums sit and which one a tap or a key means. Apart from the drawing so it can be tested, because a tap read as the wrong drum breaks the phrase |
| `src/sound.ts` | the drums, the bell, the clapper and the gong, synthesised; and the scheduling onto the audio clock |
| `src/figure.ts` | the man in the middle, drawn in code. His own figure — this game may not reach into the others |
| `src/render.ts` | reads the game and paints it |
| `src/strings.ts` | everything the player reads, in English and Burmese |
| `src/main.ts` | the clock, the input, the loop |
| `tests/unit/` | the rules and the circle, headlessly, and the balance by bots |

The music is a list of **spans** — a count, a call, an answer, a breath after
a break, a drum joining — each a number of beats at one tempo. They are
decided ahead as far as they can be: a call is always decided with its
answer, and what follows an answer is decided the moment it is kept or
broken, which is always well over a beat before it is due. The ear asks for
the cues up to a little ahead of now, and each span remembers how far it has
been heard, so nothing is handed over twice.

## Balance

Settled by simulation. Bots play whole pieces headlessly against the real
rules on a simulated clock, with a pair of made-up hands: how late they
strike, and how much a strike wanders. Over 64 pieces:

| hands | finished | |
|---|---|---|
| at a desk, 10 ms late, ±30 ms | 64 / 64 | |
| on a phone, 90 ms late, ±40 ms | 64 / 64 | the lag is learned |
| Bluetooth, 220 ms late, ±40 ms | 64 / 64 | and so is this |
| shaky, ±80 ms | 47 / 64 | |
| all over the place, ±120 ms | 2 / 64 | keeps 13 phrases on average |
| remembers 5 notes, +2 each time round | 0 / 64 | keeps 12 on average |
| remembers 7, +2 | 2 / 64 | keeps 20 |
| remembers 9, +2 | 63 / 64 | |
| strikes at random | — | never keeps more than one phrase |
| knows the notes, ignores the rhythm | — | never keeps one |

So the hardware does not decide whether you finish; a loose rhythm and a short
memory do. The last phrases run to ten notes over eight beats, and the
memory, not the hands, is what the end of the piece is testing.
`tests/unit/balance.test.ts` asserts the same over 24 pieces.

## Sound

The drums are tuned to G A B D E over an octave and a half. A five-note scale
has no two notes that clash, so every phrase the game makes up is a tune —
low enough to sound like drums, high enough that a phone speaker still has
something to play. Each is a fundamental that drops a shade as the head
settles, two harmonics over it, a little of the head's own inharmonic ring,
and the slap of a palm; the low drums are bigger and ring longer. The bell
and the clapper keep the time, as the si and the wa do in a saing ensemble.

Levels were measured rather than set by ear: each voice renders alone
through an `OfflineAudioContext` and its peak comes off the buffer. The first
pass had the drums at 0.8 to 0.9 and the bell at 0.33 — a pulse that loud
competes with the phrase it is keeping time for. Now the drums peak at 0.47
to 0.54, the bell at 0.13, the clapper at 0.20, the stumble at 0.45 and the
gong at 0.25. The busiest moment the game makes — two drums on a beat with
the bell, the clapper and the gong, and a third drum half a beat later — sums
to 1.03 and comes out of the limiter at 0.76; the run up every drum at the
end comes out at 0.91.

## End to end

`npm run e2e` plays it by ear in Firefox and Chrome: a script in the page
listens to the audio graph and plays each call back by key, through the
first section with one phrase wrong on purpose and the drum that joins. The
same harness played the whole piece through once by hand, all twenty-five
phrases, every strike on the beat. See the shelf's README.

## Still to come

- Played on a real phone, and an iPhone in particular, where the audio
  context and touch timing are the least like a desktop's.
