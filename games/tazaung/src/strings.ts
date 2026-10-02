/**
 * Tazaung — the only words in the game.
 *
 * Kept to a title, one line of purpose and the two results, so the scroll
 * never becomes a wall of text and the game still teaches itself by being
 * played. Every string carries `en` and `my` per canon 04/06: nothing is
 * hardcoded in one language at the point of use.
 */

export type Lang = "en" | "my";

export type StringKey =
  | "title"
  | "purpose"
  | "begin"
  | "wentOut"
  | "sunCameUp"
  | "lasted"
  | "returned"
  | "again"
  | "paused"
  | "carryOn"
  | "howTitle"
  | "howHint"
  | "ruleRelight"
  | "ruleBlocked"
  | "ruleChain"
  | "ruleBoons";

const TEXT: Readonly<Record<StringKey, Readonly<Record<Lang, string>>>> = {
  title: { en: "Tazaung", my: "တန်ဆောင်" },
  purpose: {
    en: "Keep the lantern lit until dawn",
    my: "မိုးလင်းသည်အထိ မီးအိမ်ကို ထိန်းထားပါ",
  },
  begin: { en: "tap to begin", my: "စတင်ရန် ထိပါ" },
  wentOut: { en: "the lantern went out", my: "မီးအိမ် ငြိမ်းသွားပြီ" },
  sunCameUp: { en: "the sun came up", my: "နေထွက်လာပြီ" },
  lasted: { en: "lasted", my: "ကြာချိန်" },
  returned: { en: "lights returned", my: "ပြန်ထွန်းခဲ့သော မီး" },
  again: { en: "tap to begin again", my: "ထပ်စရန် ထိပါ" },
  paused: { en: "paused", my: "ခဏရပ်ထားသည်" },
  carryOn: { en: "tap to carry on", my: "ဆက်ရန် ထိပါ" },
  howTitle: { en: "How to play", my: "ဘယ်လိုကစားရမလဲ" },
  howHint: { en: "press H for this again", my: "ပြန်ကြည့်ရန် H နှိပ်ပါ" },
  ruleRelight: {
    en: "Relight what falls — it costs light",
    my: "ကျလာတာကို ပြန်ထွန်းပါ — မီးကုန်တယ်",
  },
  ruleBlocked: {
    en: "What lands blocks the lane above it",
    my: "ကျသွားတာက အပေါ်လမ်းကို ပိတ်တယ်",
  },
  ruleChain: {
    en: "Touching ones lift together",
    my: "ကပ်နေတာတွေ အတူတက်တယ်",
  },
  ruleBoons: {
    en: "Some never went out",
    my: "တချို့က မငြိမ်းသေးဘူး",
  },
};

let current: Lang = "en";

/** Burmese for a Burmese browser, English otherwise. Changeable with `L`. */
export function detectLang(): Lang {
  const tags = typeof navigator === "undefined" ? [] : [navigator.language, ...navigator.languages];
  return tags.some((tag) => tag?.toLowerCase().startsWith("my")) ? "my" : "en";
}

export const lang = (): Lang => current;

export function setLang(next: Lang): void {
  current = next;
}

export function toggleLang(): Lang {
  current = current === "en" ? "my" : "en";
  return current;
}

export const t = (key: StringKey): string => TEXT[key][current];

/**
 * Myanmar script needs a font that has it; Windows ships Myanmar Text. The
 * fallbacks cover the other platforms, and Latin is unaffected either way.
 */
export const fontStack = (size: number, weight = 400): string =>
  `${weight} ${size}px "Myanmar Text", "Noto Sans Myanmar", "Padauk", system-ui, sans-serif`;

/** mm:ss, for how long the lantern lasted. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(whole / 60);
  return `${mins}:${String(whole % 60).padStart(2, "0")}`;
}
