/**
 * The shelf's layout at two widths, as boxes in document pixels, for the
 * walker's tests: the masthead, its title and readout, the lines of text
 * under them, and five cards. Shaped like the real page at those widths,
 * with round numbers, rather than measured off it.
 */

import type { Box, Layout } from '../../../src/shell/world.js';

const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom });

/** The shelf at 1280 wide: a masthead, then five cards in rows of three. */
export function desktop(): Layout {
  const cards = [0, 1, 2, 3, 4].map((i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const left = 104 + col * 366;
    const top = 270 + row * 396;
    return { id: `card:${i}`, box: box(left, top, left + 340, top + 370) };
  });
  return {
    width: 1280,
    height: 1166,
    rule: box(104, 80, 1176, 230),
    perches: [{ id: 'mark', box: box(104, 80, 330, 126) }, { id: 'readout', box: box(1010, 84, 1176, 120) }, ...cards],
    obstacles: [box(104, 146, 400, 162), box(104, 170, 220, 186)],
    ground: box(104, 1100, 1176, 1166),
  };
}

/** The shelf on a phone: one column, five cards. */
export function phone(): Layout {
  const cards = [0, 1, 2, 3, 4].map((i) => ({
    id: `card:${i}`,
    box: box(16, 220 + i * 346, 359, 220 + i * 346 + 330),
  }));
  return {
    width: 375,
    height: 2030,
    rule: box(16, 40, 359, 190),
    perches: [{ id: 'mark', box: box(16, 40, 200, 80) }, { id: 'readout', box: box(230, 44, 359, 76) }, ...cards],
    obstacles: [box(16, 100, 330, 140), box(16, 150, 150, 170)],
    ground: box(16, 1980, 359, 2030),
  };
}
