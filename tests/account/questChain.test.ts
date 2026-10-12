import { describe, expect, it } from "vitest";
import { QUESTS, QUEST_START, levelingHunt, questGap, questLevel } from "../../src/game/account/quests";
import { MONSTERS, ZONE_MONSTERS } from "../../src/game/world/monsters";
import { ZONES, type ZoneId } from "../../src/game/world/zones";

describe("the quest chain", () => {
  it("asks for a level only when the hunter is below the next quest's ground", () => {
    const spiders = QUESTS.findIndex((q) => q.targets.includes("spider"));
    expect(questGap({ ...QUEST_START, index: spiders }, 7)).toBe(questLevel(spiders));
    expect(questGap({ ...QUEST_START, index: spiders }, questLevel(spiders))).toBeNull();
    expect(questGap({ ...QUEST_START, index: QUESTS.length }, 1)).toBeNull();
  });

  it("between quests, always has a hunt to level up in: a field the hunter may go into, near their level", () => {
    for (let level = 1; level <= 60; level++) {
      const hunt = levelingHunt(level);
      expect(hunt.length, `level ${level}`).toBeGreaterThan(0);
      const zones = (Object.keys(ZONES) as ZoneId[]).filter((z) => hunt.every((t) => ZONE_MONSTERS[z].includes(t)));
      expect(zones.length, `level ${level}: ${hunt.join(",")}`).toBe(1);
      expect(ZONES[zones[0]].minLevel).toBeLessThanOrEqual(level);
      for (const t of hunt) expect(MONSTERS[t].level, `level ${level}: ${t}`).toBeLessThanOrEqual(Math.max(level + 3, Math.min(...ZONE_MONSTERS[zones[0]].map((k) => MONSTERS[k].level))));
    }
  });

  it("the hunt before the Mushroom King is the second field's, up to three levels above", () => {
    expect(levelingHunt(19)).toEqual(["spider", "snake", "wasp", "bat"]);
  });
});
