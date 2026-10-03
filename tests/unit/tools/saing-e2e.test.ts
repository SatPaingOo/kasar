/**
 * How the end-to-end run tells that Saing was played right by ear — and that
 * what it listens for is still what the game plays. The harness keeps its own
 * copy of the pitches, the clapper, the keys and two things the page says,
 * because the tools may not import a game's browser code; these tests read
 * the game's source and hold the copies to it.
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CLAPPER, EAR, GLIDE, KEYS, PITCH, SAYS, judgeEar } from '../../../tools/lib/saing-e2e.ts';
import type { Heard } from '../../../tools/lib/saing-e2e.ts';

const SAING = join(resolve(fileURLToPath(new URL('../../..', import.meta.url))), 'games', 'saing', 'src');
const source = (file: string): Promise<string> => readFile(join(SAING, file), 'utf8');

describe('what the harness listens for', () => {
  it('is the pitches the drums are tuned to', async () => {
    const sound = await source('sound.ts');
    const list = /export const PITCH = \[([^\]]+)\]/.exec(sound)?.[1] ?? '';
    expect(list.split(',').map((n) => Number(n.trim()))).toEqual([...PITCH]);
  });

  it('is the glide a drum starts with, and the clapper', async () => {
    const sound = await source('sound.ts');
    expect(sound).toContain(`partial(when, f * ${GLIDE}, f,`);
    const wa = sound.slice(sound.indexOf('wa(when: number): void {'));
    expect(wa.slice(0, wa.indexOf('},'))).toMatch(
      new RegExp(`partial\\(when, ${CLAPPER}, \\d+, [\\d.]+, [^)]*'triangle'\\)`),
    );
  });

  it('presses the keys the circle takes', async () => {
    const circle = await source('circle.ts');
    const keys = /export const KEYS = \[([^\]]+)\]/.exec(circle)?.[1] ?? '';
    expect(keys.replace(/[\s',]/g, '')).toBe(KEYS);
  });

  it('knows what the page says, in both languages', async () => {
    const strings = await source('strings.ts');
    for (const words of [...SAYS.wrong, ...SAYS.joins]) expect(strings).toContain(`'${words}'`);
  });

  it('is a script that parses', () => {
    expect(() => new Function(EAR)).not.toThrow();
    expect(EAR).not.toContain('${');
  });
});

/** A first section played right but for the second phrase, and the drum that joins. */
const played: Heard = {
  calls: [
    [2, 0],
    [2, 0, 1],
    [2, 0, 1],
    [2, 0, 1, 2],
    [3, 3],
    [0, 1, 3],
  ],
  said: ['Ready', 'Wrong drum', 'Once more', 'A drum joins'],
  slips: [1, 0, 3],
  state: 'running',
};

const failed = (heard: Heard): string[] =>
  judgeEar(heard)
    .filter((v) => !v.ok)
    .map((v) => v.name);

describe('judging Saing by ear', () => {
  it('passes a run that went as it should', () => {
    expect(failed(played)).toEqual([]);
  });

  it('passes it in Burmese too', () => {
    expect(failed({ ...played, said: ['အသင့်', 'ပတ်မှားတယ်', 'နောက်တစ်ခါ', 'ပတ်တစ်လုံး ဝင်လာပြီ'] })).toEqual([]);
  });

  it('fails when the audio never ran, however the rest went', () => {
    expect(failed({ ...played, state: 'suspended' })).toEqual(['the circle plays its call on the audio clock']);
    expect(failed({ ...played, state: null })).toContain('the circle plays its call on the audio clock');
  });

  it('fails when nothing was heard at all, rather than passing for having nothing to judge', () => {
    expect(failed({ calls: [], said: [], slips: [], state: 'running' })).toHaveLength(5);
  });

  it('fails a kept phrase that was not followed by the same one grown', () => {
    const calls = [[2, 0], [1, 0, 1], ...played.calls.slice(2)];
    expect(failed({ ...played, calls })).toContain(
      'a phrase played back in time is kept: the next is the same with more on the end',
    );
  });

  it('fails a broken phrase that moved on instead of coming round again, or went unsaid', () => {
    const moved = [...played.calls.slice(0, 2), [2, 0, 1, 2], ...played.calls.slice(3)];
    const name = 'a wrong drum breaks it, says so, and the same phrase comes round again';
    expect(failed({ ...played, calls: moved })).toContain(name);
    expect(failed({ ...played, said: ['Ready', 'Once more', 'A drum joins'] })).toContain(name);
  });

  it('fails a join that never came, or brought no new phrase', () => {
    const name = 'a drum joins after the first section, sounds on its own, and leads a new phrase';
    expect(failed({ ...played, calls: played.calls.slice(0, 5) })).toContain(name);
    expect(failed({ ...played, calls: [...played.calls.slice(0, 5), [2, 0, 1, 2, 3]] })).toContain(name);
    expect(failed({ ...played, said: ['Ready', 'Wrong drum'] })).toContain(name);
  });
});
