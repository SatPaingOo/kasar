/**
 * Play Hman in real browsers, end to end.
 *
 *   npm run e2e                 build, then every installed browser
 *   npm run e2e -- firefox      one engine only (firefox or chromium)
 *   npm run e2e -- --url <base> against a running site instead, e.g. the live one
 *   npm run e2e -- --all        every engine must be found, as CI runs it
 *
 * Uses the Firefox and Chrome already installed — see tools/lib/browsers.ts
 * for why never a downloaded one — driven over their own remote protocols
 * with nothing but Node. A browser that is not installed is skipped and named,
 * and at least one has to run — except with --all, where a missing one fails:
 * on a CI runner a skipped browser would otherwise read as a passed one. Screenshots go to the temp folder and their paths
 * are printed, because whether the colour lines up under the text is a thing
 * to look at.
 */

import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ENGINES, candidates, pick } from './lib/browsers.ts';
import type { Engine } from './lib/browsers.ts';
import { launch } from './lib/drive.ts';
import type { Box, Driver } from './lib/drive.ts';
import { ADVICE, HARNESS, judgeAdvice, showsVersion } from './lib/hman-e2e.ts';
import type { Said } from './lib/hman-e2e.ts';
import { mimeFor, resolveRequest } from './lib/request.ts';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SHOTS = join(tmpdir(), 'kasar-e2e');
const KEY = 'kasar.hman.progress.v1';

interface Outcome {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: unknown;
}

