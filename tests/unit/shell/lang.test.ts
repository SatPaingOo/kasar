import { describe, expect, it } from 'vitest';

import { pickLang } from '../../../src/shell/lang.js';

describe('pickLang', () => {
  it('opens in Burmese when any preferred tag asks for it', () => {
    expect(pickLang(['my'])).toBe('my');
    expect(pickLang(['my-MM'])).toBe('my');
    expect(pickLang(['MY-mm'])).toBe('my');
  });

  it('honours Burmese even when it is not the first choice', () => {
    expect(pickLang(['en-GB', 'my-MM'])).toBe('my');
  });

  it('opens in English for anything else', () => {
    expect(pickLang(['en-US', 'th'])).toBe('en');
    expect(pickLang([])).toBe('en');
  });

  it('is not fooled by a tag that merely begins with the same letters', () => {
    // "mya" is Burmese; a hypothetical "mys" is not, but neither is Malay "ms".
    expect(pickLang(['ms-MY'])).toBe('en');
  });

  it('survives a browser reporting undefined entries', () => {
    expect(pickLang([undefined, 'my'])).toBe('my');
    expect(pickLang([undefined])).toBe('en');
  });
});
