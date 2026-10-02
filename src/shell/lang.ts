/**
 * Which language the shelf opens in.
 *
 * Kept apart from the DOM so the tag matching can be tested: a browser can
 * report my, my-MM, or a list with Burmese behind English, and the rule is
 * the same each time.
 */

export type Lang = 'en' | 'my';

/** Burmese when any preferred tag asks for it, English otherwise. */
export function pickLang(tags: readonly (string | undefined)[]): Lang {
  return tags.some((tag) => tag?.toLowerCase().startsWith('my')) ? 'my' : 'en';
}
