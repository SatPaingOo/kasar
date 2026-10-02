/**
 * The shelf's colour judgment calls.
 *
 * A card takes its accent from the game's own game.json, which means these
 * run on a value nobody here chose. Getting the contrast wrong makes a title
 * unreadable on its own poster, so this is kept apart from the DOM and
 * tested directly.
 */

const FALLBACK: readonly [number, number, number] = [143, 166, 200];

/** Accepts #rgb and #rrggbb, with or without the hash. */
export function parseHex(hex: string): readonly [number, number, number] {
  const clean = hex.trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;

  if (!/^[0-9a-f]{6}$/i.test(full)) return FALLBACK;

  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

export type Rgb = readonly [number, number, number];

/** Perceived brightness of a triple, 0 to 1. */
export function brightness([r, g, b]: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Perceived brightness of a hex colour, 0 to 1. */
export const luminance = (hex: string): number => brightness(parseHex(hex));

/** A darker partner for the accent, so a poster is a gradient and not a slab. */
export function deepenTo(hex: string): Rgb {
  const mix = (channel: number): number => Math.round(channel * 0.34 + 26 * 0.66);
  const [r, g, b] = parseHex(hex);
  return [mix(r), mix(g), mix(b)];
}

export function deepen(hex: string): string {
  const [r, g, b] = deepenTo(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Dark text on a light accent, light text on a dark one. */
export function inkOn(hex: string): string {
  return luminance(hex) > 0.55 ? '#171a24' : '#f4f7ff';
}
