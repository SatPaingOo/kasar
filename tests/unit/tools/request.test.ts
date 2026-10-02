/**
 * The dev server's one judgment call: which file a request may have.
 *
 * Canon 10 section 5 — security tests are not optional, and the test that
 * matters is the one proving it refuses, not the one proving it serves.
 */

import { join, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { mimeFor, resolveRequest } from '../../../tools/lib/request.ts';

const ROOT = resolve('/srv/kasar');

describe('resolveRequest', () => {
  it('serves the shelf at the root', () => {
    expect(resolveRequest(ROOT, '/')).toBe(join(ROOT, 'index.html'));
  });

  it("serves a folder's index.html, so a game is reachable at its folder", () => {
    expect(resolveRequest(ROOT, '/games/tazaung/')).toBe(join(ROOT, 'games', 'tazaung', 'index.html'));
  });

  it('serves a file asked for by name', () => {
    expect(resolveRequest(ROOT, '/games.json')).toBe(join(ROOT, 'games.json'));
  });

  it('ignores a query string', () => {
    expect(resolveRequest(ROOT, '/games.json?v=3')).toBe(join(ROOT, 'games.json'));
  });

  it('never hands back a path outside the root, however it is spelled', () => {
    // The property that matters. Some of these the URL parser already
    // flattens and some the guard catches; what must hold for every one is
    // that nothing outside the project folder is ever named.
    const hostile = [
      '/../secrets.txt',
      '/games/../../secrets.txt',
      '/a/b/c/../../../../secrets.txt',
      '/%2e%2e/secrets.txt',
      '/%2e%2e%2fsecrets.txt',
      '/..%2f..%2fsecrets.txt',
      '/....//secrets.txt',
      '//etc/passwd',
      '///etc/passwd',
      '/..\\..\\secrets.txt',
      '/games\\..\\..\\secrets.txt',
      '/games/tazaung/../../../secrets.txt',
      'http://elsewhere/../secrets.txt',
    ];

    for (const url of hostile) {
      const target = resolveRequest(ROOT, url);
      if (target === null) continue;
      expect(target === ROOT || target.startsWith(ROOT + sep)).toBe(true);
    }
  });

  it('refuses a malformed escape rather than guessing at it', () => {
    expect(resolveRequest(ROOT, '/%E0%A4%A')).toBeNull();
  });

  it('reads a leading separator as the root, not as the top of the drive', () => {
    // Without stripping them, resolve() would treat the request as an
    // absolute path and hand back whatever is at the top of the drive.
    const target = resolveRequest(ROOT, '/etc/passwd');
    expect(target).toBe(join(ROOT, 'etc', 'passwd'));
  });

  it('allows a file at the root', () => {
    expect(resolveRequest(ROOT, '/index.html')).toBe(join(ROOT, 'index.html'));
  });
});

describe('mimeFor', () => {
  it('names the types the site actually serves', () => {
    expect(mimeFor('/a/index.html')).toBe('text/html; charset=utf-8');
    expect(mimeFor('/a/main.js')).toBe('text/javascript; charset=utf-8');
    expect(mimeFor('/a/games.json')).toBe('application/json; charset=utf-8');
    expect(mimeFor('/a/poster.svg')).toBe('image/svg+xml');
  });

  it('is case-insensitive about the extension', () => {
    expect(mimeFor('/a/POSTER.SVG')).toBe('image/svg+xml');
  });

  it('falls back rather than guessing for anything else', () => {
    expect(mimeFor('/a/notes.txt')).toBe('application/octet-stream');
    expect(mimeFor('/a/noextension')).toBe('application/octet-stream');
  });
});
