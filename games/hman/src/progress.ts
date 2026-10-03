/**
 * What survives closing the tab: which rungs are beaten, and what was written.
 *
 * Four rungs could be played in one sitting. Seventeen cannot, and a ladder
 * that put you back on the first rung every time the tab closed would only
 * ever be climbed to the point one evening reaches. So this keeps the rungs
 * beaten and the code in the box for each, in the browser's own storage —
 * nothing leaves the machine, and if storage is refused the game simply
 * forgets, as it always used to.
 *
 * Kept by rung id rather than by position, so a rung added in the middle of
 * the ladder later does not shift everyone's progress by one.
 *
 * No DOM: the page passes its storage in, which is what lets this be tested.
 */

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Progress {
  /** Ids of rungs that have been beaten, at least once. */
  readonly cleared: readonly string[];
  /** What was last in the box, per rung id. */
  readonly drafts: Readonly<Record<string, string>>;
}

export const KEY = 'kasar.hman.progress.v1';
const EMPTY: Progress = { cleared: [], drafts: {} };

/** Read it back, and never throw: anything odd in storage reads as a fresh start. */
export function readProgress(store: Store | null): Progress {
  if (store === null) return EMPTY;
  try {
    const raw = store.getItem(KEY);
    if (raw === null) return EMPTY;
    const data = JSON.parse(raw) as { cleared?: unknown; drafts?: unknown };
    const cleared = Array.isArray(data.cleared)
      ? data.cleared.filter((id): id is string => typeof id === 'string')
      : [];
    const drafts: Record<string, string> = {};
    if (typeof data.drafts === 'object' && data.drafts !== null) {
      for (const [id, text] of Object.entries(data.drafts)) {
        if (typeof text === 'string') drafts[id] = text;
      }
    }
    return { cleared, drafts };
  } catch {
    return EMPTY;
  }
}

export function writeProgress(store: Store | null, progress: Progress): void {
  if (store === null) return;
  try {
    store.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Full, or refused. Forgetting is the old behaviour, so it is a fine one.
  }
}

export function withCleared(progress: Progress, id: string): Progress {
  if (progress.cleared.includes(id)) return progress;
  return { ...progress, cleared: [...progress.cleared, id] };
}

export function withDraft(progress: Progress, id: string, text: string): Progress {
  return { ...progress, drafts: { ...progress.drafts, [id]: text } };
}

/**
 * Which rungs may be started from. The first always; after that, any rung up
 * to one past the furthest beaten. Playing them in order is the point of a
 * ladder, but being made to re-beat one to practise a later one is not.
 */
export function openUpTo(progress: Progress, ids: readonly string[]): number {
  let furthest = -1;
  ids.forEach((id, i) => {
    if (progress.cleared.includes(id)) furthest = i;
  });
  return Math.min(ids.length - 1, furthest + 1);
}

/** Where "carry on" goes: the first open rung not yet beaten, else the last. */
export function nextUnbeaten(progress: Progress, ids: readonly string[]): number {
  const open = openUpTo(progress, ids);
  for (let i = 0; i <= open; i += 1) {
    if (!progress.cleared.includes(ids[i] ?? '')) return i;
  }
  return open;
}
