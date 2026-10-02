import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS, METRICS, NO_RECORD, achievementById, achievementsView, factsOf, readAchieved, readRecord, recordFelled,
} from "../../src/game/account/achievements";
import { readCharacters, type Character } from "../../src/game/account/characters";
import { levelCost } from "../../src/game/account/level";

// The XP that is exactly level `n`.
const xpOf = (n: number) => Array.from({ length: n - 1 }, (_, i) => levelCost(i + 1)).reduce((a, b) => a + b, 0);

function character(id: string, change: Partial<Character> = {}): Character {
  const [c] = readCharacters([{ id, world: "w1", name: id, playerClass: "warrior", costume: "0000" }]);
  return { ...c, ...change };
}

const NOTHING = { mounts: 1, star5: 0, attend: 0 };

describe("achievements", () => {
  it("each has its own id, a goal and gems, and every metric is shown", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.goal > 0 && a.gems > 0).toBe(true);
    expect(new Set(ACHIEVEMENTS.map((a) => a.metric))).toEqual(new Set(METRICS));
    expect(ACHIEVEMENTS.reduce((n, a) => n + a.gems, 0)).toBe(1580);
    expect(achievementById("level-10")?.gems).toBe(20);
    expect(achievementById("level-11")).toBeNull();
  });

  it("reads records and claimed ids, keeping only what makes sense", () => {
    expect(readRecord(undefined)).toEqual(NO_RECORD);
    expect(readRecord({ kills: 12.5, bosses: { mushroom_king: 2, rat: 4, frost_emperor: -1 }, dailies: 3, bestPlus: 9 }))
      .toEqual({ kills: 0, bosses: { mushroom_king: 2 }, dailies: 3, bestPlus: 9 });
    expect(readAchieved(["level-10", "level-10", "nope", 3])).toEqual(["level-10"]);
  });

  it("counts what is felled, and the recorded bosses one by one", () => {
    const r = recordFelled(undefined, ["rat", "mushroom_king", "rat", "grove_guardian"]);
    expect(r).toEqual({ ...NO_RECORD, kills: 4, bosses: { mushroom_king: 1, grove_guardian: 1 } });
    expect(recordFelled(r, ["mushroom_king"]).bosses.mushroom_king).toBe(2);
  });

  it("adds up every character's kills, bosses and dailies, and takes the best level, quest and +", () => {
    const facts = factsOf([
      character("a", { xp: xpOf(31), record: { kills: 500, bosses: { grove_guardian: 1 }, dailies: 4, bestPlus: 7 } }),
      character("b", { xp: xpOf(12), record: { kills: 700, bosses: {}, dailies: 8, bestPlus: 0 }, job: "berserker" }),
    ], { mounts: 4, star5: 1, attend: 9 });
    expect(facts).toMatchObject({
      level: 31, kills: 1200, grove_guardian: 1, dailies: 12, plus: 7, advanced: 1, guild: 0, mounts: 4, star5: 1, attend: 9,
    });
  });

  it("counts the bosses a character's finished quests asked for, and the + it carries, from before records", () => {
    // Past the twelfth quest: the Mushroom King once, then three times more.
    const past = character("a", { quest: { index: 12, count: 0 } });
    const worn = character("b", { gear: { weapon: { uid: "w", id: "weapon_1", plus: 9, trade: false }, armor: null } });
    const facts = factsOf([past, worn], NOTHING);
    expect(facts.quests).toBe(12);
    expect(facts.mushroom_king).toBe(4);
    expect(facts.frost_emperor).toBe(0);
    expect(facts.plus).toBe(9);
  });

  it("shows progress up to each goal, and how many wait to be claimed", () => {
    const facts = factsOf([character("a", { xp: xpOf(31) })], NOTHING);
    const view = achievementsView(facts, ["level-10"]);
    const level = view.list.filter((a) => a.metric === "level");
    expect(level.map((a) => [a.progress, a.claimed])).toEqual([[10, true], [30, false], [31, false], [31, false]]);
    // Level 30 waits; level 10 is claimed already.
    expect(view.claimable).toBe(1);
  });
});
