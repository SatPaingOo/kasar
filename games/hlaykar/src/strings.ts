/**
 * Everything the player reads, in both languages.
 *
 * The shelf picks a language too, but it does not tell a game which one: a
 * game is its own page and reads the browser itself. One fewer thing crossing
 * the boundary, and the game still works opened on its own.
 */

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
  readonly howRule: string;
  readonly howMove: string;
  readonly howKeys: string;
  readonly howTouch: string;
  readonly begin: string;
  readonly height: string;
  readonly next: string;
  readonly paused: string;
  readonly resume: string;
  readonly drowned: string;
  readonly drownedWhy: string;
  readonly out: string;
  readonly outWhy: string;
  readonly again: string;
}

export const TEXT: Readonly<Record<Lang, Text>> = {
  en: {
    title: 'Hlaykar',
    premise: 'The water is rising, and he cannot swim.',
    howRule: 'He climbs by himself. One step up is all he can manage — two is a wall.',
    howMove: 'He never goes back down, so a stair you build stays built.',
    howKeys: '← → move · ↑ turn · ␣ drop · P pause',
    howTouch: 'Drag to aim · tap to turn · let go to drop',
    begin: 'Begin',
    height: 'height',
    next: 'next',
    paused: 'Paused',
    resume: 'Press P or tap to go on',
    drowned: 'The water took him',
    drownedWhy: 'He got as high as',
    out: 'He is over the rim',
    outWhy: 'Out, with the water at',
    again: 'Again',
  },
  my: {
    title: 'လှေကား',
    premise: 'ရေတက်နေပြီ၊ သူကလည်း ရေမကူးတတ်ဘူး။',
    howRule: 'သူ့ဘာသူ တက်ပါတယ်။ တစ်ထစ်ပဲ တက်နိုင်တယ် — နှစ်ထစ်ဆိုရင် နံရံပဲ။',
    howMove: 'သူ ဘယ်တော့မှ ပြန်မဆင်းဘူး၊ ဒါကြောင့် စီထားတဲ့ လှေကား အလကား မဖြစ်ဘူး။',
    howKeys: '← → ရွှေ့ · ↑ လှည့် · ␣ ချ · P ခဏရပ်',
    howTouch: 'ဆွဲပြီး ချိန် · ထိပြီး လှည့် · လွှတ်လိုက်ရင် ကျ',
    begin: 'စမယ်',
    height: 'အမြင့်',
    next: 'နောက်တစ်ခု',
    paused: 'ခဏရပ်ထားတယ်',
    resume: 'P နှိပ် ဒါမှမဟုတ် ထိပြီး ဆက်ပါ',
    drowned: 'ရေက သူ့ကို သိမ်းသွားပြီ',
    drownedWhy: 'အမြင့်ဆုံး ရောက်ခဲ့တာက',
    out: 'သူ အပေါ်ကို ရောက်သွားပြီ',
    outWhy: 'လွတ်သွားပြီ၊ ရေက',
    again: 'ထပ်ကစားမယ်',
  },
};
