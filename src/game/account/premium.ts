import { MAX_PIECES } from "./inventory";
import { GEM_PRODUCTS } from "./mounts";

// What money buys beyond the gems themselves (see docs/superpowers/specs/2026-10-01-free-to-play-design.md):
// VIP ranks from all an account has bought,
// a monthly pass, and gems spent to keep a high enhancement from breaking gear. Kept on the account
// (its global user state), so every character shares them. All the numbers live here.

// The monthly pass: its Verse8 product, gems at once and each day it runs, its XP, and the VIP
// points each one counts for. At its suggested 500 VX its gems come to three times a plain pack's
// (1,500 against 500); the shop shows the share from the live prices.
export const PASS_PRODUCT = "monthly-pass";
export const PASS_DAYS = 30;
export const PASS_GEMS_NOW = 300;
export const PASS_GEMS_DAILY = 40;
export const PASS_XP = 0.2;
export const PASS_POINTS = 600;
const DAY_MS = 24 * 60 * 60 * 1000;

// VIP n needs VIP_POINTS[n - 1] points. Each rank adds VIP_BONUS to hunting's XP and gold; reaching
// VIP_ANNOUNCE or above is told to every server.
export const VIP_POINTS: readonly number[] = [100, 550, 1200, 3000, 6000, 12000, 25000, 50000, 100000, 200000];
export const VIP_BONUS = 0.2;
export const VIP_ANNOUNCE = 5;

// What each rank gives beyond hunting's XP and gold. A rank keeps everything the ranks below it give;
// of the daily gems and the enhancement odds, only the highest counts.
//   1 the VIP mark by the name · 2 ten more pieces of gear in the bag · 3 gems every day (10, 30 from
//   6, 50 from 9) · 4 rising where you fell for nothing · 5 a tenth more damage and health, and a
//   golden name · 7 enhancing likelier by 5 points (10 from 9) · 8 no market fee · 10 its own mythic
//   mount (see mounts.ts)
export const VIP_BAG = 2;
export const VIP_BAG_EXTRA = 10;
export const VIP_FREE_REVIVE = 4;
export const VIP_MIGHT = 5;
export const VIP_MIGHT_SHARE = 0.1;
export const VIP_NO_FEE = 8;
// The ranks at which each perk comes, in order, for the table on the screen.
export const VIP_PERK_AT: Readonly<Record<number, string>> = {
  1: "mark", 2: "bag", 3: "daily10", 4: "revive", 5: "might", 6: "daily30", 7: "enhance5", 8: "noFee", 9: "daily50", 10: "mount",
};

export function pieceLimit(vip: number): number {
  return MAX_PIECES + (vip >= VIP_BAG ? VIP_BAG_EXTRA : 0);
}

export function vipDailyGems(vip: number): number {
  return vip >= 9 ? 50 : vip >= 6 ? 30 : vip >= 3 ? 10 : 0;
}

export function freeRevive(vip: number): boolean {
  return vip >= VIP_FREE_REVIVE;
}

// The share more damage and health a rank adds.
export function vipMight(vip: number): number {
  return vip >= VIP_MIGHT ? VIP_MIGHT_SHARE : 0;
}

// Points added to every enhancement's chance of success.
export function vipEnhance(vip: number): number {
  return vip >= 9 ? 0.1 : vip >= 7 ? 0.05 : 0;
}

export function noMarketFee(vip: number): boolean {
  return vip >= VIP_NO_FEE;
}

// Gems to keep a failed attempt at this + from breaking the gear (from +6, where breaking begins).
export const PROTECT_GEMS: Readonly<Record<number, number>> = {
  6: 20, 7: 30, 8: 50, 9: 80, 10: 120, 11: 200, 12: 300, 13: 500, 14: 800, 15: 1200,
};

export interface Premium {
  vipPoints: number;
  // The gem packs bought at least once (their first was doubled).
  firstBought: string[];
  // When the monthly pass runs out (ms; 0 when there never was one), and the last day it paid.
  passUntil: number;
  passPaidDay: string | null;
  // The last day the VIP rank's daily gems were sent.
  vipPaidDay: string | null;
}

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

// The premium part of an account's user state, whatever it holds.
export function readPremium(state: Record<string, unknown> | null | undefined): Premium {
  const s = state ?? {};
  const first = Array.isArray(s.firstBought) ? s.firstBought.filter((p): p is string => typeof p === "string" && p in GEM_PRODUCTS) : [];
  return {
    vipPoints: count(s.vipPoints),
    firstBought: [...new Set(first)],
    passUntil: count(s.passUntil),
    passPaidDay: typeof s.passPaidDay === "string" ? s.passPaidDay : null,
    vipPaidDay: typeof s.vipPaidDay === "string" ? s.vipPaidDay : null,
  };
}

export function vipOf(points: number): number {
  return VIP_POINTS.filter((need) => points >= need).length;
}

// The points the next rank needs; null at the top.
export function nextVipAt(points: number): number | null {
  return VIP_POINTS.find((need) => points < need) ?? null;
}

export function passActive(p: Premium, now: number): boolean {
  return p.passUntil > now;
}

// Whole days left on the pass, counting a day begun as one.
export function passDaysLeft(p: Premium, now: number): number {
  return passActive(p, now) ? Math.ceil((p.passUntil - now) / DAY_MS) : 0;
}

// When a pass bought `quantity` times now runs out: added to what is left, or from now.
export function extendPass(until: number, now: number, quantity: number): number {
  return Math.max(until, now) + PASS_DAYS * quantity * DAY_MS;
}

// What hunting pays is multiplied by: VIP ranks on XP and gold, the pass on XP.
export function huntBonus(p: Premium, now: number): { xp: number; gold: number } {
  const vip = vipOf(p.vipPoints) * VIP_BONUS;
  return { xp: 1 + vip + (passActive(p, now) ? PASS_XP : 0), gold: 1 + vip };
}

// A gem pack bought `quantity` times: the gems it gives (the first one doubled if the account never
// bought this pack), the VIP points (the pack's own gems), and whether this was the first. Null for a
// product that is not a gem pack.
export function gemPurchase(productId: string, quantity: number, p: Premium): { gems: number; points: number; first: boolean } | null {
  const each = GEM_PRODUCTS[productId];
  if (each === undefined || !Number.isInteger(quantity) || quantity < 1) return null;
  const first = !p.firstBought.includes(productId);
  return { gems: each * quantity, points: each * quantity, first };
}

// Gems to protect an attempt at `to`; null below +6, where nothing can break.
export function protectCost(to: number): number | null {
  return PROTECT_GEMS[to] ?? null;
}

// The premium part as the screen shows it.
export interface PremiumView {
  vip: number;
  vipPoints: number;
  nextVipAt: number | null;
  firstBought: string[];
  passDaysLeft: number;
}

export function premiumView(p: Premium, now: number): PremiumView {
  return { vip: vipOf(p.vipPoints), vipPoints: p.vipPoints, nextVipAt: nextVipAt(p.vipPoints), firstBought: p.firstBought, passDaysLeft: passDaysLeft(p, now) };
}
