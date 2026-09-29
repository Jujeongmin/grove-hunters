import { sellPrice, type Bag, type ItemId } from "../account/items";
import type { Side } from "./fieldMap";

// The grove's week and the village's rebuilding (see docs/superpowers/specs/2026-09-28-grove-purification-village-design.md).
// Every server keeps one record of each: this week's kills against PURIFY_GOAL, and what has gone into
// the village's four buildings. All the numbers live here.

export const PURIFY_GOAL = 3000;
// A room adds its kills to the record once this much of its ticks has passed.
export const FLUSH_MS = 10_000;
// The share of the goal that reaches stages 1, 2 and 3.
export const STAGE_AT = [0.3, 0.6, 1] as const;
export type Stage = 0 | 1 | 2 | 3;
// Gold for everyone who hunted, by stage: stage 2 opens a site instead, and pays gold only once every
// building stands.
const STAGE_GOLD: Record<1 | 2 | 3, number> = { 1: 200, 2: 0, 3: 500 };
const LATE_SITE_GOLD = 300;
// A finished building pays each giver this share of their points in gold, and their points in XP.
const GIVER_GOLD_SHARE = 0.2;

export type BuildingId = "herbalist" | "training" | "inn" | "watchtower";
export interface Building {
  id: BuildingId;
  model: string;
  // The top-left cell of its two-by-two site in the village, and which way its door faces.
  at: [number, number];
  face: Side;
  needs: Partial<Record<ItemId, number>>;
  gold: number;
}

// In the order they are built.
export const BUILDINGS: readonly Building[] = [
  { id: "herbalist", model: "bld_house_small", at: [26, 4], face: "S", needs: { jelly: 300 }, gold: 20_000 },
  { id: "training", model: "bld_house_long", at: [22, 9], face: "S", needs: { stone: 200, silk: 150 }, gold: 40_000 },
  { id: "inn", model: "bld_house_tall", at: [6, 20], face: "N", needs: { core: 150 }, gold: 60_000 },
  { id: "watchtower", model: "bld_tower", at: [27, 19], face: "N", needs: { spore: 30, core: 100 }, gold: 100_000 },
];

const DAY_MS = 86_400_000;
const KOREA_MS = 9 * 3_600_000;
// 1970-01-05 was a Monday.
const FIRST_MONDAY_MS = 4 * DAY_MS;

// Weeks run from Monday midnight in Korea: the week's number since 1970, as the records keep it.
function weekIndex(now: number): number {
  return Math.floor((now + KOREA_MS - FIRST_MONDAY_MS) / (7 * DAY_MS));
}

export function weekOf(now: number): string {
  return `W${weekIndex(now)}`;
}

export function weekEndsAt(now: number): number {
  return (weekIndex(now) + 1) * 7 * DAY_MS + FIRST_MONDAY_MS - KOREA_MS;
}

export function stageOf(kills: number): Stage {
  const share = kills / PURIFY_GOAL;
  return share >= STAGE_AT[2] ? 3 : share >= STAGE_AT[1] ? 2 : share >= STAGE_AT[0] ? 1 : 0;
}

const count = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0);
const readStage = (v: unknown): Stage => (v === 1 || v === 2 || v === 3 ? v : 0);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

// `guardian` is the week the guardian was last called up: once a week for the whole server.
export interface GroveRecord { week: string; kills: number; paid: Stage; lastWeek: { week: string; paid: Stage } | null; guardian?: string }

export function readGrove(raw: unknown): GroveRecord {
  const r = isObject(raw) ? raw : {};
  if (typeof r.week !== "string") return { week: "", kills: 0, paid: 0, lastWeek: null };
  const last = isObject(r.lastWeek) && typeof r.lastWeek.week === "string" ? { week: r.lastWeek.week, paid: readStage(r.lastWeek.paid) } : null;
  return {
    week: r.week, kills: count(r.kills), paid: readStage(r.paid), lastWeek: last,
    ...(typeof r.guardian === "string" ? { guardian: r.guardian } : {}),
  };
}

// A room's kills added to the record: a new week starts from nothing (keeping the last one's stage
// for the rewards still owed). `opened` is true the first time stage 2 is passed this week (a site
// opens); `guardian` the first time stage 3 is.
export function addKills(record: GroveRecord, kills: number, now: number): { record: GroveRecord; opened: boolean; guardian: boolean } {
  const week = weekOf(now);
  const base: GroveRecord = record.week === week
    ? record
    : { week, kills: 0, paid: 0, lastWeek: record.week ? { week: record.week, paid: record.paid } : null };
  const total = base.kills + kills;
  const stage = stageOf(total);
  const paid = Math.max(base.paid, stage) as Stage;
  return { record: { ...base, kills: total, paid }, opened: base.paid < 2 && paid >= 2, guardian: base.paid < 3 && paid >= 3 };
}

