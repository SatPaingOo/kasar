/**
 * Everything the player reads, in both languages.
 *
 * The shelf picks a language too, but it does not tell a game which one: a
 * game is its own page and reads the browser itself.
 */

import type { Why } from './game.js';

export type Lang = 'en' | 'my';

export function pickLang(tags: readonly (string | undefined)[]): Lang {
  for (const tag of tags) {
    if (tag !== undefined && tag.toLowerCase().startsWith('my')) return 'my';
  }
  return 'en';
}

interface Text {
  readonly title: string;
  readonly premise: string;
  readonly howListen: string;
  readonly howGrow: string;
  readonly howKeys: string;
  readonly howTouch: string;
  readonly begin: string;
  readonly phrase: string;
  readonly score: string;
  readonly count: string;
  readonly listen: string;
  readonly play: string;
  readonly joins: string;
  readonly again: string;
  readonly on: string;
  readonly early: string;
  readonly late: string;
  readonly why: Readonly<Record<Why, string>>;
  readonly paused: string;
  readonly resume: string;
  readonly finished: string;
  readonly stopped: string;
  readonly reached: string;
  readonly of: string;
  readonly best: string;
  readonly grades: string;
  readonly replay: string;
  readonly muted: string;
}

export const TEXT: Readonly<Record<Lang, Text>> = {
  en: {
    title: 'Saing',
    premise: 'He sits in a circle of tuned drums. The circle plays a phrase, and he plays it back.',
    howListen: 'Listen while the drums light up. Then strike the same drums, in the same order, in the same rhythm.',
    howGrow: 'Each phrase is the last one and one beat more. Every few, a drum joins the circle.',
    howKeys: 'A S D F G H J K, low to high · or click a drum · P pause · M mute',
    howTouch: 'Tap a drum, or anywhere on its side of the circle',
    begin: 'Begin',
    phrase: 'phrase',
    score: 'score',
    count: 'Ready',
    listen: 'Listen',
    play: 'Your turn',
    joins: 'A drum joins',
    again: 'Once more',
    on: 'on',
    early: 'early',
    late: 'late',
    why: { wrong: 'Wrong drum', rushed: 'Too soon', missed: 'Too late' },
    paused: 'Paused',
    resume: 'Press P or tap to go on — the phrase starts again',
    finished: 'The piece is played through',
    stopped: 'The circle stopped',
    reached: 'Got to phrase',
    of: 'of',
    best: 'best',
    grades: 'on the beat {on} · close {near} · loose {loose}',
    replay: 'Again',
    muted: 'muted',
  },
  my: {
    title: 'ဆိုင်း',
    premise: 'အသံညှိထားတဲ့ ပတ်ဝိုင်းထဲမှာ သူထိုင်နေတယ်။ ဝိုင်းက တီးပြတာကို သူ ပြန်တီးရမယ်။',
    howListen: 'ပတ်တွေ လင်းလာတုန်း နားထောင်ပါ။ ပြီးရင် ပတ်တွေကို အစဉ်အတိုင်း၊ စည်းချက်အတိုင်း ပြန်တီးပါ။',
    howGrow: 'အပိုဒ်တိုင်းက အရင်အပိုဒ်ကို တစ်ချက် ထပ်တိုးထားတာ။ မကြာမကြာ ပတ်တစ်လုံး ထပ်ဝင်လာမယ်။',
    howKeys: 'A S D F G H J K — အနိမ့်ကနေ အမြင့် · ဒါမှမဟုတ် ပတ်ကို နှိပ် · P ရပ် · M အသံပိတ်',
    howTouch: 'ပတ်ကို ထိပါ — ပတ်ရှိတဲ့ဘက် ဘယ်နေရာထိထိ ရတယ်',
    begin: 'စမယ်',
    phrase: 'အပိုဒ်',
    score: 'အမှတ်',
    count: 'အသင့်',
    listen: 'နားထောင်',
    play: 'မင်းအလှည့်',
    joins: 'ပတ်တစ်လုံး ဝင်လာပြီ',
    again: 'နောက်တစ်ခါ',
    on: 'ချိန်ကိုက်',
    early: 'စော',
    late: 'နောက်ကျ',
    why: { wrong: 'ပတ်မှားတယ်', rushed: 'စောလွန်းတယ်', missed: 'နောက်ကျလွန်းတယ်' },
    paused: 'ခဏရပ်ထားတယ်',
    resume: 'P နှိပ် ဒါမှမဟုတ် ထိပြီး ဆက်ပါ — အပိုဒ်ကို အစက ပြန်စမယ်',
    finished: 'တစ်ပုဒ်လုံး တီးပြီးသွားပြီ',
    stopped: 'ဆိုင်းဝိုင်း ရပ်သွားပြီ',
    reached: 'ရောက်ခဲ့တဲ့ အပိုဒ်',
    of: '/',
    best: 'အကောင်းဆုံး',
    grades: 'ချိန်ကိုက် {on} · နီးနီး {near} · လွတ်လွတ် {loose}',
    replay: 'ထပ်တီးမယ်',
    muted: 'အသံပိတ်ထား',
  },
};
