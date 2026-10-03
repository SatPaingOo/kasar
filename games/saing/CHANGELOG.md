# Changelog — Saing

Keep a Changelog, newest first.

## [0.1.0] — 2026-10-03

### Added

- The circle: a pat waing of tuned drums with him cross-legged in the middle,
  and a piece of twenty-five phrases to play back by ear — the same drums, in
  the same order, in the same rhythm. Three lives.
- Phrases that grow by one beat a round, each the last one with something on
  the end, so there is only ever one new beat to learn. Six sections, from
  three drums at 80 bpm to eight at 110; every section opens with a drum
  joining at the top of the scale, played in the first phrase it is in.
- A judge that is strict about order and generous about timing, and learns
  how late this player strikes — so a phone, or Bluetooth headphones a fifth
  of a second behind, do not decide whether the piece can be finished. Knowing
  the notes but ignoring the rhythm still breaks on the second note.
- Music on the wall clock rather than on frames; the call scheduled ahead on
  the audio clock with the output's latency taken off; strikes judged by the
  moment the browser stamped them, with 50 ms of grace before a note is
  called missed.
- Drums, bell, clapper and gong synthesised at runtime, levels measured
  through an `OfflineAudioContext`, and a limiter on the output.
- Playable with the sound off — the drums light as the call plays them, the
  rim pulses on the beat, and a row of dots spells out the rhythm — and
  playable without looking: the clapper starts every call and every answer,
  and a live region says when a drum joins, why a phrase broke, and how the
  piece ended.
- Keys `A` to `K` (or `1` to `8`), low to high, left to right round the
  circle; on a touch screen every drum owns a whole wedge of it. A pause
  starts the phrase again from a count, at no cost. The best score is kept.
- Tests for the piece, the music, the judge, the lag and the circle, and the
  balance settled by bots over whole pieces.
