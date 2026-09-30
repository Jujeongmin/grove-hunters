import { describe, expect, it } from "vitest";
import { NEWS, readNewsId, unseenNews } from "../src/game/news";

const LANGS = ["ko", "en", "ja", "zh-Hant", "zh-Hans"] as const;

describe("news", () => {
  it("has unique ids and runs newest first", () => {
    expect(new Set(NEWS.map((n) => n.id)).size).toBe(NEWS.length);
    for (const entry of NEWS) expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (let i = 1; i < NEWS.length; i++) expect(NEWS[i - 1].date >= NEWS[i].date).toBe(true);
  });

  it("says every entry in all five languages", () => {
    for (const entry of NEWS) {
      for (const lang of LANGS) {
        const text = entry.text[lang];
        expect(text.title.trim()).not.toBe("");
        expect(text.lines.length).toBeGreaterThan(0);
        for (const line of text.lines) expect(line.trim()).not.toBe("");
      }
    }
  });

  it("counts what is newer than the last one read", () => {
    expect(unseenNews(null)).toBe(NEWS.length);
    expect(unseenNews(NEWS[0].id)).toBe(0);
    expect(unseenNews(NEWS[1].id)).toBe(1);
    // An id no longer (or never) on the list: all of it is new.
    expect(unseenNews("1999-01-01-gone")).toBe(NEWS.length);
  });

  it("reads only listed ids", () => {
    expect(readNewsId(NEWS[0].id)).toBe(NEWS[0].id);
    expect(readNewsId("nope")).toBeNull();
    expect(readNewsId(3)).toBeNull();
  });
});
