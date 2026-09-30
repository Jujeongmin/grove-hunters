import { describe, expect, it } from "vitest";
import {
  GIFTS, MAIL_KEEP_MS, daysLeft, giftById, giftsDue, mailExpired, mailFits, readGiftsTaken, readMail,
} from "../../src/game/account/mail";
import { EMPTY_INVENTORY } from "../../src/game/account/inventory";

const DAY = 24 * 60 * 60 * 1000;
const LANGS = ["ko", "en", "ja", "zh-Hant", "zh-Hans"] as const;

describe("mail", () => {
  it("reads a row back whole, or not at all", () => {
    const row = { __id: "m1", kind: "gift", at: 5, gold: 10, gems: 0, items: [{ id: "potion_big", n: 3 }], params: { gift: "x", bad: {} } };
    expect(readMail(row)).toEqual({ id: "m1", kind: "gift", at: 5, gold: 10, gems: 0, items: [{ id: "potion_big", n: 3 }], params: { gift: "x" } });
    expect(readMail({ ...row, kind: "letter" })).toBeNull();
    expect(readMail({ ...row, items: [{ id: "dragon_egg", n: 1 }] })).toBeNull();
    expect(readMail({ ...row, items: [{ id: "potion_big", n: 0 }] })).toBeNull();
    expect(readMail({ ...row, __id: undefined })).toBeNull();
    // Nothing carried at all still reads (a letter of gold only).
    expect(readMail({ ...row, items: undefined })?.items).toEqual([]);
    expect(readMail({ ...row, gold: -3 })?.gold).toBe(0);
  });

  it("is kept thirty days", () => {
    const mail = { at: 1_000 };
    expect(mailExpired(mail, 1_000 + MAIL_KEEP_MS - 1)).toBe(false);
    expect(mailExpired(mail, 1_000 + MAIL_KEEP_MS)).toBe(true);
    expect(daysLeft(mail, 1_000)).toBe(30);
    expect(daysLeft(mail, 1_000 + DAY / 2)).toBe(30);
    expect(daysLeft(mail, 1_000 + 29 * DAY + 1)).toBe(1);
    expect(daysLeft(mail, 1_000 + MAIL_KEEP_MS + DAY)).toBe(0);
  });

  it("is only taken when all of it fits the bag", () => {
    const holding = (potions: number) => ({ ...EMPTY_INVENTORY, bag: { potion_big: potions } });
    expect(mailFits(holding(89), { items: [{ id: "potion_big", n: 10 }] })).toBe(true);
    expect(mailFits(holding(90), { items: [{ id: "potion_big", n: 10 }] })).toBe(false);
    // The same item twice adds up.
    expect(mailFits(holding(80), { items: [{ id: "potion_big", n: 10 }, { id: "potion_big", n: 10 }] })).toBe(false);
    expect(mailFits(EMPTY_INVENTORY, { items: [] })).toBe(true);
  });

  it("hands out each gift once while it is on", () => {
    const gift = GIFTS[0];
    expect(giftsDue([], gift.from - 1).map((g) => g.id)).not.toContain(gift.id);
    expect(giftsDue([], gift.from).map((g) => g.id)).toContain(gift.id);
    expect(giftsDue([gift.id], gift.from)).not.toContainEqual(gift);
    expect(giftsDue([], gift.until).map((g) => g.id)).not.toContain(gift.id);
    expect(giftById(gift.id)).toBe(gift);
    expect(giftById("nope")).toBeNull();
    expect(readGiftsTaken(["a", 3, "b"])).toEqual(["a", "b"]);
    expect(readGiftsTaken("a")).toEqual([]);
  });

  it("says every gift in all five languages, under unique ids", () => {
    expect(new Set(GIFTS.map((g) => g.id)).size).toBe(GIFTS.length);
    for (const gift of GIFTS) {
      expect(gift.until).toBeGreaterThan(gift.from);
      for (const lang of LANGS) {
        expect(gift.text[lang].title.trim()).not.toBe("");
        expect(gift.text[lang].body.trim()).not.toBe("");
      }
    }
  });
});
