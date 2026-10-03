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
  { en: 'Array methods', my: 'Array method တွေ' },
  { en: 'Text', my: 'စာသား' },
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

  // ── Array methods ───────────────────────────────────────────────────
  {
    id: 'evens',
    chapter: 3,
    concept: { en: 'only the even ones', my: 'စုံကိန်းတွေပဲ' },
    brief: {
      en: 'He only lands on even parts. Give back a list of just the even ones, in the order they came.',
      my: 'သူက စုံကိန်း အပိုင်းတွေကိုပဲ ထိတယ်။ စုံကိန်းတွေချည်းပဲ ပါတဲ့ စာရင်း တစ်ခုကို မူလ အစီအစဉ်အတိုင်း ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number[]',
    starter: 'return ',
    shown: [one([4, 9, 2], [4, 2]), one([7, 1], [])],
    cases: [one([3, 8, 5], [8]), one([6, 6, 1, 9], [6, 6]), one([2], [2]), one([], []), one([0, -4, 3], [0, -4])],
    hints: [
      {
        en: 'You wrote this shape in the last chapter: a loop, an if, and a list to push into. There is a shorter way.',
        my: 'ဒီပုံစံကို အရင်အခန်းမှာ ရေးခဲ့ပြီးပြီ: loop တစ်ခု၊ if တစ်ခု၊ push လုပ်မယ့် စာရင်း တစ်ခု။ ပိုတိုတဲ့ နည်း ရှိတယ်။',
      },
      {
        en: 'parts.filter((n) => ___) keeps every part for which the test is true.',
        my: 'parts.filter((n) => ___) က စစ်ချက် true ဖြစ်တဲ့ အပိုင်းတိုင်းကို ချန်ထားတယ်။',
      },
      code('return parts.filter((n) => n % 2 === 0);'),
    ],
    lesson: {
      en: 'filter takes a test and keeps what passes it, in order. The test has to give back true or false — which n % 2 === 0 already is.',
      my: 'filter က စစ်ချက် တစ်ခု ယူပြီး အောင်တဲ့ဟာတွေကို အစီအစဉ်အတိုင်း ချန်ထားတယ်။ စစ်ချက်က true ဒါမှမဟုတ် false ပြန်ပေးရမယ် — n % 2 === 0 က အဲဒါ ဖြစ်ပြီးသား။',
    },
    another: 'const out = [];\nfor (const n of parts) {\n  if (n % 2 === 0) out.push(n);\n}\nreturn out;',
  },
  {
    id: 'above',
    chapter: 3,
    concept: { en: 'over the line', my: 'မျဉ်းကို ကျော်တာ' },
    brief: {
      en: 'Now the line moves. Give back the parts that are above limit — whatever limit is this time.',
      my: 'အခု မျဉ်းက ရွေ့တယ်။ limit ထက် ကြီးတဲ့ အပိုင်းတွေကို ပြန်ပေးပါ — ဒီတစ်ခါ limit က ဘာပဲ ဖြစ်ဖြစ်။',
    },
    signature: 'function strike(parts: number[], limit: number): number[]',
    starter: 'return ',
    shown: [many([[4, 9, 2], 3], [4, 9]), many([[7, 1], 10], [])],
    cases: [
      many([[3, 8, 5], 5], [8]),
      many([[6, 6, 1, 9], 0], [6, 6, 1, 9]),
      many([[2], 2], []),
      many([[-1, -5, 0], -2], [-1, 0]),
      many([[], 1], []),
    ],
    hints: [
      {
        en: 'The same filter, but the test now uses limit, which comes from outside it.',
        my: 'filter ပဲ၊ ဒါပေမဲ့ စစ်ချက်က အပြင်ကနေ လာတဲ့ limit ကို သုံးတယ်။',
      },
      {
        en: 'The arrow inside filter can see limit: (n) => n > limit.',
        my: 'filter ထဲက arrow က limit ကို မြင်နိုင်တယ်: (n) => n > limit။',
      },
      code('return parts.filter((n) => n > limit);'),
    ],
    lesson: {
      en: 'The little function inside filter can use names from around it, like limit. That is a closure, and it is why one filter can serve any limit.',
      my: 'filter ထဲက function အသေးလေးက သူ့ပတ်ဝန်းကျင်က နာမည်တွေကို (limit လို) သုံးနိုင်တယ်။ အဲဒါကို closure လို့ ခေါ်တယ်၊ filter တစ်ခုတည်းက limit မျိုးစုံအတွက် အလုပ်လုပ်နိုင်တာ ဒါကြောင့်ပဲ။',
    },
  },
  {
    id: 'firstbig',
    chapter: 3,
    concept: { en: 'the first big one', my: 'ပထမဆုံး အကြီး' },
    brief: {
      en: 'He takes the first part above 10 and no other. Give it back — or -1 if there is none.',
      my: 'သူက 10 ထက်ကြီးတဲ့ ပထမဆုံး အပိုင်းကိုပဲ ယူတယ်၊ တခြား မယူဘူး။ အဲဒါကို ပြန်ပေးပါ — မရှိရင် -1။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: 'return ',
    shown: [one([4, 19, 12], 19), one([7, 1], -1)],
    cases: [one([30, 8, 50], 30), one([6, 11], 11), one([10], -1), one([], -1), one([1, 2, 99], 99)],
    hints: [
      {
        en: 'filter would give back all of them. You want only the first, and to stop looking once you have it.',
        my: 'filter က အကုန် ပြန်ပေးလိမ့်မယ်။ မင်း လိုတာ ပထမ တစ်ခုပဲ၊ တွေ့တာနဲ့ ရှာတာ ရပ်ရမယ်။',
      },
      {
        en: 'parts.find((n) => ___) gives back the first that passes, or undefined if none does.',
        my: 'parts.find((n) => ___) က အောင်တဲ့ ပထမ တစ်ခုကို ပြန်ပေးတယ်၊ တစ်ခုမှ မအောင်ရင် undefined။',
      },
      code('return parts.find((n) => n > 10) ?? -1;'),
    ],
    lesson: {
      en: 'find stops at the first match; filter never stops. And find gives undefined when nothing matches, which is what ?? is for.',
      my: 'find က ပထမဆုံး ကိုက်တာမှာ ရပ်တယ်၊ filter က ဘယ်တော့မှ မရပ်ဘူး။ ပြီးတော့ ဘာမှ မကိုက်ရင် find က undefined ပေးတယ် — ?? က အဲဒီအတွက်ပဲ။',
    },
  },
  {
    id: 'has',
    chapter: 3,
    concept: { en: 'is it there', my: 'ပါလား' },
    brief: {
      en: 'He only swings if 7 is somewhere in it. Give back true if 7 is one of the parts, false if not.',
      my: 'အပိုင်းတွေထဲမှာ 7 ပါမှ သူ လွှဲထိုးတယ်။ 7 ပါရင် true၊ မပါရင် false ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): boolean',
    starter: 'return ',
    shown: [one([4, 7, 2], true), one([1, 1], false)],
    cases: [one([7], true), one([], false), one([17, 70], false), one([3, 8, 5, 7], true), one([-7], false)],
    hints: [
      {
        en: 'You need neither where it is nor what it is — only whether it is there at all.',
        my: 'ဘယ်နေရာမှာလဲ၊ ဘာလဲ မလိုဘူး — ပါသလား မပါဘူးလား ဆိုတာပဲ လိုတယ်။',
      },
      {
        en: 'parts.includes(x) answers exactly that.',
        my: 'parts.includes(x) က အဲဒီမေးခွန်းကို တိုက်ရိုက် ဖြေတယ်။',
      },
      code('return parts.includes(7);'),
    ],
    lesson: {
      en: 'includes is yes or no; indexOf is where, or -1; find is the thing itself. Three questions about the same list, and picking the one that asks yours is half the work.',
      my: 'includes က ဟုတ်/မဟုတ်၊ indexOf က ဘယ်နေရာ (မရှိရင် -1)၊ find က အဲဒီအရာကိုယ်တိုင်။ စာရင်း တစ်ခုတည်းအပေါ် မေးခွန်း သုံးမျိုး — ကိုယ့်မေးခွန်းနဲ့ ကိုက်တာကို ရွေးတတ်တာက အလုပ်ရဲ့ တစ်ဝက်ပဲ။',
    },
    another: 'return parts.some((n) => n === 7);',
  },
  {
    id: 'sorted',
    chapter: 3,
    concept: { en: 'smallest first', my: 'အငယ်ဆုံးက ရှေ့' },
    brief: {
      en: 'He takes them in order, lightest first. Give back the parts sorted from smallest to biggest.',
      my: 'သူက အပေါ့ဆုံးကနေ စီပြီး ယူတယ်။ အပိုင်းတွေကို အငယ်ဆုံးကနေ အကြီးဆုံးအထိ စီပြီး ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number[]',
    starter: 'return ',
    shown: [one([4, 9, 2], [2, 4, 9]), one([7, 1], [1, 7])],
    cases: [
      one([10, 9, 1], [1, 9, 10]),
      one([3, 8, 5], [3, 5, 8]),
      one([100, 25, 3], [3, 25, 100]),
      one([2], [2]),
      one([-1, -10, 5], [-10, -1, 5]),
    ],
    hints: [
      {
        en: 'parts.sort() looks right on the examples. Work out what it does to [10, 9, 1] first.',
        my: 'parts.sort() က နမူနာတွေမှာ မှန်သလို ထင်ရတယ်။ [10, 9, 1] ကို ဘာလုပ်မလဲ အရင် စဉ်းစားကြည့်ပါ။',
      },
      {
        en: 'Left alone, sort compares them as text, so 10 comes before 9. Give it a comparison: (a, b) => a - b.',
        my: 'ဘာမှ မပေးရင် sort က စာသားလို နှိုင်းယှဉ်တယ်၊ ဒါကြောင့် 10 က 9 ရဲ့ ရှေ့ ရောက်တယ်။ နှိုင်းယှဉ်ပုံ တစ်ခု ပေးပါ: (a, b) => a - b။',
      },
      code('return [...parts].sort((a, b) => a - b);'),
    ],
    lesson: {
      en: "sort with no comparison sorts as text: '10' comes before '9' the way 'ba' comes before 'c'. Given (a, b) => a - b it sorts as numbers. And sort changes the very list it is given, which is why the answer copies it first with [...parts] — or uses toSorted, below, which never changes it.",
      my: "နှိုင်းယှဉ်ပုံ မပေးရင် sort က စာသားလို စီတယ်: 'ba' က 'c' ရဲ့ ရှေ့ ရောက်သလိုပဲ '10' က '9' ရဲ့ ရှေ့ ရောက်တယ်။ (a, b) => a - b ပေးမှ ဂဏန်းလို စီတယ်။ ပြီးတော့ sort က ပေးလိုက်တဲ့ စာရင်းကိုယ်တိုင်ကို ပြောင်းပစ်တယ် — ဒါကြောင့် အဖြေက [...parts] နဲ့ အရင် ကူးယူတာ၊ ဒါမှမဟုတ် အောက်က toSorted ကို သုံးတာ၊ သူက ဘယ်တော့မှ မပြောင်းဘူး။",
    },
    another: 'return parts.toSorted((a, b) => a - b);',
  },
  {
    id: 'unique',
    chapter: 3,
    concept: { en: 'once each', my: 'တစ်ခါစီ' },
    brief: {
      en: 'He never hits the same number twice. Give back the parts with the repeats taken out, each kept where it first appeared.',
      my: 'သူက ဂဏန်း တစ်ခုတည်းကို နှစ်ခါ ဘယ်တော့မှ မထိုးဘူး။ ထပ်နေတာတွေကို ဖယ်ပြီး ပြန်ပေးပါ — တစ်ခုစီကို ပထမဆုံး ပေါ်ခဲ့တဲ့ နေရာမှာ ထားပါ။',
    },
    signature: 'function strike(parts: number[]): number[]',
    starter: 'return ',
    shown: [one([4, 9, 4, 2], [4, 9, 2]), one([7, 7], [7])],
    cases: [
      one([3, 8, 3, 8, 5], [3, 8, 5]),
      one([1, 2, 3], [1, 2, 3]),
      one([], []),
      one([5, 5, 5, 5], [5]),
      one([2, 1, 2, 1], [2, 1]),
    ],
    hints: [
      {
        en: 'A Set is a collection that cannot hold the same thing twice.',
        my: 'Set ဆိုတာ အရာ တစ်ခုတည်းကို နှစ်ခါ မထည့်နိုင်တဲ့ စုစည်းမှု တစ်ခု။',
      },
      {
        en: 'new Set(parts) drops the repeats — but a Set is not a list, and the signature promised number[]. Spread it back into one: [...set].',
        my: 'new Set(parts) က ထပ်နေတာတွေကို ဖယ်ပေးတယ် — ဒါပေမဲ့ Set က စာရင်း မဟုတ်ဘူး၊ signature က number[] ကတိပေးထားတယ်။ စာရင်းအဖြစ် ပြန်ဖြန့်ပါ: [...set]။',
      },
      code('return [...new Set(parts)];'),
    ],
    lesson: {
      en: 'A Set keeps each thing once, in the order it first arrived. It is not an array, though — handing it back breaks the promise of number[] — so [...] spreads it back into one.',
      my: 'Set က အရာတစ်ခုစီကို တစ်ခါပဲ သိမ်းတယ်၊ ပထမ ရောက်လာတဲ့ အစီအစဉ်အတိုင်း။ ဒါပေမဲ့ array မဟုတ်ဘူး — အဲဒါကို တိုက်ရိုက် ပြန်ပေးရင် number[] ကတိ ပျက်တယ် — ဒါကြောင့် [...] နဲ့ array အဖြစ် ပြန်ဖြန့်တာ။',
    },
    another: 'return parts.filter((n, i) => parts.indexOf(n) === i);',
  },
  {
    id: 'chain',
    chapter: 3,
    concept: { en: 'one after another', my: 'တစ်ခုပြီး တစ်ခု' },
    brief: {
      en: 'The finisher, in three moves: keep only the even parts, double each of them, then add them all up. Give back that total.',
      my: 'အပြီးသတ် ထိုးချက်၊ သုံးဆင့်နဲ့: စုံကိန်း အပိုင်းတွေကိုပဲ ချန်၊ တစ်ခုစီကို နှစ်ဆလုပ်၊ ပြီးရင် အားလုံး ပေါင်း။ အဲဒီ စုစုပေါင်းကို ပြန်ပေးပါ။',
    },
    signature: 'function strike(parts: number[]): number',
    starter: 'return ',
    shown: [one([4, 9, 2], 12), one([6, 1], 12)],
    cases: [one([3, 8, 5], 16), one([7, 1], 0), one([], 0), one([2, 2, 3], 8), one([-2, 3], -4)],
    hints: [
      {
        en: 'Three steps you already know — filter, map, and a total — each handing its list to the next.',
        my: 'သိပြီးသား အဆင့် သုံးဆင့် — filter၊ map၊ ပြီးတော့ စုစုပေါင်း — တစ်ဆင့်က သူ့စာရင်းကို နောက်တစ်ဆင့်ကို လက်ဆင့်ကမ်းတယ်။',
      },
      {
        en: 'They chain, each one called on what the last gave back: parts.filter(…).map(…).reduce((sum, n) => sum + n, 0)',
        my: 'တစ်ခုက ပြန်ပေးတာပေါ်မှာ နောက်တစ်ခုကို ခေါ်ပြီး ဆက်တိုက် ချိတ်လို့ရတယ်: parts.filter(…).map(…).reduce((sum, n) => sum + n, 0)',
      },
      code('return parts\n  .filter((n) => n % 2 === 0)\n  .map((n) => n * 2)\n  .reduce((sum, n) => sum + n, 0);'),
    ],
    lesson: {
      en: "Each method hands back a new list, so the next can be called straight on it, and read top to bottom a chain says what happens in the order it happens. reduce's 0 matters: without it, an empty list has nothing to start from, and it throws.",
      my: 'method တစ်ခုစီက စာရင်းအသစ် ပြန်ပေးလို့ နောက်တစ်ခုကို အဲဒီပေါ်မှာ တန်းခေါ်လို့ရတယ်၊ အပေါ်ကနေ အောက်ကို ဖတ်ရင် chain က ဖြစ်တဲ့ အစီအစဉ်အတိုင်း ပြောပြတယ်။ reduce ရဲ့ 0 က အရေးကြီးတယ်: မပါရင် စာရင်း ဗလာမှာ စစရာ မရှိလို့ error တက်တယ်။',
    },
  },

  // ── Text ────────────────────────────────────────────────────────────
  {
    id: 'shout',
    chapter: 4,
    concept: { en: 'louder', my: 'ပိုကျယ်' },
    brief: {
      en: 'Now it is words. He shouts his move: give back the word in capital letters.',
      my: 'အခု စကားလုံးတွေ။ သူက ထိုးချက်ကို အော်ပြောတယ်: စကားလုံးကို စာလုံးကြီးနဲ့ ပြန်ပေးပါ။',
    },
    signature: 'function strike(word: string): string',
    starter: 'return ',
    shown: [one('hit', 'HIT'), one('go', 'GO')],
    cases: [one('strike', 'STRIKE'), one('a', 'A'), one('', ''), one('Ok', 'OK'), one('kyo2', 'KYO2')],
    hints: [
      {
        en: 'A string is a value with methods of its own, the way a list has.',
        my: 'string ဆိုတာ စာရင်းလိုပဲ ကိုယ်ပိုင် method တွေ ပါတဲ့ တန်ဖိုး တစ်ခု။',
      },
      {
        en: 'word.toUpperCase() gives back a new string; it never changes word.',
        my: 'word.toUpperCase() က string အသစ် တစ်ခု ပြန်ပေးတယ်၊ word ကို ဘယ်တော့မှ မပြောင်းဘူး။',
      },
      code('return word.toUpperCase();'),
    ],
    lesson: {
      en: 'Strings never change. toUpperCase, slice, trim — every string method hands back a new string and leaves the old one exactly as it was.',
      my: 'string တွေက ဘယ်တော့မှ မပြောင်းဘူး။ toUpperCase၊ slice၊ trim — string method တိုင်းက string အသစ် ပြန်ပေးပြီး အဟောင်းကို ဒီအတိုင်း ထားခဲ့တယ်။',
    },
  },
  {
    id: 'initial',
    chapter: 4,
    concept: { en: 'the first letter', my: 'ပထမ စာလုံး' },
    brief: {
      en: "He signs with his first letter. Give back the word's first letter as a capital — or an empty string if there is no word at all.",
      my: "သူက ပထမ စာလုံးနဲ့ လက်မှတ်ထိုးတယ်။ စကားလုံးရဲ့ ပထမ စာလုံးကို စာလုံးကြီးနဲ့ ပြန်ပေးပါ — စကားလုံး လုံးဝ မရှိရင် string ဗလာ ('') ပြန်ပေးပါ။",
    },
    signature: 'function strike(word: string): string',
    starter: 'return ',
    shown: [one('aung', 'A'), one('mya', 'M')],
    cases: [one('kyaw', 'K'), one('z', 'Z'), one('', ''), one('Hla', 'H')],
    hints: [
      {
        en: 'A string can be indexed like a list: word[0] is its first character.',
        my: 'string ကို စာရင်းလိုပဲ index နဲ့ ယူလို့ရတယ်: word[0] က ပထမ စာလုံး။',
      },
      {
        en: "But ''[0] is undefined, and undefined has no toUpperCase. slice(0, 1) gives '' instead.",
        my: "ဒါပေမဲ့ ''[0] က undefined၊ undefined မှာ toUpperCase မရှိဘူး။ slice(0, 1) ကတော့ အဲဒီအစား '' ပေးတယ်။",
      },
      code('return word.slice(0, 1).toUpperCase();'),
    ],
    lesson: {
      en: "slice never goes out of bounds: past the end it just gives back less, down to ''. Indexing past the end gives undefined, and calling a method on undefined is the most common error JavaScript has. ?. below is the other way round it: it stops at undefined instead of calling on it.",
      my: "slice က ဘယ်တော့မှ အပြင်ကို မထွက်ဘူး: အဆုံးကို ကျော်ရင် နည်းနည်းပဲ ပြန်ပေးတယ်၊ '' ထိ။ index နဲ့ အဆုံးကို ကျော်ယူရင် undefined ရတယ်၊ undefined ပေါ်မှာ method ခေါ်တာက JavaScript မှာ အဖြစ်အများဆုံး error ပဲ။ အောက်က ?. က နောက်တစ်နည်း: undefined ဆိုရင် ခေါ်မနေဘဲ ရပ်လိုက်တယ်။",
    },
    another: "return word.at(0)?.toUpperCase() ?? '';",
  },
  {
    id: 'letters',
    chapter: 4,
    concept: { en: 'how many a', my: 'a ဘယ်နှစ်လုံး' },
    brief: {
      en: "Every 'a' in the word is a blow. Give back how many there are — capital or small.",
      my: "စကားလုံးထဲက 'a' တိုင်းက ထိုးချက် တစ်ချက်။ ဘယ်နှစ်လုံး ပါလဲ ပြန်ပေးပါ — စာလုံးကြီး ဖြစ်ဖြစ် စာလုံးသေး ဖြစ်ဖြစ်။",
    },
    signature: 'function strike(word: string): number',
    starter: 'return ',
    shown: [one('banana', 3), one('kyo', 0)],
    cases: [one('Aung', 1), one('aaa', 3), one('', 0), one('Mandalay', 3), one('Ava', 2)],
    hints: [
      {
        en: 'for (const ch of word) walks a string one character at a time, just as it walks a list.',
        my: 'for (const ch of word) က စာရင်းကို လျှောက်သလိုပဲ string ကို တစ်လုံးချင်း လျှောက်တယ်။',
      },
      {
        en: "'A' and 'a' are different characters. Make the word all small first: word.toLowerCase().",
        my: "'A' နဲ့ 'a' က မတူတဲ့ စာလုံးတွေ။ စကားလုံးကို အရင် စာလုံးသေး ပြောင်းပါ: word.toLowerCase()။",
      },
      code("let count = 0;\nfor (const ch of word.toLowerCase()) {\n  if (ch === 'a') count += 1;\n}\nreturn count;"),
    ],
    lesson: {
      en: 'For most purposes a string is a list of characters: it has a length, an index and a for…of. Comparing text is exact, so capitals have to be dealt with on purpose.',
      my: 'ရည်ရွယ်ချက် အများစုအတွက် string က စာလုံးတွေရဲ့ စာရင်း တစ်ခုပဲ: length ရှိတယ်၊ index ရှိတယ်၊ for…of ရှိတယ်။ စာသား နှိုင်းယှဉ်တာက တိတိကျကျ ဖြစ်လို့ စာလုံးကြီး/သေးကို ရည်ရွယ်ချက်ရှိရှိ ကိုင်တွယ်ရမယ်။',
    },
    another: "return [...word.toLowerCase()].filter((ch) => ch === 'a').length;",
  },
  {
    id: 'backwards',
    chapter: 4,
    concept: { en: 'backwards', my: 'ပြောင်းပြန်' },
    brief: {
      en: 'He reads the move back to front. Give back the word reversed.',
      my: 'သူက ထိုးချက်ကို နောက်ကနေ ရှေ့ကို ဖတ်တယ်။ စကားလုံးကို ပြောင်းပြန် လှန်ပြီး ပြန်ပေးပါ။',
    },
    signature: 'function strike(word: string): string',
    starter: 'return ',
    shown: [one('abc', 'cba'), one('kyo', 'oyk')],
    cases: [one('strike', 'ekirts'), one('a', 'a'), one('', ''), one('noon', 'noon'), one('ab cd', 'dc ba')],
    hints: [
      {
        en: 'Strings have no reverse, but lists do.',
        my: 'string မှာ reverse မရှိဘူး၊ စာရင်းမှာတော့ ရှိတယ်။',
      },
      {
        en: "split('') turns a string into a list of its characters, and join('') turns one back.",
        my: "split('') က string ကို စာလုံးတွေရဲ့ စာရင်း အဖြစ် ပြောင်းတယ်၊ join('') က ပြန်ပေါင်းတယ်။",
      },
      code("return word.split('').reverse().join('');"),
    ],
    lesson: {
      en: 'split and join are the bridge between text and lists, and most text work goes across it: split it, do list things, join it back.',
      my: 'split နဲ့ join က စာသားနဲ့ စာရင်းကြားက တံတား၊ စာသား အလုပ် အများစုက ဒီလိုပဲ: split လုပ်၊ စာရင်းအလုပ်တွေ လုပ်၊ join နဲ့ ပြန်ပေါင်း။',
    },
    another: "return [...word].reverse().join('');",
  },
  {
    id: 'palindrome',
    chapter: 4,
    concept: { en: 'the same both ways', my: 'နှစ်ဖက်လုံး တူ' },
    brief: {
      en: 'Some words are their own mirror. Give back true if the word reads the same backwards — capitals do not count.',
      my: 'တချို့ စကားလုံးတွေက ကိုယ့်ကိုယ်ကိုပဲ မှန်ထဲက ပုံ။ နောက်ပြန် ဖတ်ရင်လည်း တူရင် true ပြန်ပေးပါ — စာလုံးကြီး/သေး ထည့်မတွက်ပါနဲ့။',
    },
    signature: 'function strike(word: string): boolean',
    starter: 'return ',
    shown: [one('level', true), one('kyo', false)],
    cases: [one('Noon', true), one('a', true), one('', true), one('ab', false), one('Racecar', true)],
    hints: [
      {
        en: 'You can already reverse a word. Compare the word with its reverse.',
        my: 'စကားလုံးကို ပြောင်းပြန် လုပ်တတ်ပြီးသား။ စကားလုံးနဲ့ သူ့ပြောင်းပြန်ကို နှိုင်းယှဉ်ပါ။',
      },
      {
        en: "'Noon' backwards is 'nooN'. Make it all small before comparing.",
        my: "'Noon' ကို ပြောင်းပြန်လုပ်ရင် 'nooN'။ မနှိုင်းယှဉ်ခင် အကုန် စာလုံးသေး ပြောင်းပါ။",
      },
      code("const small = word.toLowerCase();\nreturn small === small.split('').reverse().join('');"),
    ],
    lesson: {
      en: 'Putting text into one form first — all small, no spaces — and only then comparing is called normalising, and it is most of what comparing text well takes.',
      my: 'စာသားကို ပုံစံ တစ်မျိုးတည်း (အကုန် စာလုံးသေး၊ space မပါ) အရင် ပြောင်းပြီးမှ နှိုင်းယှဉ်တာကို normalise လုပ်တယ်လို့ ခေါ်တယ်၊ စာသားကို ကောင်းကောင်း နှိုင်းယှဉ်ဖို့ အဓိက လိုတာ အဲဒါပဲ။',
    },
  },
  {
    id: 'addup',
    chapter: 4,
    concept: { en: 'numbers written down', my: 'စာနဲ့ ရေးထားတဲ့ ဂဏန်း' },
    brief: {
      en: 'The numbers came in as text, the way they come out of a form. Give back their sum, as a number.',
      my: 'ဂဏန်းတွေက form ထဲကနေ ထွက်လာသလို စာသားအဖြစ် ရောက်လာတယ်။ သူတို့ရဲ့ ပေါင်းလဒ်ကို ဂဏန်းအဖြစ် ပြန်ပေးပါ။',
    },
    signature: 'function strike(a: string, b: string): number',
    starter: 'return ',
    shown: [many(['4', '1'], 5), many(['10', '20'], 30)],
    cases: [
      many(['2', '3'], 5),
      many(['0', '0'], 0),
      many(['-5', '5'], 0),
      many(['1.5', '1.5'], 3),
      many(['100', '1'], 101),
    ],
    hints: [
      {
        en: "a + b looks like adding. With two strings, + joins them: '4' + '1' is '41'.",
        my: "a + b က ပေါင်းသလို ထင်ရတယ်။ string နှစ်ခုဆိုရင် + က ဆက်ပေးတယ်: '4' + '1' က '41'။",
      },
      {
        en: 'Number(a) turns text into a number.',
        my: 'Number(a) က စာသားကို ဂဏန်း ပြောင်းပေးတယ်။',
      },
      code('return Number(a) + Number(b);'),
    ],
    lesson: {
      en: '+ means two things, adding numbers and joining strings, and if either side is a string it joins. Turning text into a number on purpose, with Number, is how to say which one you mean.',
      my: '+ က အဓိပ္ပာယ် နှစ်မျိုး ရှိတယ်: ဂဏန်းပေါင်းတာနဲ့ string ဆက်တာ၊ တစ်ဖက်ဖက်က string ဆိုရင် ဆက်တယ်။ Number နဲ့ စာသားကို ဂဏန်း ရည်ရွယ်ချက်ရှိရှိ ပြောင်းတာက ဘယ်ဟာကို ဆိုလိုလဲ ပြောပြတဲ့ နည်း။',
    },
    another: 'return parseFloat(a) + parseFloat(b);',
  },
  {
    id: 'label',
    chapter: 4,
    concept: { en: 'a line of text', my: 'စာကြောင်း တစ်ကြောင်း' },
    brief: {
      en: 'The fight is scored. Give back a line like "Aung: 3 hits" — the name, a colon, the count, and the word hits, or hit when there is only one.',
      my: 'ပွဲကို အမှတ်ပေးတယ်။ "Aung: 3 hits" လို စာကြောင်း တစ်ကြောင်း ပြန်ပေးပါ — နာမည်၊ colon၊ အရေအတွက်၊ ပြီးရင် hits (တစ်ချက်တည်းဆိုရင် hit)။',
    },
    signature: 'function strike(name: string, hits: number): string',
    starter: 'return ',
    shown: [many(['Aung', 3], 'Aung: 3 hits'), many(['Mya', 1], 'Mya: 1 hit')],
    cases: [
      many(['Kyaw', 2], 'Kyaw: 2 hits'),
      many(['Hla', 0], 'Hla: 0 hits'),
      many(['Zaw', 1], 'Zaw: 1 hit'),
      many(['Ni', 10], 'Ni: 10 hits'),
    ],
    hints: [
      {
        en: 'Backticks make a template: inside one, ${…} puts a value into the text.',
        my: 'backtick (`) က template တစ်ခု ဖန်တီးတယ်: အထဲမှာ ${…} က တန်ဖိုး တစ်ခုကို စာသားထဲ ထည့်ပေးတယ်။',
      },
      {
        en: "Choose the word first: hits === 1 ? 'hit' : 'hits'.",
        my: "စကားလုံးကို အရင် ရွေးပါ: hits === 1 ? 'hit' : 'hits'။",
      },
      code("const word = hits === 1 ? 'hit' : 'hits';\nreturn `${name}: ${hits} ${word}`;"),
    ],
    lesson: {
      en: "A template literal is the readable way to build text out of values: what you see is the line you get. And one-or-many is the smallest real bug there is — '1 hits' is on a great many screens.",
      my: "template literal က တန်ဖိုးတွေကနေ စာသား တည်ဆောက်တဲ့ ဖတ်ရလွယ်တဲ့ နည်း: မြင်ရတဲ့အတိုင်း ရတယ်။ ပြီးတော့ တစ်ခု/အများ ရွေးတာက လက်တွေ့ bug တွေထဲမှာ အသေးဆုံးပဲ — '1 hits' လို့ ပေါ်နေတဲ့ screen တွေ အများကြီး ရှိတယ်။",
    },
    another: "return name + ': ' + hits + (hits === 1 ? ' hit' : ' hits');",
  },
];
