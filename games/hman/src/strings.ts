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
  readonly rungDone: string;
  readonly nextUp: string;
  readonly goOn: string;
  readonly finish: string;
  readonly won: string;
  readonly wonWhy: (rungs: number) => string;
  readonly down: string;
  readonly downWhy: string;
  readonly sameRung: string;
  readonly hintsTaken: string;
  readonly again: string;
  readonly chapter: string;
  readonly reset: string;
  readonly keys: string;
  readonly another: string;
  readonly nextChapter: string;
  readonly fromStart: string;
  readonly pick: string;
  readonly noReturn: string;
  readonly notThere: string;
  readonly nan: string;
  readonly carryOn: (rung: number) => string;
  readonly chapterDone: (name: string) => string;
  readonly onLine: (line: number) => string;
  readonly promised: (want: string, got: string) => string;
  readonly gaveBack: (call: string, got: string, want: string) => string;
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
    cleared: 'The mirror is down',
    rungDone: 'Rung',
    nextUp: 'Next:',
    goOn: 'Next rung',
    finish: 'Finish',
    won: 'Nothing left standing',
    wonWhy: (rungs) => `Every rung, all ${rungs} of them.`,
    down: 'He is down',
    downWhy: 'Beaten by rung',
    sameRung: 'Back on your feet',
    hintsTaken: 'hints',
    again: 'Again',
    chapter: 'chapter',
    reset: 'Start over',
    keys: 'Ctrl+Enter strikes · Tab indents · Ctrl+/ turns a line off · Ctrl+Z undoes',
    another: 'Another way',
    nextChapter: 'Next chapter:',
    fromStart: 'From the first rung',
    pick: 'Or go to a rung',
    noReturn: 'Nothing came back — that is undefined. There is no return, so the function just ends.',
    notThere: 'undefined came back — what was returned is not there. An index past the end, or a property spelt wrong?',
    nan: "NaN came back — 'not a number'. It is nearly always a number added to undefined: a part that is not there, like parts[parts.length].",
    carryOn: (rung) => `Carry on — rung ${rung}`,
    chapterDone: (name) => `That is the end of “${name}”.`,
    onLine: (line) => `line ${line}`,
    promised: (want, got) => `The signature promises ${want}, and this gave back ${got}.`,
    gaveBack: (call, got, want) => `${call} gave back ${got} — needed ${want}`,
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
    cleared: 'မှန်ထဲကလူ လဲသွားပြီ',
    rungDone: 'အဆင့်',
    nextUp: 'နောက်တစ်ခု:',
    goOn: 'နောက်အဆင့်',
    finish: 'အဆုံးသတ်',
    won: 'ဘာမှ မကျန်တော့ဘူး',
    wonWhy: (rungs) => `အဆင့် ${rungs} ခုလုံး ပြီးပြီ။`,
    down: 'သူ လဲသွားပြီ',
    downWhy: 'ရှုံးသွားတဲ့ အဆင့်',
    sameRung: 'ပြန်ထပြီး ဒီအဆင့်ကို ပြန်စ',
    hintsTaken: 'ကြိမ် အကူအညီယူ',
    again: 'ထပ်ကစားမယ်',
    chapter: 'အခန်း',
    reset: 'ပြန်စ',
    keys: 'Ctrl+Enter ထိုး · Tab အထဲတိုး · Ctrl+/ စာကြောင်းပိတ် · Ctrl+Z နောက်ပြန်',
    another: 'နောက်တစ်နည်း',
    nextChapter: 'နောက်အခန်း:',
    fromStart: 'ပထမ အဆင့်ကနေ',
    pick: 'ဒါမှမဟုတ် အဆင့် တစ်ခု ရွေးပါ',
    noReturn: 'ဘာမှ ပြန်မလာဘူး — အဲဒါ undefined။ return မပါလို့ function က ဘာမှမပေးဘဲ ပြီးသွားတယ်။',
    notThere:
      'undefined ပြန်လာတယ် — return လုပ်လိုက်တဲ့ အရာက မရှိဘူး။ အဆုံးကို ကျော်သွားတဲ့ index လား၊ စာလုံးပေါင်း မှားနေတဲ့ property လား?',
    nan: 'NaN ပြန်လာတယ် — "ဂဏန်း မဟုတ်" လို့ ဆိုလိုတယ်။ များသောအားဖြင့် ဂဏန်း တစ်ခုကို undefined နဲ့ ပေါင်းမိလို့ ဖြစ်တာ: parts[parts.length] လို မရှိတဲ့ အပိုင်း တစ်ခု။',
    carryOn: (rung) => `ဆက်ကစားမယ် — အဆင့် ${rung}`,
    chapterDone: (name) => `“${name}” အခန်း ပြီးပြီ။`,
    onLine: (line) => `စာကြောင်း ${line}`,
    promised: (want, got) => `signature က ${want} ပြန်ပေးမယ်လို့ ကတိပေးထားတယ်၊ ဒါပေမဲ့ ${got} ပြန်လာတယ်။`,
    gaveBack: (call, got, want) => `${call} က ${got} ပြန်ပေးတယ် — လိုတာက ${want}`,
  },
};
