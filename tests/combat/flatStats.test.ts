import { describe, expect, it } from "vitest";
import { DEF_LIMIT, bittenFor, combatPowerAt } from "../../src/game/combat/power";
import { damageAt } from "../../src/game/world/monsters";
import { NO_GEAR } from "../../src/game/account/items";

describe("flat attack and defence (the soul codex's)", () => {
  it("attack is added to every blow before the shares multiply it", () => {
    expect(damageAt(40, 1, 0, 0)).toBe(40);
    expect(damageAt(40, 1, 0, 10)).toBe(50);
    expect(damageAt(40, 1, 0.5, 10)).toBe(75);
  });

  it("defence comes off each bite after the guard, never more than half of it, never below one", () => {
    expect(bittenFor(100, { guard: 0 })).toBe(100);
    expect(bittenFor(100, { guard: 0.2, def: 10 })).toBe(70);
    expect(bittenFor(100, { guard: 0, def: 90 })).toBe(100 * (1 - DEF_LIMIT));
    expect(bittenFor(1, { guard: 0, def: 50 })).toBe(1);
  });

  it("raises 전투력", () => {
    const plain = combatPowerAt(40, "warrior", NO_GEAR, null);
    const soul = { atk: 20, def: 10, hp: 50 };
    expect(combatPowerAt(40, "warrior", NO_GEAR, null, null, 0, 0, undefined, soul)).toBeGreaterThan(plain);
  });
});
