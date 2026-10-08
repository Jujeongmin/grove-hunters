import { describe, expect, it } from "vitest";
import { QUESTS } from "../../src/game/account/quests";
import { levelOf } from "../../src/game/account/level";
import { MONSTERS, ZONE_BOSS, ZONE_MONSTERS, type MonsterType } from "../../src/game/world/monsters";
import { ZONES, type ZoneId } from "../../src/game/world/zones";

// Where a monster kind lives (a field's own, or a boss's clearing).
const zoneOf = (t: MonsterType): ZoneId =>
  (Object.keys(ZONES) as ZoneId[]).find((z) => ZONE_MONSTERS[z].includes(t) || ZONE_BOSS[z] === t)!;

describe("the quest chain", () => {
  it("never asks for a zone the quests before it have not levelled a hunter into", () => {
    // A hunter who does only the quests: their kills (as many as each asks) and their rewards.
    let xp = 0;
    QUESTS.forEach((q, i) => {
      const need = ZONES[zoneOf(q.targets[0])].minLevel;
      expect(levelOf(xp).level, `quest ${i} (${q.targets.join("/")}) wants level ${need}`).toBeGreaterThanOrEqual(need);
      const perKill = q.targets.reduce((s, t) => s + MONSTERS[t].xp, 0) / q.targets.length;
      xp += perKill * q.count + q.xp;
    });
  });
});
