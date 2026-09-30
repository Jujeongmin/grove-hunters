import {
  GUILD_BOSSES, RANKING_SHOWN, STAGE_REWARDS, bossMax, bossOfWeek, finalGear, ranking, stageOf, type GuildBossType, type Hitter,
} from "../../src/game/world/guildBoss";
import { dailyDay } from "../../src/game/account/quests";
import type { Guild } from "../../src/game/account/guild";
import type { MailItem } from "../../src/game/account/mail";
import { RuleViolation } from "../../src/game/world/types";
import { sendMail } from "./mail";

// One row per guild and week: the boss, its full health, the damage done so far and by whom, who went
// in on which day, and how many stages have been paid. Changed only under the guild's boss lock.
export const GUILD_BOSS_COLLECTION = "guildBoss";

export interface BossWeek {
  id: string;
  guild: string;
  week: number;
  boss: GuildBossType;
  max: number;
  damage: number;
  stagesPaid: number;
  // Everyone who went in this week: the day they last did, and whose they are.
  entries: Record<string, { account: string; name: string; day: string }>;
  hitters: Record<string, Hitter>;
}

export function withBossLock<T>(guildId: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`gboss:${guildId}`, fn);
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

function readPeople<T>(raw: unknown, read: (r: Record<string, unknown>) => T | null): Record<string, T> {
  const out: Record<string, T> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    const r = entry as Record<string, unknown> | null;
    const value = r ? read(r) : null;
    if (value) out[id] = value;
  }
  return out;
}

export function readBossWeek(row: unknown): BossWeek | null {
  const r = row as Record<string, unknown> | null;
  if (!r || typeof r.__id !== "string" || typeof r.guild !== "string" || typeof r.week !== "number") return null;
  const boss = GUILD_BOSSES.find((b) => b === r.boss);
  if (!boss || num(r.max) <= 0) return null;
  return {
    id: r.__id, guild: r.guild, week: r.week, boss, max: num(r.max), damage: num(r.damage), stagesPaid: Math.min(4, num(r.stagesPaid)),
    entries: readPeople(r.entries, (e) => (typeof e.account === "string" && typeof e.name === "string" && typeof e.day === "string"
      ? { account: e.account, name: e.name, day: e.day } : null)),
    hitters: readPeople(r.hitters, (h) => (typeof h.account === "string" && typeof h.name === "string"
      ? { account: h.account, name: h.name, damage: num(h.damage) } : null)),
  };
}

export async function findWeek(guildId: string, week: number): Promise<BossWeek | null> {
  const rows = await $global.getCollectionItems(GUILD_BOSS_COLLECTION, {
    filters: [{ field: "guild", operator: "==", value: guildId }, { field: "week", operator: "==", value: week }],
    limit: 1,
  });
  return readBossWeek(rows[0] ?? null);
}

async function writeWeek(w: BossWeek): Promise<void> {
  const { id, ...row } = w;
  await $global.updateCollectionItem(GUILD_BOSS_COLLECTION, { __id: id, ...row });
}

// Goes in for the day: the week's row is made on the first entry (its health from the guild's size
// then). Refused once the boss is down, or if the character has been in already today.
export async function enterWeek(guild: Guild, characterId: string, account: string, name: string, week: number, now: number): Promise<BossWeek> {
  return withBossLock(guild.id, async () => {
    let w = await findWeek(guild.id, week);
    if (!w) {
      const fresh = {
        guild: guild.id, week, boss: bossOfWeek(week), max: bossMax(guild.members.length), damage: 0, stagesPaid: 0, entries: {}, hitters: {},
      };
      const row = await $global.addCollectionItem(GUILD_BOSS_COLLECTION, fresh);
      w = { id: (row as { __id: string }).__id, ...fresh };
    }
    if (w.damage >= w.max) throw new RuleViolation("boss_down");
    const today = dailyDay(now);
    if (w.entries[characterId]?.day === today) throw new RuleViolation("entered_today");
    const next = { ...w, entries: { ...w.entries, [characterId]: { account, name, day: today } } };
    await writeWeek(next);
    return next;
  });
}

// A room's damage since its last sync joins the week. Stages newly passed are paid to everyone who
// went in this week, once. Answers the week after.
export async function addDamage(guildId: string, week: number, by: Record<string, Hitter>, now: number): Promise<BossWeek | null> {
  return withBossLock(guildId, async () => {
    const w = await findWeek(guildId, week);
    if (!w) return null;
    const hitters = { ...w.hitters };
    let added = 0;
    for (const [characterId, h] of Object.entries(by)) {
      if (h.damage <= 0) continue;
      added += h.damage;
      const was = hitters[characterId];
      hitters[characterId] = { account: h.account, name: h.name, damage: (was?.damage ?? 0) + h.damage };
    }
    const damage = Math.min(w.max, w.damage + added);
    const reached = stageOf(damage, w.max);
    const next: BossWeek = { ...w, damage, hitters, stagesPaid: Math.max(w.stagesPaid, reached) };
    await writeWeek(next);
    for (let stage = w.stagesPaid + 1; stage <= reached; stage++) await payStage(next, stage, now);
    return next;
  });
}

// What a stage pays: gold and 강화석 to everyone who went in this week, and at the last a piece of
// tradable gear, the best for the top damage.
async function payStage(w: BossWeek, stage: number, now: number): Promise<void> {
  const reward = STAGE_REWARDS[stage - 1];
  const ranked = ranking(w.hitters).map((h) => h.characterId);
  for (const [characterId, entry] of Object.entries(w.entries)) {
    const items: MailItem[] = [{ id: "stone", n: reward.stones }];
    if (stage === STAGE_REWARDS.length) {
      const rank = ranked.indexOf(characterId);
      items.push({ id: finalGear(rank < 0 ? ranked.length : rank, Math.random), n: 1, trade: true });
    }
    await sendMail(entry.account, { kind: "guild_boss", gold: reward.gold, gems: 0, items, params: { boss: w.boss, stage, name: entry.name } }, now);
  }
}

// The boss tab: this week's boss, how far the guild has got, the top of the damage, and whether you
// have been in today.
export interface BossView {
  week: number;
  boss: GuildBossType;
  max: number;
  damage: number;
  stage: number;
  enteredToday: boolean;
  ranking: { name: string; damage: number; mine: boolean }[];
  myDamage: number;
}

export function bossView(w: BossWeek | null, guild: Guild, characterId: string, week: number, now: number): BossView {
  const ranked = w ? ranking(w.hitters) : [];
  return {
    week, boss: w?.boss ?? bossOfWeek(week), max: w?.max ?? bossMax(guild.members.length), damage: w?.damage ?? 0,
    stage: w ? stageOf(w.damage, w.max) : 0,
    enteredToday: w?.entries[characterId]?.day === dailyDay(now),
    ranking: ranked.slice(0, RANKING_SHOWN).map((h) => ({ name: h.name, damage: h.damage, mine: h.characterId === characterId })),
    myDamage: w?.hitters[characterId]?.damage ?? 0,
  };
}