/** The site, served from the working tree on a free port, as `npm run serve` would. */
async function serve(): Promise<{ base: string; stop: () => void }> {
  const server = createServer((request, response) => {
    const target = resolveRequest(ROOT, request.url ?? '/');
    if (target === null) {
      response.writeHead(403).end();
      return;
    }
    readFile(target)
      .then((body) =>
        response.writeHead(200, { 'content-type': mimeFor(target), 'cache-control': 'no-store' }).end(body),
      )
      .catch(() => response.writeHead(404).end());
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}/`, stop: () => server.close() };
}

const wait = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/**
 * Whether a browser is there. An app alias — the way the Microsoft Store build
 * of Firefox is reached — is a reparse point Node cannot stat, although it can
 * start it; it does show up in its folder's listing, so that counts too.
 */
function present(path: string): boolean {
  if (existsSync(path)) return true;
  try {
    return readdirSync(dirname(path)).includes(basename(path));
  } catch {
    return false;
  }
}

async function playHman(driver: Driver, site: string, version: string, engine: Engine): Promise<Outcome[]> {
  const game = new URL('games/hman/', site).href;
  const out: Outcome[] = [];
  const check = (name: string, ok: boolean, detail?: unknown): void => {
    out.push(detail === undefined || ok ? { name, ok } : { name, ok, detail });
  };
  const forget = async (): Promise<void> => {
    // From the shelf, not the game: the game writes its own progress as it
    // closes, over anything cleared from inside it.
    await driver.navigate(site);
    await driver.evaluate(`localStorage.removeItem('${KEY}'); return true;`);
  };
  const open = async (): Promise<void> => {
    await driver.navigate(game);
    await wait(600);
    await driver.evaluate(`${HARNESS}; return true;`);
  };
  const box = (selector: string): Promise<Box> => driver.evaluate<Box>(`return E2E.rect(${JSON.stringify(selector)});`);
  const clickOn = async (selector: string): Promise<void> => {
    const b = await box(selector);
    await driver.click(b.x + b.width / 2, b.y + b.height / 2);
    await wait(60);
  };
  const text = (): Promise<string> => driver.evaluate<string>(`return document.getElementById('body').value;`);

  await driver.viewport(900, 1000);
  await forget();
  await open();
  const marker = await driver.evaluate<string>(`return document.getElementById('build').textContent;`);
  check(`shows its version, v${version}`, showsVersion(marker, version), marker);
  const names = await driver.evaluate<{ says: string; code: string; dialog: string; scene: string }>(`
    const $ = (id) => document.getElementById(id);
    return { says: $('says').getAttribute('aria-live') ?? '', code: $('body').getAttribute('aria-label') ?? '', dialog: $('curtain').getAttribute('role') ?? '', scene: $('stage').getAttribute('aria-label') ?? '' };`);
  check(
    'a screen reader is told the results, the box and the fight',
    names.says === 'polite' && names.code.length > 0 && names.dialog === 'dialog' && /Rung 1 of \d+/.test(names.scene),
    names,
  );

  // ── The editor, by real keys ─────────────────────────────────────────
  await driver.evaluate(`document.getElementById('curtainGo').click(); return true;`);
  await clickOn('#body');
  await driver.press('End', ['Control']);
  await driver.type('parts[0];');
  const typed = await text();
  check('[ closes itself and ] steps over it', typed === 'return parts[0];', typed);
  await driver.press('z', ['Control']);
  const undone = await text();
  check('Ctrl+Z undoes', undone !== typed && typed.startsWith(undone), undone);
  await driver.press('z', ['Control', 'Shift']);
  check('Ctrl+Shift+Z redoes', (await text()) === typed, await text());
  await driver.press('a', ['Control']);
  await driver.type('for (const n of parts) {');
  await driver.press('Enter');
  const block = await text();
  check('Enter between braces opens a block', block === 'for (const n of parts) {\n  \n}', block);
  await driver.type('total += n;');
  await driver.press('Home');
  await driver.press('/', ['Control']);
  const off = await text();
  check('Ctrl+/ turns a line off', off.includes('// total += n;'), off);
  await driver.press('z', ['Control']);
  const on = await text();
  check('and undo turns it back on', on.includes('  total += n;') && !on.includes('//'), on);
  await driver.press('Tab');
  const focus = await driver.evaluate<string>(`return document.activeElement.id;`);
  check('Tab indents and keeps the focus', (await text()).includes('    total') && focus === 'body', focus);

  // ── The advice, for each kind of mistake ─────────────────────────────
  for (const one of ADVICE) {
    await driver.evaluate(`await E2E.ready(); return true;`);
    const said = await driver.evaluate<Said>(`return await E2E.strike(${JSON.stringify(one.code)});`);
    check(one.name, judgeAdvice(one, said), said);
  }

  // ── The colour under the text ────────────────────────────────────────
  await driver.evaluate(
    `await E2E.ready(); E2E.put(${JSON.stringify('const longName = parts.map((n) => n * 2);\n// a comment\nreturn "it\'s" + longName[0];')}); const b = document.getElementById('body'); b.style.color = 'rgba(255, 40, 40, 0.75)'; b.blur(); return true;`,
  );
  await wait(200);
  const shot = join(SHOTS, `${engine}-overlay.png`);
  await driver.screenshot(shot, await box('.editor'));
  const same = await driver.evaluate<{ diff: string[]; at: number[] }>(`
    const a = getComputedStyle(document.getElementById('body'));
    const p = getComputedStyle(document.getElementById('paint'));
    const names = ['fontFamily', 'fontSize', 'lineHeight', 'paddingTop', 'paddingLeft', 'letterSpacing', 'whiteSpace', 'tabSize'];
    const t = document.getElementById('body').getBoundingClientRect();
    const q = document.getElementById('paint').getBoundingClientRect();
    document.getElementById('body').style.color = '';
    return { diff: names.filter((k) => a[k] !== p[k]), at: [t.left - q.left, t.top - q.top].map(Math.round) };`);
  check('the colour sits exactly under the text', same.diff.length === 0 && same.at.every((d) => d === 0), same);

  // ── Every rung, from an empty save ───────────────────────────────────
  await forget();
  await open();
  await driver.evaluate(`document.getElementById('curtainGo').click(); return true;`);
  const ladder = await driver.evaluate<{ rungs: number; bad: string[]; end: string }>(`return await E2E.ladder();`);
  check(
    `every rung, ${ladder.rungs} of them, in order, to the end`,
    ladder.bad.length === 0 && ladder.end.startsWith('Nothing left standing'),
    ladder,
  );

  // ── A rung deep in, reached from the map ─────────────────────────────
  await driver.evaluate(`document.getElementById('curtainGo').click(); return true;`);
  const deep = await driver.evaluate<Said>(`
    const button = [...document.querySelectorAll('.map button')].find((b) => b.textContent === '51');
    if (!button || button.disabled) return { says: 'rung 51 is not open', line: [] };
    button.click();
    return await E2E.strike('return n * strike(n - 1);');`);
  check('running out of stack is called a missing base case', /base case/.test(deep.says), deep);

  // ── Phone width: the row of symbols ──────────────────────────────────
  await forget();
  await driver.viewport(375, 760);
  await open();
  await driver.evaluate(`document.getElementById('curtainGo').click(); return true;`);
  const shown = await driver.evaluate<string>(`return getComputedStyle(document.getElementById('symbols')).display;`);
  check('the row of symbols is there at phone width', shown === 'flex', shown);
  const symbol = async (label: string): Promise<void> => {
    const at = await driver.evaluate<Box>(`
      const b = [...document.querySelectorAll('#symbols button')].find((x) => x.textContent === ${JSON.stringify(label)});
      b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = b.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };`);
    await driver.click(at.x + at.width / 2, at.y + at.height / 2);
    await wait(60);
  };
  await clickOn('#body');
  await driver.press('End', ['Control']);
  await driver.type('parts');
  await symbol('[');
  await driver.type('0');
  await symbol(']');
  await symbol(';');
  const row = await text();
  const kept = await driver.evaluate<string>(`return document.activeElement.id;`);
  check('symbols pair, step over, and never take the focus', row === 'return parts[0];' && kept === 'body', {
    row,
    kept,
  });
  await driver.evaluate(`document.execCommand('insertText', false, ' // it\\u2019s'); return true;`);
  check("a phone's curly quote is put straight", (await text()).endsWith("// it's"), await text());
  const wide = await driver.evaluate<boolean>(`return document.documentElement.scrollWidth > innerWidth;`);
  check('nothing is wider than the phone', !wide, wide);
  await driver.screenshot(join(SHOTS, `${engine}-phone.png`));

  await driver.viewport(900, 1000);
  await forget();
  return out;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const urlAt = args.indexOf('--url');
  const given = urlAt >= 0 ? args[urlAt + 1] : undefined;
  const only = args.filter((a): a is Engine => (ENGINES as readonly string[]).includes(a));
  const engines = only.length > 0 ? only : ENGINES;
  const every = args.includes('--all');

  const manifest = JSON.parse(await readFile(join(ROOT, 'games', 'hman', 'game.json'), 'utf8')) as { version: string };
  const local = given === undefined ? await serve() : null;
  const site = given ?? local?.base ?? '';
  await mkdir(SHOTS, { recursive: true });

  let ran = 0;
  let failed = 0;
  const missing: Engine[] = [];
  for (const engine of engines) {
    const path = pick(candidates(engine, process.platform, process.env), present);
    if (path === null) {
      console.log(`\n${engine}: not installed — ${every ? 'and it is required' : 'skipped'}`);
      missing.push(engine);
      continue;
    }
    const started = Date.now();
    let driver: Driver;
    try {
      driver = await launch(engine, path);
    } catch (err) {
      // A browser that is there and will not start is a failure, not a skip.
      console.log(`\n${engine} at ${path} would not start: ${err instanceof Error ? err.message : String(err)}`);
      failed += 1;
      continue;
    }
    console.log(`\n${driver.name} — ${site}`);
    try {
      const outcomes = await playHman(driver, site, manifest.version, engine);
      for (const one of outcomes) {
        console.log(`  ${one.ok ? '✓' : '✗'} ${one.name}${one.ok ? '' : `\n      ${JSON.stringify(one.detail)}`}`);
        if (!one.ok) failed += 1;
      }
      console.log(`  ${Math.round((Date.now() - started) / 1000)}s`);
      ran += 1;
    } finally {
      await driver.close();
    }
  }

  local?.stop();
  console.log(`\nscreenshots: ${SHOTS}`);
  if (ran === 0) {
    console.log('no browser was found to run in');
    process.exit(1);
  }
  if (every && missing.length > 0) {
    console.log(`required but not installed: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(failed === 0 ? `all checks passed in ${ran} browser(s)` : `${failed} check(s) failed`);
  if (failed > 0) process.exit(1);
}

await main();
