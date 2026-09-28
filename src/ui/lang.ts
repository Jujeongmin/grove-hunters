import { useEffect, useState } from "react";
import { onSettings, settings, updateSettings } from "./settings";
import { ko, type Bundle, type Key } from "./strings/ko";
export type { Key };
import { en } from "./strings/en";
import { ja } from "./strings/ja";
import { zhHant } from "./strings/zhHant";
import { zhHans } from "./strings/zhHans";

// The languages the game is written in. Korean is the one it was written in; the rest are checked
// against it at compile time (see strings/ko.ts), so none of them can quietly fall behind.
export type Lang = "ko" | "en" | "ja" | "zh-Hant" | "zh-Hans";

// Each language named in itself, which is how a reader finds their own in a list.
export const LANGS: { id: Lang; name: string }[] = [
  { id: "ko", name: "한국어" },
  { id: "en", name: "English" },
  { id: "ja", name: "日本語" },
  { id: "zh-Hant", name: "繁體中文" },
  { id: "zh-Hans", name: "简体中文" },
];

const BUNDLES: Record<Lang, Bundle> = { ko, en, ja, "zh-Hant": zhHant, "zh-Hans": zhHans };

export function readLang(value: unknown): Lang | null {
  return LANGS.find((l) => l.id === value)?.id ?? null;
}

// The language the browser asks for, as near as the game has one. Chinese is told apart by its
// script where the browser says so (zh-TW, zh-HK and zh-Hant are traditional), and simplified
// otherwise, which is what plain "zh" means in practice.
export function browserLang(): Lang {
  const tags = typeof navigator === "undefined" ? [] : [navigator.language, ...(navigator.languages ?? [])];
  for (const raw of tags) {
    const tag = (raw ?? "").toLowerCase();
    if (tag.startsWith("ko")) return "ko";
    if (tag.startsWith("ja")) return "ja";
    if (tag.startsWith("en")) return "en";
    if (tag.startsWith("zh")) {
      return /hant|tw|hk|mo/.test(tag) ? "zh-Hant" : "zh-Hans";
    }
  }
  return "ko";
}

// The language in play: the one the reader picked, or the browser's until they pick one.
export function lang(): Lang {
  return readLang(settings().lang) ?? browserLang();
}

export function setLang(next: Lang): void {
  updateSettings({ lang: next });
}

// Kept on <html> so the browser hyphenates, spell-checks and picks fonts for the right language.
function tellTheDocument(): void {
  if (typeof document !== "undefined") document.documentElement.lang = lang();
}

tellTheDocument();
onSettings(tellTheDocument);

// A line in the language in play, with its holes filled: t("settings.times", { n: 1.5 }).
// A language missing the line falls back to Korean, and a line missing everywhere shows its own key
// rather than an empty space, so a gap is obvious instead of invisible.
export function t(key: Key, holes?: Record<string, string | number>): string {
  const line = BUNDLES[lang()][key] ?? ko[key] ?? key;
  if (!holes) return line;
  return line.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const filling = holes[name];
    return filling === undefined ? whole : String(filling);
  });
}

// The BCP 47 tag for Intl, which wants a real locale rather than our short names.
export function locale(): string {
  return { ko: "ko-KR", en: "en-US", ja: "ja-JP", "zh-Hant": "zh-TW", "zh-Hans": "zh-CN" }[lang()];
}

// Everything on screen has to be said again when the language changes. A component that only reads
// t() has no reason to render otherwise, so the top of the tree holds this and the change ripples
// down from there.
export function useLang(): Lang {
  const [current, setCurrent] = useState(lang);
  useEffect(() => onSettings(() => setCurrent(lang())), []);
  return current;
}
