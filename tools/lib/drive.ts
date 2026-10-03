/**
 * Driving a real browser, with nothing but Node.
 *
 * Firefox speaks WebDriver BiDi and Chrome speaks the DevTools protocol, and
 * both are JSON over a WebSocket — which Node 22 has built in. So there is no
 * driver binary to download and no dependency: the browser is started with
 * its remote port open, and spoken to directly. Both are wrapped in the one
 * small interface the end-to-end run needs.
 *
 * Each run gets a throwaway profile in the temp folder, removed afterwards, so
 * a browser the person also uses for everything else is never touched.
 *
 * This is plumbing, and it has no unit tests: the only honest test of it is a
 * browser, which is what the end-to-end run is.
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Engine } from './browsers.ts';

export type Mod = 'Control' | 'Shift';
/** A named key, or any single character. */
export type Key = 'Enter' | 'Tab' | 'Home' | 'End' | string;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Driver {
  /** "firefox 157.0", "chrome 141.0…" */
  readonly name: string;
  navigate(url: string): Promise<void>;
  /** Run the body of an async function in the page; its return value comes back through JSON. */
  evaluate<T>(body: string): Promise<T>;
  /** Type text a key at a time, as real key events. */
  type(text: string): Promise<void>;
  press(key: Key, mods?: readonly Mod[]): Promise<void>;
  click(x: number, y: number): Promise<void>;
  viewport(width: number, height: number): Promise<void>;
  screenshot(file: string, clip?: Box): Promise<void>;
  /** Run a script at the start of every page loaded from now on, before the page's own. */
  preload(source: string): Promise<void>;
  close(): Promise<void>;
}

// ── One JSON-over-WebSocket connection ─────────────────────────────────

interface Socket {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

interface Wire {
  call<T>(method: string, params?: object): Promise<T>;
  once(method: string): Promise<unknown>;
  close(): void;
}

interface Message {
  readonly id?: number;
  readonly method?: string;
  readonly params?: unknown;
  readonly result?: unknown;
  readonly type?: string;
  readonly error?: unknown;
  readonly message?: string;
}

async function connect(url: string, shape: 'bidi' | 'cdp'): Promise<Wire> {
  const found = (globalThis as { WebSocket?: unknown }).WebSocket;
  if (typeof found !== 'function') throw new Error('this Node has no built-in WebSocket; Node 22 or later is needed');
  const socket = new (found as new (url: string) => Socket)(url);
  await new Promise<void>((resolve, reject) => {
    socket.onopen = (): void => resolve();
    socket.onerror = (): void => reject(new Error(`could not connect to ${url}`));
  });

  let next = 0;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const waiting = new Map<string, ((params: unknown) => void)[]>();

  socket.onmessage = (event): void => {
    const msg = JSON.parse(String(event.data)) as Message;
    if (typeof msg.id === 'number') {
      const call = pending.get(msg.id);
      if (call === undefined) return;
      pending.delete(msg.id);
      const failed = shape === 'bidi' ? msg.type === 'error' : msg.error !== undefined;
      if (failed) call.reject(new Error(msg.message ?? JSON.stringify(msg.error)));
      else call.resolve(msg.result);
      return;
    }
    if (typeof msg.method === 'string') {
      const handlers = waiting.get(msg.method) ?? [];
      waiting.delete(msg.method);
      for (const handler of handlers) handler(msg.params);
    }
  };

  return {
    call: <T>(method: string, params: object = {}): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        next += 1;
        pending.set(next, { resolve: resolve as (value: unknown) => void, reject });
        socket.send(JSON.stringify({ id: next, method, params }));
      }),
    once: (method: string): Promise<unknown> =>
      new Promise((resolve) => {
        waiting.set(method, [...(waiting.get(method) ?? []), resolve]);
      }),
    close: (): void => socket.close(),
  };
}

