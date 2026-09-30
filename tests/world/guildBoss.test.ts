import { describe, expect, it } from "vitest";
import {
  ARENA_ROOMS, BROOD_COUNT, GUILD_BOSSES, HP_PER_MEMBER, MIN_MEMBERS, TOP_GEAR, arenaRoomId, bossMax, bossOfWeek, castPattern,
  finalGear, nextPattern, patternGap, ranking, readArenaRoom, stageOf,
} from "../../src/game/world/guildBoss";
import { inShape } from "../../src/game/world/telegraphs";

const still = () => 0.5;

describe("guild boss", () => {
  it("takes the three in turn, week by week", () => {
    expect([0, 1, 2, 3, -1].map(bossOfWeek)).toEqual([GUILD_BOSSES[0], GUILD_BOSSES[1], GUILD_BOSSES[2], GUILD_BOSSES[0], GUILD_BOSSES[2]]);
  });

  it("is as strong as the guild is big, and never smaller than five", () => {
    expect(bossMax(1)).toBe(HP_PER_MEMBER * MIN_MEMBERS);
    expect(bossMax(12)).toBe(HP_PER_MEMBER * 12);
  });

  it("counts stages at a quarter each", () => {
    expect([0, 24, 25, 50, 99, 100, 150].map((d) => stageOf(d, 100))).toEqual([0, 0, 1, 2, 3, 4, 4]);
  });

  it("gives the top three the best gear and the rest good gear", () => {
    for (let rank = 0; rank < TOP_GEAR; rank++) expect(["weapon_5", "armor_5"]).toContain(finalGear(rank, Math.random));
    expect(["weapon_3", "armor_3", "weapon_4", "armor_4"]).toContain(finalGear(TOP_GEAR, Math.random));
    expect(finalGear(0, () => 0.999)).toBe("armor_5");
  });

  it("ranks by damage", () => {
    const board = ranking({ a: { account: "x", name: "A", damage: 5 }, b: { account: "y", name: "B", damage: 9 } });
    expect(board.map((h) => h.characterId)).toEqual(["b", "a"]);
  });

  it("names its rooms by guild and number", () => {
    expect(readArenaRoom(arenaRoomId("abc-1", 3))).toEqual({ guildId: "abc-1", n: 3 });
    expect(readArenaRoom(arenaRoomId("g", ARENA_ROOMS + 1))).toBeNull();
    expect(readArenaRoom("rpg-w1-village-1")).toBeNull();
  });

  it("never picks the same pattern twice in a row", () => {
    for (const last of [0, 1, 2]) for (const r of [0, 0.4, 0.99]) expect(nextPattern(last, () => r)).not.toBe(last);
    expect(patternGap(true, still)).toBeLessThan(patternGap(false, still));
  });

  const boss = { x: 0, z: 0 };
  const prey = [{ account: "a", x: 3, z: 0 }, { account: "b", x: -8, z: 0 }];

  it("the dragon: fire under everyone, a breath at the nearest, a sweep round itself", () => {
    const fire = castPattern("guild_dragon", 0, boss, prey, 1000, false, still, "d");
    expect(fire.telegraphs.length).toBe(prey.length);
    for (const p of prey) expect(fire.telegraphs.some((t) => inShape(t.shape, p.x, p.z))).toBe(true);
    expect(fire.telegraphs[0].hitAt).toBe(1000 + 1600);
    const breath = castPattern("guild_dragon", 1, boss, prey, 0, false, still, "d").telegraphs[0];
    expect(inShape(breath.shape, 3, 0)).toBe(true);
    expect(inShape(breath.shape, -8, 0)).toBe(false);
    const sweep = castPattern("guild_dragon", 2, boss, prey, 0, false, still, "d").telegraphs[0];
    expect(inShape(sweep.shape, 3, 0)).toBe(true);
    expect(inShape(sweep.shape, -8, 0)).toBe(false);
  });

  it("the yeti: a lane at the farthest and a charge down it, falling ice, a roar safe close in", () => {
    const charge = castPattern("guild_yeti", 0, boss, prey, 0, false, still, "y");
    expect(inShape(charge.telegraphs[0].shape, -6, 0)).toBe(true);
    expect(charge.chargeTo!.x).toBeLessThan(-10);
    expect(charge.chargeTo!.at).toBe(charge.telegraphs[0].hitAt);
    expect(castPattern("guild_yeti", 1, boss, prey, 0, false, Math.random, "y").telegraphs.length).toBe(7);
    const roar = castPattern("guild_yeti", 2, boss, prey, 0, false, still, "y").telegraphs[0];
    expect(inShape(roar.shape, 1, 0)).toBe(false);
    expect(inShape(roar.shape, -8, 0)).toBe(true);
  });

  it("the glub: its brood, pools that stay, a gulp round itself", () => {
    expect(castPattern("guild_glub", 0, boss, prey, 0, false, still, "g")).toEqual({ telegraphs: [], summon: BROOD_COUNT });
    const pools = castPattern("guild_glub", 1, boss, prey, 0, false, still, "g").telegraphs;
    expect(pools.length).toBe(3);
    expect(pools.every((t) => t.pool && t.pool.until > t.hitAt)).toBe(true);
  });

  it("raging: quicker marks and more of them", () => {
    const calm = castPattern("guild_yeti", 1, boss, prey, 0, false, Math.random, "y").telegraphs;
    const angry = castPattern("guild_yeti", 1, boss, prey, 0, true, Math.random, "y").telegraphs;
    expect(angry.length).toBe(calm.length + 2);
    expect(angry[0].hitAt).toBeLessThan(calm[0].hitAt);
  });
});
