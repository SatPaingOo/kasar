/**
 * Everything the player reads, in both languages.
 *
 * The shelf picks a language too, but it does not tell a game which one: a
 * game is its own page and reads the browser itself.
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
  readonly howHold: string;
  readonly howLet: string;
  readonly howKeys: string;
  readonly howTouch: string;
  readonly begin: string;
  readonly across: string;
  readonly paused: string;
  readonly resume: string;
  readonly fallen: string;
  readonly reached: string;
  readonly over: string;
  readonly overWhy: string;
  readonly again: string;
}

export const TEXT: Readonly<Record<Lang, Text>> = {
  en: {
    title: 'Kyo',
    premise: 'A gorge, and one rope. He cannot climb and he cannot stop.',
    howHold: 'Hold and he swings. Let go and he flies with whatever the swing gave him.',
    howLet: 'Let go climbing, not at the bottom — height is the only thing that buys speed.',
    howKeys: 'Hold ␣ to swing · let go to fly · P pause · M mute',
    howTouch: 'Hold to swing · let go to fly',
    begin: 'Begin',
    across: 'across',
    paused: 'Paused',
    resume: 'Press P or tap to go on',
    fallen: 'He ran out of sky',
    reached: 'He got as far as',
    over: 'He is across',
    overWhy: 'Over, in',
    again: 'Again',
  },
  my: {
    title: 'ကြိုး',
    premise: 'ချောက်တစ်ခု၊ ကြိုးတစ်ချောင်း။ သူ တက်လို့မရ၊ ရပ်လို့လည်း မရဘူး။',
    howHold: 'ဖိထားရင် လွှဲနေမယ်။ လွှတ်လိုက်ရင် လွှဲထားတဲ့အရှိန်နဲ့ ပျံထွက်သွားမယ်။',
    howLet: 'အောက်ဆုံးမှာ မလွှတ်နဲ့ — တက်နေတုန်း လွှတ်ပါ။ အရှိန်ကို အမြင့်နဲ့ပဲ ဝယ်လို့ရတယ်။',
    howKeys: '␣ ဖိထား လွှဲ · လွှတ် ပျံ · P ရပ် · M အသံပိတ်',
    howTouch: 'ဖိထား လွှဲ · လွှတ် ပျံ',
    begin: 'စမယ်',
    across: 'ကူးပြီး',
    paused: 'ခဏရပ်ထားတယ်',
    resume: 'P နှိပ် ဒါမှမဟုတ် ထိပြီး ဆက်ပါ',
    fallen: 'ကောင်းကင် ကုန်သွားပြီ',
    reached: 'ရောက်ခဲ့တာက',
    over: 'သူ ကူးလွတ်သွားပြီ',
    overWhy: 'ကူးပြီးသွားတာ',
    again: 'ထပ်ကစားမယ်',
  },
};
