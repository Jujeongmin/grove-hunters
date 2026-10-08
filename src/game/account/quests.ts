import { ZONE_BOSS, ZONE_MONSTERS, type MonsterType } from "../world/monsters";
import { ZONES, type ZoneId } from "../world/zones";
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
  // Added 2026-10-08 so the first field's quests carry a hunter to level 10, where the second field
  // opens (they used to end around level 6). Saves from before are moved along (see readQuest).
  { targets: ["rat", "frog"], count: 60, xp: 5000, gold: 300, items: [{ id: "weapon_1", n: 1 }] },
  { targets: ["green_blob", "mushnub", "rat", "frog"], count: 80, xp: 7000, gold: 400, items: [{ id: "potion_small", n: 10 }, { id: "stone", n: 3 }] },
  { targets: ["spider", "snake"], count: 50, xp: 9000, gold: 600, items: [{ id: "potion_big", n: 5 }] },
  { targets: ["wasp", "bat"], count: 60, xp: 18000, gold: 1000, items: [] },
  { targets: ["goleling"], count: 60, xp: 30000, gold: 1500, items: [{ id: "weapon_2", n: 1 }] },
  // Added in chain 3 (2026-10-08): the second field's own carry a hunter to 25, where the Mushroom
  // King's clearing and the deep wood open (they used to end around 17).
  { targets: ["wasp", "bat", "goleling"], count: 120, xp: 60000, gold: 2500, items: [{ id: "stone", n: 5 }] },
  {
    targets: ["spider", "snake", "wasp", "bat", "goleling"], count: 200, xp: 120000, gold: 3500,
    items: [{ id: "potion_big", n: 10 }, { id: "silk", n: 10 }],
  },
  { targets: ["mushroom_king"], count: 1, xp: 40000, gold: 3000, items: [] },
  { targets: ["dire_spider", "venom_snake"], count: 60, xp: 60000, gold: 4000, items: [{ id: "potion_big", n: 10 }] },
  { targets: ["hornet", "vampire_bat"], count: 80, xp: 90000, gold: 6000, items: [] },
  { targets: ["stone_golem"], count: 60, xp: 130000, gold: 9000, items: [{ id: "armor_2", n: 1 }] },
  // Past the chain's first end. New ones go on the end, or, inserted (as the two above), with
  // QUEST_CHAIN raised and readQuest moving older saves along.
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
  // Chain 3: the foothills' carry a hunter to 47, where the canyon opens.
  {
    targets: ["frost_blob", "snow_hare", "snow_wolf", "frost_spider"], count: 150, xp: 200000, gold: 14000,
    items: [{ id: "snow_fur", n: 8 }, { id: "stone", n: 10 }],
  },
  { targets: ["frost_bat", "penguin_brute"], count: 80, xp: 140000, gold: 12000, items: [{ id: "snow_fur", n: 10 }] },
  { targets: ["frost_snake", "ice_golem"], count: 90, xp: 170000, gold: 15000, items: [{ id: "armor_6", n: 1 }] },
  { targets: ["ice_golem"], count: 100, xp: 200000, gold: 18000, items: [{ id: "stone", n: 30 }] },
  // Chain 3: the canyon's carry a hunter to 54, where the peaks open.
  {
    targets: ["frost_bat", "penguin_brute", "frost_snake", "ice_golem"], count: 150, xp: 250000, gold: 20000,
    items: [{ id: "frost_shard", n: 12 }, { id: "potion_big", n: 20 }],
  },
  { targets: ["penguin_brute", "ice_golem"], count: 150, xp: 250000, gold: 22000, items: [{ id: "snow_fur", n: 12 }, { id: "stone", n: 20 }] },
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

// Where a character is in the chain: the quest it is on (QUESTS.length when all are done), how many
// it has felled for it, which shape of the chain the index counts in (v; see QUEST_CHAIN), and
// whether it has taken that quest from the elder (taken; kills count only then). Saves from before
// taking began read as taken, so no one loses a quest they were on.
export interface QuestProgress { index: number; count: number; v?: number; taken?: boolean }

