import { describe, expect, it } from "vitest";
import { WEAPONS } from "../../src/game/combat/classes";
import { AIM_GRACE, inStrikeReach } from "../../src/game/combat/melee";
import { CLASS_SKILLS, skillTargets } from "../../src/game/combat/skills";
import { MONSTERS, bodyOf } from "../../src/game/world/monsters";

// Facing -z (yaw 0), a monster straight ahead at distance d.
const pose = { x: 0, z: 0, yaw: 0 };
const ahead = (d: number) => ({ x: 0, z: -d });

describe("strike reach", () => {
  it("reaches a monster's edge, not its middle", () => {
    const wizard = WEAPONS.wizard;
    const body = MONSTERS.green_blob.body;
    expect(inStrikeReach(pose, ahead(wizard.reach + body - 0.05), wizard, false, body)).toBe(true);
    expect(inStrikeReach(pose, ahead(wizard.reach + body + 0.05), wizard, false, body)).toBe(false);
  });

  it("whatever the client fires at (its grace included), the server lets land", () => {
    for (const weapon of Object.values(WEAPONS)) {
      for (const type of ["green_blob", "stone_golem", "frost_drake"] as const) {
        const body = MONSTERS[type].body;
        for (let d = 0.5; d <= weapon.reach + body + AIM_GRACE + 1; d += 0.25) {
          if (inStrikeReach(pose, ahead(d), weapon, false, body + AIM_GRACE)) expect(inStrikeReach(pose, ahead(d), weapon, true, body)).toBe(true);
        }
      }
    }
  });

  it("skills reach each monster's edge too", () => {
    const skill = CLASS_SKILLS.wizard;
    const m = { ...ahead(skill.reach + MONSTERS.stone_golem.body - 0.05), alive: true, type: "stone_golem" };
    expect(skillTargets(pose, { m }, skill)).toEqual([]);
    expect(skillTargets(pose, { m }, skill, false, bodyOf)).toEqual(["m"]);
  });
});
