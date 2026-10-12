import { describe, expect, it } from "vitest";
import { MONSTERS, ZONE_MONSTERS, damageAt, spawnMonsters, type MonsterType } from "../../src/game/world/monsters";
import { ZONE_IDS, zoneLayout, type ZoneId } from "../../src/game/world/zones";
import { fightStatsAt } from "../../src/game/combat/power";
import { WEAPONS } from "../../src/game/combat/classes";
import type { ItemId } from "../../src/game/account/items";

const FIELDS = ZONE_IDS.filter((z) => ZONE_MONSTERS[z].length > 0);

describe("monster packs", () => {
  it("every field spot holds a pack: three and two in turn (the slimes three each), two and a half times the spots", () => {
    for (const zone of FIELDS) {
      const spots = zoneLayout(zone).zombieSpawns.length;
      const n = Object.keys(spawnMonsters(zone)).length;
      expect(n, zone).toBeGreaterThanOrEqual(Math.floor(spots * 2.5));
      expect(n, zone).toBeLessThanOrEqual(spots * 3);
    }
  });

  it("stand on open ground, none inside another", () => {
    for (const zone of FIELDS) {
      const { solid, tileSize } = zoneLayout(zone);
      const all = Object.values(spawnMonsters(zone));
      for (const m of all) expect(solid[Math.floor(m.z / tileSize)]?.[Math.floor(m.x / tileSize)], `${zone} ${m.type} ${m.x},${m.z}`).toBeFalsy();
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const [a, b] = [all[i], all[j]];
          expect(Math.hypot(a.x - b.x, a.z - b.z), `${zone} ${a.type}/${b.type}`).toBeGreaterThanOrEqual(MONSTERS[a.type].body + MONSTERS[b.type].body - 1e-6);
        }
      }
    }
  });

  it("keep a field's room state small enough to send to everyone in it", () => {
    for (const zone of FIELDS) expect(JSON.stringify(spawnMonsters(zone)).length, zone).toBeLessThan(24_000);
  });
});

// What felling one monster of a field's kind costs a warrior of its level with nothing bought, in the
// gear of that field: its first bite lands at once, then one each attackMs, until it falls.
const GEAR: Partial<Record<ZoneId, [ItemId, ItemId]>> = {
  forest1: ["weapon_1", "armor_1"], forest2: ["weapon_2", "armor_2"], forest3: ["weapon_4", "armor_4"],
};
function lossOf(type: MonsterType, [weapon, armor]: [ItemId, ItemId]): number {
  const m = MONSTERS[type];
  const gear = { weapon: { uid: "w", id: weapon, plus: 0, trade: false }, armor: { uid: "a", id: armor, plus: 0, trade: false } };
  const s = fightStatsAt(m.level, gear, null, "deer", 0, 0);
  const dps = (damageAt(WEAPONS.warrior.damage, m.level, s.gear.power) / (WEAPONS.warrior.intervalMs / 1000)) * 1.15;
  const bites = Math.floor(((m.hp / dps) * 1000) / m.attackMs) + 1;
  return (bites * m.damage * (1 - s.gear.guard)) / s.maxHp;
}

describe("monster blows", () => {
  it("a fight at your own level costs health: a tenth or less in the first field, a fifth or more past it", () => {
    for (const [zone, gear] of Object.entries(GEAR) as [ZoneId, [ItemId, ItemId]][]) {
      for (const type of ZONE_MONSTERS[zone]) {
        const loss = lossOf(type, gear);
        if (MONSTERS[type].level <= 7) expect(loss, type).toBeGreaterThanOrEqual(0.05);
        if (MONSTERS[type].level <= 7) expect(loss, type).toBeLessThanOrEqual(0.12);
        else expect(loss, type).toBeGreaterThanOrEqual(0.19);
      }
    }
  });
});
