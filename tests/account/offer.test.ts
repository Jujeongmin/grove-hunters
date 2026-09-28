import { describe, expect, it } from "vitest";
import { readOffer } from "../../src/game/account/purchase";

const NOW = Date.parse("2026-09-28T12:00:00+09:00");

describe("readOffer", () => {
  it("says there is no sale when the product does not say there is one", () => {
    for (const metadata of [null, undefined, "", "   ", "not json", "[]", '"text"', "7"]) {
      expect(readOffer(500, metadata, NOW)).toEqual({ price: 500, listPrice: null, off: null, endsAt: null });
    }
  });

  it("marks the price down from what the product is normally sold at", () => {
    const offer = readOffer(500, JSON.stringify({ listPrice: 1000 }), NOW);
    expect(offer).toEqual({ price: 500, listPrice: 1000, off: 50, endsAt: null });
  });

  it("rounds the share off to a whole percent", () => {
    expect(readOffer(700, JSON.stringify({ listPrice: 1000 }), NOW).off).toBe(30);
    expect(readOffer(999, JSON.stringify({ listPrice: 1000 }), NOW).off).toBe(1);
    expect(readOffer(1, JSON.stringify({ listPrice: 1000 }), NOW).off).toBe(99);
  });

  it("refuses a list price that is not above what is being charged", () => {
    for (const listPrice of [500, 400, 0, -100]) {
      expect(readOffer(500, JSON.stringify({ listPrice }), NOW).off).toBeNull();
    }
    expect(readOffer(500, JSON.stringify({ listPrice: "1000" }), NOW).off).toBeNull();
  });

  it("carries when the sale ends, and lets a finished one lapse", () => {
    const ending = JSON.stringify({ listPrice: 1000, saleEndsAt: "2026-10-31T23:59:59+09:00" });
    const live = readOffer(500, ending, NOW);
    expect(live.off).toBe(50);
    expect(live.endsAt).toBe(Date.parse("2026-10-31T23:59:59+09:00"));
    // The same product read after its sale ran out is simply the price it asks.
    const after = readOffer(500, ending, Date.parse("2026-11-01T00:00:00+09:00"));
    expect(after).toEqual({ price: 500, listPrice: null, off: null, endsAt: null });
  });

  it("ignores an end date it cannot read", () => {
    const offer = readOffer(500, JSON.stringify({ listPrice: 1000, saleEndsAt: "언젠가" }), NOW);
    expect(offer).toMatchObject({ off: 50, endsAt: null });
  });
});
