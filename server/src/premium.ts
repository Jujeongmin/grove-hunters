import {
  PASS_GEMS_DAILY, PASS_GEMS_NOW, PASS_POINTS, PASS_PRODUCT, VIP_ANNOUNCE, extendPass, gemPurchase, passActive, pieceLimit, readPremium,
  vipDailyGems, vipOf, type Premium,
} from "../../src/game/account/premium";
import type { PurchaseEvent } from "../../src/game/account/purchase";
import { dailyDay } from "../../src/game/account/quests";
import { announce } from "./announce";
import { sendMail } from "./mail";
import { changeGems, onceper, readProfile } from "./store";

// The account's premium state (see premium.ts): changed one purchase or pass day at a time, under
// the account's own lock, so two receipts landing together both count.
function withPremiumLock<T>(account: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`premium:${account}`, fn);
}

export async function accountPremium(account: string): Promise<Premium> {
  return readPremium(await $global.getUserState(account));
}

export async function vipOfAccount(account: string): Promise<number> {
  return vipOf((await accountPremium(account)).vipPoints);
}

// How many pieces of gear an account's characters may carry (VIP 2 gives more).
export async function roomOf(account: string): Promise<number> {
  return pieceLimit(await vipOfAccount(account));
}

// The VIP rank's gems for today, by mail, the first time the account comes into the world that day.
export async function payVipDay(account: string, now: number): Promise<void> {
  await withPremiumLock(account, async () => {
    const premium = await accountPremium(account);
    const gems = vipDailyGems(vipOf(premium.vipPoints));
    const today = dailyDay(now);
    if (gems <= 0 || premium.vipPaidDay === today) return;
    await $global.updateUserState(account, { vipPaidDay: today });
    await sendMail(account, { kind: "vip_daily", gold: 0, gems, items: [], params: { vip: vipOf(premium.vipPoints) } }, now);
  });
}

// A rank of VIP_ANNOUNCE or above, newly reached, is told to every server under the account's
// character's name (the one it plays; none, no name).
async function announceVip(account: string, before: number, after: number, now: number): Promise<void> {
  const rank = vipOf(after);
  if (rank < VIP_ANNOUNCE || rank <= vipOf(before)) return;
  const { active } = await readProfile(account);
  await announce("vip", { name: active?.name ?? "", world: active?.world ?? "", vip: rank }, now).catch(() => undefined);
}

// Gems onto the buyer's account, once per receipt: a pack's first purchase doubled, its gems counted
// toward VIP. False for a receipt seen before.
export function grantGemPack(event: PurchaseEvent, now: number): Promise<boolean> {
  return onceper(event, (credited) => withPremiumLock(event.account, async () => {
    const before = await accountPremium(event.account);
    const bought = gemPurchase(event.productId, event.quantity, before);
    if (!bought) throw new Error(`not a gem pack: ${event.productId}`);
    await changeGems(event.account, bought.gems);
    credited();
    const firstBought = bought.first ? [...before.firstBought, event.productId] : before.firstBought;
    await $global.updateUserState(event.account, { firstBought, vipPoints: before.vipPoints + bought.points });
    await announceVip(event.account, before.vipPoints, before.vipPoints + bought.points, now);
  }));
}

// The monthly pass, once per receipt: its gems now, thirty days more of it, and its VIP points.
export function grantPass(event: PurchaseEvent, now: number): Promise<boolean> {
  return onceper(event, (credited) => withPremiumLock(event.account, async () => {
    const before = await accountPremium(event.account);
    await changeGems(event.account, PASS_GEMS_NOW * event.quantity);
    credited();
    const points = before.vipPoints + PASS_POINTS * event.quantity;
    await $global.updateUserState(event.account, { passUntil: extendPass(before.passUntil, now, event.quantity), vipPoints: points });
    await announceVip(event.account, before.vipPoints, points, now);
  }));
}

export function isPassProduct(productId: string): boolean {
  return productId === PASS_PRODUCT;
}

// The pass's gems for today, by mail, the first time the account comes into the world on a day the
// pass runs. Nothing on a day already paid, or with no pass.
export async function payPassDay(account: string, now: number): Promise<void> {
  await withPremiumLock(account, async () => {
    const premium = await accountPremium(account);
    const today = dailyDay(now);
    if (!passActive(premium, now) || premium.passPaidDay === today) return;
    await $global.updateUserState(account, { passPaidDay: today });
    await sendMail(account, { kind: "monthly_pass", gold: 0, gems: PASS_GEMS_DAILY, items: [], params: {} }, now);
  });
}
