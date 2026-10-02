import type { ItemId } from "../account/items";
import type { GuildBossType } from "./guildBoss";
import type { MonsterType } from "./monsters";

// The Trial Dungeon (시련의 던전, see docs/superpowers/specs/2026-10-02-dungeon-design.md): players of
// like level, matched from every server, clear two waves and a boss in a room of their own. Every rule
// and number is here; the server keeps the queue, the matches and the rooms.

export type BracketId = "low" | "mid" | "high";

export interface Bracket {
  id: BracketId;
  minLevel: number;
  // Who the waves are made of, the boss, and its health for four.
  waves: readonly MonsterType[];
  boss: GuildBossType;
  bossHp: number;
  // What a clear pays each player.
  gold: number;
  stones: number;
  gear: readonly ItemId[];
}

export const BRACKETS: readonly Bracket[] = [
  {
    id: "low", minLevel: 10, waves: ["spider", "snake", "wasp", "goleling", "bat"], boss: "guild_glub", bossHp: 60_000,
    gold: 5_000, stones: 5, gear: ["weapon_3", "armor_3", "weapon_4", "armor_4"],
  },
  {
    id: "mid", minLevel: 30, waves: ["dire_spider", "venom_snake", "hornet", "vampire_bat", "stone_golem"], boss: "guild_yeti", bossHp: 200_000,
    gold: 12_000, stones: 10, gear: ["weapon_5", "armor_5"],
  },
  {
    id: "high", minLevel: 50, waves: ["frost_bat", "penguin_brute", "frost_snake", "ice_golem", "peak_yeti", "frost_drake"], boss: "guild_dragon",
    bossHp: 400_000, gold: 25_000, stones: 15, gear: ["weapon_6", "armor_6"],
  },
];

export const DUNGEON_SIZE = 4;
export const DUNGEON_MS = 5 * 60 * 1000;
export const DAILY_RUNS = 3;
// How long a match waits for everyone to say they are coming.
export const READY_MS = 15_000;
// A queued group not heard from this long has gone.
export const QUEUE_STALE_MS = 15_000;
// The screen asks how things stand this often while queued or matched.
export const DUNGEON_POLL_MS = 3_000;
// Players are sought for this long; then a match starts with whoever is there, mercenaries taking
// the empty seats (see mercenary.ts). Going in at once fills them at once.
export const MERC_AFTER_MS = 30_000;
// A clear this fast pays FAST_GOLD more gold; the day's first clear brings FIRST_GEMS.
export const FAST_MS = 150_000;
export const FAST_GOLD = 0.5;
export const FIRST_GEMS = 30;
export const GEAR_CHANCE = 0.4;
// The boss's health for n players, as a share of its health for four; the waves' health and count.
const BOSS_SHARE = [0, 0.4, 0.6, 0.8, 1];
export const WAVES = 2;

export function bracketOf(level: number): Bracket | null {
  return [...BRACKETS].reverse().find((b) => level >= b.minLevel) ?? null;
}

export function bracketById(id: unknown): Bracket | null {
  return BRACKETS.find((b) => b.id === id) ?? null;
}

const size = (n: number) => Math.max(1, Math.min(DUNGEON_SIZE, Math.floor(n)));

export function bossHpFor(bracket: Bracket, n: number): number {
  return Math.round(bracket.bossHp * BOSS_SHARE[size(n)]);
}

// Wave `wave` (1 or 2) for n players: how many come, and how much tougher each is than in the field.
export function waveFor(wave: number, n: number): { count: number; hpScale: number } {
  return { count: (wave === 1 ? 3 : 4) + size(n), hpScale: 1 + 0.4 * (size(n) - 1) };
}

// The fewest players a match may start with, when its oldest group has waited `waited`: four, until
// mercenaries may fill the rest.
export function startSize(waited: number): number {
  return waited >= MERC_AFTER_MS ? 1 : DUNGEON_SIZE;
}

export interface QueuedGroup { id: string; at: number; size: number }

// The groups (oldest first) that make the next match, or null when none is ready yet: whole groups
// only, never past DUNGEON_SIZE, starting from the oldest, and big enough for how long it has waited.
export function pickGroups<G extends QueuedGroup>(queue: readonly G[], now: number): G[] | null {
  const waiting = [...queue].sort((a, b) => a.at - b.at);
  if (waiting.length === 0) return null;
  const picked: G[] = [];
  let total = 0;
  for (const g of waiting) {
    if (total + g.size > DUNGEON_SIZE) continue;
    picked.push(g);
    total += g.size;
    if (total === DUNGEON_SIZE) break;
  }
  return total >= startSize(now - waiting[0].at) ? picked : null;
}

// What a clear pays one player: gold (more for a fast one), 강화석, maybe a piece of gear, and the day's
// first clear's gems. random gives numbers in [0, 1).
export function clearReward(bracket: Bracket, ms: number, first: boolean, random: () => number): { gold: number; stones: number; gear: ItemId | null; gems: number } {
  const gear = random() < GEAR_CHANCE ? bracket.gear[Math.min(bracket.gear.length - 1, Math.floor(random() * bracket.gear.length))] : null;
  return { gold: Math.round(bracket.gold * (ms <= FAST_MS ? 1 + FAST_GOLD : 1)), stones: bracket.stones, gear, gems: first ? FIRST_GEMS : 0 };
}

// A match's room: its id says which match.
export function dungeonRoomId(matchId: string): string {
  return `dgn-${matchId}`;
}

export function readDungeonRoom(roomId: unknown): { matchId: string } | null {
  if (typeof roomId !== "string") return null;
  const m = /^dgn-(.+)$/.exec(roomId);
  return m ? { matchId: m[1] } : null;
}

// What the room keeps of the run.
export type DungeonStatus = "running" | "cleared" | "failed";
export interface DungeonRun {
  match: string;
  bracket: BracketId;
  // Everyone it was sized for: the players and the mercenaries filling the empty seats.
  size: number;
  mercs: number;
  // 1 and 2 are the waves; WAVES + 1 is the boss.
  wave: number;
  status: DungeonStatus;
  startedAt: number;
  endsAt: number;
  clearMs: number | null;
}

export function readRun(raw: unknown): DungeonRun | null {
  const r = raw as Partial<DungeonRun> | null;
  if (!r || typeof r.match !== "string" || !bracketById(r.bracket) || typeof r.wave !== "number" || typeof r.startedAt !== "number"
    || typeof r.endsAt !== "number" || (r.status !== "running" && r.status !== "cleared" && r.status !== "failed")) return null;
  return {
    match: r.match, bracket: r.bracket as BracketId, size: typeof r.size === "number" ? r.size : 1, mercs: typeof r.mercs === "number" ? r.mercs : 0,
    wave: r.wave, status: r.status,
    startedAt: r.startedAt, endsAt: r.endsAt, clearMs: typeof r.clearMs === "number" ? r.clearMs : null,
  };
}

// How things stand for one player, as the screen asks.
export interface DungeonView {
  bracket: BracketId | null;
  runsLeft: number;
  queued: { since: number } | null;
  match: {
    id: string;
    names: string[];
    readyBy: number;
    ready: boolean;
    started: boolean;
  } | null;
}