// The chain's shape, raised each time quests go in between others; a save counts in the chain its v
// names (none: the first), and is moved along through every change since, to the same quest with
// its count kept. Each change lists where its quests went in, in the chain as it stood before it.
export const QUEST_CHAIN = 3;
const CHAIN_CHANGES: { to: number; inserted: { at: number; n: number }[] }[] = [
  // 2026-10-08: two in the first field, so its quests reach level 10.
  { to: 2, inserted: [{ at: 3, n: 2 }] },
  // 2026-10-08: two in the second field (to 25), one in the foothills (to 47), two in the canyon (to 54).
  { to: 3, inserted: [{ at: 8, n: 2 }, { at: 17, n: 1 }, { at: 20, n: 2 }] },
];

// A saved index in chain `from`, as it reads in the chain now.
function movedAlong(index: number, from: number): number {
  let at = index;
  for (const change of CHAIN_CHANGES) {
    if (change.to <= from) continue;
    at += change.inserted.reduce((n, ins) => n + (index >= ins.at ? ins.n : 0), 0);
    index = at;
  }
  return at;
}

export const QUEST_START: QuestProgress = { index: 0, count: 0, v: QUEST_CHAIN, taken: false };

// The level a quest's hunting ground asks for (its first kind's zone).
export function questLevel(index: number): number {
  const quest = QUESTS[index];
  if (!quest) return 0;
  const zones = (Object.keys(ZONES) as ZoneId[]).filter((z) => ZONE_MONSTERS[z].includes(quest.targets[0]) || ZONE_BOSS[z] === quest.targets[0]);
  return zones.length === 0 ? 0 : Math.min(...zones.map((z) => ZONES[z].minLevel));
}

// Where, in the chain as it is now, the quests every change put in stand.
function insertedNow(): Set<number> {
  let marks: boolean[] = [];
  let length = QUESTS.length - CHAIN_CHANGES.reduce((n, c) => n + c.inserted.reduce((m, i) => m + i.n, 0), 0);
  marks = Array.from({ length }, () => false);
  for (const change of CHAIN_CHANGES) {
    const next: boolean[] = [];
    marks.forEach((mark, i) => {
      for (const ins of change.inserted) if (ins.at === i) for (let k = 0; k < ins.n; k++) next.push(true);
      next.push(mark);
    });
    for (const ins of change.inserted) if (ins.at >= marks.length) for (let k = 0; k < ins.n; k++) next.push(true);
    marks = next;
    length = marks.length;
  }
  return new Set(marks.flatMap((mark, i) => (mark ? [i] : [])));
}
const INSERTED_NOW = insertedNow();

// `level`, when known: a save moved along onto a quest whose ground is above the character (they
// were stuck there, which is why quests went in before it) goes back to the first of the new ones
// before it it can do, to be taken from the elder.
export function readQuest(raw: unknown, level?: number): QuestProgress {
  const q = (raw ?? {}) as Record<string, unknown>;
  const whole = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0);
  const from = typeof q.v === "number" && Number.isInteger(q.v) && q.v >= 1 && q.v <= QUEST_CHAIN ? q.v : 1;
  let index = Math.min(movedAlong(whole(q.index), from), QUESTS.length);
  let taken = q.taken !== false;
  let count = whole(q.count);
  if (from < QUEST_CHAIN && level !== undefined && questLevel(index) > level && INSERTED_NOW.has(index - 1)) {
    while (INSERTED_NOW.has(index - 1)) index--;
    taken = false;
    count = 0;
  }
  const quest = QUESTS[index];
  return { index, count: quest ? Math.min(count, quest.count) : 0, v: QUEST_CHAIN, taken };
}

// Whether the quest on is one taken from the elder (saves from before taking began are).
export function questTaken(progress: QuestProgress): boolean {
  return progress.taken !== false;
}

// Progress after felling these monsters.
export function countKills(progress: QuestProgress, felled: readonly MonsterType[]): QuestProgress {
  const quest = QUESTS[progress.index];
  if (!quest || !questTaken(progress)) return progress;
  const hits = felled.filter((t) => quest.targets.includes(t)).length;
  return hits === 0 ? progress : { ...progress, count: Math.min(quest.count, progress.count + hits) };
}

export function questDone(progress: QuestProgress): boolean {
  const quest = QUESTS[progress.index];
  return !!quest && progress.count >= quest.count;
}
