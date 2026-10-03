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
 * are hidden: those are the fight. The hidden ones are where the traps are —
 * the empty list, the zero, the list of negatives — because that is where
 * code actually breaks, and finding that out by being hit is the lesson.
 *
 * And each rung is named only after it is beaten. Its label before then says
 * what is being asked, not which tool does it; the card that comes up when
 * the mirror falls is where "that was a filter" gets said. Doing it first and
 * being told what it was called second is how it gets remembered.
 */

import type { Value } from './values.js';

export type { Value };

export interface Words {
  readonly en: string;
  readonly my: string;
}

export interface Case {
  /** What the function is called with, in the order the signature lists. */
  readonly args: readonly Value[];
  readonly want: Value;
}

export interface Level {
  readonly id: string;
  /** Which chapter it belongs to, as an index into CHAPTERS. */
  readonly chapter: number;
  /** What is being asked, shown as a small label. Never the tool for it. */
  readonly concept: Words;
  readonly brief: Words;
  /**
   * TypeScript, read by the game for its parameter names and its promise
   * about what comes back, and drawn as the top line of the editor.
   */
  readonly signature: string;
  /** What the box starts with. */
  readonly starter: string;
  /** Two of them, shown as what happened last time he tried. */
  readonly shown: readonly Case[];
  /** The fight. One blow each. */
  readonly cases: readonly Case[];
  /** Three, each more of a giveaway than the last. The last is the answer. */
  readonly hints: readonly Words[];
  /** What it was, said once it is beaten. */
  readonly lesson: Words;
  /** Another way to write it, shown with the lesson. The tests run it too. */
  readonly another?: string;
}

export const CHAPTERS: readonly Words[] = [
  { en: 'Values and lists', my: 'တန်ဖိုးနဲ့ စာရင်း' },
  { en: 'Choosing', my: 'ရွေးချယ်ခြင်း' },
  { en: 'Again and again', my: 'ထပ်ခါ ထပ်ခါ' },
];

/** A case for a rung that takes one thing. */
const one = (input: Value, want: Value): Case => ({ args: [input], want });
/** A case for a rung that takes several. */
const many = (args: readonly Value[], want: Value): Case => ({ args, want });
/** Code reads the same in both languages. */
const code = (text: string): Words => ({ en: text, my: text });

