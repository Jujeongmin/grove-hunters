import type { ItemId } from "../account/items";
import { weekIndex } from "./grove";
import { facingOf, yawToward, type Shape, type Telegraph } from "./telegraphs";

// The guild boss: one a week for each guild, its health shared by the whole guild, fought three
// minutes a day at a time in the guild's own rooms (six to a room). Every rule and number is here;
// the server keeps each guild's week and the screen shows it.

export type GuildBossType = "guild_dragon" | "guild_yeti" | "guild_glub";
// Every boss that fights with marked patterns: the guild bosses and the snow's Glacier Emperor.
export type PatternBossType = GuildBossType | "frost_emperor";
export const PATTERN_BOSSES: readonly PatternBossType[] = ["guild_dragon", "guild_yeti", "guild_glub", "frost_emperor"];
// Week by week, in turn.
export const GUILD_BOSSES: readonly GuildBossType[] = ["guild_dragon", "guild_yeti", "guild_glub"];

export const HP_PER_MEMBER = 120_000;
// A small guild's boss is sized as if it had this many.
export const MIN_MEMBERS = 5;
export const ARENA_MS = 3 * 60 * 1000;
export const ARENA_LEVEL = 10;
export const ARENA_ROOMS = 5;
export const ARENA_SEATS = 6;
// How often a room's damage joins the guild's week.
export const SYNC_MS = 5_000;
// The shares of its health at which everyone who fought it that week is paid (see STAGE_REWARDS).
export const STAGES = [0.25, 0.5, 0.75, 1] as const;
// How many of the ranking the screen shows, and how many at the top win the best gear.
export const RANKING_SHOWN = 10;
export const TOP_GEAR = 3;

export function bossOfWeek(week: number): GuildBossType {
  return GUILD_BOSSES[((week % GUILD_BOSSES.length) + GUILD_BOSSES.length) % GUILD_BOSSES.length];
}

export function currentWeek(now: number): number {
  return weekIndex(now);
}

export function bossMax(members: number): number {
  return HP_PER_MEMBER * Math.max(MIN_MEMBERS, members);
}

// How many stages the damage has passed (0 to 4).
export function stageOf(damage: number, max: number): number {
  return STAGES.filter((s) => damage >= max * s).length;
}

// What each stage pays everyone who went in that week; the last also a piece of tradable gear.
export const STAGE_REWARDS: readonly { gold: number; stones: number }[] = [
  { gold: 2000, stones: 5 }, { gold: 3000, stones: 8 }, { gold: 4000, stones: 12 }, { gold: 6000, stones: 20 },
];
const BEST_GEAR: readonly ItemId[] = ["weapon_5", "armor_5"];
const GOOD_GEAR: readonly ItemId[] = ["weapon_3", "armor_3", "weapon_4", "armor_4"];

