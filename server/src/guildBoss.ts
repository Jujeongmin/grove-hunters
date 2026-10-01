import {
  GUILD_BOSSES, LEAGUE_GUILD_GEMS, LEAGUE_PLAYER_GEMS, LEAGUE_SHOWN, RANKING_SHOWN, STAGE_REWARDS, bossMax, bossOfWeek, finalGear,
  leagueOrder, ranking, stageOf, type GuildBossType, type Hitter, type LeagueView,
} from "../../src/game/world/guildBoss";
import { dailyDay } from "../../src/game/account/quests";
import type { Guild } from "../../src/game/account/guild";
import type { MailItem } from "../../src/game/account/mail";
import { RuleViolation } from "../../src/game/world/types";
import { sendMail } from "./mail";
import { announce } from "./announce";
import { readGuildById } from "./guild";

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
  // When its health ran out (null while it stands), for the league's order.
  killedAt: number | null;
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
    killedAt: typeof r.killedAt === "number" && r.killedAt > 0 ? r.killedAt : null,
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
        guild: guild.id, week, boss: bossOfWeek(week), max: bossMax(guild.members.length), damage: 0, stagesPaid: 0, killedAt: null,
        entries: {}, hitters: {},
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
    const killedAt = w.killedAt ?? (damage >= w.max ? now : null);
    const next: BossWeek = { ...w, damage, hitters, stagesPaid: Math.max(w.stagesPaid, reached), killedAt };
    await writeWeek(next);
    for (let stage = w.stagesPaid + 1; stage <= reached; stage++) await payStage(next, stage, now);
    if (w.stagesPaid < STAGE_REWARDS.length && reached >= STAGE_REWARDS.length) {
      const guild = await readGuildById(guildId);
      await announce("guild_boss", { guild: guild?.name ?? "", boss: w.boss }, now);
    }
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

// --- The week's league ------------------------------------------------------------------------

// One row per week once its league has been paid.
export const LEAGUE_COLLECTION = "guildBossLeague";
// The most rows of a week read to rank it.
const LEAGUE_READ = 500;

async function weekRows(week: number): Promise<BossWeek[]> {
  const rows = await $global.getCollectionItems(GUILD_BOSS_COLLECTION, { filters: [{ field: "week", operator: "==", value: week }], limit: LEAGUE_READ });
  return (rows as unknown[]).map((r) => readBossWeek(r)).filter((w): w is BossWeek => w !== null);
}

// A week's league: the guilds in order (top LEAGUE_SHOWN, with the caller's guild's place), and the
// players across every guild by damage.
export async function leagueView(week: number, myGuild: string | null, myCharacter: string | null): Promise<LeagueView> {
  const rows = leagueOrder(await weekRows(week));
  const names = new Map<string, string>();
  for (const r of rows.slice(0, LEAGUE_SHOWN)) names.set(r.guild, (await readGuildById(r.guild))?.name ?? "");
  const players = rows.flatMap((r) => Object.entries(r.hitters).map(([characterId, h]) => ({ characterId, guild: r.guild, ...h })))
    .sort((a, b) => b.damage - a.damage)
    .slice(0, LEAGUE_SHOWN);
  for (const p of players) if (!names.has(p.guild)) names.set(p.guild, (await readGuildById(p.guild))?.name ?? "");
  const rank = myGuild ? rows.findIndex((r) => r.guild === myGuild) : -1;
  return {
    week,
    guilds: rows.slice(0, LEAGUE_SHOWN).map((r) => ({
      name: names.get(r.guild) ?? "", share: r.max > 0 ? r.damage / r.max : 0, killed: r.killedAt !== null, mine: r.guild === myGuild,
    })),
    myGuildRank: rank < 0 ? null : rank + 1,
    players: players.map((p) => ({ name: p.name, guild: names.get(p.guild) ?? "", damage: p.damage, mine: p.characterId === myCharacter })),
  };
}

// Pays a week that is over, once: gems by mail to every member of its first three guilds (as they
// stand when it is paid) and to its first three players, and the first guild told to every server.
export async function settleLeague(week: number, now: number): Promise<void> {
  await $lock("gboss-league", async () => {
    const done = await $global.getCollectionItems(LEAGUE_COLLECTION, { filters: [{ field: "week", operator: "==", value: week }], limit: 1 });
    if (done.length > 0) return;
    await $global.addCollectionItem(LEAGUE_COLLECTION, { week, at: now });
    const rows = leagueOrder(await weekRows(week)).filter((r) => r.damage > 0);
    for (let i = 0; i < Math.min(rows.length, LEAGUE_GUILD_GEMS.length); i++) {
      const guild = await readGuildById(rows[i].guild);
      if (!guild) continue;
      for (const m of guild.members) {
        await sendMail(m.account, { kind: "guild_league", gold: 0, gems: LEAGUE_GUILD_GEMS[i], items: [], params: { place: i + 1, guild: guild.name, who: "guild" } }, now);
      }
      if (i === 0) await announce("guild_week", { guild: guild.name }, now).catch(() => undefined);
    }
    const players = rows.flatMap((r) => Object.values(r.hitters)).sort((a, b) => b.damage - a.damage);
    for (let i = 0; i < Math.min(players.length, LEAGUE_PLAYER_GEMS.length); i++) {
      await sendMail(players[i].account, { kind: "guild_league", gold: 0, gems: LEAGUE_PLAYER_GEMS[i], items: [], params: { place: i + 1, who: "player" } }, now);
    }
  });
}
