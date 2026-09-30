import type { MonsterType } from "../world/monsters";
import type { ItemId } from "./items";

// The village's quests, taken one after another: each asks for a number of monsters of some kinds,
// and pays XP, gold and sometimes an item when claimed. A character keeps which quest it is on and
// how many it has felled for it.

export interface Quest {
  targets: MonsterType[];
  count: number;
  xp: number;
  gold: number;
  items: { id: ItemId; n: number }[];
}

export const QUESTS: readonly Quest[] = [
  { targets: ["green_blob"], count: 15, xp: 250, gold: 40, items: [{ id: "potion_small", n: 5 }] },
  { targets: ["mushnub"], count: 20, xp: 700, gold: 80, items: [] },
  { targets: ["rat", "frog"], count: 40, xp: 2500, gold: 200, items: [{ id: "armor_1", n: 1 }] },
  { targets: ["spider", "snake"], count: 50, xp: 9000, gold: 600, items: [{ id: "potion_big", n: 5 }] },
  { targets: ["wasp", "bat"], count: 60, xp: 18000, gold: 1000, items: [] },
  { targets: ["goleling"], count: 60, xp: 30000, gold: 1500, items: [{ id: "weapon_2", n: 1 }] },
  { targets: ["mushroom_king"], count: 1, xp: 40000, gold: 3000, items: [] },
  { targets: ["dire_spider", "venom_snake"], count: 60, xp: 60000, gold: 4000, items: [{ id: "potion_big", n: 10 }] },
  { targets: ["hornet", "vampire_bat"], count: 80, xp: 90000, gold: 6000, items: [] },
  { targets: ["stone_golem"], count: 60, xp: 130000, gold: 9000, items: [{ id: "armor_2", n: 1 }] },
  // Past the chain's first end: new ones only ever go on the end, so saved progress keeps its meaning.
  {
    targets: ["stone_golem"], count: 100, xp: 200000, gold: 12000,
    items: [{ id: "core", n: 12 }, { id: "stone", n: 10 }],
  },
  {
    targets: ["mushroom_king"], count: 3, xp: 180000, gold: 15000,
    items: [{ id: "spore", n: 4 }],
  },
  {
    targets: ["dire_spider", "venom_snake", "hornet", "vampire_bat", "stone_golem"], count: 200, xp: 350000, gold: 25000,
    items: [{ id: "stone", n: 20 }, { id: "potion_big", n: 20 }],
  },
  // The snow region's, from the outpost's captain (any town's elder takes the reports).
  { targets: ["frost_blob", "snow_hare"], count: 60, xp: 90000, gold: 8000, items: [{ id: "potion_big", n: 10 }] },
  { targets: ["snow_wolf", "frost_spider"], count: 80, xp: 110000, gold: 10000, items: [{ id: "frost_shard", n: 10 }] },
  { targets: ["frost_bat", "penguin_brute"], count: 80, xp: 140000, gold: 12000, items: [{ id: "snow_fur", n: 10 }] },
  { targets: ["frost_snake", "ice_golem"], count: 90, xp: 170000, gold: 15000, items: [{ id: "armor_6", n: 1 }] },
  { targets: ["ice_golem"], count: 100, xp: 200000, gold: 18000, items: [{ id: "stone", n: 30 }] },
  { targets: ["peak_yeti"], count: 80, xp: 250000, gold: 22000, items: [{ id: "ever_ice", n: 3 }] },
  { targets: ["frost_drake", "glacier_alpaking"], count: 100, xp: 300000, gold: 26000, items: [{ id: "weapon_6", n: 1 }] },
  { targets: ["frost_emperor"], count: 1, xp: 400000, gold: 30000, items: [{ id: "ever_ice", n: 6 }] },
];

// Daily quests, one per hunting field: fell that many of its monsters in a day (Korean time) and
// claim the reward, from anywhere. They start over at midnight.
export interface DailyQuest {
  id: "forest1" | "forest2" | "forest3" | "snow1" | "snow2" | "snow3";
  targets: MonsterType[];
  count: number;
  gold: number;
  items: { id: ItemId; n: number }[];
}

