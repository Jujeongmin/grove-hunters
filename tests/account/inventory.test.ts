import { describe, expect, it } from "vitest";
import {
  EMPTY_INVENTORY, MAX_PIECES, TRADE_DROP_CHANCE, allStacks, countOf, equipPiece, fits, give, loot, putPiece, readInventory, spend,
  takePiece, takeStack, unequipSlot, type Inventory,
} from "../../src/game/account/inventory";
import type { GearPiece, ItemId } from "../../src/game/account/items";

// uids in order: u1, u2, …
function uids() {
  let n = 0;
  return () => `u${++n}`;
}

const piece = (uid: string, id: ItemId, plus = 0, trade = false): GearPiece => ({ uid, id, plus, trade });

describe("inventory", () => {
  it("turns a save from before pieces into pieces, the + on one piece only", () => {
    const old = { bag: { weapon_2: 2, armor_1: 1, potion_small: 4, stone: 3 }, gear: { weapon: "weapon_2", armor: null }, plus: { weapon_2: 5, armor_1: 2 } };
    const inv = readInventory(old, "c1");
    expect(inv.bag).toEqual({ potion_small: 4, stone: 3 });
    expect(inv.bagTrade).toEqual({});
    // The worn weapon_2 takes its +; the two in the bag stay +0. armor_1 is not worn: the bag's takes it.
    expect(inv.gear).toEqual({ weapon: piece("m-c1-weapon_2-w", "weapon_2", 5), armor: null });
    expect(inv.pieces).toEqual([
      piece("m-c1-weapon_2-0", "weapon_2"), piece("m-c1-weapon_2-1", "weapon_2"), piece("m-c1-armor_1-0", "armor_1", 2),
    ]);
    // Read again, the same uids: nothing was saved in between.
    expect(readInventory(old, "c1")).toEqual(inv);
    // A + for gear it no longer has goes nowhere.
    expect(readInventory({ plus: { weapon_5: 4 } }, "c1")).toEqual(EMPTY_INVENTORY);
  });

  it("reads the new form as saved, dropping what does not read", () => {
    const saved = {
      bag: { potion_big: 2 }, bagTrade: { silk: 5, potion_big: 3 },
      pieces: [piece("a", "weapon_1", 3, true), { uid: "b", id: "potion_big" }, piece("a", "weapon_1")],
      gear: { weapon: piece("w", "weapon_5", 7, true), armor: piece("x", "weapon_1") },
    };
    expect(readInventory(saved, "c1")).toEqual({
      bag: { potion_big: 2 }, bagTrade: { silk: 5 }, pieces: [piece("a", "weapon_1", 3, true)], gear: { weapon: piece("w", "weapon_5", 7, true), armor: null },
    });
  });

  it("gives all or nothing, gear as new pieces", () => {
    const inv = give(EMPTY_INVENTORY, [{ id: "armor_1", n: 1 }, { id: "potion_small", n: 5 }, { id: "stone", n: 2 }], false, uids());
    expect(inv).toEqual({ bag: { potion_small: 5, stone: 2 }, bagTrade: {}, pieces: [piece("u1", "armor_1")], gear: EMPTY_INVENTORY.gear });
    // Tradable: materials to their own stack, gear marked; potions never have a market.
    const traded = give(inv, [{ id: "weapon_3", n: 1 }, { id: "stone", n: 4 }, { id: "potion_small", n: 1 }], true, () => "t");
    expect(traded.bagTrade).toEqual({ stone: 4 });
    expect(traded.bag).toEqual({ potion_small: 6, stone: 2 });
    expect(traded.pieces[1]).toEqual(piece("t", "weapon_3", 0, true));
    expect(() => give(inv, [{ id: "potion_small", n: 95 }], false, uids())).toThrow("bag_full");
    const full: Inventory = { ...EMPTY_INVENTORY, pieces: Array.from({ length: MAX_PIECES }, (_, i) => piece(`p${i}`, "weapon_1")) };
    expect(fits(full, [{ id: "armor_1", n: 1 }], false)).toBe(false);
    expect(fits(full, [{ id: "stone", n: 1 }], false)).toBe(true);
  });

  it("loot: materials may be traded, gear on its chance, and a full bag loses the rest", () => {
    const rolls = [TRADE_DROP_CHANCE - 0.01, TRADE_DROP_CHANCE];
    const inv = loot(EMPTY_INVENTORY, ["weapon_1", "armor_1", "jelly", "potion_small"], () => rolls.shift()!, uids());
    expect(inv.pieces).toEqual([piece("u1", "weapon_1", 0, true), piece("u2", "armor_1", 0, false)]);
    expect(inv.bagTrade).toEqual({ jelly: 1 });
    expect(inv.bag).toEqual({ potion_small: 1 });
    const full: Inventory = { ...EMPTY_INVENTORY, pieces: Array.from({ length: MAX_PIECES }, (_, i) => piece(`p${i}`, "weapon_1")) };
    expect(loot(full, ["weapon_2"], () => 0, uids()).pieces.length).toBe(MAX_PIECES);
  });

  it("spends what may not be traded first", () => {
    const inv: Inventory = { ...EMPTY_INVENTORY, bag: { stone: 2 }, bagTrade: { stone: 5 } };
    expect(countOf(inv, "stone")).toBe(7);
    expect(allStacks(inv)).toEqual({ stone: 7 });
    const spent = spend(inv, [{ id: "stone", n: 3 }]);
    expect(spent.bag).toEqual({});
    expect(spent.bagTrade).toEqual({ stone: 4 });
    expect(() => spend(inv, [{ id: "stone", n: 8 }])).toThrow("no_item");
    expect(takeStack(inv, "stone", 5, true).bagTrade).toEqual({});
    expect(() => takeStack(inv, "stone", 3, false)).toThrow("no_item");
  });

  it("wears, swaps and takes off pieces", () => {
    const a = piece("a", "weapon_1", 2);
    const b = piece("b", "weapon_2", 0, true);
    const inv: Inventory = { ...EMPTY_INVENTORY, pieces: [a, b] };
    const worn = equipPiece(inv, "a");
    expect(worn.gear.weapon).toEqual(a);
    expect(worn.pieces).toEqual([b]);
    const swapped = equipPiece(worn, "b");
    expect(swapped.gear.weapon).toEqual(b);
    expect(swapped.pieces).toEqual([a]);
    const off = unequipSlot(swapped, "weapon");
    expect(off.gear.weapon).toBeNull();
    expect(off.pieces).toEqual([a, b]);
    expect(() => equipPiece(inv, "zzz")).toThrow("no_item");
    // A worn piece is not in the bag to take.
    expect(() => takePiece(worn, "a")).toThrow("no_item");
    expect(takePiece(inv, "b").piece).toEqual(b);
    const full: Inventory = { ...swapped, pieces: Array.from({ length: MAX_PIECES }, (_, i) => piece(`p${i}`, "armor_1")) };
    expect(() => unequipSlot(full, "weapon")).toThrow("bag_full");
    expect(() => putPiece(full, piece("n", "armor_1"))).toThrow("bag_full");
    expect(() => putPiece(inv, a)).toThrow("unavailable");
  });
});
