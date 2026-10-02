# Hlaykar

**Status:** S1 Prototype · active · last reviewed 2026-10-03 · v0.2.0

လှေကား — a stair.

Water is rising in a shaft and a man is standing at the bottom of it who cannot
swim. Stones fall from the rim. You decide where each one lands; he decides
where he goes, and he only ever goes up. He can step up exactly one, never
down, and at anything else he turns around and walks the other way.

That rule is the whole game. A flat wall is no use to him and a two-high step
is a wall, so what you are building is not a floor but a stair, and you are
building it ahead of a man who is already walking. There are no rows to clear
here. The water is the clock.

**Binding constraint:** one person, `$0`, no artist. Every pixel is drawn in
code — no sprite sheet, no image file, no audio file, no runtime dependency.
That is the reason for a stick figure and for procedural animation, and it is
the first thing to defend when the scope starts to grow.

## Running it

From the repository root:

```bash
npm run play
```

Then open `games/hlaykar/`. `npm run build` compiles this folder with its own
`tsconfig.json`; nothing here is shared with the shelf or with another game.

## Playing it

| | |
|---|---|
| `←` `→` | move the stone |
| `↑` / `Z` | turn it |
| `↓` | hurry it down |
| `space` | drop it |
| `P` | pause |
| `M` | mute |

On a touch screen: drag to aim, let go to drop, tap without dragging to turn.

Dropping a stone on his head does not lift him — it knocks him off his feet,
and that is deliberate. Without it the whole game would be a one-wide tower.
He can only be shoved somewhere he could have stepped, so a stone dropped on a
man standing in a pit pins him and ends the run.

Three ways to lose: the water reaches him, a stone pins him, or the shaft
fills to the rim.

Stones are marked. A **breaker** comes apart instead of stacking and takes the
top off the column it lands in and one off each neighbour — it is for knocking
a two-high wall down to a step he can take, and it will drop him if you break
the ground under his feet. It shows you exactly which stones it will take
before it lands. A **swift** stone comes down two and a half times as fast.
Both are named on the next-stone preview as well as on the stone itself.

## Layout

| file | what it is |
|---|---|
| `src/game.ts` | the rules. Pure: no canvas, no DOM, no clock, and randomness arrives as an argument |
| `src/climber.ts` | the man, drawn in code. His own figure — this game may not reach into Tazaung's or the shelf's |
| `src/render.ts` | reads the game and paints it; decides the layout and nothing else |
| `src/strings.ts` | everything the player reads, in English and Burmese |
| `src/sound.ts` | every sound, made from oscillators and one noise buffer |
| `src/main.ts` | the loop, the canvas and the input. The only file that knows this is a browser |
| `tests/unit/` | the rules, headlessly |

## Balance

The numbers in `RULES` were settled by simulation rather than by feel: two bots
play it headlessly, one choosing the placement that gets the climber highest
and one dropping wherever. At the committed numbers the careful bot gets out of
the shaft 14 times in 16 and the careless bot twice; the careless runs end
drowned, the careful ones that fail end buried. A version where stones arrived
every 0.18s had the careful bot out in nine seconds and the careless one out a
quarter of the time — the water was never the clock, the stone supply was, and
it was set far too generous.

The bot had to be taught the new ways to lose before it was worth tuning
against again: left alone it piled itself to the rim, which made the game look
harder than it is rather than showing where the difficulty actually sits.

Sound levels were measured the same way rather than chosen by ear. Each cue is
rendered on its own through an `OfflineAudioContext` and its peak read off the
buffer. The first set, picked by eye, put the step cue at 0.016 and the move
cue at 0.029 — inaudible. Everything now lands above 0.05, and all thirteen
cues fired on the same frame peak at 0.917, under the limiter's ceiling.

## Still to come

- An ending worth watching when he gets over the rim.
- Dust and debris when a breaker goes off. The sound carries it for now, but
  the stones simply vanish.