export interface BuildingProgress {
  gold: number;
  items: Partial<Record<ItemId, number>>;
  // Each giver's points (gold 1, an item its sell price) and the name they gave under.
  donors: Record<string, { points: number; name: string }>;
  done: boolean;
}
export interface VillageRecord { open: number; buildings: Record<BuildingId, BuildingProgress> }

function readProgress(raw: unknown, building: Building): BuildingProgress {
  const r = isObject(raw) ? raw : {};
  const items: Partial<Record<ItemId, number>> = {};
  for (const id of Object.keys(building.needs) as ItemId[]) items[id] = count(isObject(r.items) ? r.items[id] : 0);
  const donors: BuildingProgress["donors"] = {};
  if (isObject(r.donors)) {
    for (const [account, d] of Object.entries(r.donors)) {
      if (isObject(d) && typeof d.name === "string") donors[account] = { points: count(d.points), name: d.name };
    }
  }
  return { gold: count(r.gold), items, donors, done: r.done === true };
}

export function readVillage(raw: unknown): VillageRecord {
  const r = isObject(raw) ? raw : {};
  const stored = isObject(r.buildings) ? r.buildings : {};
  const buildings = Object.fromEntries(BUILDINGS.map((b) => [b.id, readProgress(stored[b.id], b)])) as Record<BuildingId, BuildingProgress>;
  return { open: Math.min(BUILDINGS.length, count(r.open)), buildings };
}

// The building gifts go to now: the first unfinished one among the open sites.
export function underWay(village: VillageRecord): Building | null {
  for (const b of BUILDINGS.slice(0, village.open)) if (!village.buildings[b.id].done) return b;
  return null;
}

export function allBuilt(village: VillageRecord): boolean {
  return BUILDINGS.every((b) => village.buildings[b.id].done);
}

export function openSite(village: VillageRecord): VillageRecord {
  return { ...village, open: Math.min(BUILDINGS.length, village.open + 1) };
}

export interface Offer { items: Partial<Record<ItemId, number>>; gold: number }

// What a gift to the building under way takes: no more than it still needs, nor than you have. Null
// when there is nothing to take (no building under way, or nothing it needs).
export function donation(village: VillageRecord, offer: Offer, bag: Bag, gold: number): { building: Building; take: Offer; points: number } | null {
  const building = underWay(village);
  if (!building) return null;
  const progress = village.buildings[building.id];
  const take: Offer = { items: {}, gold: Math.max(0, Math.min(count(offer.gold), gold, building.gold - progress.gold)) };
  let points = take.gold;
  for (const [id, need] of Object.entries(building.needs) as [ItemId, number][]) {
    const n = Math.max(0, Math.min(count(offer.items[id]), bag[id] ?? 0, need - (progress.items[id] ?? 0)));
    if (n === 0) continue;
    take.items[id] = n;
    points += n * sellPrice(id);
  }
  return points > 0 ? { building, take, points } : null;
}

export function giveTo(village: VillageRecord, id: BuildingId, take: Offer, points: number, account: string, name: string): VillageRecord {
  const building = BUILDINGS.find((b) => b.id === id)!;
  const was = village.buildings[id];
  const items = { ...was.items };
  for (const [item, n] of Object.entries(take.items) as [ItemId, number][]) items[item] = (items[item] ?? 0) + n;
  const gold = was.gold + take.gold;
  const done = gold >= building.gold && Object.entries(building.needs).every(([item, need]) => (items[item as ItemId] ?? 0) >= need!);
  const donors = { ...was.donors, [account]: { points: (was.donors[account]?.points ?? 0) + points, name } };
  return { ...village, buildings: { ...village.buildings, [id]: { gold, items, donors, done } } };
}

export function completionRewards(progress: BuildingProgress): Record<string, { gold: number; xp: number }> {
  return Object.fromEntries(
    Object.entries(progress.donors).map(([account, d]) => [account, { gold: Math.floor(d.points * GIVER_GOLD_SHARE), xp: d.points }]),
  );
}

// An account's part in its server's grove: the week it last hunted in and the stages it has been paid
// for, the week before (still owed until its record is gone), and what finished buildings owe it.
export interface UserGrove {
  week: string;
  claimed: Stage;
  prev: { week: string; claimed: Stage } | null;
  pending: { gold: number; xp: number };
}

