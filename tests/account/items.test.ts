import { describe, expect, it } from "vitest";
import { MAX_STACK, addItem, gearStats, readBag, readPiece, slotOf } from "../../src/game/account/items";
import { MONSTERS, rollLoot } from "../../src/game/world/monsters";

describe("items", () => {
  it("stacks up to a limit, and refuses to take away what is not there", () => {
    expect(addItem({}, "potion_small", 2)).toEqual({ potion_small: 2 });
    expect(addItem({ potion_small: 2 }, "potion_small", -2)).toEqual({});
    expect(addItem({ potion_small: 98 }, "potion_small", 5)).toEqual({ potion_small: MAX_STACK });
    expect(() => addItem({}, "potion_small", -1)).toThrow("no_item");
  });

  it("worn pieces add up in a fight, each with its own +", () => {
    const weapon = { uid: "a", id: "weapon_2" as const, plus: 0, trade: false };
    const armor = { uid: "b", id: "armor_2" as const, plus: 0, trade: false };
    expect(gearStats({ weapon, armor })).toEqual({ power: 0.25, hp: 60, guard: 0.1 });
    const sharper = gearStats({ weapon: { ...weapon, plus: 5 }, armor: { ...armor, plus: 2 } });
    expect(sharper.power).toBeCloseTo(0.25 + 5 * 0.04);
    expect(sharper.hp).toBe(60 + 2 * 12);
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
