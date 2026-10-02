/**
 * Turning a request path into a file on disk, safely.
 *
 * Split out of serve.ts so the one judgment call it makes — never serving
 * anything outside the project folder, however the path was spelled — can be
 * tested directly instead of through a socket.
 */

import { extname, normalize, resolve, sep } from 'node:path';

export const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export const mimeFor = (path: string): string => MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';

/**
 * The file a request asks for, or null when it asks for something outside
 * the root. A path ending in / means that folder's index.html, so each game
 * is reachable at its own folder exactly as it will be on a static host.
 *
 * @param url the raw request target, which may be absolute or malformed
 */
export function resolveRequest(root: string, url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url, 'http://localhost').pathname;
  } catch {
    return null;
  }

  let requested: string;
  try {
    requested = decodeURIComponent(pathname.endsWith('/') ? `${pathname}index.html` : pathname);
  } catch {
    // A malformed percent-escape is not a path worth guessing at.
    return null;
  }

  // Strip every leading separator before resolving, or an absolute path in the
  // request would escape the root rather than be read relative to it.
  const target = resolve(root, normalize(requested).replace(/^[/\\]+/, ''));
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}
