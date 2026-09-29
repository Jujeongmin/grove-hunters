import { describe, expect, it } from "vitest";
import { Threats } from "../../src/game/world/threats";
import { MONSTERS, type MonsterState } from "../../src/game/world/monsters";

const me = { x: 0, z: 0 };
function rat(x: number, attackReadyAt: number, extra: Partial<MonsterState> = {}): MonsterState {
  return {
    type: "rat", x, z: 0, yaw: 0, hp: MONSTERS.rat.hp, alive: true, stunnedUntil: 0, attackReadyAt, respawnAt: 0,
    homeX: x, homeZ: 0, ...extra,
  };
}

describe("the monsters hitting you", () => {
  it("are those that swung while within reach of you", () => {
    const threats = new Threats();
    threats.watch({ near: rat(1, 100), far: rat(8, 100) }, me, 0);
    expect(threats.nearest({ near: rat(1, 100), far: rat(8, 100) }, me)).toBeNull();
    const swung = { near: rat(1, 1500), far: rat(8, 1500) };
    threats.watch(swung, me, 100);
    expect(threats.has("near")).toBe(true);
    expect(threats.has("far")).toBe(false);
    expect(threats.nearest(swung, me)).toBe("near");
  });

  it("the nearest of several, and not once they stop, fall or it has been a while", () => {
    const threats = new Threats();
    threats.watch({ a: rat(1.4, 0), b: rat(1, 0) }, me, 0);
    threats.watch({ a: rat(1.4, 1400), b: rat(1, 1400) }, me, 50);
    expect(threats.nearest({ a: rat(1.4, 1400), b: rat(1, 1400) }, me)).toBe("b");
    threats.watch({ a: rat(1.4, 1400), b: rat(1, 1400, { alive: false }) }, me, 100);
    expect(threats.has("b")).toBe(false);
    expect(threats.has("a")).toBe(true);
    threats.watch({ a: rat(1.4, 1400) }, me, 10_000);
    expect(threats.has("a")).toBe(false);
  });
});
