/**
 * The ladder.
 *
 * Every rung has to produce a value that can be drawn as a move, which is why
 * it does not start at "declare a variable". Declaring one returns nothing,
 * so there is nothing to animate and nothing to be right or wrong about on
 * screen; the textbook order and the game fight each other at exactly the
 * place the textbook thinks is easiest. So the ladder starts at the first
 * thing that produces something visible, and a variable arrives at the rung
 * where it first makes the answer easier rather than at the rung where a
 * syllabus would name it.
 *
 * Each rung gives a signature and two worked examples. The cases underneath
 * are hidden: those are the fight.
 */

export type Value = number | readonly number[];

export interface Case {
  readonly parts: readonly number[];
  readonly want: Value;
}

export interface Level {
  readonly id: string;
  /** What it is really teaching, shown as a small label. */
  readonly concept: { readonly en: string; readonly my: string };
  readonly brief: { readonly en: string; readonly my: string };
  /** Shown above the box, not editable. */
  readonly signature: string;
  /** What the box starts with. */
  readonly starter: string;
  /** Two of them, shown as what happened last time he tried. */
  readonly shown: readonly Case[];
  /** The fight. One strike each. */
  readonly cases: readonly Case[];
  /** Three, each more of a giveaway than the last. */
  readonly hints: readonly { readonly en: string; readonly my: string }[];
}

export const LEVELS: readonly Level[] = [
  {
    id: 'value',
    concept: { en: 'a value', my: 'တန်ဖိုး' },
    brief: {
      en: 'He goes for the front of it. Give back the first part.',
      my: 'သူက ရှေ့ဆုံးကို သွားတယ်။ ပထမဆုံး အပိုင်းကို ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: 'return ',
    shown: [
      { parts: [4, 9, 2], want: 4 },
      { parts: [7, 1], want: 7 },
    ],
    cases: [
      { parts: [3, 8, 5], want: 3 },
      { parts: [6, 6, 1, 9], want: 6 },
      { parts: [2], want: 2 },
      { parts: [10, 4, 4], want: 10 },
    ],
    hints: [
      {
        en: 'A list is counted from 0, not from 1.',
        my: 'စာရင်းကို ၁ ကနေ မဟုတ်ဘဲ ၀ ကနေ ရေတွက်တယ်။',
      },
      { en: 'parts[___]', my: 'parts[___]' },
      { en: 'return parts[0];', my: 'return parts[0];' },
    ],
  },
  {
    id: 'reach',
    concept: { en: 'both ends', my: 'အစွန်းနှစ်ဖက်' },
    brief: {
      en: 'This time he swings through it. Give back the first part plus the last.',
      my: 'ဒီတစ်ခါ သူက တစ်ဖက်ကနေ တစ်ဖက် ဖြတ်တယ်။ ပထမ အပိုင်းနဲ့ နောက်ဆုံး အပိုင်း ပေါင်းပြီး ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: 'return ',
    shown: [
      { parts: [4, 9, 2], want: 6 },
      { parts: [7, 1], want: 8 },
    ],
    cases: [
      { parts: [3, 8, 5], want: 8 },
      { parts: [6, 6, 1, 9], want: 15 },
      { parts: [2], want: 4 },
      { parts: [10, 4, 1, 1, 5], want: 15 },
    ],
    hints: [
      {
        en: 'The last one is not always at the same place. How long is the list?',
        my: 'နောက်ဆုံးဟာက အမြဲ တစ်နေရာတည်းမှာ မရှိဘူး။ စာရင်းက ဘယ်လောက် ရှည်လဲ?',
      },
      { en: 'parts.length - 1 is where the last one is.', my: 'parts.length - 1 မှာ နောက်ဆုံးဟာ ရှိတယ်။' },
      {
        en: 'const last = parts[parts.length - 1];\nreturn parts[0] + last;',
        my: 'const last = parts[parts.length - 1];\nreturn parts[0] + last;',
      },
    ],
  },
  {
    id: 'choose',
    concept: { en: 'a choice', my: 'ရွေးချယ်မှု' },
    brief: {
      en: 'He only hits the heavier of the first two. Give that one back.',
      my: 'သူက ပထမ နှစ်ခုထဲက ပိုလေးတဲ့ဟာကိုပဲ ထိုးတယ်။ အဲဒါကို ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: 'return ',
    shown: [
      { parts: [4, 9, 2], want: 9 },
      { parts: [7, 1], want: 7 },
    ],
    cases: [
      { parts: [3, 8, 5], want: 8 },
      { parts: [6, 2, 1], want: 6 },
      { parts: [5, 5], want: 5 },
      { parts: [1, 20, 3], want: 20 },
    ],
    hints: [
      {
        en: 'Two answers, and something has to pick between them.',
        my: 'အဖြေ နှစ်ခု ရှိတယ်၊ တစ်ခုခုက ရွေးပေးရမယ်။',
      },
      { en: 'parts[0] > parts[1] ? ___ : ___', my: 'parts[0] > parts[1] ? ___ : ___' },
      {
        en: 'return parts[0] > parts[1] ? parts[0] : parts[1];',
        my: 'return parts[0] > parts[1] ? parts[0] : parts[1];',
      },
    ],
  },
  {
    id: 'every',
    concept: { en: 'all of them', my: 'အားလုံး' },
    brief: {
      en: 'Now every part at once. Give back all of them, each one doubled.',
      my: 'အခု အပိုင်းအားလုံးကို တစ်ပြိုင်နက်။ အားလုံးကို နှစ်ဆစီ လုပ်ပြီး ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number[]',
    starter: 'return ',
    shown: [
      { parts: [4, 9, 2], want: [8, 18, 4] },
      { parts: [7, 1], want: [14, 2] },
    ],
    cases: [
      { parts: [3, 8, 5], want: [6, 16, 10] },
      { parts: [6, 6, 1, 9], want: [12, 12, 2, 18] },
      { parts: [2], want: [4] },
      { parts: [0, 5], want: [0, 10] },
    ],
    hints: [
      {
        en: 'The same thing, done to each one, giving a list the same length back.',
        my: 'တစ်ခုချင်းစီကို အတူတူ လုပ်ပြီး အရှည်တူ စာရင်းတစ်ခု ပြန်ရမယ်။',
      },
      { en: 'parts.map((n) => ___)', my: 'parts.map((n) => ___)' },
      { en: 'return parts.map((n) => n * 2);', my: 'return parts.map((n) => n * 2);' },
    ],
  },
];
