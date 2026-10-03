/**
 * Running what the player wrote, without being able to be hurt by it.
 *
 * Two things make this safe enough. The first is that the only code it ever
 * runs is code typed by the person at the keyboard — never from a URL, a file
 * or anybody else — so it can do nothing they could not already do in the
 * console. The second is the worker: `while (true)` is a thing beginners write
 * constantly, and on the main thread it kills the tab with no way back. In a
 * worker it costs one submit, because the worker can be terminated and a
 * terminated worker is simply gone.
 *
 * The worker is built from a blob rather than a file so that it travels with
 * the page and needs nothing served alongside it.
 */

import type { RunResult } from './game.js';
import type { Case } from './levels.js';

/** How long the code gets before it is assumed to be in a loop. */
export const PATIENCE = 1000;

const WORKER = `
self.onmessage = (event) => {
  const { source, inputs } = event.data;
  let fn;
  try {
    fn = new Function('parts', source);
  } catch (err) {
    self.postMessage({ fatal: String(err && err.message ? err.message : err) });
    return;
  }
  const results = inputs.map((parts) => {
    try {
      const value = fn(parts);
      return { value: value === undefined ? null : value, error: null };
    } catch (err) {
      return { value: null, error: String(err && err.message ? err.message : err) };
    }
  });
  self.postMessage({ results });
};
`;

export interface RunOutcome {
  readonly results: readonly RunResult[];
  /** Set when nothing ran at all: a syntax error, or a loop that never ended. */
  readonly fatal: string | null;
}

/**
 * Only values the rules can compare survive. Anything else — an object, a
 * function, a list of lists — comes back as null and counts as a miss, which
 * is both safe and the honest answer to "that is not what was asked for".
 */
function clean(value: unknown): number | number[] | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    const list: number[] = [];
    for (const item of value) {
      if (typeof item !== 'number' || !Number.isFinite(item)) return null;
      list.push(item);
    }
    return list;
  }
  return null;
}

export async function run(source: string, cases: readonly Case[]): Promise<RunOutcome> {
  const blob = new Blob([WORKER], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);

  try {
    return await new Promise<RunOutcome>((resolve) => {
      const timer = window.setTimeout(() => {
        worker.terminate();
        resolve({ results: [], fatal: 'timeout' });
      }, PATIENCE);

      worker.onmessage = (event: MessageEvent): void => {
        window.clearTimeout(timer);
        const data = event.data as {
          fatal?: string;
          results?: readonly { value: unknown; error: string | null }[];
        };
        if (typeof data.fatal === 'string') {
          resolve({ results: [], fatal: data.fatal });
          return;
        }
        const results = (data.results ?? []).map((one) => ({
          value: clean(one.value),
          error: one.error,
        }));
        resolve({ results, fatal: null });
      };

      worker.onerror = (): void => {
        window.clearTimeout(timer);
        resolve({ results: [], fatal: 'the code could not be started' });
      };

      worker.postMessage({ source, inputs: cases.map((one) => [...one.parts]) });
    });
  } finally {
    worker.terminate();
    URL.revokeObjectURL(url);
  }
}
