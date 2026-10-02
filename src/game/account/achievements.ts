import type { MonsterType } from "../world/monsters";
import type { Character } from "./characters";
import { levelOf } from "./level";
import { QUESTS } from "./quests";

// Achievements (업적, see docs/superpowers/specs/2026-10-02-attendance-achievements-design.md): goals
// an account works toward across all its characters, each paying gems once when claimed. What counts
// is gathered as facts from the characters and the account; which have been claimed is kept on the
// account by id, so an id is never changed or reused, and new ones go on the end.

// The bosses whose falls are counted one by one.
export const RECORDED_BOSSES = ["mushroom_king", "grove_guardian", "frost_emperor"] as const;
export type RecordedBoss = (typeof RECORDED_BOSSES)[number];

export type Metric =
  | "level" | "kills" | "quests" | RecordedBoss | "dailies" | "plus" | "advanced" | "guild" | "mounts" | "star5" | "attend";

// The order the screen shows them in.
export const METRICS: readonly Metric[] = [
  "level", "quests", "kills", "mushroom_king", "grove_guardian", "frost_emperor", "dailies", "plus", "advanced", "guild",
  "mounts", "star5", "attend",
];

export interface Achievement { id: string; metric: Metric; goal: number; gems: number }

const goals = (metric: Metric, list: readonly [number, number][]): Achievement[] =>
  list.map(([goal, gems]) => ({ id: `${metric}-${goal}`, metric, goal, gems }));

export const ACHIEVEMENTS: readonly Achievement[] = [
  ...goals("level", [[10, 20], [30, 30], [50, 50], [60, 100]]),
  ...goals("kills", [[100, 10], [1000, 20], [10000, 50], [50000, 100]]),
  ...goals("quests", [[7, 20], [13, 50], [21, 100]]),
  ...goals("mushroom_king", [[1, 30]]),
  ...goals("grove_guardian", [[1, 30]]),
  ...goals("frost_emperor", [[1, 50]]),
  ...goals("dailies", [[10, 20], [50, 50], [200, 100]]),
  ...goals("plus", [[5, 10], [8, 20], [10, 50], [12, 100], [15, 200]]),
  ...goals("advanced", [[1, 20]]),
  ...goals("guild", [[1, 20]]),
  ...goals("mounts", [[3, 10], [10, 30], [20, 100]]),
  ...goals("star5", [[1, 50]]),
  ...goals("attend", [[7, 10], [28, 30], [100, 100]]),
];

export function achievementById(id: unknown): Achievement | null {
  return ACHIEVEMENTS.find((a) => a.id === id) ?? null;
}

// What a character has done that nothing else keeps: monsters felled (as its quests count them, so
// every hitter's), each recorded boss felled, daily rewards taken, and the highest + it enhanced to.
export interface CharRecord {
  kills: number;
  bosses: Partial<Record<RecordedBoss, number>>;
  dailies: number;
  bestPlus: number;
}

export const NO_RECORD: CharRecord = { kills: 0, bosses: {}, dailies: 0, bestPlus: 0 };

const count = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : 0);

export function readRecord(raw: unknown): CharRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  const savedBosses = (r.bosses ?? {}) as Record<string, unknown>;
  const bosses: CharRecord["bosses"] = {};
  for (const boss of RECORDED_BOSSES) {
    const n = count(savedBosses[boss]);
    if (n > 0) bosses[boss] = n;
  }
  return { kills: count(r.kills), bosses, dailies: count(r.dailies), bestPlus: count(r.bestPlus) };
}

// The record after felling these.
export function recordFelled(record: CharRecord | undefined, felled: readonly MonsterType[]): CharRecord {
  const r = record ?? NO_RECORD;
  const bosses = { ...r.bosses };
  for (const type of felled) {
    if ((RECORDED_BOSSES as readonly string[]).includes(type)) bosses[type as RecordedBoss] = (bosses[type as RecordedBoss] ?? 0) + 1;
  }
  return { ...r, kills: r.kills + felled.length, bosses };
}

export type Facts = Record<Metric, number>;

// What the account itself holds toward its achievements.
export interface AccountFacts { mounts: number; star5: number; attend: number }

// The bosses a character must have felled to be past its quests: before records were kept, these are
// counted for it.
function questBosses(index: number, boss: RecordedBoss): number {
  return QUESTS.slice(0, index).reduce((n, q) => n + (q.targets.length === 1 && q.targets[0] === boss ? q.count : 0), 0);
}

// The highest + a character has: its record, or what it carries and wears now.
function bestPlus(c: Character): number {
  const now = [c.gear.weapon, c.gear.armor, ...c.pieces].reduce((top, p) => Math.max(top, p?.plus ?? 0), 0);
  return Math.max(c.record?.bestPlus ?? 0, now);
}

// Everything an account's achievements are measured by.
export function factsOf(characters: readonly Character[], account: AccountFacts): Facts {
  const facts: Facts = {
    level: 0, kills: 0, quests: 0, mushroom_king: 0, grove_guardian: 0, frost_emperor: 0, dailies: 0, plus: 0, advanced: 0, guild: 0,
    mounts: account.mounts, star5: account.star5, attend: account.attend,
  };
  for (const c of characters) {
    const record = c.record ?? NO_RECORD;
    facts.level = Math.max(facts.level, levelOf(c.xp).level);
    facts.quests = Math.max(facts.quests, c.quest.index);
    facts.kills += record.kills;
    for (const boss of RECORDED_BOSSES) facts[boss] += Math.max(record.bosses[boss] ?? 0, questBosses(c.quest.index, boss));
    facts.dailies += record.dailies;
    facts.plus = Math.max(facts.plus, bestPlus(c));
    if (c.job) facts.advanced = 1;
    if (c.guild) facts.guild = 1;
  }
  return facts;
}

// One achievement as the screen shows it.
export interface AchievementRow extends Achievement { progress: number; claimed: boolean }

export interface AchievementsView { list: AchievementRow[]; claimable: number }

export function achievementsView(facts: Facts, claimed: readonly string[]): AchievementsView {
  const list = ACHIEVEMENTS.map((a) => ({ ...a, progress: Math.min(facts[a.metric], a.goal), claimed: claimed.includes(a.id) }));
  return { list, claimable: list.filter((a) => !a.claimed && a.progress >= a.goal).length };
}

// The claimed ids as saved: only ones that still exist, each once.
export function readAchieved(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => achievementById(id) !== null))] : [];
}
