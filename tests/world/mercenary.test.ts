import { describe, expect, it } from "vitest";
import {
  HEAL_MS, HEAL_SHARE, MERC_EFFICIENCY, MERC_HP_SHARE, makeMercs, mercClasses, readMercs, stepMercs, type Merc,
} from "../../src/game/world/mercenary";
import { WEAPONS } from "../../src/game/combat/classes";
import { damageAt, type MonsterState } from "../../src/game/world/monsters";
import { zoneLayout } from "../../src/game/world/zones";
import type { Telegraph } from "../../src/game/world/telegraphs";

const layout = zoneLayout("dungeon");
const centre = layout.bossSpawn!;
const mate = { playerClass: "warrior" as const, level: 20, maxHp: 1000, power: 0.4, guard: 0.1 };

function merc(change: Partial<Merc> = {}): Merc {
  return {
    name: "루카", playerClass: "warrior", costume: "0000", level: 20, x: centre.x, z: centre.z, yaw: 0, hp: 800, maxHp: 800, dead: false,
    power: 0.4, guard: 0.1, attackReadyAt: 0, healReadyAt: 0, swing: 0, skill: 0, hitAt: 0, ...change,
  };
}

function monster(x: number, z: number, hp = 5000): MonsterState {
  return { type: "spider", x, z, yaw: 0, hp, maxHp: hp, alive: true, stunnedUntil: 0, attackReadyAt: 0, respawnAt: 0, homeX: x, homeZ: z, summoned: true };
}

describe("mercenaries", () => {
  it("fill the empty seats with a healer first, then what the players lack", () => {
    expect(mercClasses([mate], 3)).toEqual(["cleric", "ranger", "warrior"]);
    expect(mercClasses([{ ...mate, playerClass: "cleric" }], 2)).toEqual(["warrior", "ranger"]);
    expect(mercClasses([mate, mate, mate, mate], 0)).toEqual([]);
  });

  it("are about as strong as the players, a little less", () => {
    const mercs = makeMercs([mate, { ...mate, level: 30, maxHp: 2000 }], 2, centre, () => 0.3);
    const list = Object.values(mercs);
    expect(list.length).toBe(2);
    expect(list[0]).toMatchObject({ level: 25, maxHp: Math.round(1500 * MERC_HP_SHARE), power: 0.4, dead: false });
    expect(new Set(list.map((m) => m.name)).size).toBe(2);
    expect(readMercs(mercs)).toEqual(mercs);
    expect(readMercs({ bad: { name: 1 } })).toEqual({});
  });

  it("walk to the nearest monster and strike it, a little softer than a player", () => {
    const mercs = { m0: merc() };
    const monsters = { far: monster(centre.x + 6, centre.z, 5000) };
    stepMercs(mercs, monsters, [], [], [], layout, 0.2, 1000);
    // Too far to strike: a step closer.
    expect(mercs.m0.x).toBeGreaterThan(centre.x);
    expect(monsters.far.hp).toBe(5000);
    const near = { close: monster(mercs.m0.x + 1, mercs.m0.z, 5000) };
    stepMercs(mercs, near, [], [], [], layout, 0.2, 2000);
    const blow = Math.round(damageAt(WEAPONS.warrior.damage, 20, 0.4) * MERC_EFFICIENCY);
    expect(near.close.hp).toBe(5000 - blow);
    expect(near.close.hitters).toEqual({ "merc:m0": blow });
    expect(mercs.m0.swing).toBe(1);
    // Not again before its weapon allows.
    stepMercs(mercs, near, [], [], [], layout, 0.2, 2100);
    expect(near.close.hp).toBe(5000 - blow);
  });

  it("step out of a mark before anything else", () => {
    const mercs = { m0: merc() };
    const mark: Telegraph = { id: "t", shape: { kind: "circle", x: centre.x, z: centre.z, r: 2.5 }, startAt: 0, hitAt: 5000, share: 0.4 };
    const monsters = { close: monster(centre.x + 1, centre.z) };
    stepMercs(mercs, monsters, [mark], [], [], layout, 0.5, 1000);
    expect(Math.hypot(mercs.m0.x - centre.x, mercs.m0.z - centre.z)).toBeGreaterThan(0.5);
    expect(monsters.close.hp).toBe(5000);
  });

  it("a cleric heals the most hurt ally near it, then waits", () => {
    const mercs = { m0: merc({ playerClass: "cleric" }) };
    const allies = [
      { id: "a", x: centre.x + 2, z: centre.z, hp: 500, maxHp: 1000, dead: false },
      { id: "b", x: centre.x + 2, z: centre.z, hp: 200, maxHp: 1000, dead: false },
      { id: "c", x: centre.x + 40, z: centre.z, hp: 10, maxHp: 1000, dead: false },
    ];
    stepMercs(mercs, {}, [], allies, [], layout, 0.2, 1000);
    expect(allies.map((a) => a.hp)).toEqual([500, 200 + 1000 * HEAL_SHARE, 10]);
    expect(mercs.m0.healReadyAt).toBe(1000 + HEAL_MS);
    stepMercs(mercs, {}, [], allies, [], layout, 0.2, 2000);
    expect(allies[1].hp).toBe(200 + 1000 * HEAL_SHARE);
  });
});
