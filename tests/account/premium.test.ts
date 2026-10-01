import { describe, expect, it } from "vitest";
import {
  PASS_DAYS, PASS_XP, VIP_BONUS, VIP_POINTS, extendPass, gemPurchase, huntBonus, nextVipAt, passDaysLeft, protectCost, readPremium, vipOf,
} from "../../src/game/account/premium";

const DAY = 24 * 60 * 60 * 1000;
const none = readPremium(null);

describe("premium", () => {
  it("reads an account's state, keeping only what makes sense", () => {
    expect(none).toEqual({ vipPoints: 0, firstBought: [], passUntil: 0, passPaidDay: null });
    expect(readPremium({ vipPoints: 640.7, firstBought: ["gems-100", "nope", "gems-100"], passUntil: -5, passPaidDay: 3 }))
      .toEqual({ vipPoints: 640, firstBought: ["gems-100"], passUntil: 0, passPaidDay: null });
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

  it("doubles a gem pack the first time an account buys it, and counts its own gems as points", () => {
    expect(gemPurchase("gems-550", 1, none)).toEqual({ gems: 1100, points: 550, first: true });
    expect(gemPurchase("gems-550", 2, none)).toEqual({ gems: 1650, points: 1100, first: true });
    const bought = { ...none, firstBought: ["gems-550"] };
    expect(gemPurchase("gems-550", 1, bought)).toEqual({ gems: 550, points: 550, first: false });
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
});