export const LEVELS: readonly Level[] = [
  // ── Values and lists ────────────────────────────────────────────────
  {
    id: 'value',
    chapter: 0,
    concept: { en: 'the first', my: 'ပထမဆုံး' },
    brief: {
      en: 'He goes for the front of it. Give back the first part.',
      my: 'သူက ရှေ့ဆုံးကို သွားတယ်။ ပထမဆုံး အပိုင်းကို ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: 'return ',
    shown: [one([4, 9, 2], 4), one([7, 1], 7)],
    cases: [one([3, 8, 5], 3), one([6, 6, 1, 9], 6), one([2], 2), one([10, 4, 4], 10)],
    hints: [
      {
        en: 'A list is counted from 0, not from 1.',
        my: 'စာရင်းကို ၁ ကနေ မဟုတ်ဘဲ ၀ ကနေ ရေတွက်တယ်။',
      },
      code('parts[___]'),
      code('return parts[0];'),
    ],
    lesson: {
      en: 'A list is counted from 0, so parts[0] is the first and parts[1] the second. The number in the brackets is an index: where, not what. The other way below takes the list apart by position.',
      my: 'စာရင်းကို ၀ ကနေ ရေတွက်တယ်၊ ဒါကြောင့် parts[0] က ပထမ၊ parts[1] က ဒုတိယ။ ကွင်းထဲက ဂဏန်းကို index လို့ ခေါ်တယ် — ဘာလဲ မဟုတ်ဘဲ ဘယ်နေရာလဲ ဆိုတာ။ အောက်က နောက်တစ်နည်းက စာရင်းကို နေရာအလိုက် ခွဲထုတ်ယူတာ။',
    },
    another: 'const [first] = parts;\nreturn first;',
  },
  {
    id: 'last',
    chapter: 0,
    concept: { en: 'the last', my: 'နောက်ဆုံး' },
    brief: {
      en: 'He goes round the back. Give back the last part.',
      my: 'သူက နောက်ကနေ ပတ်ဝင်တယ်။ နောက်ဆုံး အပိုင်းကို ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: 'return ',
    shown: [one([4, 9, 2], 2), one([7, 1], 1)],
    cases: [one([3, 8, 5], 5), one([6, 6, 1, 9], 9), one([2], 2), one([10, 4, 4, 7, 3], 3)],
    hints: [
      {
        en: 'The lists are not all the same length, so the last one is not always in the same place.',
        my: 'စာရင်းတွေက အရှည် မတူကြဘူး၊ ဒါကြောင့် နောက်ဆုံးဟာက အမြဲ နေရာ တစ်ခုတည်းမှာ မရှိဘူး။',
      },
      {
        en: 'parts.length is how many there are. Counting from 0, the last index is one less than that.',
        my: 'parts.length က ဘယ်နှစ်ခု ရှိလဲ ပြောတယ်။ ၀ ကနေ ရေတွက်တော့ နောက်ဆုံး index က အဲဒီထက် တစ် လျော့တယ်။',
      },
      code('return parts[parts.length - 1];'),
    ],
    lesson: {
      en: 'length is how many; the last index is length - 1. One further, parts[parts.length], is past the end, and what is there is undefined. at(-1), below, counts from the back instead.',
      my: 'length က အရေအတွက်၊ နောက်ဆုံး index က length - 1။ နောက်တစ်ခု ထပ်ကျော်ရင် (parts[parts.length]) အဆုံးကို ကျော်သွားပြီ၊ အဲဒီမှာ ရှိတာက undefined။ အောက်က at(-1) ကတော့ နောက်ကနေ ပြန်ရေတွက်တယ်။',
    },
    another: 'return parts.at(-1);',
  },
  {
    id: 'reach',
    chapter: 0,
    concept: { en: 'both ends', my: 'အစွန်းနှစ်ဖက်' },
    brief: {
      en: 'This time he swings through it. Give back the first part plus the last.',
      my: 'ဒီတစ်ခါ သူက တစ်ဖက်ကနေ တစ်ဖက် ဖြတ်တယ်။ ပထမ အပိုင်းနဲ့ နောက်ဆုံး အပိုင်း ပေါင်းပြီး ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: 'return ',
    shown: [one([4, 9, 2], 6), one([7, 1], 8)],
    cases: [one([3, 8, 5], 8), one([6, 6, 1, 9], 15), one([2], 4), one([10, 4, 1, 1, 5], 15)],
    hints: [
      {
        en: 'Two things you already know how to reach, with a + between them.',
        my: 'ယူတတ်ပြီးသား အရာ နှစ်ခု၊ ကြားမှာ + တစ်ခု။',
      },
      {
        en: 'It reads better with names: const first = …; const last = …;',
        my: 'နာမည်ပေးလိုက်ရင် ပိုဖတ်ရလွယ်တယ်: const first = …; const last = …;',
      },
      code('const first = parts[0];\nconst last = parts[parts.length - 1];\nreturn first + last;'),
    ],
    lesson: {
      en: 'const gives a value a name. The name does nothing the value could not, but return first + last reads as what it means — and misspell a name and it fails at once, where a misspelt number would quietly be wrong.',
      my: 'const က တန်ဖိုး တစ်ခုကို နာမည် ပေးတယ်။ နာမည်က တန်ဖိုး မလုပ်နိုင်တာကို မလုပ်ပေးဘူး၊ ဒါပေမဲ့ return first + last က သူ့အဓိပ္ပာယ်အတိုင်း ဖတ်ရတယ် — ပြီးတော့ နာမည်ကို စာလုံးပေါင်း မှားရင် ချက်ချင်း error တက်တယ်၊ ဂဏန်း မှားရင်တော့ တိတ်တိတ်လေး မှားနေမှာ။',
    },
  },
  {
    id: 'middle',
    chapter: 0,
    concept: { en: 'the middle', my: 'အလယ်' },
    brief: {
      en: 'He aims for the centre. Give back the middle part — and when two are in the middle, the later one.',
      my: 'သူက အလယ်ကို ချိန်တယ်။ အလယ်က အပိုင်းကို ပြန်ပေးပါ — အလယ်မှာ နှစ်ခု ရှိနေရင် နောက်က တစ်ခုကို ယူပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: 'return ',
    shown: [one([4, 9, 2], 9), one([7, 1], 1)],
    cases: [one([3, 8, 5], 8), one([6, 6, 1, 9], 1), one([2], 2), one([10, 4, 4, 7, 3], 4), one([5, 1, 8, 2, 9, 3], 2)],
    hints: [
      {
        en: 'Half the length is about the middle — but half is not always a whole number.',
        my: 'အရှည်ရဲ့ တစ်ဝက်က အလယ်နားမှာပဲ — ဒါပေမဲ့ တစ်ဝက်က အမြဲ ကိန်းပြည့် မဖြစ်ဘူး။',
      },
      {
        en: 'Math.floor(x) drops everything after the point: Math.floor(1.5) is 1.',
        my: 'Math.floor(x) က ဒသမ နောက်က အပိုင်းကို ဖြုတ်ပစ်တယ်: Math.floor(1.5) က 1။',
      },
      code('const mid = Math.floor(parts.length / 2);\nreturn parts[mid];'),
    ],
    lesson: {
      en: 'An index has to be a whole number. parts[1.5] is not half-way between two parts; there is nothing there, so it is undefined.',
      my: 'index က ကိန်းပြည့် ဖြစ်ရမယ်။ parts[1.5] က အပိုင်း နှစ်ခုကြားက တစ်ဝက် မဟုတ်ဘူး၊ အဲဒီမှာ ဘာမှ မရှိလို့ undefined ဖြစ်တယ်။',
    },
  },
  {
    id: 'ends',
    chapter: 0,
    concept: { en: 'two at once', my: 'နှစ်ခု တစ်ပြိုင်နက်' },
    brief: {
      en: 'Both ends at once, as two blows. Give back a list: the first part, then the last.',
      my: 'အစွန်း နှစ်ဖက်ကို တစ်ပြိုင်နက် — ထိုးချက် နှစ်ချက်။ စာရင်း တစ်ခု ပြန်ပေးပါ: ပထမ အပိုင်း၊ ပြီးရင် နောက်ဆုံး အပိုင်း။',
    },
    signature: 'function strike(parts: number[]): number[]',
    starter: 'return ',
    shown: [one([4, 9, 2], [4, 2]), one([7, 1], [7, 1])],
    cases: [one([3, 8, 5], [3, 5]), one([6, 6, 1, 9], [6, 9]), one([2], [2, 2]), one([10, 4, 4, 7, 3], [10, 3])],
    hints: [
      {
        en: 'Look at what the signature promises this time: number[], not number. One number is not the answer, however right it is.',
        my: 'ဒီတစ်ခါ signature က ဘာကတိ ပေးထားလဲ ကြည့်ပါ: number မဟုတ်ဘဲ number[]။ ဂဏန်း တစ်လုံးတည်းက ဘယ်လောက်ပဲ မှန်မှန် အဖြေ မဟုတ်ဘူး။',
      },
      {
        en: 'Square brackets make a list: [a, b].',
        my: 'လေးထောင့်ကွင်းက စာရင်း ဖန်တီးတယ်: [a, b]။',
      },
      code('return [parts[0], parts[parts.length - 1]];'),
    ],
    lesson: {
      en: 'The return type is a promise. number and number[] are different promises, and only a list keeps the second.',
      my: 'return type က ကတိ တစ်ခုပဲ။ number နဲ့ number[] က မတူတဲ့ ကတိတွေ၊ ဒုတိယ ကတိကို စာရင်း တစ်ခုကပဲ တည်စေနိုင်တယ်။',
    },
    another: 'return [parts[0], parts.at(-1)];',
  },

  // ── Choosing ────────────────────────────────────────────────────────
  {
    id: 'choose',
    chapter: 1,
    concept: { en: 'a choice', my: 'ရွေးချယ်မှု' },
    brief: {
      en: 'He only hits the heavier of the first two. Give that one back.',
      my: 'သူက ပထမ နှစ်ခုထဲက ပိုလေးတဲ့ဟာကိုပဲ ထိုးတယ်။ အဲဒါကို ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: 'return ',
    shown: [one([4, 9, 2], 9), one([7, 1], 7)],
    cases: [one([3, 8, 5], 8), one([6, 2, 1], 6), one([5, 5], 5), one([1, 20, 3], 20)],
    hints: [
      {
        en: 'Two answers, and something has to pick between them.',
        my: 'အဖြေ နှစ်ခု ရှိတယ်၊ တစ်ခုခုက ရွေးပေးရမယ်။',
      },
      code('parts[0] > parts[1] ? ___ : ___'),
      code('return parts[0] > parts[1] ? parts[0] : parts[1];'),
    ],
    lesson: {
      en: 'a ? b : c is a choice that gives back a value. if and else are the same choice written as steps, which is easier to read once there are more than two answers.',
      my: 'a ? b : c က တန်ဖိုး ပြန်ပေးတဲ့ ရွေးချယ်မှု။ if နဲ့ else ကလည်း အဲဒီ ရွေးချယ်မှုပဲ၊ အဆင့်လိုက် ရေးထားတာ — အဖြေ နှစ်ခုထက် များလာရင် ပိုဖတ်ရလွယ်တယ်။',
    },
    another: 'if (parts[0] > parts[1]) {\n  return parts[0];\n}\nreturn parts[1];',
  },
  {
    id: 'even',
    chapter: 1,
    concept: { en: 'yes or no', my: 'ဟုတ်လား မဟုတ်လား' },
    brief: {
      en: "The mirror's guard is a single number now, and he only gets through when it is even. Give back true if n is even, false if it is not.",
      my: 'အခု မှန်ထဲကလူရဲ့ ကာကွယ်မှုက ဂဏန်း တစ်လုံးတည်း၊ စုံကိန်း ဖြစ်မှ သူ ဖောက်ဝင်နိုင်တယ်။ n က စုံကိန်း ဆိုရင် true၊ မဟုတ်ရင် false ပြန်ပေးပါ။',
    },
    signature: 'function strike(n: number): boolean',
    starter: 'return ',
    shown: [one(4, true), one(7, false)],
    cases: [one(10, true), one(3, false), one(0, true), one(15, false), one(-6, true)],
    hints: [
      {
        en: 'Even means it splits into twos with nothing left over.',
        my: 'စုံကိန်း ဆိုတာ နှစ်ခုစီ ခွဲရင် ဘာမှ မကျန်တာ။',
      },
      {
        en: 'n % 2 is what is left over after taking out all the twos.',
        my: 'n % 2 က နှစ်ခုစီ အကုန် ထုတ်ပြီးရင် ကျန်တဲ့ အကြွင်း။',
      },
      code('return n % 2 === 0;'),
    ],
    lesson: {
      en: 'A comparison is already a value: n % 2 === 0 is true or false by itself, so it needs no if around it. === compares exactly; == converts things first, and is best left alone.',
      my: 'နှိုင်းယှဉ်ချက် တစ်ခုက ကိုယ်တိုင် တန်ဖိုး ဖြစ်ပြီးသား: n % 2 === 0 က သူ့ဘာသာ true ဒါမှမဟုတ် false ဖြစ်တယ်၊ ဒါကြောင့် if နဲ့ ဝိုင်းစရာ မလိုဘူး။ === က တိတိကျကျ နှိုင်းယှဉ်တယ်၊ == က အရင် ပြောင်းပြီးမှ နှိုင်းယှဉ်လို့ မသုံးတာ ကောင်းတယ်။',
    },
  },
  {
    id: 'sign',
    chapter: 1,
    concept: { en: 'three ways', my: 'လမ်း သုံးသွယ်' },
    brief: {
      en: 'He reads which way it leans. Give back -1 if n is below zero, 0 if it is zero, and 1 if it is above.',
      my: 'သူက ဘယ်ဘက်ကို ယိမ်းနေလဲ ဖတ်တယ်။ n က သုညအောက် ဆိုရင် -1၊ သုည ဆိုရင် 0၊ သုညအထက် ဆိုရင် 1 ပြန်ပေးပါ။',
    },
    signature: 'function strike(n: number): number',
    starter: '',
    shown: [one(-4, -1), one(9, 1)],
    cases: [one(-1, -1), one(0, 0), one(3, 1), one(-20, -1), one(100, 1)],
    hints: [
      {
        en: 'Three answers, so one question is not enough. Ask one; if it is not that, ask the next.',
        my: 'အဖြေ သုံးမျိုး ရှိလို့ မေးခွန်း တစ်ခုတည်းနဲ့ မလုံလောက်ဘူး။ တစ်ခု မေး၊ အဲဒါ မဟုတ်ရင် နောက်တစ်ခု မေး။',
      },
      code('if (…) { … } else if (…) { … } else { … }'),
      code('if (n < 0) {\n  return -1;\n} else if (n === 0) {\n  return 0;\n} else {\n  return 1;\n}'),
    ],
    lesson: {
      en: 'Once a return runs, the function is over. So below if (n < 0) return -1; everything already knows n is not negative, and the elses can go. Math.sign, below, is this exact thing built in.',
      my: 'return တစ်ခု run သွားတာနဲ့ function ပြီးသွားပြီ။ ဒါကြောင့် if (n < 0) return -1; ရဲ့ အောက်မှာ n က အနုတ် မဟုတ်ဘူးဆိုတာ သိပြီးသား၊ else တွေ မထည့်လည်း ရတယ်။ အောက်က Math.sign က ဒီအတိုင်း အသင့်ပါပြီးသား။',
    },
    another: 'return Math.sign(n);',
  },
  {
    id: 'between',
    chapter: 1,
    concept: { en: 'in between', my: 'ကြားထဲ' },
    brief: {
      en: "Three numbers now: his reach n, and the two edges of the mirror's guard, low and high. He lands only if n is between them, and landing on an edge counts.",
      my: 'အခု ဂဏန်း သုံးလုံး: သူ့လက်တံ n နဲ့ မှန်ထဲကလူရဲ့ ကာကွယ်မှု အစွန်း နှစ်ဖက် low နဲ့ high။ n က အဲဒီ နှစ်ခုကြားမှာ ရှိမှ ထိတယ်၊ အစွန်းပေါ် ကျရင်လည်း ထိတယ်လို့ ယူတယ်။',
    },
    signature: 'function strike(n: number, low: number, high: number): boolean',
    starter: 'return ',
    shown: [many([5, 1, 9], true), many([12, 1, 9], false)],
    cases: [
      many([1, 1, 9], true),
      many([9, 1, 9], true),
      many([0, 1, 9], false),
      many([10, 1, 9], false),
      many([4, 4, 4], true),
      many([-3, -5, 0], true),
    ],
    hints: [
      {
        en: 'Two things have to be true at once: n is not below low, and n is not above high.',
        my: 'အရာ နှစ်ခု တစ်ပြိုင်နက် မှန်ရမယ်: n က low အောက် မရောက်ရဘူး၊ high အထက် မကျော်ရဘူး။',
      },
      {
        en: '&& means and: it is true only when both sides are. >= includes the edge; > does not.',
        my: '&& က "နဲ့" — ဘက် နှစ်ဖက်လုံး မှန်မှ true ဖြစ်တယ်။ >= က အစွန်းကို ထည့်တွက်တယ်၊ > က မထည့်ဘူး။',
      },
      code('return n >= low && n <= high;'),
    ],
    lesson: {
      en: '&& is and, || is or, ! is not. Turned inside out, between is "not below and not above", which is !(n < low || n > high) — the same test said the other way round.',
      my: '&& က "နဲ့"၊ || က "သို့မဟုတ်"၊ ! က "မဟုတ်"။ ပြောင်းပြန် လှန်ကြည့်ရင် ကြားထဲ ဆိုတာ "အောက် မရောက်၊ အထက် မကျော်" — !(n < low || n > high) ပဲ၊ စစ်တာ အတူတူ၊ ပြောပုံပဲ ပြောင်းပြန်။',
    },
    another: 'return !(n < low || n > high);',
  },
  {
    id: 'fallback',
    chapter: 1,
    concept: { en: 'nothing there', my: 'ဘာမှ မရှိရင်' },
    brief: {
      en: 'Sometimes there is nothing there at all. Give back the first part — or -1 when the list is empty.',
      my: 'တခါတလေ ဘာမှ မရှိဘူး။ ပထမ အပိုင်းကို ပြန်ပေးပါ — စာရင်း ဗလာ ဖြစ်နေရင် -1 ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: 'return ',
    shown: [one([4, 9, 2], 4), one([], -1)],
    cases: [one([7], 7), one([], -1), one([0, 5], 0), one([3, 8, 5], 3)],
    hints: [
      {
        en: 'parts[0] of an empty list is undefined. You need to notice that — and only that.',
        my: 'စာရင်း ဗလာရဲ့ parts[0] က undefined။ အဲဒါကို သတိထားမိရမယ် — အဲဒါကိုပဲ။',
      },
      {
        en: 'Careful with ||: to it, 0 counts as nothing too. ?? only steps in for undefined and null.',
        my: '|| ကို သတိထား: သူ့အတွက် 0 ကလည်း "ဘာမှ မရှိ" ပဲ။ ?? ကတော့ undefined နဲ့ null အတွက်ပဲ ဝင်ပေးတယ်။',
      },
      code('return parts.length === 0 ? -1 : parts[0];'),
    ],
    lesson: {
      en: 'Edge cases are where code breaks: the empty list, the zero, the list with one thing in it. parts[0] || -1 gets [0, 5] wrong, because || treats 0 as nothing; ?? does not.',
      my: 'edge case တွေမှာ code ပျက်တတ်တယ်: စာရင်း ဗလာ၊ သုည၊ တစ်ခုတည်း ပါတဲ့ စာရင်း။ parts[0] || -1 က [0, 5] မှာ မှားတယ်၊ || က 0 ကို ဘာမှ မရှိဘူးလို့ ယူလို့၊ ?? ကတော့ အဲလို မယူဘူး။',
    },
    another: 'return parts[0] ?? -1;',
  },

  // ── Again and again ─────────────────────────────────────────────────
  {
    id: 'total',
    chapter: 2,
    concept: { en: 'all of it', my: 'အားလုံး ပေါင်း' },
    brief: {
      en: 'Every part, one after another, into a single blow. Give back the total of them all.',
      my: 'အပိုင်း တစ်ခုပြီး တစ်ခု၊ ထိုးချက် တစ်ချက်ထဲ ပေါင်းထည့်။ အားလုံးရဲ့ စုစုပေါင်းကို ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: '',
    shown: [one([4, 9, 2], 15), one([7, 1], 8)],
    cases: [one([3, 8, 5], 16), one([6, 6, 1, 9], 22), one([2], 2), one([], 0), one([10, -4, 4], 10)],
    hints: [
      {
        en: 'Keep a running total. Start it at 0 and add each part to it in turn.',
        my: 'ပေါင်းလဒ်ကို တစ်လျှောက်လုံး မှတ်ထား။ 0 ကနေ စပြီး အပိုင်း တစ်ခုချင်းစီကို အလှည့်ကျ ပေါင်းထည့်။',
      },
      {
        en: 'for (const n of parts) { … } runs once for every part, with n as that part. The total has to be let, not const, because it changes.',
        my: 'for (const n of parts) { … } က အပိုင်း တစ်ခုစီအတွက် တစ်ခါစီ run တယ်၊ n က အဲဒီ အပိုင်းပဲ။ total က ပြောင်းနေမှာမို့ const မဟုတ်ဘဲ let ဖြစ်ရမယ်။',
      },
      code('let total = 0;\nfor (const n of parts) {\n  total += n;\n}\nreturn total;'),
    ],
    lesson: {
      en: 'That shape is an accumulator: a let before the loop, changed inside it, returned after it. A good half of all loops are this, and reduce is its name when it is said in one line.',
      my: 'ဒီပုံစံကို accumulator (စုဆောင်းကိန်း) လို့ ခေါ်တယ်: loop မတိုင်ခင် let တစ်ခု၊ loop ထဲမှာ ပြောင်း၊ loop ပြီးမှ return။ loop တွေရဲ့ တစ်ဝက်လောက်က ဒီပုံစံပဲ၊ တစ်ကြောင်းတည်းနဲ့ ရေးရင် reduce လို့ ခေါ်တယ်။',
    },
    another: 'return parts.reduce((sum, n) => sum + n, 0);',
  },
  {
    id: 'count',
    chapter: 2,
    concept: { en: 'how many', my: 'ဘယ်နှစ်ခု' },
    brief: {
      en: 'He only feels the heavy ones. Give back how many parts are above 5.',
      my: 'သူက လေးတဲ့ အပိုင်းတွေကိုပဲ ခံစားရတယ်။ 5 ထက် ကြီးတဲ့ အပိုင်း ဘယ်နှစ်ခု ရှိလဲ ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: '',
    shown: [one([4, 9, 2], 1), one([7, 6], 2)],
    cases: [one([3, 8, 5], 1), one([6, 6, 1, 9], 3), one([2], 0), one([], 0), one([10, 5, 11, 5], 2)],
    hints: [
      {
        en: 'A total again — but of how many, not how much, and only some of them count.',
        my: 'စုစုပေါင်းပဲ — ဒါပေမဲ့ ဘယ်လောက်လဲ မဟုတ်ဘဲ ဘယ်နှစ်ခုလဲ၊ ပြီးတော့ တချို့ပဲ ထည့်တွက်တယ်။',
      },
      {
        en: 'An if inside the loop decides which ones count. Above 5 is > 5, so 5 itself does not.',
        my: 'loop ထဲက if တစ်ခုက ဘယ်ဟာ ထည့်တွက်မလဲ ဆုံးဖြတ်တယ်။ 5 ထက်ကြီး ဆိုတာ > 5၊ ဒါကြောင့် 5 ကိုယ်တိုင် မပါဘူး။',
      },
      code('let count = 0;\nfor (const n of parts) {\n  if (n > 5) count += 1;\n}\nreturn count;'),
    ],
    lesson: {
      en: 'A loop with an if inside is a filter: it decides, one at a time, what gets in. The other way below says the same thing — keep the ones above 5, then count them.',
      my: 'ထဲမှာ if ပါတဲ့ loop က filter (စစ်ထုတ်) ပဲ: တစ်ခုချင်း ဘာ ဝင်ခွင့်ရမလဲ ဆုံးဖြတ်တယ်။ အောက်က နောက်တစ်နည်းကလည်း အတူတူပဲ ပြောတယ် — 5 ထက်ကြီးတာတွေကို ချန်ထား၊ ပြီးမှ ရေတွက်။',
    },
    another: 'return parts.filter((n) => n > 5).length;',
  },
  {
    id: 'biggest',
    chapter: 2,
    concept: { en: 'the heaviest', my: 'အလေးဆုံး' },
    brief: {
      en: 'He goes for the heaviest. Give back the biggest part.',
      my: 'သူက အလေးဆုံးကို သွားတယ်။ အကြီးဆုံး အပိုင်းကို ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: '',
    shown: [one([4, 9, 2], 9), one([7, 1], 7)],
    cases: [one([3, 8, 5], 8), one([6, 6, 1, 9], 9), one([2], 2), one([-4, -2, -7], -2), one([10, 40, 4, 40], 40)],
    hints: [
      {
        en: 'Walk the list keeping the best one so far. Each new part either beats it or does not.',
        my: 'စာရင်းကို လျှောက်သွားရင်း အခုထိ အကောင်းဆုံးကို မှတ်ထား။ အပိုင်းသစ် တစ်ခုစီက အဲဒါကို နိုင်တာ ဒါမှမဟုတ် မနိုင်တာ ဖြစ်မယ်။',
      },
      {
        en: 'Start the best at parts[0], not at 0 — the parts are not always above zero.',
        my: 'အကောင်းဆုံးကို 0 ကနေ မစနဲ့၊ parts[0] ကနေ စ — အပိုင်းတွေက အမြဲ သုညထက် မကြီးဘူး။',
      },
      code('let best = parts[0];\nfor (const n of parts) {\n  if (n > best) best = n;\n}\nreturn best;'),
    ],
    lesson: {
      en: 'Where a loop starts matters as much as what it does. 0 is the right start for a total and the wrong one for a biggest, and only a list of negatives shows it.',
      my: 'loop က ဘယ်က စလဲ ဆိုတာ ဘာလုပ်လဲ ဆိုတာလောက် အရေးကြီးတယ်။ 0 က စုစုပေါင်းအတွက် မှန်တဲ့ အစ၊ အကြီးဆုံးအတွက် မှားတဲ့ အစ — အနုတ်ချည်းပဲ ပါတဲ့ စာရင်းကမှ အဲဒါကို ပြတယ်။',
    },
    another: 'return Math.max(...parts);',
  },
  {
    id: 'where',
    chapter: 2,
    concept: { en: 'where', my: 'ဘယ်နေရာ' },
    brief: {
      en: 'He looks for the gap. Give back the index of the first 0 — or -1 if there is no 0 at all.',
      my: 'သူက ကွက်လပ်ကို ရှာတယ်။ ပထမဆုံး 0 ရဲ့ index ကို ပြန်ပေးပါ — 0 လုံးဝ မရှိရင် -1။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: '',
    shown: [one([4, 0, 2], 1), one([7, 1], -1)],
    cases: [one([0, 8, 5], 0), one([6, 6, 1, 0], 3), one([2], -1), one([], -1), one([3, 0, 0], 1)],
    hints: [
      {
        en: 'This time you need where each part is, not only what it is.',
        my: 'ဒီတစ်ခါ အပိုင်းက ဘာလဲ ဆိုတာတင် မဟုတ်ဘဲ ဘယ်နေရာမှာလဲ ဆိုတာပါ လိုတယ်။',
      },
      {
        en: 'for (let i = 0; i < parts.length; i += 1) walks i through every index. A return inside it stops the loop and the function at once.',
        my: 'for (let i = 0; i < parts.length; i += 1) က i ကို index တိုင်း ဖြတ်ပြီး လျှောက်စေတယ်။ အထဲက return က loop ရော function ရော ချက်ချင်း ရပ်လိုက်တယ်။',
      },
      code('for (let i = 0; i < parts.length; i += 1) {\n  if (parts[i] === 0) return i;\n}\nreturn -1;'),
    ],
    lesson: {
      en: 'Returning from inside a loop is how to stop early. The return after the loop is what happens when nothing was found, and -1 is the usual way to say "nowhere".',
      my: 'loop ထဲကနေ return လုပ်တာက စောစော ရပ်တဲ့ နည်း။ loop ပြီးမှ ရှိတဲ့ return က ဘာမှ ရှာမတွေ့တဲ့အခါ ဖြစ်တာ၊ -1 က "ဘယ်မှာမှ မရှိ" လို့ ပြောတဲ့ ပုံမှန် နည်း။',
    },
    another: 'return parts.indexOf(0);',
  },
  {
    id: 'all',
    chapter: 2,
    concept: { en: 'every one', my: 'တစ်ခုမကျန်' },
    brief: {
      en: 'He breaks through only if every part is above 0. Give back true if they all are, and false if even one is not.',
      my: 'အပိုင်းတိုင်း 0 ထက် ကြီးမှ သူ ဖောက်ထွင်းနိုင်တယ်။ အကုန်လုံး ကြီးရင် true၊ တစ်ခုတည်း မကြီးရင်တောင် false ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): boolean',
    starter: '',
    shown: [one([4, 9, 2], true), one([7, 0, 1], false)],
    cases: [one([3, 8, 5], true), one([6, -6, 1], false), one([2], true), one([], true), one([1, 1, 1, 0], false)],
    hints: [
      {
        en: 'One part is enough to make it false. Nothing at all is needed to make it true.',
        my: 'false ဖြစ်ဖို့ အပိုင်း တစ်ခုတည်း လုံလောက်တယ်။ true ဖြစ်ဖို့ကျတော့ ဘာမှ မလိုဘူး။',
      },
      {
        en: 'Return false the moment you meet one that is not above 0. If the loop gets to the end, there was none.',
        my: '0 ထက် မကြီးတာ တစ်ခု တွေ့တာနဲ့ false ကို ချက်ချင်း return လုပ်။ loop က အဆုံးထိ ရောက်သွားရင် အဲလို တစ်ခုမှ မရှိခဲ့ဘူး။',
      },
      code('for (const n of parts) {\n  if (n <= 0) return false;\n}\nreturn true;'),
    ],
    lesson: {
      en: 'The empty list is true: nothing in it breaks the rule. parts.every(…) agrees, and parts.some(…) is its other half — true as soon as one does.',
      my: 'စာရင်း ဗလာက true: အထဲမှာ စည်းကမ်း ချိုးတာ ဘာမှ မရှိလို့။ parts.every(…) ကလည်း သဘောတူတယ်၊ parts.some(…) က သူ့ရဲ့ ကျန်တစ်ခြမ်း — တစ်ခု မှန်တာနဲ့ true။',
    },
    another: 'return parts.every((n) => n > 0);',
  },
  {
    id: 'countdown',
    chapter: 2,
    concept: { en: 'counting down', my: 'ပြန်ရေ' },
    brief: {
      en: 'A countdown, one blow for each number. Give back a list that goes from n down to 1.',
      my: 'ပြန်ရေတွက်ပြီး ထိုးမယ်၊ ဂဏန်း တစ်လုံး ထိုးချက် တစ်ချက်။ n ကနေ 1 အထိ ပြန်ဆင်းသွားတဲ့ စာရင်း တစ်ခု ပြန်ပေးပါ။',
    },
    signature: 'function strike(n: number): number[]',
    starter: '',
    shown: [one(3, [3, 2, 1]), one(1, [1])],
    cases: [one(5, [5, 4, 3, 2, 1]), one(2, [2, 1]), one(0, []), one(4, [4, 3, 2, 1])],
    hints: [
      {
        en: 'Start with an empty list and put one number into it at a time.',
        my: 'စာရင်း ဗလာ တစ်ခုနဲ့ စပြီး ဂဏန်း တစ်လုံးချင်း ထည့်။',
      },
      {
        en: 'list.push(x) puts x on the end. A for loop can count down as well as up: i -= 1.',
        my: 'list.push(x) က x ကို နောက်ဆုံးမှာ ထည့်တယ်။ for loop က အတက်ရော အဆင်းရော ရေတွက်နိုင်တယ်: i -= 1။',
      },
      code('const out = [];\nfor (let i = n; i >= 1; i -= 1) {\n  out.push(i);\n}\nreturn out;'),
    ],
    lesson: {
      en: 'const out = [] can still be pushed to. const means the name always points at the same list — not that the list can never change.',
      my: 'const out = [] ကို push လုပ်လို့ ရသေးတယ်။ const ဆိုတာ နာမည်က အမြဲ စာရင်း တစ်ခုတည်းကို ညွှန်ထားတယ်လို့ ဆိုလိုတာ — စာရင်းက ဘယ်တော့မှ မပြောင်းနိုင်ဘူးလို့ မဟုတ်ဘူး။',
    },
    another: 'return Array.from({ length: n }, (_, i) => n - i);',
  },
  {
    id: 'double',
    chapter: 2,
    concept: { en: 'each one, doubled', my: 'တစ်ခုစီ နှစ်ဆ' },
    brief: {
      en: 'Now every part at once. Give back all of them, each one doubled.',
      my: 'အခု အပိုင်းအားလုံးကို တစ်ပြိုင်နက်။ အားလုံးကို နှစ်ဆစီ လုပ်ပြီး ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number[]',
    starter: 'return ',
    shown: [one([4, 9, 2], [8, 18, 4]), one([7, 1], [14, 2])],
    cases: [one([3, 8, 5], [6, 16, 10]), one([6, 6, 1, 9], [12, 12, 2, 18]), one([2], [4]), one([0, 5], [0, 10])],
    hints: [
      {
        en: 'A new list, the same length, built one part at a time. You have just done this.',
        my: 'အရှည်တူ စာရင်းသစ် တစ်ခု၊ အပိုင်း တစ်ခုချင်း တည်ဆောက်။ ဒါ မင်း ခုနက လုပ်ခဲ့ပြီးပြီ။',
      },
      {
        en: 'parts.map((n) => ___) runs the loop for you and hands back the new list.',
        my: 'parts.map((n) => ___) က loop ကို မင်းအစား run ပေးပြီး စာရင်းသစ်ကို ပြန်ပေးတယ်။',
      },
      code('return parts.map((n) => n * 2);'),
    ],
    lesson: {
      en: 'map is the loop-and-push of the last rung, said in one line. It never changes parts — it makes a new list, the same length, every time.',
      my: 'map က အရင်အဆင့်က loop-နဲ့-push ကို တစ်ကြောင်းတည်းနဲ့ ပြောတာ။ parts ကို ဘယ်တော့မှ မပြောင်းဘူး — အရှည်တူ စာရင်းသစ် တစ်ခုကို အမြဲ ဖန်တီးတယ်။',
    },
    another: 'const out = [];\nfor (const n of parts) out.push(n * 2);\nreturn out;',
  },
];
