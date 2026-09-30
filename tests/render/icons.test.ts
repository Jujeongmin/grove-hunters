import { describe, expect, it } from "vitest";
import { ICON_IDS, iconFor, skillIconId } from "../../src/game/render/icons";
import { CLASSES } from "../../src/game/combat/classes";
import { SKILL_SLOTS } from "../../src/game/combat/skills";
import { JOBS, type JobId } from "../../src/game/combat/jobs";
import { ITEM_IDS } from "../../src/game/account/items";

describe("icons", () => {
  it("cover every skill, and every item with a picture of its own", async () => {
    for (const c of CLASSES) {
      for (let i = 0; i < SKILL_SLOTS; i++) expect(iconFor(skillIconId(c, null, i)), `${c} ${i}`).toMatch(/assets\/ui\/icons\//);
    }
    for (const job of Object.keys(JOBS) as JobId[]) {
      for (let i = 1; i < SKILL_SLOTS; i++) {
        expect(iconFor(skillIconId(JOBS[job].playerClass, job, i)), `${job} ${i}`).toMatch(/assets\/ui\/icons\//);
      }
    }
    // A path that brought skills of its own shows its own pictures; one that took its class's over keeps theirs.
    expect(skillIconId("warrior", "guardian", 1)).toBe("guardian_1");
    expect(skillIconId("warrior", "berserker", 1)).toBe("warrior_1");
    expect(skillIconId("cleric", "high_priest", 2)).toBe("cleric_2");
    // Every path's fourth skill has a gilded picture of its own.
    for (const job of Object.keys(JOBS)) expect(skillIconId(JOBS[job as JobId].playerClass, job, 3)).toBe(`${job}_3`);
    // The pictures live with the other assets on the deploy branch; where they are here, all must be.
    const { existsSync } = await import("node:fs");
    const here = existsSync("public/assets/ui/items");
    for (const id of ITEM_IDS) {
      expect(iconFor(id), id).toMatch(new RegExp(`assets/ui/items/${id}\\.png$`));
      if (here) expect(existsSync(`public/assets/ui/items/${id}.png`), id).toBe(true);
    }
    if (here) for (const id of ICON_IDS) expect(existsSync(`public/assets/ui/icons/${id}.png`), id).toBe(true);
  });
});
