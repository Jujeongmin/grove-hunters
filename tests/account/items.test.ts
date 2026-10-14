import { describe, expect, it } from "vitest";
import { ITEMS, MAX_CARRY, MAX_STACK, SHOP_ITEMS, addItem, pickPotion, gearStats, readBag, readPiece, slotOf } from "../../src/game/account/items";
import { MONSTERS, rollLoot } from "../../src/game/world/monsters";

describe("items", () => {
  it("stacks up to a limit, and refuses to take away what is not there", () => {
    expect(addItem({}, "potion_small", 2)).toEqual({ potion_small: 2 });
    expect(addItem({ potion_small: 2 }, "potion_small", -2)).toEqual({});
    // Past a square's 99 the stack goes on in the next square: only MAX_CARRY of a kind stops it.
    expect(addItem({ potion_small: 98 }, "potion_small", 5)).toEqual({ potion_small: 103 });
    expect(addItem({ potion_small: MAX_CARRY - 1 }, "potion_small", 5)).toEqual({ potion_small: MAX_CARRY });
    expect(MAX_CARRY).toBeGreaterThan(MAX_STACK * 50);
    expect(readBag({ stone: 250 })).toEqual({ stone: 250 });
    expect(() => addItem({}, "potion_small", -1)).toThrow("no_item");
  });

  it("worn pieces add up in a fight, each with its own +", () => {
    const weapon = { uid: "a", id: "weapon_2" as const, plus: 0, trade: false };
    const armor = { uid: "b", id: "armor_2" as const, plus: 0, trade: false };
    expect(gearStats({ weapon, armor })).toEqual({ atk: 18, hp: 60, def: 7 });
    const sharper = gearStats({ weapon: { ...weapon, plus: 5 }, armor: { ...armor, plus: 2 } });
    expect(sharper.atk).toBe(18 + 5 * 3);
    expect(sharper.hp).toBe(60 + 2 * 12);
    expect(sharper.def).toBe(7 + 2);
  });

  it("reads back only what makes sense from a save", () => {
    // Gear kinds are pieces now, never counted in the bag.
    expect(readBag({ potion_small: 2, nothing: 3, potion_big: -1, weapon_1: 2, stone: 1.5 })).toEqual({ potion_small: 2 });
    expect(readPiece({ uid: "x", id: "weapon_1", plus: 3, trade: true })).toEqual({ uid: "x", id: "weapon_1", plus: 3, trade: true });
    expect(readPiece({ uid: "x", id: "weapon_1", plus: 30 })).toEqual({ uid: "x", id: "weapon_1", plus: 15, trade: false });
    expect(readPiece({ uid: "x", id: "potion_small" })).toBeNull();
    expect(readPiece({ id: "weapon_1" })).toBeNull();
    expect(slotOf("armor_3")).toBe("armor");
    expect(slotOf("stone")).toBeNull();
  });

  it("loot pays gold in the monster's range and drops on each item's chance", () => {
    const [low, high] = MONSTERS.rat.gold;
    expect(rollLoot("rat", () => 0)).toEqual({ gold: low, items: ["potion_small", "weapon_1", "armor_1", "jelly", "stone"] });
    expect(rollLoot("rat", () => 0.999)).toEqual({ gold: high, items: [] });
  });
});

describe("potions", () => {
  it("the right one is drunk: the biggest that does not waste much, else the smallest there is", () => {
    const all = { potion_small: 3, potion_big: 3, potion_huge: 3 };
    expect(pickPotion(all, 30)).toBe("potion_small");
    expect(pickPotion(all, ITEMS.potion_big.heal)).toBe("potion_big");
    expect(pickPotion(all, ITEMS.potion_huge.heal + 50)).toBe("potion_huge");
    // Nothing small enough: the smallest carried.
    expect(pickPotion({ potion_huge: 1 }, 10)).toBe("potion_huge");
    expect(pickPotion({ potion_big: 1, potion_huge: 1 }, 10)).toBe("potion_big");
    expect(pickPotion({}, 500)).toBeNull();
  });

  it("the huge one is for the volcano: heals several of its blows, and the shop sells it", () => {
    expect(ITEMS.potion_huge.heal).toBeGreaterThanOrEqual(MONSTERS.cinder_dragon.damage * 1.5);
    expect(SHOP_ITEMS).toContain("potion_huge");
  });
});
