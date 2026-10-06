import { describe, expect, it } from "vitest";
import {
  PASS_DAYS, PASS_XP, VIP_BONUS, VIP_POINTS, extendPass, gemPurchase, huntBonus, nextVipAt, passDaysLeft, protectCost, readPremium, vipOf,
  freeRevive, noMarketFee, pieceLimit, vipDailyGems, vipEnhance,
} from "../../src/game/account/premium";
import { combatPowerAt } from "../../src/game/combat/power";

const DAY = 24 * 60 * 60 * 1000;
const none = readPremium(null);

describe("premium", () => {
  it("reads an account's state, keeping only what makes sense", () => {
    expect(none).toEqual({ vipPoints: 0, firstBought: [], passUntil: 0, passPaidDay: null, vipPaidDay: null });
    expect(readPremium({ vipPoints: 640.7, firstBought: ["gems-100", "nope", "gems-100"], passUntil: -5, passPaidDay: 3 }))
      .toEqual({ vipPoints: 640, firstBought: ["gems-100"], passUntil: 0, passPaidDay: null, vipPaidDay: null });
  });

  it("ranks VIP by points bought, ten ranks in all", () => {
    expect(vipOf(0)).toBe(0);
    expect(vipOf(99)).toBe(0);
    expect(vipOf(100)).toBe(1);
    expect(vipOf(1200)).toBe(3);
    expect(vipOf(10_000_000)).toBe(VIP_POINTS.length);
    expect(nextVipAt(560)).toBe(1200);
    expect(nextVipAt(200_000)).toBeNull();
  });

  it("gives a gem pack's own gems, every time (no first-purchase double), and counts them as points", () => {
    expect(gemPurchase("gems-550", 1, none)).toEqual({ gems: 550, points: 550, first: true });
    expect(gemPurchase("gems-550", 2, none)).toEqual({ gems: 1100, points: 1100, first: true });
    const bought = { ...none, firstBought: ["gems-550"] };
    expect(gemPurchase("gems-550", 1, bought)).toEqual({ gems: 550, points: 550, first: false });
    expect(gemPurchase("gems-14000", 1, none)).toEqual({ gems: 14000, points: 14000, first: true });
    expect(gemPurchase("gems-100", 1, bought)?.first).toBe(true);
    expect(gemPurchase("monthly-pass", 1, none)).toBeNull();
  });

  it("runs a pass thirty days from now, or on from where it ends", () => {
    const now = 1_000 * DAY;
    expect(extendPass(0, now, 1)).toBe(now + PASS_DAYS * DAY);
    expect(extendPass(now + 5 * DAY, now, 1)).toBe(now + 35 * DAY);
    expect(passDaysLeft({ ...none, passUntil: now + 1.5 * DAY }, now)).toBe(2);
    expect(passDaysLeft({ ...none, passUntil: now - 1 }, now)).toBe(0);
  });

  it("adds VIP ranks to hunting's XP and gold, and the pass to its XP", () => {
    const now = 1_000 * DAY;
    expect(huntBonus(none, now)).toEqual({ xp: 1, gold: 1 });
    const vip3 = { ...none, vipPoints: 1200, passUntil: now + DAY };
    expect(huntBonus(vip3, now).xp).toBeCloseTo(1 + 3 * VIP_BONUS + PASS_XP);
    expect(huntBonus(vip3, now).gold).toBeCloseTo(1 + 3 * VIP_BONUS);
  });

  it("protects attempts from +6, where gear can break", () => {
    expect(protectCost(5)).toBeNull();
    expect(protectCost(6)).toBe(20);
    expect(protectCost(10)).toBe(120);
  });

  it("each rank keeps the perks below it; of the daily gems and the odds, the highest counts", () => {
    expect([pieceLimit(1), pieceLimit(2), pieceLimit(10)]).toEqual([50, 60, 60]);
    expect([2, 3, 5, 6, 8, 9, 10].map(vipDailyGems)).toEqual([0, 10, 10, 30, 30, 50, 50]);
    expect([freeRevive(3), freeRevive(4), freeRevive(10)]).toEqual([false, true, true]);
    expect([vipEnhance(6), vipEnhance(7), vipEnhance(9)]).toEqual([0, 0.05, 0.1]);
    expect([noMarketFee(7), noMarketFee(8)]).toEqual([false, true]);
    // VIP 5's might shows in 전투력.
    const at = (vip: number) => combatPowerAt(30, "warrior", { weapon: null, armor: null }, null, null, 0, vip);
    expect(at(5)).toBeGreaterThan(at(4));
    expect(at(4)).toBe(at(0));
  });
});