// The gear a character wins when the boss falls: the top few by damage the best, the rest good.
// rank counts from 0; random gives numbers in [0, 1).
export function finalGear(rank: number, random: () => number): ItemId {
  const pool = rank < TOP_GEAR ? BEST_GEAR : GOOD_GEAR;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export interface Hitter { account: string; name: string; damage: number }

// Everyone who hurt it, most damage first, with their character id.
export function ranking(hitters: Readonly<Record<string, Hitter>>): (Hitter & { characterId: string })[] {
  return Object.entries(hitters).map(([characterId, h]) => ({ characterId, ...h })).sort((a, b) => b.damage - a.damage);
}

// A guild's boss rooms: the room id says which guild and which of its rooms.
export function arenaRoomId(guildId: string, n: number): string {
  return `gboss-${guildId}-${n}`;
}

export function readArenaRoom(roomId: unknown): { guildId: string; n: number } | null {
  if (typeof roomId !== "string") return null;
  const m = /^gboss-(.+)-(\d+)$/.exec(roomId);
  const n = m ? Number(m[2]) : 0;
  return m && n >= 1 && n <= ARENA_ROOMS ? { guildId: m[1], n } : null;
}

// --- The fight ---------------------------------------------------------------------------------------

// Below this share of its health it rages: marks come quicker, more of them, and patterns closer.
export const RAGE_BELOW = 0.25;
const RAGE_WARN = 0.8;
const RAGE_GAP = 0.7;
const RAGE_EXTRA = 2;
// Between patterns (before rage).
const GAP_MS = [4_000, 6_000] as const;
// The glub's brood, called up four at a time.
export const BROOD_COUNT = 4;

export interface Quarry { account: string; x: number; z: number }

// What a pattern does: marks on the ground, and for the yeti a charge to where its lane ends, for the
// glub its brood called up.
export interface Pattern {
  telegraphs: Telegraph[];
  chargeTo?: { x: number; z: number; at: number };
  summon?: number;
}

const circle = (x: number, z: number, r: number): Shape => ({ kind: "circle", x, z, r });

// Pattern `index` (0 to 2) of `type`, cast now from where the boss stands at the players about.
// random gives numbers in [0, 1); id prefixes every mark's id.
export function castPattern(
  type: PatternBossType, index: number, boss: { x: number; z: number }, prey: readonly Quarry[], now: number, rage: boolean,
  random: () => number, id: string,
): Pattern {
  const warn = (ms: number) => Math.round(ms * (rage ? RAGE_WARN : 1));
  const extra = rage ? RAGE_EXTRA : 0;
  const mark = (n: number, shape: Shape, ms: number, share: number, pool?: { lasts: number; tickShare: number }): Telegraph => {
    const hitAt = now + warn(ms);
    return {
      id: `${id}-${n}`, group: id, shape, startAt: now, hitAt, share,
      ...(pool ? { pool: { until: hitAt + pool.lasts, tickShare: pool.tickShare, nextAt: hitAt } } : {}),
    };
  };
  const nearest = [...prey].sort((a, b) => Math.hypot(a.x - boss.x, a.z - boss.z) - Math.hypot(b.x - boss.x, b.z - boss.z));
  const scatter = (n: number, spread: number, around: { x: number; z: number }) => Array.from({ length: n }, () => {
    const a = random() * Math.PI * 2;
    const d = random() * spread;
    return { x: around.x + Math.cos(a) * d, z: around.z + Math.sin(a) * d };
  });
  if (type === "guild_dragon") {
    if (index === 0) {
      // Pillars of fire under everyone (and, raging, a couple more near them).
      const spots = [...prey.map((p) => ({ x: p.x, z: p.z })), ...scatter(extra, 5, nearest[0] ?? boss)];
      return { telegraphs: spots.map((s, i) => mark(i, circle(s.x, s.z, 2.5), 1600, 0.4)) };
    }
    if (index === 1) {
      const target = nearest[0] ?? { x: boss.x, z: boss.z - 1 };
      return { telegraphs: [mark(0, { kind: "cone", x: boss.x, z: boss.z, yaw: yawToward(boss.x, boss.z, target.x, target.z), r: 10, arc: Math.PI / 2 }, 2000, 0.55)] };
    }
    return { telegraphs: [mark(0, circle(boss.x, boss.z, 6), 1500, 0.45)] };
  }
  if (type === "guild_yeti") {
    if (index === 0) {
      const target = nearest[nearest.length - 1] ?? { x: boss.x, z: boss.z - 1 };
      const yaw = yawToward(boss.x, boss.z, target.x, target.z);
      const f = facingOf(yaw);
      const length = 14;
      const lane = mark(0, { kind: "line", x: boss.x, z: boss.z, yaw, length, width: 3 }, 1500, 0.5);
      return { telegraphs: [lane], chargeTo: { x: boss.x + f.x * (length - 1), z: boss.z + f.z * (length - 1), at: lane.hitAt } };
    }
    if (index === 1) {
      return { telegraphs: scatter(7 + extra, 9, boss).map((s, i) => mark(i, circle(s.x, s.z, 2), 1800, 0.4)) };
    }
    return { telegraphs: [mark(0, { kind: "ring", x: boss.x, z: boss.z, inner: 3, outer: 10 }, 2000, 0.45)] };
  }
  if (type === "frost_emperor") {
    if (index === 0) {
      // Ice spears under everyone near (and, raging, a couple more).
      const spots = [...prey.map((p) => ({ x: p.x, z: p.z })), ...scatter(extra, 5, nearest[0] ?? boss)];
      return { telegraphs: spots.map((s, i) => mark(i, circle(s.x, s.z, 2.5), 1500, 0.35)) };
    }
    if (index === 1) {
      const target = nearest[0] ?? { x: boss.x, z: boss.z - 1 };
      return { telegraphs: [mark(0, { kind: "cone", x: boss.x, z: boss.z, yaw: yawToward(boss.x, boss.z, target.x, target.z), r: 12, arc: (100 * Math.PI) / 180 }, 2000, 0.5)] };
    }
    const spots = scatter(3 + extra, 4, nearest[0] ?? boss);
    return { telegraphs: spots.map((s, i) => mark(i, circle(s.x, s.z, 3), 1800, 0.25, { lasts: 5000, tickShare: 0.07 })) };
  }
  // The elder glub.
  if (index === 0) return { telegraphs: [], summon: BROOD_COUNT };
  if (index === 1) {
    const spots = scatter(3 + extra, 3, nearest[0] ?? boss);
    return { telegraphs: spots.map((s, i) => mark(i, circle(s.x, s.z, 2.5), 1600, 0.3, { lasts: 5000, tickShare: 0.08 })) };
  }
  return { telegraphs: [mark(0, circle(boss.x, boss.z, 5), 1400, 0.6)] };
}

// The next pattern: any of the three but the last one. random gives numbers in [0, 1).
export function nextPattern(last: number | null, random: () => number): number {
  const choices = [0, 1, 2].filter((i) => i !== last);
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

// How long it waits after a pattern before the next.
export function patternGap(rage: boolean, random: () => number): number {
  const gap = GAP_MS[0] + random() * (GAP_MS[1] - GAP_MS[0]);
  return Math.round(gap * (rage ? RAGE_GAP : 1));
}

// The week's league across every guild: a guild that felled its boss stands above one that has not,
// the sooner the higher; the rest by the share of its boss's health taken (each boss's health is sized
// to its guild, so a small guild stands as fair a chance as a big one). Players across every guild by
// their damage. When a week is over, the first three guilds' members and the first three players are
// paid gems by mail, and the first guild is told to every server.
export const LEAGUE_SHOWN = 10;
export const LEAGUE_GUILD_GEMS: readonly number[] = [300, 150, 80];
export const LEAGUE_PLAYER_GEMS: readonly number[] = [200, 100, 50];

export interface LeagueGuild { guild: string; damage: number; max: number; killedAt: number | null }

export function leagueOrder<T extends LeagueGuild>(rows: readonly T[]): T[] {
  const share = (r: LeagueGuild) => (r.max > 0 ? r.damage / r.max : 0);
  return [...rows].sort((a, b) => {
    if ((a.killedAt !== null) !== (b.killedAt !== null)) return a.killedAt !== null ? -1 : 1;
    if (a.killedAt !== null && b.killedAt !== null && a.killedAt !== b.killedAt) return a.killedAt - b.killedAt;
    return share(b) - share(a) || a.guild.localeCompare(b.guild);
  });
}

// A week's league as the screen shows it: the guilds in order (each with the share of its boss taken),
// the caller's guild's place, and the players across every guild by damage.
export interface LeagueView {
  week: number;
  guilds: { name: string; share: number; killed: boolean; mine: boolean }[];
  myGuildRank: number | null;
  players: { name: string; guild: string; damage: number; mine: boolean }[];
}
