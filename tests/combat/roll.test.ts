import { describe, expect, it } from "vitest";
import { ROLL, dodging, rollReady } from "../../src/game/combat/roll";

describe("the dodge roll", () => {
  it("keeps blows off for a moment from when the server hears of it, a little longer than the tumble", () => {
    expect(ROLL.safeMs).toBeGreaterThan(ROLL.seconds * 1000);
    expect(dodging(undefined, 1000)).toBe(false);
    expect(dodging(1000, 1000)).toBe(true);
    expect(dodging(1000, 1000 + ROLL.safeMs - 1)).toBe(true);
    expect(dodging(1000, 1000 + ROLL.safeMs)).toBe(false);
  });

  it("comes again only after its wait (the server forgives a fifth of it for the way there)", () => {
    expect(rollReady(undefined, 0)).toBe(true);
    expect(rollReady(1000, 1000 + ROLL.cooldownMs * 0.5)).toBe(false);
    expect(rollReady(1000, 1000 + ROLL.cooldownMs * 0.8)).toBe(true);
  });
});
