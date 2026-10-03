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
 * the page and needs nothing served alongside it — and the player's code is
 * written *into* that blob as a function, rather than handed to
 * `new Function`. That is what gets a line number out of a mistake. A syntax
 * error from `new Function` says what is wrong and never where; one in a
 * worker's own script comes back with the line it is on, and so does the
 * stack of anything that throws while running.
 */

import type { RunResult } from './game.js';
import type { Case } from './levels.js';
import { lineOf } from './advice.js';
import { inspect } from './values.js';

/** How long the code gets before it is assumed to be in a loop. */
export const PATIENCE = 1000;

/**
 * Lines of the script above the player's first one. The body starts on line
 * three: `"use strict";`, then the line that opens the function.
 */
export const ABOVE = 2;

/**
 * Strict, because TypeScript is. Assigning to a name that was never declared
 * is a mistake TypeScript refuses outright, and in sloppy JavaScript it
 * quietly makes a global and carries on — so a typo in a variable's name
 * would pass here and fail everywhere else.
 */
function script(params: readonly string[], source: string): string {
  return `"use strict";
const strike = function (${params.join(', ')}) {
${source}
};
self.onmessage = (event) => {
  const results = event.data.map((args) => {
    try {
      const value = strike(...args);
      try {
        structuredClone(value);
        return { value, error: null, stack: null, odd: null };
      } catch {
        return { value: null, error: null, stack: null, odd: typeof value };
      }
    } catch (err) {
      const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
      const stack = err && typeof err === 'object' && 'stack' in err ? String(err.stack) : '';
      return { value: null, error: message, stack, odd: null };
    }
  });
  self.postMessage(results);
};
`;
}

export interface RunOutcome {
  readonly results: readonly RunResult[];
  /** Set when nothing ran at all: a syntax error, or a loop that never ended. */
  readonly fatal: string | null;
  /** The line of the box a fatal error is on, when the engine says. */
  readonly line: number | null;
}

interface Posted {
  readonly value: unknown;
  readonly error: string | null;
  readonly stack: string | null;
  /** What it was, when it could not be sent back at all. */
  readonly odd: string | null;
}

/** "Uncaught SyntaxError: …" is the engine talking to itself. */
const tidy = (message: string): string => message.replace(/^Uncaught\s+/, '');

export async function run(source: string, params: readonly string[], cases: readonly Case[]): Promise<RunOutcome> {
  const blob = new Blob([script(params, source)], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);

  try {
    return await new Promise<RunOutcome>((resolve) => {
      const timer = window.setTimeout(() => {
        worker.terminate();
        resolve({ results: [], fatal: 'timeout', line: null });
      }, PATIENCE);

      worker.onmessage = (event: MessageEvent): void => {
        window.clearTimeout(timer);
        const posted = event.data as readonly Posted[];
        const results = posted.map((one): RunResult => {
          if (one.error !== null) {
            const line = lineOf(one.stack ?? '', url, ABOVE);
            return line === null ? { value: null, error: one.error } : { value: null, error: one.error, line };
          }
          if (one.odd !== null) {
            const seen = one.odd === 'function' ? 'function' : `${one.odd} (cannot be sent back)`;
            return { value: null, error: null, seen, type: one.odd };
          }
          const looked = inspect(one.value);
          return { value: looked.value, error: null, seen: looked.seen, type: looked.type };
        });
        resolve({ results, fatal: null, line: null });
      };

      // A mistake the script could not even be read past arrives here, with
      // the line it is on — which is the whole reason the code is in the
      // script rather than passed to `new Function`.
      worker.onerror = (event: ErrorEvent): void => {
        event.preventDefault();
        window.clearTimeout(timer);
        const message = tidy(event.message || 'the code could not be started');
        const line = event.lineno > ABOVE ? event.lineno - ABOVE : null;
        resolve({ results: [], fatal: message, line });
      };

      worker.postMessage(cases.map((one) => one.args));
    });
  } finally {
    worker.terminate();
    URL.revokeObjectURL(url);
  }
}
