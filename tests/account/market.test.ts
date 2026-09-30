import { describe, expect, it } from "vitest";
import {
  MAX_PRICE, MIN_BUNDLE_PRICE, MIN_GEAR_PRICE, PAGE_SIZE, marketFee, pageOf, readBundle, readFilter, readListing, readPrice, sellerGets,
  shelfOf, type Listing,
} from "../../src/game/account/market";

const piece = (plus: number, trade = true) => ({ uid: "p", id: "weapon_3", plus, trade });
const row = (over: Record<string, unknown> = {}) => ({
  __id: "l1", seller: "acc", sellerName: "이름", shelf: "weapon", item: "weapon_3", piece: piece(4), n: 1, plus: 4, price: 50, at: 1, until: 100,
  ...over,
});

describe("market", () => {
  it("keeps 5% of a sale, rounded down", () => {
    expect(marketFee(19)).toBe(0);
    expect(sellerGets(19)).toBe(19);
    expect(marketFee(20)).toBe(1);
    expect(sellerGets(20)).toBe(19);
    expect(marketFee(1000)).toBe(50);
  });

  it("takes prices in range: gear from 10, a bundle from 1", () => {
    expect(readPrice(MIN_GEAR_PRICE, "weapon")).toBe(MIN_GEAR_PRICE);
    expect(readPrice(MIN_GEAR_PRICE - 1, "armor")).toBeNull();
    expect(readPrice(MIN_BUNDLE_PRICE, "material")).toBe(1);
    expect(readPrice(0, "material")).toBeNull();
    expect(readPrice(MAX_PRICE + 1, "material")).toBeNull();
    expect(readPrice(12.5, "weapon")).toBeNull();
    expect(readBundle(99)).toBe(99);
    expect(readBundle(100)).toBeNull();
    expect(readBundle(0)).toBeNull();
    expect(shelfOf("silk")).toBe("material");
    expect(shelfOf("armor_2")).toBe("armor");
    expect(shelfOf("potion_big")).toBeNull();
  });

  it("reads a listing back whole, or not at all", () => {
    expect(readListing(row())).toEqual({
      id: "l1", seller: "acc", sellerName: "이름", shelf: "weapon", item: "weapon_3", piece: piece(4), n: 1, plus: 4, price: 50, at: 1, until: 100,
    });
    // The + comes from the piece itself, not the row's copy.
    expect(readListing(row({ plus: 9 }))?.plus).toBe(4);
    expect(readListing(row({ piece: piece(4, false) }))).toBeNull();
    expect(readListing(row({ shelf: "armor" }))).toBeNull();
    expect(readListing(row({ price: 5 }))).toBeNull();
    const silk = readListing(row({ shelf: "material", item: "silk", piece: undefined, n: 20, price: 3 }));
    expect(silk).toMatchObject({ shelf: "material", item: "silk", piece: null, n: 20, plus: 0, price: 3 });
    expect(readListing(row({ shelf: "material", item: "silk", n: 0, price: 3 }))).toBeNull();
    expect(readListing(row({ item: "potion_big", shelf: "material" }))).toBeNull();
  });

  it("reads a filter, keeping the item to its shelf", () => {
    expect(readFilter(undefined)).toEqual({ shelf: "weapon", item: null, minPlus: 0, page: 0 });
    expect(readFilter({ shelf: "armor", item: "weapon_1", minPlus: 30, page: -1 })).toEqual({ shelf: "armor", item: null, minPlus: 10, page: 0 });
    expect(readFilter({ shelf: "material", item: "silk", page: 2 })).toEqual({ shelf: "material", item: "silk", minPlus: 0, page: 2 });
  });

  it("finds what a filter asks for, cheapest (per piece) first, a page at a time", () => {
    const listing = (id: string, over: Partial<Listing>): Listing => ({ ...(readListing(row({ __id: id }))!), ...over });
    const all = [
      listing("a", { price: 40 }),
      listing("b", { price: 20, plus: 7 }),
      listing("c", { price: 20, plus: 2, at: 0 }),
      listing("gone", { price: 10, until: 50 }),
      listing("m1", { shelf: "material", item: "silk", piece: null, n: 10, plus: 0, price: 5 }),
      listing("m2", { shelf: "material", item: "silk", piece: null, n: 2, plus: 0, price: 2 }),
    ];
    const now = 60;
    expect(pageOf(all, readFilter({ shelf: "weapon" }), now).listings.map((l) => l.id)).toEqual(["c", "b", "a"]);
    expect(pageOf(all, readFilter({ shelf: "weapon", minPlus: 5 }), now).listings.map((l) => l.id)).toEqual(["b"]);
    // Materials by the price of one: 10 for 5 is cheaper than 2 for 2.
    expect(pageOf(all, readFilter({ shelf: "material" }), now).listings.map((l) => l.id)).toEqual(["m1", "m2"]);
    const many = Array.from({ length: PAGE_SIZE + 3 }, (_, i) => listing(`x${i}`, { price: 10 + i }));
    const second = pageOf(many, readFilter({ shelf: "weapon", page: 5 }), now);
    expect(second.pages).toBe(2);
    expect(second.page).toBe(1);
    expect(second.listings.length).toBe(3);
  });
});