export function readUserGrove(raw: unknown): UserGrove {
  const r = isObject(raw) ? raw : {};
  const prev = isObject(r.prev) && typeof r.prev.week === "string" ? { week: r.prev.week, claimed: readStage(r.prev.claimed) } : null;
  const pending = isObject(r.pending) ? { gold: count(r.pending.gold), xp: count(r.pending.xp) } : { gold: 0, xp: 0 };
  return { week: typeof r.week === "string" ? r.week : "", claimed: readStage(r.claimed), prev, pending };
}

// Hunting this week: null when already marked (nothing to write).
export function markHunted(user: UserGrove, week: string): UserGrove | null {
  if (user.week === week) return null;
  return { ...user, week, claimed: 0, prev: user.week ? { week: user.week, claimed: user.claimed } : null };
}

function stageGold(from: Stage, to: Stage, late: boolean): number {
  let gold = 0;
  for (let s = from + 1; s <= to; s++) gold += s === 2 ? (late ? LATE_SITE_GOLD : 0) : STAGE_GOLD[s as 1 | 3];
  return gold;
}

// What an account is owed on coming in: the stages this week and last week reached since it was last
// paid (it must have hunted in that week), and what finished buildings left it.
export function settle(user: UserGrove, record: GroveRecord, village: VillageRecord): { user: UserGrove; gold: number; xp: number } {
  const late = allBuilt(village);
  let gold = user.pending.gold;
  const next: UserGrove = { ...user, pending: { gold: 0, xp: 0 } };
  const weeks: [string, Stage][] = [[record.week, record.paid]];
  if (record.lastWeek) weeks.push([record.lastWeek.week, record.lastWeek.paid]);
  for (const [week, paid] of weeks) {
    if (next.week === week && next.claimed < paid) {
      gold += stageGold(next.claimed, paid, late);
      next.claimed = paid;
    } else if (next.prev?.week === week && next.prev.claimed < paid) {
      gold += stageGold(next.prev.claimed, paid, late);
      next.prev = { ...next.prev, claimed: paid };
    }
  }
  return { user: next, gold, xp: user.pending.xp };
}

export const built = (village: VillageRecord, id: BuildingId) => village.buildings[id].done;
export const potionPriceFactor = (v: VillageRecord) => (built(v, "herbalist") ? 0.8 : 1);
export const huntXpFactor = (v: VillageRecord) => (built(v, "training") ? 1.05 : 1);
export const deathLossFactor = (v: VillageRecord) => (built(v, "inn") ? 0.5 : 1);
export const revealsBosses = (v: VillageRecord) => built(v, "watchtower");

export interface GroveView {
  kills: number;
  goal: number;
  stage: Stage;
  daysLeft: number;
  buildings: {
    id: BuildingId;
    state: "closed" | "building" | "done";
    // How far along, 0 to 1 (gold and every material counted alike).
    share: number;
    given: Offer;
    // The three biggest givers' names.
    top: string[];
  }[];
  revealsBosses: boolean;
}

// On coming into the world while the haze still stands (before stage 2), a new player is told why
// once a week: the percent of the week's goal hunted so far, or null when there is nothing to say.
// `seenWeek` is the week it was last told in.
export function hazeHint(view: GroveView | null, seenWeek: string | null, week: string): number | null {
  if (!view || view.stage >= 2 || seenWeek === week) return null;
  return Math.floor((view.kills / view.goal) * 100);
}

export function groveView(record: GroveRecord, village: VillageRecord, now: number): GroveView {
  const current = record.week === weekOf(now) ? record : { ...record, kills: 0, paid: 0 as Stage };
  const going = underWay(village);
  return {
    kills: current.kills,
    goal: PURIFY_GOAL,
    stage: stageOf(current.kills),
    daysLeft: Math.ceil((weekEndsAt(now) - now) / DAY_MS),
    buildings: BUILDINGS.map((b) => {
      const p = village.buildings[b.id];
      const parts = [Math.min(1, p.gold / b.gold), ...Object.entries(b.needs).map(([id, n]) => Math.min(1, (p.items[id as ItemId] ?? 0) / n!))];
      return {
        id: b.id,
        state: p.done ? "done" : going?.id === b.id ? "building" : "closed",
        share: p.done ? 1 : parts.reduce((a, x) => a + x, 0) / parts.length,
        given: { gold: p.gold, items: p.items },
        top: Object.values(p.donors).sort((a, x) => x.points - a.points).slice(0, 3).map((d) => d.name),
      };
    }),
    revealsBosses: revealsBosses(village),
  };
}