/** Wait for a started browser to print the address it is listening on. */
function listening(proc: ChildProcess, pattern: RegExp, what: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} did not open its remote port`)), 30_000);
    const look = (chunk: unknown): void => {
      const found = pattern.exec(String(chunk));
      if (found?.[1] !== undefined) {
        clearTimeout(timer);
        resolve(found[1]);
      }
    };
    proc.stderr?.on('data', look);
    proc.stdout?.on('data', look);
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`${what} exited with ${String(code)} before it was ready`));
    });
  });
}

const wrap = (body: string): string => `(async () => JSON.stringify(await (async () => { ${body} })()))()`;

async function stop(proc: ChildProcess, profile: string): Promise<void> {
  if (proc.exitCode === null) {
    const gone = new Promise((resolve) => proc.once('exit', resolve));
    proc.kill();
    await Promise.race([gone, new Promise((resolve) => setTimeout(resolve, 5000))]);
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}

// ── Firefox, over WebDriver BiDi ───────────────────────────────────────

const BIDI_KEYS: Readonly<Record<string, string>> = {
  Enter: '',
  Tab: '',
  Home: '',
  End: '',
  Control: '',
  Shift: '',
};

async function firefox(path: string): Promise<Driver> {
  const profile = await mkdtemp(join(tmpdir(), 'kasar-e2e-firefox-'));
  const proc = spawn(
    path,
    ['--headless', '--remote-debugging-port', '0', '-no-remote', '-profile', profile, 'about:blank'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const endpoint = await listening(proc, /WebDriver BiDi listening on (ws:\/\/\S+)/, 'Firefox');
  const wire = await connect(`${endpoint}/session`, 'bidi');
  const session = await wire.call<{ capabilities: { browserName: string; browserVersion: string } }>('session.new', {
    capabilities: {},
  });
  const tree = await wire.call<{ contexts: readonly { context: string }[] }>('browsingContext.getTree', {});
  const context = tree.contexts[0]?.context;
  if (context === undefined) throw new Error('Firefox opened no page');

  const keys = (actions: readonly object[]): Promise<unknown> =>
    wire.call('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions }] });
  const value = (key: Key): string => BIDI_KEYS[key] ?? key;

  return {
    name: `${session.capabilities.browserName} ${session.capabilities.browserVersion}`,
    navigate: async (url) => {
      await wire.call('browsingContext.navigate', { context, url, wait: 'complete' });
    },
    evaluate: async <T>(body: string): Promise<T> => {
      const r = await wire.call<{ type: string; result?: { value?: string }; exceptionDetails?: { text: string } }>(
        'script.evaluate',
        { expression: wrap(body), target: { context }, awaitPromise: true },
      );
      if (r.type === 'exception') throw new Error(r.exceptionDetails?.text ?? 'the page threw');
      const text = r.result?.value;
      return (text === undefined ? undefined : JSON.parse(text)) as T;
    },
    type: async (text) => {
      await keys(
        [...text].flatMap((ch) => [
          { type: 'keyDown', value: ch },
          { type: 'keyUp', value: ch },
        ]),
      );
    },
    press: async (key, mods = []) => {
      await keys([
        ...mods.map((mod) => ({ type: 'keyDown', value: value(mod) })),
        { type: 'keyDown', value: value(key) },
        { type: 'keyUp', value: value(key) },
        ...[...mods].reverse().map((mod) => ({ type: 'keyUp', value: value(mod) })),
      ]);
    },
    click: async (x, y) => {
      await wire.call('input.performActions', {
        context,
        actions: [
          {
            type: 'pointer',
            id: 'mouse',
            parameters: { pointerType: 'mouse' },
            actions: [
              { type: 'pointerMove', x: Math.round(x), y: Math.round(y) },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerUp', button: 0 },
            ],
          },
        ],
      });
    },
    viewport: async (width, height) => {
      await wire.call('browsingContext.setViewport', { context, viewport: { width, height } });
    },
    screenshot: async (file, clip) => {
      const r = await wire.call<{ data: string }>(
        'browsingContext.captureScreenshot',
        clip === undefined ? { context } : { context, clip: { type: 'box', ...clip } },
      );
      await writeFile(file, Buffer.from(r.data, 'base64'));
    },
    preload: async (source) => {
      await wire.call('script.addPreloadScript', { functionDeclaration: `() => { ${source} }` });
    },
    close: async () => {
      await wire.call('browser.close', {}).catch(() => undefined);
      wire.close();
      await stop(proc, profile);
    },
  };
}

// ── Chrome, over the DevTools protocol ─────────────────────────────────

const CDP_KEYS: Readonly<Record<string, { key: string; code: string; keyCode: number; text?: string }>> = {
  Enter: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' },
  Tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
  Home: { key: 'Home', code: 'Home', keyCode: 36 },
  End: { key: 'End', code: 'End', keyCode: 35 },
};

/** What the DevTools protocol needs to know about a key pressed with a modifier. */
function cdpKey(key: Key): { key: string; code: string; keyCode: number; text?: string } {
  const named = CDP_KEYS[key];
  if (named !== undefined) return named;
  if (/^[a-z]$/i.test(key)) return { key, code: `Key${key.toUpperCase()}`, keyCode: key.toUpperCase().charCodeAt(0) };
  if (key === '/') return { key, code: 'Slash', keyCode: 191 };
  return { key, code: '', keyCode: key.charCodeAt(0), text: key };
}

async function chromium(path: string): Promise<Driver> {
  const profile = await mkdtemp(join(tmpdir(), 'kasar-e2e-chrome-'));
  const proc = spawn(
    path,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const browserUrl = await listening(proc, /DevTools listening on (ws:\/\/\S+)/, 'Chrome');
  const port = new URL(browserUrl).port;
  const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as readonly {
    type: string;
    webSocketDebuggerUrl: string;
  }[];
  const page = targets.find((target) => target.type === 'page');
  if (page === undefined) throw new Error('Chrome opened no page');
  const wire = await connect(page.webSocketDebuggerUrl, 'cdp');
  const version = await wire.call<{ product: string }>('Browser.getVersion');
  await wire.call('Page.enable');

  const mask = (mods: readonly Mod[]): number => (mods.includes('Control') ? 2 : 0) | (mods.includes('Shift') ? 8 : 0);

  return {
    name: version.product.replace('/', ' ').replace(/^HeadlessChrome/, 'chrome'),
    navigate: async (url) => {
      const loaded = wire.once('Page.loadEventFired');
      await wire.call('Page.navigate', { url });
      await loaded;
    },
    evaluate: async <T>(body: string): Promise<T> => {
      const r = await wire.call<{
        result: { value?: string };
        exceptionDetails?: { text: string; exception?: { description?: string } };
      }>('Runtime.evaluate', { expression: wrap(body), awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails !== undefined) {
        throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      }
      const text = r.result.value;
      return (text === undefined ? undefined : JSON.parse(text)) as T;
    },
    type: async (text) => {
      for (const ch of text) {
        await wire.call('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch });
        await wire.call('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
      }
    },
    press: async (key, mods = []) => {
      const k = cdpKey(key);
      const modifiers = mask(mods);
      const typing = modifiers === 0 && k.text !== undefined;
      await wire.call('Input.dispatchKeyEvent', {
        type: typing ? 'keyDown' : 'rawKeyDown',
        key: k.key,
        code: k.code,
        windowsVirtualKeyCode: k.keyCode,
        modifiers,
        ...(typing ? { text: k.text } : {}),
      });
      await wire.call('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: k.key,
        code: k.code,
        windowsVirtualKeyCode: k.keyCode,
        modifiers,
      });
    },
    click: async (x, y) => {
      await wire.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await wire.call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await wire.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    },
    viewport: async (width, height) => {
      await wire.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    },
    screenshot: async (file, clip) => {
      const r = await wire.call<{ data: string }>(
        'Page.captureScreenshot',
        clip === undefined ? { format: 'png' } : { format: 'png', clip: { ...clip, scale: 1 } },
      );
      await writeFile(file, Buffer.from(r.data, 'base64'));
    },
    preload: async (source) => {
      await wire.call('Page.addScriptToEvaluateOnNewDocument', { source });
    },
    close: async () => {
      await wire.call('Browser.close').catch(() => undefined);
      wire.close();
      await stop(proc, profile);
    },
  };
}

export function launch(engine: Engine, path: string): Promise<Driver> {
  return engine === 'firefox' ? firefox(path) : chromium(path);
}
