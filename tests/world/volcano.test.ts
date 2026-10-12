import { describe, expect, it } from "vitest";
import { MONSTERS, ZONE_BOSS, ZONE_MONSTERS } from "../../src/game/world/monsters";
import { ZONES, portalsOf, townOf } from "../../src/game/world/zones";
import { castPattern } from "../../src/game/world/guildBoss";
import { RECIPES } from "../../src/game/account/forge";
import { lookOf, VOLCANO_LOOK } from "../../src/game/render/regionLook";

describe("the volcano", () => {
  it("runs peaks, camp, ash plain, lava canyon, summit, with the altar off the canyon, each way back", () => {
    const pairs: [string, string][] = [["snow3", "camp"], ["camp", "lava1"], ["lava1", "lava2"], ["lava2", "lava3"], ["lava2", "lavaboss"]];
    for (const [a, b] of pairs) {
      expect(portalsOf(a as never).some((p) => p.to === b), `${a} to ${b}`).toBe(true);
      expect(portalsOf(b as never).some((p) => p.to === a), `${b} to ${a}`).toBe(true);
    }
    for (const z of ["camp", "lava1", "lava2", "lava3", "lavaboss"] as const) {
      expect(ZONES[z].region).toBe("volcano");
      expect(townOf(z)).toBe("camp");
    }
    expect(lookOf("volcano")).toBe(VOLCANO_LOOK);
  });

  it("its monsters stand at or above their ground's level and carry on past the snow's", () => {
    for (const z of ["lava1", "lava2", "lava3"] as const) {
      for (const t of ZONE_MONSTERS[z]) {
        expect(MONSTERS[t].level, t).toBeGreaterThanOrEqual(ZONES[z].minLevel);
        expect(MONSTERS[t].hp, t).toBeGreaterThan(MONSTERS.glacier_alpaking.hp);
      }
    }
    expect(ZONE_BOSS.lavaboss).toBe("flame_lord");
    expect(MONSTERS.flame_lord.drops.some((d) => d.item === "weapon_9")).toBe(true);
  });

  it("the Flame Lord casts meteors, a breath and lingering lava", () => {
    const prey = [{ account: "a", x: 10, z: 10 }];
    const kinds = [0, 1, 2].map((i) => castPattern("flame_lord", i, { x: 10, z: 4 }, prey, 0, false, () => 0.5, "f").telegraphs);
    expect(kinds[0].length).toBeGreaterThanOrEqual(1);
    expect(kinds[1][0].shape.kind).toBe("cone");
    expect(kinds[2].every((t) => t.pool !== undefined)).toBe(true);
  });

  it("the smith makes tiers 8 and 9 from the volcano's materials", () => {
    for (const id of ["weapon_8", "armor_8", "weapon_9", "armor_9"]) expect(RECIPES.some((r) => r.makes === id), id).toBe(true);
  });
});
