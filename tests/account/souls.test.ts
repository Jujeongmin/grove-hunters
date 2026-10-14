import { describe, expect, it } from "vitest";
import {
  BOSS_SOUL_CHANCE, SOUL_CHANCE, SOUL_MAX, SOUL_MONSTERS, codexBonus, collectSouls, gainSoul, readSouls, soulChance, soulGroup,
  soulStage, soulZones, stageBonus, wantsSoul,
} from "../../src/game/account/souls";
import { ZONE_IDS } from "../../src/game/world/zones";
import { ZONE_MONSTERS } from "../../src/game/world/monsters";

describe("the soul codex", () => {
  it("holds every field monster once and the four bosses, each met somewhere", () => {
    const fields = new Set(ZONE_IDS.flatMap((z) => ZONE_MONSTERS[z]));
    expect(SOUL_MONSTERS.length).toBe(fields.size + 4);
    for (const t of SOUL_MONSTERS) expect(soulZones(t).length, t).toBeGreaterThan(0);
    expect(soulZones("grove_guardian")).toEqual(["forest1"]);
    expect(soulZones("flame_lord")).toEqual(["lavaboss"]);
    expect(soulGroup("green_blob")).toBe("grove");
    expect(soulGroup("frost_blob")).toBe("snow");
    expect(soulGroup("magma_blob")).toBe("volcano");
    expect(soulGroup("mushroom_king")).toBe("boss");
  });

  it("drops one time in a hundred from the fields, one in twenty from the bosses, always from the guardian, never from the brood", () => {
    expect(soulChance("rat")).toBe(SOUL_CHANCE);
    expect(SOUL_CHANCE).toBe(0.01);
    expect(soulChance("flame_lord")).toBe(BOSS_SOUL_CHANCE);
    expect(BOSS_SOUL_CHANCE).toBe(0.05);
    expect(soulChance("grove_guardian")).toBe(1);
    expect(soulChance("mushnub_guard")).toBe(0);
    expect(soulChance("guild_dragon")).toBe(0);
  });

  it("opens its stages at one, five and ten souls", () => {
    expect([0, 1, 4, 5, 9, 10].map(soulStage)).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it("waits for the hunter to collect, and never holds more than ten of a monster", () => {
    let souls = gainSoul("rat", {}, {});
    expect(souls).toEqual({ rat: 1 });
    souls = gainSoul("rat", { rat: 9 }, souls);
    expect(souls).toEqual({ rat: 1 });
    expect(wantsSoul("rat", { rat: 9 }, souls)).toBe(false);
    const done = collectSouls("rat", { rat: 4 }, { rat: 3, frog: 1 });
    expect(done.codex).toEqual({ rat: 7 });
    expect(done.souls).toEqual({ frog: 1 });
    expect(done.opened).toEqual([2]);
    expect(collectSouls("rat", {}, { rat: 10 }).opened).toEqual([1, 2, 3]);
    expect(collectSouls("rat", { rat: 3 }, {}).opened).toEqual([]);
    expect(readSouls({ rat: 99, nope: 3, frog: -1, mushnub_guard: 2 })).toEqual({ rat: SOUL_MAX });
  });

  it("adds flat attack in the grove, health in the snow, defence in the volcano, more from stronger monsters, all three twice from a boss", () => {
    expect(stageBonus("green_blob", 0)).toEqual({ atk: 1, def: 0, hp: 0 });
    expect(stageBonus("stone_golem", 0)).toEqual({ atk: 2, def: 0, hp: 0 });
    expect(stageBonus("frost_blob", 0)).toEqual({ atk: 0, def: 0, hp: 7 });
    expect(stageBonus("glacier_alpaking", 0)).toEqual({ atk: 0, def: 0, hp: 10 });
    expect(stageBonus("magma_blob", 0)).toEqual({ atk: 0, def: 1, hp: 0 });
    expect(stageBonus("flame_lord", 0)).toEqual({ atk: 6, def: 2, hp: 26 });
    expect(codexBonus({ green_blob: 10 })).toEqual({ atk: 3, def: 0, hp: 0 });
    expect(codexBonus({ frost_blob: 5 })).toEqual({ atk: 0, def: 0, hp: 14 });
    const full = codexBonus(Object.fromEntries(SOUL_MONSTERS.map((t) => [t, 10])));
    // The whole codex: a sizeable lift, not a second character.
    expect(full.atk).toBeGreaterThan(40);
    expect(full.atk).toBeLessThan(90);
    expect(full.hp).toBeGreaterThan(200);
    expect(full.hp).toBeLessThan(450);
    expect(full.def).toBeGreaterThan(20);
    expect(full.def).toBeLessThan(60);
  });
});
