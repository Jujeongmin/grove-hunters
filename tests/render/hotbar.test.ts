import { describe, expect, it } from "vitest";
import { equipSkill, hotbarFor, setHotbarSlot, startBarEmpty } from "../../src/ui/settings";

describe("the skill bar", () => {
  it("starts with the class's first skill in the first slot", () => {
    expect(hotbarFor("ranger")).toEqual([0, null, null, null]);
  });

  it("takes a skill into a slot, moving it out of any other, and empties slots", () => {
    setHotbarSlot("wizard", 2, 1);
    expect(hotbarFor("wizard")).toEqual([0, null, 1, null]);
    setHotbarSlot("wizard", 1, 1);
    expect(hotbarFor("wizard")).toEqual([0, 1, null, null]);
    setHotbarSlot("wizard", 0, null);
    expect(hotbarFor("wizard")).toEqual([null, 1, null, null]);
    setHotbarSlot("wizard", 3, 3);
    expect(hotbarFor("wizard")).toEqual([null, 1, null, 3]);
    // Other classes keep their own bars.
    expect(hotbarFor("ranger")).toEqual([0, null, null, null]);
  });

  it("starts empty for a new character's class, but a class already played keeps its bar", () => {
    startBarEmpty("cleric");
    expect(hotbarFor("cleric")).toEqual([null, null, null, null]);
    setHotbarSlot("monk", 1, 2);
    startBarEmpty("monk");
    expect(hotbarFor("monk")).toEqual([0, 2, null, null]);
  });

  it("a double-tap puts a skill in the first empty slot, or the first slot when the bar is full", () => {
    startBarEmpty("rogue");
    expect(equipSkill("rogue", 2)).toBe(0);
    expect(equipSkill("rogue", 0)).toBe(1);
    expect(equipSkill("rogue", 2)).toBe(0);
    expect(hotbarFor("rogue")).toEqual([2, 0, null, null]);
    equipSkill("rogue", 1);
    equipSkill("rogue", 3);
    setHotbarSlot("rogue", 3, 3);
    expect(hotbarFor("rogue")).toEqual([2, 0, 1, 3]);
    setHotbarSlot("rogue", 0, null);
    expect(equipSkill("rogue", 2)).toBe(0);
  });
});
