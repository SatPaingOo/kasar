/**
 * Where the end-to-end run looks for a browser.
 *
 * Installed browsers only, in a fixed order, with an override first — and the
 * Store build of Firefox on Windows found through its app alias, because that
 * is the one Smart App Control lets run.
 */

import { describe, expect, it } from 'vitest';

import { candidates, pick } from '../../../tools/lib/browsers.ts';

const WINDOWS = {
  LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
  ProgramFiles: 'C:\\Program Files',
  'ProgramFiles(x86)': 'C:\\Program Files (x86)',
};

describe('candidates', () => {
  it('puts an override first, whatever the platform', () => {
    expect(candidates('firefox', 'linux', { FIREFOX: '/opt/ff/firefox' })[0]).toBe('/opt/ff/firefox');
    expect(candidates('chromium', 'win32', { ...WINDOWS, CHROME: 'D:\\chrome.exe' })[0]).toBe('D:\\chrome.exe');
  });

  it('ignores an empty override', () => {
    expect(candidates('firefox', 'linux', { FIREFOX: '' })[0]).toBe('/usr/bin/firefox');
  });

  it('finds the Store build of Firefox on Windows through its app alias, before any other', () => {
    expect(candidates('firefox', 'win32', WINDOWS)[0]).toBe(
      'C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps\\firefox.exe',
    );
    expect(candidates('firefox', 'win32', WINDOWS)).toContain('C:\\Program Files\\Mozilla Firefox\\firefox.exe');
  });

  it('tries Chrome before Edge on Windows', () => {
    const list = candidates('chromium', 'win32', WINDOWS);
    expect(list[0]).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    expect(list[list.length - 1]).toBe('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');
  });

  it('knows where Linux and macOS keep them', () => {
    expect(candidates('chromium', 'linux', {})).toContain('/usr/bin/google-chrome');
    expect(candidates('firefox', 'darwin', {})).toEqual(['/Applications/Firefox.app/Contents/MacOS/firefox']);
  });

  it('never suggests a downloaded test build', () => {
    for (const engine of ['firefox', 'chromium'] as const) {
      for (const platform of ['win32', 'linux', 'darwin']) {
        expect(candidates(engine, platform, WINDOWS).some((path) => path.includes('ms-playwright'))).toBe(false);
      }
    }
  });
});

describe('pick', () => {
  it('takes the first that exists', () => {
    expect(pick(['/a', '/b', '/c'], (path) => path !== '/a')).toBe('/b');
  });

  it('says so when none does', () => {
    expect(pick(['/a'], () => false)).toBeNull();
  });
});
