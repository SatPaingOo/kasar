/**
 * Where to look for a browser to drive.
 *
 * The end-to-end run uses browsers that are already installed, never ones it
 * downloads. That is a rule learned the hard way: on a machine with Smart App
 * Control on, a downloaded test build of Firefox is unsigned and is refused
 * outright, while the Firefox and Chrome the machine already has are signed
 * and run. Installed browsers are also the ones players have.
 *
 * Split out of the script so the list — the part that decides — can be
 * tested on every platform from any one of them.
 */

export type Engine = 'firefox' | 'chromium';

export const ENGINES: readonly Engine[] = ['firefox', 'chromium'];

type Env = Readonly<Record<string, string | undefined>>;

const winJoin = (...parts: readonly string[]): string => parts.join('\\');

/**
 * Paths to try, in order, for one engine. An environment variable — FIREFOX
 * or CHROME — always comes first, so any browser at all can be pointed at.
 */
export function candidates(engine: Engine, platform: string, env: Env): string[] {
  const override = engine === 'firefox' ? env['FIREFOX'] : env['CHROME'];
  const found: string[] = override !== undefined && override.length > 0 ? [override] : [];

  if (platform === 'win32') {
    const local = env['LOCALAPPDATA'];
    const programs = env['ProgramFiles'] ?? 'C:\\Program Files';
    const programs86 = env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
    if (engine === 'firefox') {
      // The Microsoft Store build is reached through its app alias.
      if (local !== undefined) found.push(winJoin(local, 'Microsoft', 'WindowsApps', 'firefox.exe'));
      found.push(
        winJoin(programs, 'Mozilla Firefox', 'firefox.exe'),
        winJoin(programs86, 'Mozilla Firefox', 'firefox.exe'),
      );
    } else {
      found.push(winJoin(programs, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      found.push(winJoin(programs86, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      if (local !== undefined) found.push(winJoin(local, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      found.push(winJoin(programs86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
    return found;
  }

  if (platform === 'darwin') {
    found.push(
      engine === 'firefox'
        ? '/Applications/Firefox.app/Contents/MacOS/firefox'
        : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    );
    return found;
  }

  if (engine === 'firefox') found.push('/usr/bin/firefox', '/snap/bin/firefox');
  else
    found.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    );
  return found;
}

/** The first candidate that exists, or null. */
export function pick(paths: readonly string[], exists: (path: string) => boolean): string | null {
  return paths.find((path) => exists(path)) ?? null;
}
