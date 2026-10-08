import {
  achievementById, achievementsView, factsOf, readAchieved, type AchievementsView,
} from "../../src/game/account/achievements";
import { readAttendance } from "../../src/game/account/attendance";
import { MAX_STARS, ownedMounts, readStars, vipMounts } from "../../src/game/account/mounts";
import { readPremium, vipOf } from "../../src/game/account/premium";
import { RuleViolation } from "../../src/game/world/types";
import { changeGems, readProfile, splitWallet } from "./store";

// Achievements (see achievements.ts): measured on every character the account has, on every server,
// and claimed one at a time under the account's own lock.
function withAchieveLock<T>(account: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`achieve:${account}`, fn);
}

export async function achievementsOf(account: string): Promise<AchievementsView> {
  await splitWallet(account);
  const state = await $global.getUserState(account);
  const { characters } = await readProfile(account);
  // Mounts are each character's: counted across all of them (and VIP's, the account's), for the
  // account's achievements.
  const owned = new Set([...characters.flatMap((c) => ownedMounts(state[`mounts@${c.id}`])), ...vipMounts(vipOf(readPremium(state).vipPoints))]);
  const star5 = new Set(characters.flatMap((c) => Object.entries(readStars(state[`mountStars@${c.id}`])).filter(([, n]) => n === MAX_STARS).map(([id]) => id))).size;
  const facts = factsOf(characters, { mounts: owned.size, star5, attend: readAttendance(state.attendance).total });
  return achievementsView(facts, readAchieved(state.achieved));
}

// One achievement's gems, once, when its goal is met. Answers the list after it and the gems held.
export function claimAchievement(account: string, id: unknown): Promise<AchievementsView & { gems: number }> {
  return withAchieveLock(account, async () => {
    const achievement = achievementById(id);
    if (!achievement) throw new RuleViolation("unavailable");
    const view = await achievementsOf(account);
    const row = view.list.find((a) => a.id === achievement.id)!;
    if (row.claimed || row.progress < row.goal) throw new RuleViolation("unavailable");
    // Marked first: should the gems fail, the achievement is lost rather than paid twice.
    const achieved = [...readAchieved((await $global.getUserState(account)).achieved), achievement.id];
    await $global.updateUserState(account, { achieved });
    const gems = await changeGems(account, achievement.gems);
    return { ...(await achievementsOf(account)), gems };
  });
}

// Every achievement whose goal is met and not yet claimed, at once. Refused when there is none.
export function claimAllAchievements(account: string): Promise<AchievementsView & { gems: number; claimed: number }> {
  return withAchieveLock(account, async () => {
    const ready = (await achievementsOf(account)).list.filter((a) => !a.claimed && a.progress >= a.goal);
    if (ready.length === 0) throw new RuleViolation("unavailable");
    const achieved = [...readAchieved((await $global.getUserState(account)).achieved), ...ready.map((a) => a.id)];
    await $global.updateUserState(account, { achieved });
    const gems = await changeGems(account, ready.reduce((n, a) => n + a.gems, 0));
    return { ...(await achievementsOf(account)), gems, claimed: ready.length };
  });
}
