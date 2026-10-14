import { gearStats, type Gear } from "../account/items";
import { NO_HERD, mountBonus, type MountBonus, type MountId } from "../account/mounts";
import { vipMight } from "../account/premium";
import { levelOf } from "../account/level";
import { damageAt, maxHpAt } from "../world/monsters";
import { WEAPONS, type PlayerClass } from "./classes";
import { JOBS, type JobId } from "./jobs";
import { NO_SOUL_BONUS, codexBonus, type SoulBonus, type Souls } from "../account/souls";

// What gear and an advanced class add to a fight: a share more damage, more health, a share of
// every blow stopped, and a share more healing.
// atk and def are flat (the soul codex's): atk added to every blow, def taken off every bite.
export interface FightBonus { power: number; hp: number; guard: number; heal: number; atk: number; def: number }

// A monster's bite as it lands: the share the guard stops, then the defence taken off, which never
// takes more than half of what is left.
export const DEF_LIMIT = 0.5;
export function bittenFor(damage: number, bonus: { guard: number; def?: number }): number {
  const guarded = damage * (1 - Math.min(0.8, bonus.guard));
  return Math.max(1, Math.round(Math.max(guarded * (1 - DEF_LIMIT), guarded - (bonus.def ?? 0))));
}

// What a bite of a monster of a hunter's level is, about: to weigh defence in 전투력.
const BITE_AT = (level: number) => 20 + level * 3;

// The stats a character fights with at its level, in its gear and advanced class, with the account's
// picked mount, what its owned mounts add (herd) and its VIP rank (see premium.ts).
export function fightStats(
  c: { xp: number; gear: Gear; job: JobId | null; mount?: MountId | null; mountStars?: number; vip?: number; herd?: MountBonus; codex?: Souls },
): { maxHp: number; gear: FightBonus } {
  return fightStatsAt(levelOf(c.xp).level, c.gear, c.job, c.mount, c.mountStars, c.vip, c.herd, codexBonus(c.codex ?? {}));
}

export function fightStatsAt(
  level: number, gear: Gear, job: JobId | null, mount: MountId | null = null, stars = 0, vip = 0, herd: MountBonus = NO_HERD,
  soul: SoulBonus = NO_SOUL_BONUS,
): { maxHp: number; gear: FightBonus } {
  const worn = gearStats(gear);
  const advanced = job ? JOBS[job] : null;
  const steed = mountBonus(mount, stars);
  const might = vipMight(vip);
  const bonus = {
    power: worn.power + (advanced?.power ?? 0) + steed.power + herd.power + might,
    hp: worn.hp + (advanced?.hp ?? 0) + steed.hp + herd.hp + soul.hp,
    guard: worn.guard + (advanced?.guard ?? 0),
    heal: advanced?.heal ?? 0,
    atk: soul.atk,
    def: soul.def,
  };
  return { maxHp: Math.round((maxHpAt(level) + bonus.hp) * (1 + might)), gear: bonus };
}

// 전투력: one number for how strong a character is, from how fast it deals damage with its class's
// weapon (at its level, gear and advanced class) and how much it takes to fell it (health, over the
// share of each blow that gets through). Healing adds to both halves.
export function combatPower(
  c: {
    xp: number; playerClass: PlayerClass; gear: Gear; job: JobId | null; mount?: MountId | null; mountStars?: number; vip?: number; herd?: MountBonus;
    codex?: Souls;
  },
): number {
  return combatPowerAt(levelOf(c.xp).level, c.playerClass, c.gear, c.job, c.mount, c.mountStars, c.vip, c.herd, codexBonus(c.codex ?? {}));
}

export function combatPowerAt(
  level: number, playerClass: PlayerClass, gear: Gear, job: JobId | null, mount: MountId | null = null, stars = 0, vip = 0,
  herd: MountBonus = NO_HERD, soul: SoulBonus = NO_SOUL_BONUS,
): number {
  const { maxHp, gear: bonus } = fightStatsAt(level, gear, job, mount, stars, vip, herd, soul);
  const weapon = WEAPONS[playerClass];
  const perSecond = damageAt(weapon.damage, level, bonus.power, bonus.atk) / (weapon.intervalMs / 1000);
  // How much it takes to fell: its health over the share of each blow that gets through, and the
  // defence weighed against a bite of its own level.
  const guarded = BITE_AT(level) * (1 - Math.min(0.8, bonus.guard));
  const defended = guarded - Math.min(bonus.def, guarded * DEF_LIMIT);
  const toFell = (maxHp / (1 - Math.min(0.8, bonus.guard))) * (guarded / defended);
  return Math.round((perSecond * 10 + toFell * 2) * (1 + bonus.heal * 0.2));
}
