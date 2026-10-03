/**
 * What survives closing the tab.
 *
 * Storage is the browser's and can be refused, full, or full of something
 * else entirely, so the rule is that reading it never throws and anything
 * odd reads as a fresh start.
 */

import { describe, expect, it } from 'vitest';

import {
  KEY,
  nextUnbeaten,
  openUpTo,
  readProgress,
  withCleared,
  withDraft,
  writeProgress,
} from '../../src/progress.js';
import type { Store } from '../../src/progress.js';

function memory(start: Record<string, string> = {}): Store & { data: Record<string, string> } {
  const data = { ...start };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const IDS = ['a', 'b', 'c', 'd'];

describe('reading it back', () => {
  it('round-trips what was written', () => {
    const store = memory();
    writeProgress(store, withDraft(withCleared({ cleared: [], drafts: {} }, 'a'), 'b', 'return 1;'));
    expect(readProgress(store)).toEqual({ cleared: ['a'], drafts: { b: 'return 1;' } });
  });

  it('reads nothing, rubbish or the wrong shape as a fresh start', () => {
    const fresh = { cleared: [], drafts: {} };
    expect(readProgress(null)).toEqual(fresh);
    expect(readProgress(memory())).toEqual(fresh);
    expect(readProgress(memory({ [KEY]: 'not json' }))).toEqual(fresh);
    expect(readProgress(memory({ [KEY]: '{"cleared": 3, "drafts": [1]}' }))).toEqual(fresh);
  });

  it('keeps what is good out of something half broken', () => {
    const store = memory({ [KEY]: '{"cleared": ["a", 4], "drafts": {"a": "x", "b": 5}}' });
    expect(readProgress(store)).toEqual({ cleared: ['a'], drafts: { a: 'x' } });
  });

  it('does not throw when storage refuses', () => {
    const refusing: Store = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(readProgress(refusing)).toEqual({ cleared: [], drafts: {} });
    expect(() => writeProgress(refusing, { cleared: ['a'], drafts: {} })).not.toThrow();
  });
});

describe('which rungs are open', () => {
  it('opens only the first to begin with', () => {
    expect(openUpTo({ cleared: [], drafts: {} }, IDS)).toBe(0);
  });

  it('opens one past the furthest beaten', () => {
    expect(openUpTo({ cleared: ['a', 'b'], drafts: {} }, IDS)).toBe(2);
    expect(openUpTo({ cleared: ['c'], drafts: {} }, IDS)).toBe(3);
  });

  it('never opens past the top', () => {
    expect(openUpTo({ cleared: IDS, drafts: {} }, IDS)).toBe(3);
  });

  it('carries on at the first one not yet beaten', () => {
    expect(nextUnbeaten({ cleared: ['a', 'b'], drafts: {} }, IDS)).toBe(2);
    expect(nextUnbeaten({ cleared: ['a', 'c'], drafts: {} }, IDS)).toBe(1);
  });

  it('counts a rung beaten once, however often it is beaten', () => {
    const once = withCleared({ cleared: [], drafts: {} }, 'a');
    expect(withCleared(once, 'a').cleared).toEqual(['a']);
  });
});
