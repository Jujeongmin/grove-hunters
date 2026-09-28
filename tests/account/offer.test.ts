import { describe, expect, it } from "vitest";
import { readOffer } from "../../src/game/account/purchase";

describe("readOffer", () => {
  it("says there is no sale when the product does not say there is one", () => {
    for (const metadata of [null, undefined, "", "   ", "not json", "[]", '"text"', "7", "{}"]) {
      expect(readOffer(500, metadata)).toEqual({ price: 500, listPrice: null, off: null });
    }
  });

  it("marks the price down from what the product is normally sold at", () => {
    expect(readOffer(500, JSON.stringify({ listPrice: 1000 }))).toEqual({ price: 500, listPrice: 1000, off: 50 });
  });

  it("rounds the share off to a whole percent, and keeps it sane", () => {
    expect(readOffer(700, JSON.stringify({ listPrice: 1000 })).off).toBe(30);
    expect(readOffer(999, JSON.stringify({ listPrice: 1000 })).off).toBe(1);
    expect(readOffer(1, JSON.stringify({ listPrice: 1000 })).off).toBe(99);
    expect(readOffer(500, JSON.stringify({ listPrice: 1000.4 })).listPrice).toBe(1000);
  });

  it("refuses a list price that is not above what is being charged", () => {
    for (const listPrice of [500, 400, 0, -100, Infinity, NaN, "1000", null]) {
      expect(readOffer(500, JSON.stringify({ listPrice })).off, String(listPrice)).toBeNull();
    }
  });

  it("ignores anything else the metadata carries", () => {
    expect(readOffer(500, JSON.stringify({ listPrice: 1000, note: "hi", saleEndsAt: "2026-10-31" })))
      .toEqual({ price: 500, listPrice: 1000, off: 50 });
  });
});
