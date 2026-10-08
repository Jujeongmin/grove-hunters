import { describe, expect, it } from "vitest";
import { QUESTS, QUEST_CHAIN, countKills, questDone, readQuest } from "../../src/game/account/quests";
import { levelOf } from "../../src/game/account/level";
import { CLASSES } from "../../src/game/combat/classes";
import { ADVANCE_LEVEL, JOBS, jobsOf } from "../../src/game/combat/jobs";
import { CLASS_SKILLS, FOURTH_SKILL_LEVEL, JOB_SKILLS, THIRD_SKILL_LEVEL, skillAt } from "../../src/game/combat/skills";
import { MONSTERS, XP_GRACE, xpFor } from "../../src/game/world/monsters";

describe("quests", () => {
  it("count only the asked kinds, up to the goal", () => {
    const first = QUESTS[0];
    let p = countKills({ index: 0, count: 0 }, ["rat", first.targets[0]]);
    expect(p.count).toBe(1);
    p = countKills(p, Array(20).fill(first.targets[0]));
    expect(p.count).toBe(first.count);
    expect(questDone(p)).toBe(true);
  });

  it("read back safely, and stay done past the last", () => {
    expect(readQuest(undefined)).toEqual({ index: 0, count: 0, v: QUEST_CHAIN });
    expect(readQuest({ index: 0, count: 999 })).toEqual({ index: 0, count: QUESTS[0].count, v: QUEST_CHAIN });
    expect(readQuest({ index: 99, count: 3 })).toEqual({ index: QUESTS.length, count: 0, v: QUEST_CHAIN });
    expect(questDone({ index: QUESTS.length, count: 0 })).toBe(false);
  });

  it("moves a save from before the two inserted quests along to the same quest, its count kept", () => {
    // Old index 3 was the second field's spiders and snakes; it is 5 now.
    expect(QUESTS[5].targets).toEqual(["spider", "snake"]);
    expect(readQuest({ index: 3, count: 7 })).toEqual({ index: 5, count: 7, v: QUEST_CHAIN });
    // Before the insertion point nothing moves; a save already in the new chain is read as it is.
    expect(readQuest({ index: 2, count: 4 })).toEqual({ index: 2, count: 4, v: QUEST_CHAIN });
    expect(readQuest({ index: 3, count: 7, v: QUEST_CHAIN })).toEqual({ index: 3, count: 7, v: QUEST_CHAIN });
    // Read twice, it does not move again.
    expect(readQuest(readQuest({ index: 3, count: 0 }))).toEqual({ index: 5, count: 0, v: QUEST_CHAIN });
  });

  it("carries a hunter of the first field to level 10, where the second opens", () => {
    let xp = 0;
    for (const q of QUESTS.slice(0, 5)) xp += q.xp;
    expect(levelOf(xp).level).toBeGreaterThanOrEqual(10);
  });
});

describe("growth tables", () => {
  it("every class has a skill of its own, and two paths that each bring two skills of their own", () => {
    for (const c of CLASSES) {
      expect(CLASS_SKILLS[c].level).toBe(1);
      const [a, b] = jobsOf(c);
      expect(jobsOf(c)).toHaveLength(2);
      for (const id of [a, b]) {
        expect(JOBS[id].playerClass).toBe(c);
        expect(JOB_SKILLS[id].map((s) => s.level)).toEqual([ADVANCE_LEVEL, THIRD_SKILL_LEVEL, FOURTH_SKILL_LEVEL]);
        // The fourth is the path's great one: its strongest, on the longest wait.
        expect(JOB_SKILLS[id][2].cooldownMs).toBeGreaterThanOrEqual(40_000);
        expect(JOB_SKILLS[id][2].damage + JOB_SKILLS[id][2].heal).toBeGreaterThan(JOB_SKILLS[id][1].damage + JOB_SKILLS[id][1].heal);
      }
      expect(JOB_SKILLS[a]).not.toEqual(JOB_SKILLS[b]);
      // Before advancing, only the first slot holds a skill.
      expect(skillAt(c, null, 0)).toBe(CLASS_SKILLS[c]);
      expect(skillAt(c, null, 1)).toBeNull();
      expect(skillAt(c, a, 2)).toBe(JOB_SKILLS[a][1]);
      expect(skillAt(c, a, 3)).toBe(JOB_SKILLS[a][2]);
      expect(skillAt(c, a, 4)).toBeNull();
    }
    // A path of another class gives nothing.
    expect(skillAt("warrior", "sniper", 1)).toBeNull();
  });
});

describe("monster XP", () => {
  it("pays in full near the monster's level and less and less far above it", () => {
    const rat = MONSTERS.rat;
    expect(xpFor("rat", 1)).toBe(rat.xp);
    expect(xpFor("rat", rat.level + XP_GRACE)).toBe(rat.xp);
    expect(xpFor("rat", rat.level + XP_GRACE + 3)).toBe(Math.round(rat.xp * 0.7));
    expect(xpFor("rat", 99)).toBe(Math.round(rat.xp * 0.1));
  });
});

describe("daily quests", () => {
  it("count a day's kills in their own field, and start over the next day (Korean time)", async () => {
    const { countDaily, dailyDay, dailyToday, readDaily } = await import("../../src/game/account/quests");
    // 23:30 and 00:30 in Korea are different days even though both are the same UTC date.
    const late = Date.UTC(2026, 8, 22, 14, 30);
    const early = Date.UTC(2026, 8, 22, 15, 30);
    expect(dailyDay(late)).toBe("2026-09-22");
    expect(dailyDay(early)).toBe("2026-09-23");
    const start = readDaily(null);
    const one = countDaily(start, ["green_blob", "spider", "stone_golem", "mushroom_king"], late);
    expect(one.counts).toEqual({ forest1: 1, forest2: 1, forest3: 1 });
    expect(dailyToday(one, early)).toEqual({ day: "2026-09-23", counts: {}, claimed: [] });
    expect(readDaily({ day: "x", counts: { forest1: 9999, nope: 3 }, claimed: ["forest2", "nope"] })).toEqual({
      day: "x", counts: { forest1: 30 }, claimed: ["forest2"],
    });
  });
});
