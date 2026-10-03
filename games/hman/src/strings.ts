/**
 * Everything the player reads that is not part of a rung.
 *
 * The rungs carry their own words, in both languages, because the brief and
 * the hints are the rung — keeping them here would mean editing two files to
 * add one.
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
  readonly howWrite: string;
  readonly howWrong: string;
  readonly howJs: string;
  readonly begin: string;
  readonly lives: string;
  readonly rung: string;
  readonly standing: string;
  readonly submit: string;
  readonly hint: string;
  readonly noMoreHints: string;
  readonly examples: string;
  readonly got: string;
  readonly wanted: string;
  readonly threw: string;
  readonly looping: string;
  readonly annotation: string;
  readonly cleared: string;
  readonly won: string;
  readonly wonWhy: string;
  readonly lost: string;
  readonly lostWhy: string;
  readonly hintsTaken: string;
  readonly again: string;
}

export const TEXT: Readonly<Record<Lang, Text>> = {
  en: {
    title: 'Hman',
    premise: 'မှန် — correct. Write the move and he makes it.',
    howWrite: 'You are given a signature and two worked examples. Write the body.',
    howWrong: 'What you return is what he does. Right lands on the mirror; wrong lands on you.',
    howJs: 'The box runs as JavaScript — the types live in the signature above it.',
    begin: 'Begin',
    lives: 'lives',
    rung: 'rung',
    standing: 'standing',
    submit: 'Strike',
    hint: 'Hint',
    noMoreHints: 'no hints left',
    examples: 'last time',
    got: 'came back',
    wanted: 'needed',
    threw: 'it broke',
    looping: 'It never finished. Something is looping.',
    annotation: 'Type annotations do not run in the box. The types are in the signature.',
    cleared: 'The mirror is down.',
    won: 'Nothing left standing',
    wonWhy: 'All of it, with',
    lost: 'The mirror had the better of it',
    lostWhy: 'Rungs cleared:',
    hintsTaken: 'hints',
    again: 'Again',
  },
  my: {
    title: 'မှန်',
    premise: 'မှန် — မှန်ကန်တာ။ ထိုးချက်ကို ရေးပေးရင် သူ လုပ်ပြတယ်။',
    howWrite: 'signature တစ်ခုနဲ့ နမူနာ နှစ်ခု ပေးထားတယ်။ အထဲက အပိုင်းကို ရေးပါ။',
    howWrong: 'ပြန်ပေးလိုက်တာက သူလုပ်မယ့်အရာ။ မှန်ရင် မှန်ထဲကလူကို ထိတယ်၊ မှားရင် ကိုယ့်ကို ပြန်ထိတယ်။',
    howJs: 'အကွက်ထဲက code က JavaScript အဖြစ် run တယ် — type တွေက အပေါ်က signature မှာ ရှိတယ်။',
    begin: 'စမယ်',
    lives: 'အသက်',
    rung: 'အဆင့်',
    standing: 'ကျန်',
    submit: 'ထိုး',
    hint: 'အရိပ်အမြွက်',
    noMoreHints: 'အရိပ်အမြွက် ကုန်ပြီ',
    examples: 'အရင်တစ်ခေါက်',
    got: 'ပြန်ရတာ',
    wanted: 'လိုတာ',
    threw: 'ပျက်သွားတယ်',
    looping: 'မပြီးဘူး။ တစ်ခုခုက အဆုံးမရှိ ပတ်နေတယ်။',
    annotation: 'အကွက်ထဲမှာ type ရေးလို့ မရဘူး။ type တွေက signature မှာ ရှိတယ်။',
    cleared: 'မှန်ထဲကလူ ပြိုသွားပြီ။',
    won: 'ဘာမှ မကျန်တော့ဘူး',
    wonWhy: 'အကုန်ပြီး၊',
    lost: 'မှန်ထဲကလူက သာသွားတယ်',
    lostWhy: 'ပြီးခဲ့တဲ့ အဆင့်:',
    hintsTaken: 'ကြိမ် အကူအညီယူ',
    again: 'ထပ်ကစားမယ်',
  },
};