export const DAILY_QUESTS: readonly DailyQuest[] = [
  {
    id: "forest1", targets: ["green_blob", "mushnub", "rat", "frog"],
    count: 30, gold: 150, items: [{ id: "stone", n: 2 }, { id: "jelly", n: 5 }],
  },
  {
    id: "forest2", targets: ["spider", "snake", "wasp", "bat", "goleling"],
    count: 40, gold: 800, items: [{ id: "stone", n: 4 }, { id: "silk", n: 6 }],
  },
  {
    id: "forest3", targets: ["dire_spider", "venom_snake", "hornet", "vampire_bat", "stone_golem"],
    count: 50, gold: 2500, items: [{ id: "stone", n: 6 }, { id: "core", n: 6 }],
  },
  {
    id: "snow1", targets: ["frost_blob", "snow_hare", "snow_wolf", "frost_spider"],
    count: 50, gold: 4000, items: [{ id: "stone", n: 8 }, { id: "snow_fur", n: 4 }],
  },
  {
    id: "snow2", targets: ["frost_bat", "penguin_brute", "frost_snake", "ice_golem"],
    count: 60, gold: 5500, items: [{ id: "stone", n: 10 }, { id: "frost_shard", n: 5 }],
  },
  {
    id: "snow3", targets: ["peak_yeti", "frost_drake", "glacier_alpaking"],
    count: 60, gold: 7000, items: [{ id: "stone", n: 12 }, { id: "ever_ice", n: 1 }],
  },
];

// A character's daily quests: the day they are for (Korean date, e.g. "2026-09-22"), how many it has
// felled for each today, and which it has claimed.
export interface DailyProgress {
  day: string;
  counts: Partial<Record<DailyQuest["id"], number>>;
  claimed: DailyQuest["id"][];
}

// The day's date in Korea (UTC+9), when the dailies start over.
export function dailyDay(now: number): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
}

export function readDaily(raw: unknown): DailyProgress {
  const d = (raw ?? {}) as Record<string, unknown>;
  const day = typeof d.day === "string" ? d.day : "";
  const counts: DailyProgress["counts"] = {};
  const claimed: DailyQuest["id"][] = [];
  for (const q of DAILY_QUESTS) {
    const n = (d.counts as Record<string, unknown> | undefined)?.[q.id];
    if (typeof n === "number" && Number.isInteger(n) && n > 0) counts[q.id] = Math.min(n, q.count);
    if (Array.isArray(d.claimed) && d.claimed.includes(q.id)) claimed.push(q.id);
  }
  return { day, counts, claimed };
}

// Today's progress: the saved one if it is for today, else a fresh day.
export function dailyToday(progress: DailyProgress, now: number): DailyProgress {
  const day = dailyDay(now);
  return progress.day === day ? progress : { day, counts: {}, claimed: [] };
}

// Progress after felling these monsters at `now`.
export function countDaily(progress: DailyProgress, felled: readonly MonsterType[], now: number): DailyProgress {
  const today = dailyToday(progress, now);
  const counts = { ...today.counts };
  for (const q of DAILY_QUESTS) {
    const hits = felled.filter((t) => q.targets.includes(t)).length;
    if (hits > 0) counts[q.id] = Math.min(q.count, (counts[q.id] ?? 0) + hits);
  }
  return { ...today, counts };
}

export function readDailyId(value: unknown): DailyQuest | null {
  return DAILY_QUESTS.find((q) => q.id === value) ?? null;
}

// Where a character is in the chain: the quest it is on (QUESTS.length when all are done) and how
// many it has felled for it.
export interface QuestProgress { index: number; count: number }

export const QUEST_START: QuestProgress = { index: 0, count: 0 };

export function readQuest(raw: unknown): QuestProgress {
  const q = (raw ?? {}) as Record<string, unknown>;
  const whole = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0);
  const index = Math.min(whole(q.index), QUESTS.length);
  const quest = QUESTS[index];
  return { index, count: quest ? Math.min(whole(q.count), quest.count) : 0 };
}

// Progress after felling these monsters.
export function countKills(progress: QuestProgress, felled: readonly MonsterType[]): QuestProgress {
  const quest = QUESTS[progress.index];
  if (!quest) return progress;
  const hits = felled.filter((t) => quest.targets.includes(t)).length;
  return hits === 0 ? progress : { ...progress, count: Math.min(quest.count, progress.count + hits) };
}

export function questDone(progress: QuestProgress): boolean {
  const quest = QUESTS[progress.index];
  return !!quest && progress.count >= quest.count;
}
