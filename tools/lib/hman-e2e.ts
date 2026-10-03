/**
 * What the end-to-end run checks in Hman, and how it tells a pass.
 *
 * Hman is the one game on the shelf whose failures have hidden from every
 * unit test: a race between the worker and the loop that only lost at sixty
 * frames a second, and a syntax error that Firefox reported with no message
 * and no line. Both were found by playing it in a real browser, so this plays
 * it in a real browser — the editor by real keys, the advice for each kind of
 * mistake with its line, every rung from an empty save, and the phone row.
 *
 * The judgments live here and are tested; the browser plumbing does not.
 */

/** One wrong answer on the first rung, and what the desk must say about it. */
export interface AdviceCase {
  readonly name: string;
  readonly code: string;
  readonly says: RegExp;
  /** The line the gutter must mark, when the mistake has one. */
  readonly line?: number;
}

export const ADVICE: readonly AdviceCase[] = [
  {
    name: 'a syntax error says what and where',
    code: 'const a = parts[0];\nconst b = parts[parts.length - 1;\nreturn a + b;',
    says: /line 2\).*SyntaxError/,
    line: 2,
  },
  {
    name: 'a runtime error has its line',
    code: 'const a = parts[0];\nconst gone = null;\nreturn gone.length;',
    says: /line 3/,
    line: 3,
  },
  {
    name: 'strict mode catches an undeclared name',
    code: 'total = 1;\nreturn total;',
    says: /not defined|undeclared/,
    line: 1,
  },
  {
    name: 'a type annotation is named as such',
    code: 'const x: number = parts[0];\nreturn x;',
    says: /Type annotations/,
  },
  { name: 'a loop that never ends is caught', code: 'while (true) {}', says: /never finished/ },
  { name: 'NaN is explained', code: 'return parts[0] + parts[parts.length];', says: /NaN/ },
  { name: 'no return is called a missing return', code: 'parts[0];', says: /Nothing came back/ },
  {
    name: 'the wrong shape is a broken promise',
    code: 'return [parts[0]];',
    says: /promises number, and this gave back number\[\]/,
  },
];

export interface Said {
  readonly says: string;
  readonly line: readonly number[];
}

export function judgeAdvice(expected: AdviceCase, got: Said): boolean {
  if (!expected.says.test(got.says)) return false;
  return expected.line === undefined || got.line[0] === expected.line;
}

/** The marker in the corner must name the version the game ships as. */
export const showsVersion = (marker: string, version: string): boolean => marker.trim() === `v${version}`;

/**
 * Put in the page, then called from outside. Written as a string because it
 * runs in a browser, and the tools are typed for Node.
 */
export const HARNESS = String.raw`
window.E2E = (() => {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const skip = () => $('stage').dispatchEvent(new PointerEvent('pointerdown'));
  const put = (code) => {
    const box = $('body');
    box.focus();
    box.select();
    if (code.length > 0) document.execCommand('insertText', false, code);
    else document.execCommand('delete');
  };
  // A card left up by the last answer: back on his feet, or on to the next.
  const ready = async () => {
    if (!$('curtain').hidden) {
      $('curtainGo').click();
      await sleep(120);
    }
  };
  const strike = async (code) => {
    put(code);
    $('submit').click();
    await sleep(120);
    const t0 = performance.now();
    while (performance.now() - t0 < 40000) {
      skip();
      if (!$('submit').disabled || !$('curtain').hidden) break;
      await sleep(60);
    }
    return { says: $('says').textContent, line: [...document.querySelectorAll('#gutter .bad')].map((d) => Number(d.textContent)) };
  };
  const ladder = async () => {
    const { LEVELS } = await import('./dist/levels.js');
    const bad = [];
    for (let i = 0; i < LEVELS.length; i += 1) {
      const level = LEVELS[i];
      if (!$('concept').textContent.endsWith(level.concept.en)) {
        bad.push((i + 1) + ' is not the rung on the desk');
        break;
      }
      await strike(level.starter);
      if (!$('says').classList.contains('bad')) bad.push((i + 1) + ' took its starter as right');
      await ready();
      await strike(level.hints[level.hints.length - 1].en);
      const t0 = performance.now();
      while ($('curtain').hidden && performance.now() - t0 < 40000) await sleep(60);
      if ($('curtainLead').textContent !== 'Rung ' + (i + 1) + '/' + LEVELS.length) {
        bad.push((i + 1) + ' ' + level.id + ' would not clear: ' + $('says').textContent);
        break;
      }
      if ($('lessonText').textContent !== level.lesson.en) bad.push((i + 1) + ' showed the wrong lesson');
      $('curtainGo').click();
      await sleep(40);
    }
    const t0 = performance.now();
    while ($('curtain').hidden && performance.now() - t0 < 20000) await sleep(100);
    return { rungs: LEVELS.length, bad, end: $('curtainTitle').textContent + ' / ' + $('curtainLead').textContent };
  };
  const rect = (selector) => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  };
  return { put, ready, strike, ladder, rect };
})();
`;
