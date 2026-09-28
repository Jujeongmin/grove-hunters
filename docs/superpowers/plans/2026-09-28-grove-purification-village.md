# 숲 정화 + 마을 복구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서버마다 한 주 동안 모두의 처치로 숲을 정화하고(단계 보상·세상 변화·수호자), 2단계마다 열리는 터에 기부로 마을 건물 4채를 영구히 지어 서버 전체가 혜택을 받게 한다.

**Architecture:** 규칙은 전부 `src/game/world/grove.ts`의 순수 함수(서버·화면 공용). 서버는 공용 컬렉션 `grove`·`village`(서버당 1개)를 `$lock("grove-<world>")` 안에서만 읽고 쓰고, 처치는 방 상태 `groveKills`에 쌓았다가 방 틱이 10초치 쌓일 때마다 합친다. 계정 상태 `grove[world]`가 단계 보상·완공 보상 지급을 한 번씩만 하게 막는다. 화면은 `grove()`로 받은 `GroveView`로 패널·기부·꽃·안개·건물을 그린다.

**Tech Stack:** Vite + React + TypeScript, three.js, @agent8/gameserver (`$global` 컬렉션, `$lock`, `$room`, `$asset`), vitest(`tests/`), gameserver-node test(`server/test/`).

**Spec:** [docs/superpowers/specs/2026-09-28-grove-purification-village-design.md](../specs/2026-09-28-grove-purification-village-design.md)

## Global Constraints

- 사용자와는 한국어. 코드·주석·커밋은 영어, 주변 코드 말투.
- 커밋 직전마다 `npx tsc -b`, `npx vitest run`, `npm run server:test` 통과.
- `master`에 커밋 → `master`를 `develop`에 병합(깨끗한 worktree에서 `vite build` 확인) → `origin master`, `gitlab develop` 푸시. force-push 금지, develop→master 병합 금지. 에셋(`public/assets/ui/`, `public/assets/models/`)은 develop에만.
- 푸시 뒤 컨테이너 미리보기는 열지 않는다(사용자가 확인).
- 문구는 5개 언어(ko, en, ja, zhHant, zhHans) 모두. 800×450에서 패널 스크롤 0.
- 코드로 그린 장면 금지: 꽃·더미·건물은 기존 모델(`sn_flowers`, `sn_bush_flowers`, `pt_logs`, `pt_rock`, `bld_*`, `bld_tower`).
- 수치: `PURIFY_GOAL = 3000`, 단계 30/60/100%, 단계 골드 200 / (터 또는 300) / 500, 건물 4채 표(스펙 1절) 그대로. 한 주 = 월요일 0시 한국 시간.
- 스펙 변경(구현하며 확정): 터 4곳은 **처음부터 폐허 더미가 놓인 막힌 땅**(지도에 집 칸으로 고정)이다. 열리면 더미 위에 진행률 이름표, 완공되면 집 모델로 바뀐다. 지도가 주마다 바뀌지 않게 하기 위해서다.

---

## File Structure

| 파일 | 할 일 |
|---|---|
| `src/game/world/grove.ts` (새) | 상수, 주 계산, 단계, 기록 읽기, 합치기, 기부 계산, 보상, 혜택, `GroveView` |
| `tests/world/grove.test.ts` (새) | 위 규칙 테스트 |
| `src/game/world/zones.ts` | 마을 지도에 터 4곳(집 칸) 추가 |
| `src/game/world/monsters.ts` | `grove_guardian` 몬스터, 리스폰 배율에서 제외 |
| `src/game/render/monsterLooks.ts` | 수호자 모습(버섯왕 모델, 작게, 초록 빛) |
| `server/src/grove.ts` (새) | 컬렉션 읽기·쓰기, 잠금, 마을 캐시, 방 합치기, 수호자 소환, 입장 정산, 기부 |
| `server/src/server.ts` | 처치 카운트, 사냥 표시, 혜택 적용, `grove()`·`donate()`, 입장 정산, 틱 합치기 |
| `server/test/grove.test.ts` (새) | 서버 테스트 |
| `src/net/worldClient.ts` | `grove()`, `donate()`, 입장 보상을 payout으로 |
| `src/game/world/dialogue.ts` | 촌장 선택지 "donate" |
| `src/ui/GrovePanel.tsx`, `src/ui/DonatePanel.tsx` (새) | 숲 패널, 기부 패널 |
| `src/ui/WorldScreen.tsx`, `src/ui/DialogueBox.tsx` | 메뉴 "숲"(G), 1분 갱신, 기부 연결 |
| `src/game/render/groveScene.ts` (새) | 터(더미·건물·이름표), 꽃, 안개 |
| `src/game/render/WorldView.ts` | `setGrove(view)`, 모델 미리 불러오기, 미니맵 보스 표시 |
| `src/ui/Minimap.tsx` | 보스·수호자 점 |
| `src/game/render/icons.ts` + `public/assets/ui/icons/ui_grove.png` | 메뉴 아이콘(PixelLab) |
| `src/ui/strings/*.ts`, `src/index.css` | 문구, 패널 스타일 |

---

### Task 1: 공용 규칙 `grove.ts`

**Files:** Create `src/game/world/grove.ts`, `tests/world/grove.test.ts`

**Interfaces — Produces:**
- `PURIFY_GOAL`, `FLUSH_MS = 10_000`, `STAGE_AT = [0.3, 0.6, 1]`, `type Stage = 0|1|2|3`, `type BuildingId = "herbalist"|"training"|"inn"|"watchtower"`
- `BUILDINGS: readonly Building[]` (`{ id, model, at: [col,row], face, needs: Partial<Record<ItemId, number>>, gold }`)
- `weekOf(now: number): string`, `weekEndsAt(now: number): number`, `stageOf(kills: number): Stage`
- `GroveRecord { week: string; kills: number; paid: Stage; lastWeek: { week: string; paid: Stage } | null }`, `readGrove(raw): GroveRecord`
- `addKills(record, kills, now): { record: GroveRecord; opened: boolean; guardian: boolean }`
- `BuildingProgress { gold: number; items: Partial<Record<ItemId, number>>; donors: Record<string, { points: number; name: string }>; done: boolean }`, `VillageRecord { open: number; buildings: Record<BuildingId, BuildingProgress> }`, `readVillage(raw): VillageRecord`
- `underWay(village): Building | null`, `allBuilt(village): boolean`, `openSite(village): VillageRecord`
- `Offer { items: Partial<Record<ItemId, number>>; gold: number }`, `donation(village, offer, bag, gold): { building: Building; take: Offer; points: number } | null`, `giveTo(village, id, take, points, account, name): VillageRecord`
- `completionRewards(progress): Record<string, { gold: number; xp: number }>`
- `UserGrove { week: string; claimed: Stage; prev: { week: string; claimed: Stage } | null; pending: { gold: number; xp: number } }`, `readUserGrove(raw): UserGrove`, `markHunted(user, week): UserGrove | null`
- `settle(user, record, village): { user: UserGrove; gold: number; xp: number }`
- `built(village, id): boolean`, `potionPriceFactor(v)`, `huntXpFactor(v)`, `deathLossFactor(v)`, `revealsBosses(v)`
- `GroveView`, `groveView(record, village, now): GroveView`

- [ ] **Step 1: Write the failing test** — `tests/world/grove.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BUILDINGS, PURIFY_GOAL, addKills, allBuilt, completionRewards, deathLossFactor, donation, giveTo, groveView,
  huntXpFactor, markHunted, openSite, potionPriceFactor, readGrove, readUserGrove, readVillage, settle, stageOf,
  underWay, weekEndsAt, weekOf, type GroveRecord, type VillageRecord,
} from "../../src/game/world/grove";

// 2026-10-05 is a Monday. Korea is UTC+9: its Monday midnight is Sunday 15:00 UTC.
const MONDAY_KST = Date.UTC(2026, 9, 4, 15, 0, 0);

const empty = (): VillageRecord => readVillage(null);
const doneVillage = (ids: string[]): VillageRecord => {
  const v = empty();
  v.open = 4;
  for (const id of ids) v.buildings[id as keyof VillageRecord["buildings"]].done = true;
  return v;
};

describe("the grove's week", () => {
  it("turns over at Monday midnight in Korea", () => {
    expect(weekOf(MONDAY_KST - 60_000)).not.toBe(weekOf(MONDAY_KST));
    expect(weekOf(MONDAY_KST)).toBe(weekOf(MONDAY_KST + 6 * 86_400_000 + 86_399_000));
    expect(weekEndsAt(MONDAY_KST + 1000)).toBe(MONDAY_KST + 7 * 86_400_000);
  });

  it("climbs a stage at 30, 60 and 100 percent", () => {
    expect(stageOf(0)).toBe(0);
    expect(stageOf(PURIFY_GOAL * 0.3 - 1)).toBe(0);
    expect(stageOf(PURIFY_GOAL * 0.3)).toBe(1);
    expect(stageOf(PURIFY_GOAL * 0.6)).toBe(2);
    expect(stageOf(PURIFY_GOAL)).toBe(3);
    expect(stageOf(PURIFY_GOAL * 5)).toBe(3);
  });

  it("adds kills, opening a site and calling the guardian the first time the stages are passed", () => {
    const week = weekOf(MONDAY_KST);
    let r: GroveRecord = { week, kills: PURIFY_GOAL * 0.6 - 1, paid: 1, lastWeek: null };
    const two = addKills(r, 1, MONDAY_KST);
    expect(two).toEqual({ record: { ...r, kills: PURIFY_GOAL * 0.6, paid: 2 }, opened: true, guardian: false });
    r = two.record;
    expect(addKills(r, 1, MONDAY_KST).opened).toBe(false);
    expect(addKills(r, PURIFY_GOAL, MONDAY_KST).guardian).toBe(true);
  });

  it("starts a new week from nothing and keeps the last one's stage", () => {
    const old: GroveRecord = { week: weekOf(MONDAY_KST - 60_000), kills: 2000, paid: 2, lastWeek: null };
    const next = addKills(old, 5, MONDAY_KST).record;
    expect(next).toEqual({ week: weekOf(MONDAY_KST), kills: 5, paid: 0, lastWeek: { week: old.week, paid: 2 } });
  });

  it("reads broken records as nothing", () => {
    expect(readGrove({ week: 3, kills: "x", paid: 9 })).toEqual({ week: "", kills: 0, paid: 0, lastWeek: null });
    expect(readVillage({ open: -2, buildings: "no" }).open).toBe(0);
    expect(readUserGrove(undefined)).toEqual({ week: "", claimed: 0, prev: null, pending: { gold: 0, xp: 0 } });
  });
});

describe("rebuilding the village", () => {
  it("builds in order, one open site at a time", () => {
    expect(underWay(empty())).toBeNull();
    const v = openSite(empty());
    expect(underWay(v)?.id).toBe("herbalist");
    v.buildings.herbalist.done = true;
    expect(underWay(v)).toBeNull();
    expect(underWay(openSite(v))?.id).toBe("training");
    expect(openSite(openSite(openSite(openSite(openSite(empty()))))).open).toBe(4);
  });

  it("takes only what the building still needs, and what you have", () => {
    const v = openSite(empty());
    const need = BUILDINGS[0];
    const jelly = need.needs.jelly!;
    const d = donation(v, { items: { jelly: jelly + 50, stone: 3 }, gold: need.gold + 1 }, { jelly: jelly + 50, stone: 3 }, need.gold + 1)!;
    expect(d.take).toEqual({ items: { jelly }, gold: need.gold });
    expect(d.points).toBe(need.gold + jelly * 5);
    expect(donation(v, { items: { jelly: 10 }, gold: 0 }, { jelly: 2 }, 0)!.take.items.jelly).toBe(2);
    expect(donation(v, { items: {}, gold: 0 }, {}, 0)).toBeNull();
    expect(donation(empty(), { items: {}, gold: 5 }, {}, 5)).toBeNull();
  });

  it("finishes the building when the last of it comes, and pays its givers by their points", () => {
    let v = openSite(empty());
    const need = BUILDINGS[0];
    v = giveTo(v, "herbalist", { items: { jelly: need.needs.jelly! }, gold: need.gold - 100 }, 1000, "a", "Ann");
    expect(v.buildings.herbalist.done).toBe(false);
    v = giveTo(v, "herbalist", { items: {}, gold: 100 }, 100, "b", "Bo");
    expect(v.buildings.herbalist.done).toBe(true);
    expect(completionRewards(v.buildings.herbalist)).toEqual({ a: { gold: 200, xp: 1000 }, b: { gold: 20, xp: 100 } });
  });

  it("gives the whole server each building's perk once it stands", () => {
    expect(potionPriceFactor(empty())).toBe(1);
    expect(potionPriceFactor(doneVillage(["herbalist"]))).toBe(0.8);
    expect(huntXpFactor(doneVillage(["training"]))).toBe(1.05);
    expect(deathLossFactor(doneVillage(["inn"]))).toBe(0.5);
    expect(allBuilt(doneVillage(["herbalist", "training", "inn", "watchtower"]))).toBe(true);
  });
});

describe("each hunter's share", () => {
  it("marks a hunter once a week, keeping last week's for its rewards", () => {
    const a = markHunted(readUserGrove(null), "W1")!;
    expect(a).toMatchObject({ week: "W1", claimed: 0, prev: null });
    expect(markHunted(a, "W1")).toBeNull();
    expect(markHunted({ ...a, claimed: 1 }, "W2")).toMatchObject({ week: "W2", claimed: 0, prev: { week: "W1", claimed: 1 } });
  });

  it("pays each stage reached once, this week's and last week's, and what a finished building owes", () => {
    const record: GroveRecord = { week: "W2", kills: 2000, paid: 2, lastWeek: { week: "W1", paid: 3 } };
    const user = { week: "W2", claimed: 1 as const, prev: { week: "W1", claimed: 1 as const }, pending: { gold: 40, xp: 70 } };
    const out = settle(user, record, empty());
    // This week stage 2 opened a site (no gold); last week stages 2 and 3 (site, then 500).
    expect(out.gold).toBe(500 + 40);
    expect(out.xp).toBe(70);
    expect(out.user).toEqual({ week: "W2", claimed: 2, prev: { week: "W1", claimed: 3 }, pending: { gold: 0, xp: 0 } });
    expect(settle(out.user, record, empty()).gold).toBe(0);
    // With every building up, stage 2 pays gold instead.
    const late = settle({ week: "W2", claimed: 1, prev: null, pending: { gold: 0, xp: 0 } }, record, doneVillage(["herbalist", "training", "inn", "watchtower"]));
    expect(late.gold).toBe(300);
  });

  it("shows the week and the village as the screen needs them", () => {
    const record: GroveRecord = { week: weekOf(MONDAY_KST), kills: 1200, paid: 1, lastWeek: null };
    const view = groveView(record, openSite(empty()), MONDAY_KST + 86_400_000);
    expect(view).toMatchObject({ kills: 1200, goal: PURIFY_GOAL, stage: 1, daysLeft: 6 });
    expect(view.buildings.map((b) => b.state)).toEqual(["building", "closed", "closed", "closed"]);
    // A new week that has not been added to yet reads as nothing.
    expect(groveView(record, empty(), MONDAY_KST + 8 * 86_400_000)).toMatchObject({ kills: 0, stage: 0 });
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run tests/world/grove.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** — `src/game/world/grove.ts`:

```ts
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

export interface GroveRecord { week: string; kills: number; paid: Stage; lastWeek: { week: string; paid: Stage } | null }

export function readGrove(raw: unknown): GroveRecord {
  const r = isObject(raw) ? raw : {};
  if (typeof r.week !== "string") return { week: "", kills: 0, paid: 0, lastWeek: null };
  const last = isObject(r.lastWeek) && typeof r.lastWeek.week === "string" ? { week: r.lastWeek.week, paid: readStage(r.lastWeek.paid) } : null;
  return { week: r.week, kills: count(r.kills), paid: readStage(r.paid), lastWeek: last };
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
```

- [ ] **Step 4:** `npx vitest run tests/world/grove.test.ts` → PASS. 실패하면 테스트 기대값이 아니라 규칙을 스펙과 맞춘다(젤리 판매가 5, 30/60/100%).
- [ ] **Step 5:** 세 검사 후 커밋 `feat: the grove's week and the village's rebuilding as shared rules`.

---

### Task 2: 마을 지도에 터 4곳

**Files:** Modify `src/game/world/zones.ts`; Test `tests/world/zones.test.ts`

- [ ] **Step 1: 테스트 추가** (`tests/world/zones.test.ts` 끝의 describe 안):

```ts
  it("keeps the village's four building sites as solid ground, clear of the paths and the NPCs", () => {
    const layout = zoneLayout("village");
    for (const b of BUILDINGS) {
      for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expect(layout.solid[b.at[1] + dr][b.at[0] + dc]).toBe(true);
    }
    for (const id of ["merchant", "elder", "smith"] as const) {
      const spot = npcSpot(id);
      expect(solidAt(layout, spot.x, spot.z)).toBe(false);
    }
  });
```

(import `BUILDINGS` from `../../src/game/world/grove`, `npcSpot` from `../../src/game/world/npcs`, `solidAt` from `../../src/game/rules/levelLayout` if missing.)

- [ ] **Step 2:** 실패 확인.
- [ ] **Step 3: 구현** — `zones.ts`의 마을 `fieldMap` 호출에서 `houses: VILLAGE_HOUSES` 를 `houses: [...VILLAGE_HOUSES, ...VILLAGE_SITES]` 로, 파일 위쪽에:

```ts
import { BUILDINGS } from "./grove";

// The village's four building sites (see grove.ts): ruins now, built up by the players. They block the
// map like houses from the start, so the map never changes as they go up.
const VILLAGE_SITES: House[] = BUILDINGS.map((b) => ({ model: b.model, at: b.at, face: b.face }));
```

`ZONES.village.houses`는 `VILLAGE_HOUSES` 그대로 둔다(WorldView는 기존 집만 그리고, 터는 groveScene이 그린다).
- [ ] **Step 4:** 테스트 → PASS. 전체 `npx vitest run`에서 지도·경로 테스트가 깨지면 터 좌표를 빈 땅으로 옮긴다(후보 모두 확인된 빈 칸: [26,4], [22,9], [6,20], [27,19]). 지도를 출력해 포탈·NPC 문 앞·스폰이 막히지 않았는지 본다.
- [ ] **Step 5:** 커밋 `feat: the village keeps four building sites for the rebuilding`.

---

### Task 3: 수호자 몬스터

**Files:** `src/game/world/monsters.ts`, `src/game/render/monsterLooks.ts`, `src/ui/strings/*.ts`, `tests/world/respawn.test.ts`

- [ ] **Step 1: 테스트** (`tests/world/respawn.test.ts`에):

```ts
  it("never hurries the grove's guardian back", () => {
    expect(respawnDelay("grove_guardian", 10)).toBe(MONSTERS.grove_guardian.respawnMs);
  });
```

- [ ] **Step 2:** 실패 확인(`grove_guardian` 없음).
- [ ] **Step 3: 구현** — `MonsterType`에 `"grove_guardian"`, `MONSTERS`에:

```ts
  // Called up in the first field when the grove is cleansed (see grove.ts); once felled it is gone
  // for the week.
  grove_guardian: {
    ...common, level: 12, hp: 8000, damage: 30, range: 2.4, attackMs: 1600, speed: 1.6, aggro: 14, body: 0.8, xp: 3000,
    respawnMs: 8 * 86_400_000, gold: [500, 800],
    drops: [{ item: "potion_big", chance: 1 }, { item: "potion_big", chance: 1 }, { item: "potion_big", chance: 1 }, { item: "spore", chance: 1 }],
  },
```

`export const GROVE_GUARDIAN_ZONE: ZoneId = "forest1";` 추가. `respawnDelay`의 조건을 들판 몬스터만 빨라지게 바꾼다:

```ts
  if (!Object.values(ZONE_MONSTERS).some((kinds) => kinds.includes(type)) || full <= RESPAWN_FLOOR_MS) return full;
```

(주석도 "A boss, the guardian and the boss's brood keep their own clocks."로.) `monsterLooks.ts`에:

```ts
  // The grove's guardian: the Mushroom King's model, smaller and green with the forest.
  grove_guardian: { model: "mon_mushroom_king", look: { ...MUSHROOM_KING_LOOK, height: <버섯왕 height × 0.7>, tint: 0x9dffb0 } },
```

(버섯왕 항목의 look을 상수로 빼서 같이 쓴다.) 5개 언어에 `"monster.grove_guardian"`: 정화의 수호자 / Grove Guardian / 浄化の守護者 / 淨化守護者 / 净化守护者. `tsc`가 알려주는 다른 `Record<MonsterType, …>`도 채운다.
- [ ] **Step 4:** 세 검사 PASS.
- [ ] **Step 5:** 커밋 `feat: the grove's guardian`.

---

### Task 4: 서버 — 기록, 처치 합치기, 사냥 표시, 수호자 소환

**Files:** Create `server/src/grove.ts`; Modify `server/src/server.ts`; Test `server/test/grove.test.ts`

**Interfaces — Produces (server/src/grove.ts):**
- `withGroveLock<T>(world, fn)`, `readGroveRecord(world): Promise<{ id: string | null; record: GroveRecord }>`, `writeGroveRecord(world, id, record)`
- `readVillageRecord(world)`, `writeVillageRecord(world, id, village)`, `villageOf(world): Promise<VillageRecord>` (30초 캐시, 쓰기 때 갱신)
- `countGroveKills(roomId, n)` (방 잠금 안에서 `groveKills += n`)
- `flushRoom(world, zone, roomId, delta, now)` — `$roomTick`이 부름
- `markHunter(account, world, now)`

- [ ] **Step 1: 서버 테스트** `server/test/grove.test.ts`:

```ts
import { PURIFY_GOAL, weekOf } from "../../src/game/world/grove";
import { portalsOf, zoneLayout } from "../../src/game/world/zones";
import { enterAs, join, makeCharacter, walkTo } from "./helpers";

async function inForest(server: any, account = "test-a"): Promise<any> {
  await makeCharacter(server, account, `숲${account.slice(-1)}`);
  const village = await enterAs(server, account);
  const portal = portalsOf("village").find((p) => p.to === "forest1")!;
  await walkTo(server, portal.x, portal.z);
  return join(server, account, await server.travel("forest1"), village.roomId);
}

async function killOne(server: any): Promise<void> {
  const spawn = zoneLayout("forest1").playerSpawn;
  await walkTo(server, spawn.x, spawn.z, 0);
  await $room.updateRoomState({
    monsters: {
      m0: {
        type: "green_blob", x: spawn.x, z: spawn.z - 1.5, yaw: 0, hp: 1, alive: true, stunnedUntil: 0, attackReadyAt: 0,
        respawnAt: 0, homeX: spawn.x, homeZ: spawn.z - 1.5,
      },
    },
  });
  await server.strike("m0");
  await $room.updateMyState({ strikeReadyAt: 0 });
}

describe("the grove", () => {
  test("kills wait in the room and join the server's record after ten seconds of ticks", async (server) => {
    const entry = await inForest(server);
    await killOne(server);
    expect((await $room.getRoomState()).groveKills).toBe(1);
    expect((await server.grove()).kills).toBe(0);
    await server.simulateTick(entry.roomId, 10_000);
    expect((await server.grove()).kills).toBe(1);
    expect((await $room.getRoomState()).groveKills).toBe(0);
  });

  test("a hunter is marked for this week's rewards", async (server) => {
    await inForest(server);
    await killOne(server);
    const state = await $global.getUserState("test-a");
    expect(state.grove[Object.keys(state.grove)[0]].week).toBe(weekOf(Date.now()));
  });

  test("passing stage 2 opens a site, once a week", async (server) => {
    const entry = await inForest(server);
    await $room.updateRoomState({ groveKills: PURIFY_GOAL * 0.6 });
    await server.simulateTick(entry.roomId, 10_000);
    const view = await server.grove();
    expect(view.stage).toBe(2);
    expect(view.buildings[0].state).toBe("building");
    await $room.updateRoomState({ groveKills: 10 });
    await server.simulateTick(entry.roomId, 10_000);
    expect((await server.grove()).buildings[1].state).toBe("closed");
  });

  test("the guardian comes to the first field once the grove is cleansed", async (server) => {
    const entry = await inForest(server);
    await $room.updateRoomState({ groveKills: PURIFY_GOAL });
    await server.simulateTick(entry.roomId, 10_000);
    await server.simulateTick(entry.roomId, 200);
    const monsters = (await $room.getRoomState()).monsters;
    expect(Object.values(monsters).some((m: any) => m.type === "grove_guardian" && m.alive)).toBe(true);
  });
});
```

- [ ] **Step 2:** `npm run server:test -- grove` → FAIL.

- [ ] **Step 3: `server/src/grove.ts`**:

```ts
import {
  FLUSH_MS, addKills, groveView, markHunted, openSite, readGrove, readUserGrove, readVillage, weekOf,
  type GroveRecord, type GroveView, type VillageRecord,
} from "../../src/game/world/grove";
import { GROVE_GUARDIAN_ZONE, MONSTERS, type MonsterState } from "../../src/game/world/monsters";
import { zoneLayout, type ZoneId } from "../../src/game/world/zones";
import { withRoomLock } from "./hunt";

// A server's grove and village records (one item each in these collections), and the room side of
// the grove: kills counted in the room and added to the record every FLUSH_MS of ticks.
const GROVE_COLLECTION = "grove";
const VILLAGE_COLLECTION = "village";
// Perks are read on every kill; the village is kept this long between reads (a write refreshes it).
const VILLAGE_CACHE_MS = 30_000;

export function withGroveLock<T>(world: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`grove-${world}`, fn);
}

async function readItem(collection: string, world: string): Promise<{ id: string | null; raw: unknown }> {
  const [item] = await $global.getCollectionItems(collection, { filters: [{ field: "world", operator: "==", value: world }], limit: 1 });
  return { id: (item as { __id?: string } | undefined)?.__id ?? null, raw: item ?? null };
}

async function writeItem(collection: string, world: string, id: string | null, value: object): Promise<void> {
  if (id) await $global.updateCollectionItem(collection, { __id: id, world, ...value });
  else await $global.addCollectionItem(collection, { world, ...value });
}

export async function readGroveRecord(world: string): Promise<{ id: string | null; record: GroveRecord }> {
  const { id, raw } = await readItem(GROVE_COLLECTION, world);
  return { id, record: readGrove(raw) };
}

export async function readVillageRecord(world: string): Promise<{ id: string | null; village: VillageRecord }> {
  const { id, raw } = await readItem(VILLAGE_COLLECTION, world);
  return { id, village: readVillage(raw) };
}

const villageCache = new Map<string, { at: number; village: VillageRecord }>();

export async function writeVillageRecord(world: string, id: string | null, village: VillageRecord): Promise<void> {
  await writeItem(VILLAGE_COLLECTION, world, id, village);
  villageCache.set(world, { at: Date.now(), village });
}

export async function villageOf(world: string): Promise<VillageRecord> {
  const cached = villageCache.get(world);
  if (cached && Date.now() - cached.at < VILLAGE_CACHE_MS) return cached.village;
  const { village } = await readVillageRecord(world);
  villageCache.set(world, { at: Date.now(), village });
  return village;
}

export async function viewOf(world: string, now: number): Promise<GroveView> {
  const [{ record }, { village }] = await Promise.all([readGroveRecord(world), readVillageRecord(world)]);
  return groveView(record, village, now);
}

// Kills felled in a room, counted there until the next flush.
export async function countGroveKills(roomId: string, n: number): Promise<void> {
  if (n <= 0) return;
  await withRoomLock(roomId, async () => {
    const { groveKills } = await $room.getRoomState(["groveKills"]);
    await $room.updateRoomState({ groveKills: (typeof groveKills === "number" ? groveKills : 0) + n });
  });
}

// Marks an account as having hunted on this server this week (written once a week).
export async function markHunter(account: string, world: string, now: number): Promise<void> {
  const all = (await $global.getUserState(account)).grove;
  const mine = readUserGrove(all && typeof all === "object" ? (all as Record<string, unknown>)[world] : null);
  const next = markHunted(mine, weekOf(now));
  if (next) await $global.updateUserState(account, { grove: { ...(all ?? {}), [world]: next } });
}

// Every tick: once FLUSH_MS of ticks have passed, the room's kills go into the server's record (which
// may open a site), and the first field calls up the guardian in a week the grove was cleansed.
// How much of each room's ticks has passed since it last flushed. Kept in memory, not in the room:
// writing it every tick would be a room write five times a second. A restart only delays a flush.
const sinceFlush = new Map<string, number>();

export async function flushRoom(world: string, zone: ZoneId, roomId: string, delta: number, now: number): Promise<void> {
  const since = (sinceFlush.get(roomId) ?? 0) + delta;
  sinceFlush.set(roomId, since);
  if (since < FLUSH_MS) return;
  sinceFlush.set(roomId, 0);
  const state = await $room.getRoomState(["groveKills", "guardianWeek"]);
  const kills = typeof state.groveKills === "number" ? state.groveKills : 0;
  const record = await withGroveLock(world, async () => {
    const { id, record } = await readGroveRecord(world);
    const added = addKills(record, kills, now);
    if (kills > 0 || added.record.week !== record.week) await writeItem(GROVE_COLLECTION, world, id, added.record);
    if (added.opened) {
      const { id: villageId, village } = await readVillageRecord(world);
      await writeVillageRecord(world, villageId, openSite(village));
    }
    return added.record;
  });
  await withRoomLock(roomId, async () => {
    const latest = (await $room.getRoomState(["groveKills"])).groveKills;
    await $room.updateRoomState({ groveKills: Math.max(0, (typeof latest === "number" ? latest : 0) - kills) });
    if (zone === GROVE_GUARDIAN_ZONE && record.paid >= 3 && state.guardianWeek !== record.week) {
      const monsters = ((await $room.getRoomState(["monsters"])).monsters ?? {}) as Record<string, MonsterState>;
      const at = guardianSpot();
      monsters.guardian = {
        type: "grove_guardian", x: at.x, z: at.z, yaw: 0, hp: MONSTERS.grove_guardian.hp, alive: true, stunnedUntil: 0,
        attackReadyAt: 0, respawnAt: 0, homeX: at.x, homeZ: at.z,
      };
      await $room.updateRoomState({ monsters, guardianWeek: record.week });
    }
  });
}

// Where the guardian stands: the monster spot nearest the middle of the first field.
function guardianSpot(): { x: number; z: number } {
  const layout = zoneLayout(GROVE_GUARDIAN_ZONE);
  const mid = { x: (layout.cols * layout.tileSize) / 2, z: (layout.rows * layout.tileSize) / 2 };
  return [...layout.zombieSpawns].sort((a, b) => Math.hypot(a.x - mid.x, a.z - mid.z) - Math.hypot(b.x - mid.x, b.z - mid.z))[0];
}
```

- [ ] **Step 4: `server.ts` 연결**
  - import: `import { countGroveKills, flushRoom, markHunter, viewOf } from "./grove";`
  - `reward()`: `if (result.kills.length === 0) return result;` 다음 줄에
    ```ts
    const here = readChannelRoom(roomId);
    await countGroveKills(roomId, result.kills.length);
    ```
    끝의 `for (const [account, pay] of pays) await payHunter(account, roomId, pay);` 앞에
    ```ts
    if (here) for (const account of pays.keys()) await markHunter(account, here.world, Date.now());
    ```
  - `$roomTick`:
    ```ts
    const fell = await withRoomLock(roomId, () => tickRoom(here.zone, delta, Date.now()));
    for (const account of fell) await fallen(account, roomId);
    await flushRoom(here.world, here.zone, roomId, delta, Date.now());
    ```
  - 새 엔드포인트(`getBag` 위):
    ```ts
    // The server's grove this week and its village (the "숲" panel and the world's look).
    async grove(): Promise<GroveView> {
      return viewOf((await readAccountWorld($sender.account)).id, Date.now());
    }
    ```
    (`GroveView` import는 `../../src/game/world/grove`에서.)
  - `readChannelRoom(roomId)`가 돌려주는 `world`를 확인한다(`{ world, zone, channel }`).
- [ ] **Step 5:** `npm run server:test` 전부 PASS (기존 테스트의 처치 흐름이 느려지지 않았는지도).
- [ ] **Step 6:** 커밋 `feat: kills cleanse the server's grove, ten seconds at a time`.

---

### Task 5: 서버 — 입장 정산, 기부, 혜택

**Files:** `server/src/grove.ts`, `server/src/server.ts`, `server/test/grove.test.ts`

**Interfaces — Produces:** `settleOnArrive(account, world, now): Promise<{ gold: number; xp: number }>`, `giveToVillage(account, world, name, offer, character): Promise<{ take: Offer; village: VillageRecord }>`; 엔드포인트 `donate(rawItems, rawGold): Promise<GroveView>`; `arrive()` 응답에 `grove: { gold, xp } | null`.

- [ ] **Step 1: 테스트 추가** (`server/test/grove.test.ts`):

```ts
import { BUILDINGS, readUserGrove } from "../../src/game/world/grove";
import { ITEMS } from "../../src/game/account/items";
import { errorOf, toNpc } from "./helpers";

async function inVillage(server: any, account = "test-a"): Promise<any> {
  await makeCharacter(server, account, `마을${account.slice(-1)}`);
  return enterAs(server, account);
}

async function openFirstSite(world: string, week: string): Promise<void> {
  await $global.addCollectionItem("grove", { world, week, kills: PURIFY_GOAL * 0.6, paid: 2, lastWeek: null });
  await $global.addCollectionItem("village", { world, open: 1, buildings: {} });
}

describe("the grove's rewards and the village", () => {
  test("a hunter is paid each stage once, on coming in", async (server) => {
    const entry = await inForest(server);
    await killOne(server);
    await $room.updateRoomState({ groveKills: PURIFY_GOAL * 0.3 });
    await server.simulateTick(entry.roomId, 10_000);
    const before = (await server.getBag()).gold;
    const arrived = await server.arrive();
    expect(arrived.grove).toEqual({ gold: 200, xp: 0 });
    expect((await server.getBag()).gold).toBe(before + 200);
    expect((await server.arrive()).grove).toBeNull();
  });

  test("gifts go only to the building under way, from beside the elder, and no more than it needs", async (server) => {
    await inVillage(server);
    const world = (await server.getAccount()).world;
    await openFirstSite(world, weekOf(Date.now()));
    await $asset.mint("gold", 30_000);
    expect(await errorOf(server.donate({ jelly: 1 }, 0))).toContain("not_near");
    await toNpc(server, "elder");
    expect(await errorOf(server.donate({}, 0))).toContain("nothing");
    const view = await server.donate({}, 25_000);
    expect(view.buildings[0].given.gold).toBe(BUILDINGS[0].gold);
    expect((await server.getBag()).gold).toBe(30_000 - BUILDINGS[0].gold);
  });

  test("a finished building pays its givers on coming in, and its perk applies at once", async (server) => {
    await inVillage(server);
    const world = (await server.getAccount()).world;
    await openFirstSite(world, weekOf(Date.now()));
    await $asset.mint("gold", BUILDINGS[0].gold);
    const state = await $global.getUserState("test-a");
    const map = { ...state.characterMap };
    map[state.active] = { ...map[state.active], bag: { ...map[state.active].bag, jelly: BUILDINGS[0].needs.jelly } };
    await $global.updateUserState("test-a", { characterMap: map });
    await toNpc(server, "elder");
    const view = await server.donate({ jelly: BUILDINGS[0].needs.jelly }, BUILDINGS[0].gold);
    expect(view.buildings[0]).toMatchObject({ state: "done", top: ["마을a"] });
    const owed = readUserGrove((await $global.getUserState("test-a")).grove[world]).pending;
    expect(owed.xp).toBe(BUILDINGS[0].gold + BUILDINGS[0].needs.jelly! * 5);
    const arrived = await server.arrive();
    expect(arrived.grove.xp).toBe(owed.xp);
    await toNpc(server, "merchant");
    await $asset.mint("gold", 100);
    const bought = await server.buyItem("potion_small");
    expect(bought.gold).toBe((await server.getBag()).gold);
    expect(100 + owed.gold - bought.gold).toBe(Math.round(ITEMS.potion_small.price! * 0.8));
  });
});
```

- [ ] **Step 2:** 실패 확인.

- [ ] **Step 3: `server/src/grove.ts`에 추가**:

```ts
import { addItem, type ItemId } from "../../src/game/account/items";
import { completionRewards, donation, giveTo, settle, underWay, type Offer } from "../../src/game/world/grove";
import type { Character } from "../../src/game/account/characters";
import { RuleViolation } from "../../src/game/world/types";

async function userGroves(account: string): Promise<Record<string, unknown>> {
  const all = (await $global.getUserState(account)).grove;
  return all && typeof all === "object" ? (all as Record<string, unknown>) : {};
}

// On coming into a zone: the stages owed (this week's and last week's) and what finished buildings
// left the account, paid once. Answers what to pay; the caller mints the gold and adds the XP.
export async function settleOnArrive(account: string, world: string): Promise<{ gold: number; xp: number }> {
  const all = await userGroves(account);
  const user = readUserGrove(all[world]);
  const [{ record }, village] = await Promise.all([readGroveRecord(world), villageOf(world)]);
  const out = settle(user, record, village);
  if (out.gold === 0 && out.xp === 0 && JSON.stringify(out.user) === JSON.stringify(user)) return { gold: 0, xp: 0 };
  await $global.updateUserState(account, { grove: { ...all, [world]: out.user } });
  return { gold: out.gold, xp: out.xp };
}

// A gift to the building under way. Takes no more than it needs; a finished building leaves each
// giver's reward on their account. Answers what was taken and the village after.
export async function giveToVillage(
  account: string, world: string, character: Character, offer: Offer, gold: number,
): Promise<{ take: Offer; village: VillageRecord }> {
  return withGroveLock(world, async () => {
    const { id, village } = await readVillageRecord(world);
    const gift = donation(village, offer, character.bag, gold);
    if (!gift) throw new RuleViolation(underWay(village) ? "nothing" : "no_building");
    const next = giveTo(village, gift.building.id, gift.take, gift.points, account, character.name);
    await writeVillageRecord(world, id, next);
    if (next.buildings[gift.building.id].done) {
      for (const [giver, reward] of Object.entries(completionRewards(next.buildings[gift.building.id]))) {
        const all = await userGroves(giver);
        const user = readUserGrove(all[world]);
        await $global.updateUserState(giver, {
          grove: { ...all, [world]: { ...user, pending: { gold: user.pending.gold + reward.gold, xp: user.pending.xp + reward.xp } } },
        });
      }
    }
    return { take: gift.take, village: next };
  });
}

export function takeFromBag(bag: Character["bag"], take: Offer): Character["bag"] {
  let next = bag;
  for (const [item, n] of Object.entries(take.items) as [ItemId, number][]) next = addItem(next, item, -n);
  return next;
}
```


- [ ] **Step 4: `server.ts`**
  - `arrive()` 끝(`return` 전):
    ```ts
    // What the grove owes: this week's and last week's stages, and finished buildings' thanks.
    const world = (await readAccountWorld(account)).id;
    const owed = await settleOnArrive(account, world);
    if (owed.gold > 0) await $asset.mint(GOLD, owed.gold);
    if (owed.xp > 0) {
      const next = await updateActive(account, (c) => ({ ...c, xp: c.xp + owed.xp }));
      await writeRanking(account, next);
      await refreshFighter(next);
    }
    return { x: spot.x, z: spot.z, grove: owed.gold > 0 || owed.xp > 0 ? owed : null };
    ```
    (반환 타입을 `{ x: number; z: number; grove: { gold: number; xp: number } | null }`로.)
  - `donate`:
    ```ts
    // A gift of materials and gold to the village's building under way, from beside the elder.
    async donate(rawItems: unknown, rawGold: unknown): Promise<GroveView> {
      await requireNpc("elder");
      const account = $sender.account;
      const world = (await readAccountWorld(account)).id;
      const character = await playing(account);
      const items: Partial<Record<ItemId, number>> = {};
      if (rawItems && typeof rawItems === "object") {
        for (const [id, n] of Object.entries(rawItems as Record<string, unknown>)) {
          const item = readItemId(id);
          if (item && typeof n === "number" && Number.isInteger(n) && n > 0) items[item] = n;
        }
      }
      const offered = typeof rawGold === "number" && Number.isInteger(rawGold) && rawGold > 0 ? rawGold : 0;
      const held = await $asset.get(GOLD);
      const { take } = await giveToVillage(account, world, character, { items, gold: offered }, held);
      if (take.gold > 0) await $asset.burn(GOLD, take.gold);
      try {
        await updateActive(account, (c) => ({ ...c, bag: takeFromBag(c.bag, take) }));
      } catch (error) {
        if (take.gold > 0) await $asset.mint(GOLD, take.gold);
        throw error;
      }
      return viewOf(world, Date.now());
    }
    ```
  - 혜택:
    - `buyItem`: `const price = ITEMS[item].price;` 다음에 물약이면 할인: `const unit = ITEMS[item].kind === "potion" ? Math.round(price * potionPriceFactor(await villageOf(world))) : price;` → `const cost = unit * n;` (`world`는 `readAccountWorld`로).
    - `payHunter`: 맨 앞에 `const here = readChannelRoom(roomId); const factor = here ? huntXpFactor(await villageOf(here.world)) : 1; const xp = Math.round(pay.xp * factor);` 그리고 `pay.xp` 대신 `xp`를 쓴다(보여주는 payout의 xp도).
    - `fallen`: `lost = Math.round(deathXpLoss(c.xp) * factor)` (factor = `deathLossFactor(await villageOf(world))`, `world`는 `readChannelRoom(roomId)`).
- [ ] **Step 5:** `npm run server:test` 전부 PASS.
- [ ] **Step 6:** 커밋 `feat: the grove pays its hunters, and the village takes gifts and gives back`.

---

### Task 6: 클라이언트 — grove 호출, 입장 보상 알림

**Files:** `src/net/worldClient.ts`, `src/game/world/dialogue.ts`, `tests/world/dialogue.test.ts`

- [ ] **Step 1: 테스트** (`tests/world/dialogue.test.ts`):

```ts
  it("lets the elder take gifts while a building is under way", () => {
    expect(dialogueChoices("elder", on(0, 0), true)).toEqual(["seek", "donate", "close"]);
    expect(dialogueChoices("elder", on(0, 0, 1), true)).toEqual(["close"]);
    expect(dialogueChoices("merchant", null, true)).toEqual(["shop", "close"]);
  });
```

- [ ] **Step 2:** 실패 확인.
- [ ] **Step 3: 구현**
  - `dialogue.ts`: `DialogueChoice`에 `"donate"`. `dialogueChoices(id, state, building = false)` — 촌장이고 튜토리얼이 아니면 `[quest choice?, building ? "donate" : null, "close"]`에서 null 뺀 것. 퀘스트가 다 끝났어도 `building`이면 `["donate", "close"]`.
  - `worldClient.ts`:
    ```ts
    // The server's grove and village (null when it could not be read).
    async grove(): Promise<GroveView | null> {
      return await this.transport.call<GroveView>("grove").catch(() => null);
    }

    // A gift to the village's building under way: the grove after it, or why it was refused.
    async donate(items: Partial<Record<ItemId, number>>, gold: number): Promise<GroveView | string> {
      try {
        const view = await this.transport.call<GroveView>("donate", [items, gold]);
        void this.refreshBag();
        return view;
      } catch (error) {
        return errorCode(error) ?? "unavailable";
      }
    }
    ```
    `arrive` 호출: `const arrived = await this.transport.call<{ grove?: { gold: number; xp: number } | null }>("arrive");` 뒤에 `if (arrived?.grove) { this.payouts.push({ xp: arrived.grove.xp, gold: arrived.grove.gold, items: [] }); void this.refreshBag(); }`.
- [ ] **Step 4:** 세 검사 PASS. 커밋 `feat: the client reads the grove, gives to the village and hears what it paid`.

---

### Task 7: 화면 — 숲 패널, 기부 패널, 메뉴, 문구

**Files:** Create `src/ui/GrovePanel.tsx`, `src/ui/DonatePanel.tsx`; Modify `src/ui/WorldScreen.tsx`, `src/ui/DialogueBox.tsx`, `src/game/render/icons.ts`, `src/ui/strings/*.ts`, `src/index.css`; asset `public/assets/ui/icons/ui_grove.png`

- [ ] **Step 1: 아이콘** — PixelLab `create_image_pixflux`(32×32, 배경 없음, "a small green sapling growing from a glowing leaf, forest purification, RPG icon, black outline")로 만들어 `public/assets/ui/icons/ui_grove.png`에 받고, `ICON_IDS`에 `"ui_grove"`, provenance 표에 한 줄.

- [ ] **Step 2: 문구** (5개 언어, ko 기준 — en/ja/zhHant/zhHans도 같은 키):

| 키 | ko | en | ja | zhHant | zhHans |
|---|---|---|---|---|---|
| `menu.grove` | 숲 | Grove | 森 | 森林 | 森林 |
| `grove.title` | 숲 정화 | Grove Purification | 森の浄化 | 森林淨化 | 森林净化 |
| `grove.kills` | 이번 주 {n} / {goal}마리 | This week {n} / {goal} | 今週 {n} / {goal}体 | 本週 {n} / {goal} 隻 | 本周 {n} / {goal} 只 |
| `grove.daysLeft` | {n}일 남음 | {n} days left | 残り{n}日 | 剩 {n} 天 | 剩 {n} 天 |
| `grove.stage.1` | 30% 꽃이 피고 골드 200 | 30% Flowers bloom, 200 gold | 30% 花が咲き 200G | 30% 花開，金幣 200 | 30% 花开，金币 200 |
| `grove.stage.2` | 60% 하늘이 맑아지고 건물 터가 열림 | 60% Clear skies, a site opens | 60% 空が晴れ、建設地が開く | 60% 天空放晴，開放建地 | 60% 天空放晴，开放建地 |
| `grove.stage.3` | 100% 정화의 수호자, 골드 500 | 100% The Guardian, 500 gold | 100% 浄化の守護者、500G | 100% 淨化守護者，金幣 500 | 100% 净化守护者，金币 500 |
| `grove.village` | 마을 복구 | Village Rebuilding | 村の復興 | 村莊重建 | 村庄重建 |
| `grove.building.herbalist` | 약초상 | Herbalist | 薬草屋 | 藥草鋪 | 药草铺 |
| `grove.building.training` | 훈련소 | Training Ground | 訓練所 | 訓練場 | 训练场 |
| `grove.building.inn` | 여관 | Inn | 宿屋 | 旅店 | 旅店 |
| `grove.building.watchtower` | 망루 | Watchtower | 物見櫓 | 瞭望塔 | 瞭望塔 |
| `grove.perk.herbalist` | 물약 값 -20% | Potions 20% off | 薬 -20% | 藥水 -20% | 药水 -20% |
| `grove.perk.training` | 사냥 경험치 +5% | Hunting XP +5% | 狩り経験値 +5% | 狩獵經驗 +5% | 狩猎经验 +5% |
| `grove.perk.inn` | 쓰러질 때 잃는 경험치 절반 | Half the XP lost on falling | 倒れた時の経験値損失半分 | 倒下損失經驗減半 | 倒下损失经验减半 |
| `grove.perk.watchtower` | 미니맵에 보스 표시 | Bosses on the minimap | ミニマップにボス表示 | 小地圖顯示首領 | 小地图显示首领 |
| `grove.closed` | 닫힘 | Not open | 未開放 | 未開放 | 未开放 |
| `grove.building` | 짓는 중 {n}% | Building {n}% | 建設中 {n}% | 建造中 {n}% | 建造中 {n}% |
| `grove.done` | 완공 | Built | 完成 | 完工 | 完工 |
| `grove.failed` | 불러오지 못했어요 | Could not load | 読み込めませんでした | 無法載入 | 无法载入 |
| `dialogue.donate` | 기부하기 | Donate | 寄付する | 捐獻 | 捐献 |
| `donate.title` | {building} 짓기 | Build the {building} | {building}を建てる | 建造{building} | 建造{building} |
| `donate.have` | 가진 것 {n} | You have {n} | 所持 {n} | 持有 {n} | 持有 {n} |
| `donate.gold` | 골드 | Gold | ゴールド | 金幣 | 金币 |
| `donate.done` | 고맙네! 자네 이름을 새겨 두지. | Thank you! Your name will be remembered. | ありがとう！名前は刻んでおくよ。 | 謝謝！會記住你的名字。 | 谢谢！会记住你的名字。 |
| `problem.nothing` | 넣을 것을 골라 주세요 | Choose something to give | 寄付するものを選んでください | 請選擇要捐的東西 | 请选择要捐的东西 |
| `problem.no_building` | 지금 지을 건물이 없어요 | Nothing is being built | 建設中の建物がありません | 目前沒有建造中的建築 | 目前没有建造中的建筑 |

- [ ] **Step 3: `GrovePanel.tsx`** (모달, 800×450 한 화면):

```tsx
import { t, type Key } from "./lang";
import type { GroveView } from "../game/world/grove";

interface GrovePanelProps { view: GroveView | null; failed: boolean; onClose: () => void }

// This week's grove on the server and the village it is rebuilding: how many monsters have fallen
// against the goal, the stages and what each brings, and the four buildings with their perks and top
// givers.
export function GrovePanel({ view, failed, onClose }: GrovePanelProps) {
  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel grove-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("grove.title")}</h2>
        {!view && <p className="note">{failed ? t("grove.failed") : t("common.loading")}</p>}
        {view && (
          <>
            <div className="grove-gauge"><i style={{ width: `${Math.min(100, (view.kills / view.goal) * 100)}%` }} /></div>
            <p className="grove-count">
              <span>{t("grove.kills", { n: view.kills.toLocaleString(), goal: view.goal.toLocaleString() })}</span>
              <span className="note">{t("grove.daysLeft", { n: view.daysLeft })}</span>
            </p>
            <ol className="grove-stages">
              {([1, 2, 3] as const).map((s) => (
                <li key={s} className={view.stage >= s ? "on" : ""}>{t(`grove.stage.${s}` as Key)}</li>
              ))}
            </ol>
            <h3>{t("grove.village")}</h3>
            <ul className="grove-buildings">
              {view.buildings.map((b) => (
                <li key={b.id} className={b.state}>
                  <b>{t(`grove.building.${b.id}` as Key)}</b>
                  <span className="note">{t(`grove.perk.${b.id}` as Key)}</span>
                  <span className="grove-state">
                    {b.state === "done" ? t("grove.done") : b.state === "building" ? t("grove.building", { n: Math.floor(b.share * 100) }) : t("grove.closed")}
                  </span>
                  {b.top.length > 0 && <span className="grove-top">{b.top.join(" · ")}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `DonatePanel.tsx`**:

```tsx
import { useState } from "react";
import { t, type Key } from "./lang";
import { itemName } from "./names";
import { iconFor } from "../game/render/icons";
import { BUILDINGS, type GroveView } from "../game/world/grove";
import type { BagView, ItemId } from "../game/account/items";

const PROBLEM: Record<string, Key> = {
  not_near: "problem.not_near_elder", nothing: "problem.nothing", no_building: "problem.no_building",
  not_enough_gold: "problem.not_enough_gold", no_item: "problem.no_item",
};

interface DonatePanelProps {
  view: GroveView;
  bag: BagView | null;
  onDonate: (items: Partial<Record<ItemId, number>>, gold: number) => Promise<string | null>;
  onClose: () => void;
}

// Giving to the building under way, from beside the elder: each thing it needs, how much has come
// in, what you hold, and how much of it to give; and gold.
export function DonatePanel({ view, bag, onDonate, onClose }: DonatePanelProps) {
  const going = view.buildings.find((b) => b.state === "building");
  const building = BUILDINGS.find((b) => b.id === going?.id);
  const [items, setItems] = useState<Partial<Record<ItemId, number>>>({});
  const [gold, setGold] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!going || !building) {
    return (
      <div className="menu-modal" onClick={onClose}>
        <div className="solid-panel donate-panel" onClick={(e) => e.stopPropagation()}>
          <p className="note">{t("problem.no_building")}</p>
          <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    );
  }
  const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.floor(Number.isFinite(n) ? n : 0)));
  const give = async () => {
    setBusy(true);
    setNote(null);
    const code = await onDonate(items, gold);
    setBusy(false);
    setNote(code ? t(PROBLEM[code] ?? "problem.retryLater") : t("donate.done"));
    if (!code) {
      setItems({});
      setGold(0);
    }
  };
  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel donate-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("donate.title", { building: t(`grove.building.${building.id}` as Key) })}</h2>
        <ul className="donate-needs">
          {(Object.entries(building.needs) as [ItemId, number][]).map(([id, need]) => {
            const have = bag?.bag[id] ?? 0;
            const room = need - (going.given.items[id] ?? 0);
            return (
              <li key={id}>
                <img src={iconFor(id) ?? undefined} alt="" />
                <b>{itemName(id)}</b>
                <span className="note">{going.given.items[id] ?? 0} / {need}</span>
                <span className="note">{t("donate.have", { n: have })}</span>
                <input
                  type="number" min={0} max={Math.min(have, room)} value={items[id] ?? 0}
                  onChange={(e) => setItems({ ...items, [id]: clamp(Number(e.target.value), Math.min(have, room)) })}
                />
              </li>
            );
          })}
          <li>
            <b>{t("donate.gold")}</b>
            <span className="note">{going.given.gold.toLocaleString()} / {building.gold.toLocaleString()}</span>
            <span className="note">{t("donate.have", { n: (bag?.gold ?? 0).toLocaleString() })}</span>
            <input
              type="number" min={0} step={100} value={gold}
              onChange={(e) => setGold(clamp(Number(e.target.value), Math.min(bag?.gold ?? 0, building.gold - going.given.gold)))}
            />
          </li>
        </ul>
        {note && <p className="bag-problem">{note}</p>}
        <div className="delete-actions">
          <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
          <button type="button" className="brush-button small" disabled={busy} onClick={() => void give()}>{t("dialogue.donate")}</button>
        </div>
      </div>
    </div>
  );
}
```

(`problem.not_enough_gold`, `problem.no_item`, `problem.retryLater` 키가 있는지 확인하고 없으면 기존 이름을 쓴다.)

- [ ] **Step 5: WorldScreen 연결**
  - `Panel`에 `"grove" | "donate"`. state `const [grove, setGrove] = useState<GroveView | null>(null); const [groveFailed, setGroveFailed] = useState(false);`
  - 1분마다 + 처음:
    ```ts
    useEffect(() => {
      let live = true;
      const load = () => void client.grove().then((next) => {
        if (!live) return;
        if (next) setGrove(next);
        else setGroveFailed(true);
      });
      load();
      const timer = setInterval(load, 60_000);
      return () => {
        live = false;
        clearInterval(timer);
      };
    }, [client]);
    useEffect(() => view.current?.setGrove(grove), [grove, ready]);
    ```
  - 메뉴 항목(`quests` 다음): `{ id: "grove", label: t("menu.grove"), key: "G", code: "KeyG", act: () => toggle("grove"), on: panel === "grove" }`.
  - 패널: `{panel === "grove" && <GrovePanel view={grove} failed={groveFailed} onClose={() => setPanel(null)} />}`, `{panel === "donate" && grove && <DonatePanel view={grove} bag={bag} onDonate={async (items, gold) => { const r = await client.donate(items, gold); if (typeof r === "string") return r; setGrove(r); return null; }} onClose={() => setPanel(null)} />}`.
  - `DialogueBox`에 `building={grove?.buildings.some((b) => b.state === "building") ?? false}` 넘기고, 선택 `donate` → `setPanel("donate")`.
- [ ] **Step 6: `DialogueBox`**: prop `building: boolean` → `dialogueChoices(id, state, building)`, `CHOICE_LABEL.donate = "dialogue.donate"`.
- [ ] **Step 7: CSS** (`src/index.css`, 패널 스타일 근처):

```css
/* The grove this week and the village it is rebuilding, in one screen. */
.grove-panel { width: min(520px, 94%); gap: 8px; }
.grove-gauge { height: 12px; border-radius: 6px; background: rgba(255, 255, 255, 0.1); overflow: hidden; }
.grove-gauge i { display: block; height: 100%; background: linear-gradient(90deg, #7fd48a, #d9f6a2); }
.grove-count { display: flex; justify-content: space-between; margin: 0; font-size: 13px; }
.grove-stages { display: flex; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 11px; color: var(--ink-dim); }
.grove-stages li { flex: 1; padding: 4px 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); }
.grove-stages li.on { color: #1a120b; background: #9dffb0; }
.grove-panel h3 { margin: 4px 0 0; font: 700 14px var(--font-head); }
.grove-buildings { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 0; padding: 0; list-style: none; }
.grove-buildings li { display: flex; flex-direction: column; gap: 1px; padding: 6px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); font-size: 11px; }
.grove-buildings li.done { background: rgba(157, 255, 176, 0.14); }
.grove-buildings li.closed { opacity: 0.6; }
.grove-state { color: var(--ember); }
.grove-top { color: #ffd36a; }
.donate-panel { width: min(460px, 94%); gap: 8px; }
.donate-needs { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.donate-needs li { display: grid; grid-template-columns: 24px 1fr auto auto 80px; align-items: center; gap: 8px; font-size: 12px; }
.donate-needs li:last-child { grid-template-columns: 1fr auto auto 80px; }
.donate-needs img { width: 24px; height: 24px; image-rendering: pixelated; }
.donate-needs input { width: 80px; }
```

- [ ] **Step 8:** 세 검사 PASS, `?local`에서 G로 숲 패널, 800×450 5개 언어 스크롤 0(측정 스크립트). 커밋 `feat: the grove panel, and giving to the village from the elder`.

---

### Task 8: 월드 모습 — 터, 꽃, 안개, 미니맵 보스

**Files:** Create `src/game/render/groveScene.ts`; Modify `src/game/render/WorldView.ts`, `src/ui/Minimap.tsx`

**Interfaces — Produces:** `class GroveScene { constructor(scene, library, layout, zone); set(view: GroveView | null): void; dispose(): void }`; `WorldView.setGrove(view: GroveView | null)`; `WorldHud.bosses: { x: number; z: number }[]`.

- [ ] **Step 1: `groveScene.ts`**:

```ts
import * as THREE from "three";
import { BUILDINGS, type GroveView } from "../world/grove";
import { START_ZONE, GROVE_FLOWER_ZONES, type ZoneId } from "../world/zones";
import type { LevelLayout } from "../rules/levelLayout";
import type { ModelLibrary } from "../assets/ModelLibrary";
import { createLabel, setLabel } from "./labels";
import { t, type Key } from "../../ui/lang";

// What the grove's week and the village's rebuilding look like: the four sites in the village (a
// pile of logs and rocks, then the building with its top givers' names over it), more flowers once
// stage 1 is reached, and the haze lifting at stage 2.
const FLOWERS = 140;
const FLOWER_MODELS = ["sn_flowers", "sn_bush_flowers"];
const HAZE_FAR = 650;
const CLEAR_FAR = 1100;
const HOUSE_YAW = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 } as const;

export const GROVE_MODELS = ["pt_logs", "pt_rock", "sn_flowers", "sn_bush_flowers", ...new Set(BUILDINGS.map((b) => b.model))];

export class GroveScene {
  private readonly sites = new THREE.Group();
  private readonly flowers = new THREE.Group();
  private shown = "";

  constructor(private readonly scene: THREE.Scene, private readonly library: ModelLibrary, private readonly layout: LevelLayout, private readonly zone: ZoneId) {
    scene.add(this.sites, this.flowers);
    this.plantFlowers();
    this.flowers.visible = false;
  }

  set(view: GroveView | null): void {
    const key = JSON.stringify(view ? [view.stage, view.buildings.map((b) => [b.state, b.top])] : null);
    if (key === this.shown) return;
    this.shown = key;
    const stage = view?.stage ?? 0;
    this.flowers.visible = stage >= 1;
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.far = stage >= 2 ? CLEAR_FAR : HAZE_FAR;
    if (this.zone === START_ZONE) this.buildSites(view);
  }

  private buildSites(view: GroveView | null): void {
    this.sites.clear();
    const t0 = this.layout.tileSize;
    for (const b of BUILDINGS) {
      const at = new THREE.Vector3((b.at[0] + 1) * t0, 0, (b.at[1] + 1) * t0);
      const state = view?.buildings.find((x) => x.id === b.id);
      if (state?.state === "done") {
        const house = this.library.instance(b.model);
        house.position.copy(at);
        house.rotation.y = HOUSE_YAW[b.face];
        this.sites.add(house);
      } else {
        const logs = this.library.instance("pt_logs");
        logs.position.set(at.x - 1.2, 0, at.z + 0.4);
        const rock = this.library.instance("pt_rock");
        rock.position.set(at.x + 1.1, 0, at.z - 0.6);
        this.sites.add(logs, rock);
      }
      const name = t(`grove.building.${b.id}` as Key);
      const text = state?.state === "done" ? `${name} · ${state.top.join(", ")}`
        : state?.state === "building" ? `${name} · ${t("grove.building", { n: Math.floor(state.share * 100) })}` : null;
      if (text) {
        const label = createLabel(3.2);
        setLabel(label, text, "#9dffb0");
        label.position.set(at.x, 5.2, at.z);
        label.visible = true;
        this.sites.add(label);
      }
    }
  }

  // Flowers scattered over open ground (the same every time: seeded by the zone's size).
  private plantFlowers(): void {
    if (!GROVE_FLOWER_ZONES.includes(this.zone)) return;
    const { cols, rows, tileSize, solid } = this.layout;
    let seed = cols * 131 + rows;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0, placed = 0; i < FLOWERS * 8 && placed < FLOWERS; i++) {
      const c = Math.floor(random() * cols);
      const r = Math.floor(random() * rows);
      if (solid[r]?.[c]) continue;
      const flower = this.library.instance(FLOWER_MODELS[placed % FLOWER_MODELS.length]);
      flower.position.set((c + random()) * tileSize, 0, (r + random()) * tileSize);
      flower.rotation.y = random() * Math.PI * 2;
      this.flowers.add(flower);
      placed++;
    }
  }

  dispose(): void {
    this.scene.remove(this.sites, this.flowers);
  }
}
```

(`zones.ts`에 `export const GROVE_FLOWER_ZONES: ZoneId[] = ["village", "forest1"];`. `ModelLibrary` import 경로는 `WorldView.ts`의 것과 같게. `HOUSE_YAW`는 WorldView의 것을 export해 같이 쓴다 — 두 곳에 두지 않는다.)

- [ ] **Step 2: WorldView**
  - `start()`의 preload 목록에 `...GROVE_MODELS`와, 숲 필드 1이면 수호자 모델(`zoneMonsterModels`에서 `zone === GROVE_GUARDIAN_ZONE`이면 `"grove_guardian"`을 types에 추가).
  - `buildLevelScene` 다음에 `this.grove = new GroveScene(this.scene, library, this.layout, this.options.entry.zone); this.grove.set(this.groveView);`
  - `setGrove(view: GroveView | null): void { this.groveView = view; this.grove?.set(view); }`
  - HUD에 `bosses: this.groveView?.revealsBosses ? Object.values(state.monsters).filter((m) => m.alive && (m.type === "mushroom_king" || m.type === "grove_guardian")).map((m) => ({ x: m.x, z: m.z })) : []`
  - `dispose()`에서 `this.grove?.dispose()`.
- [ ] **Step 3: Minimap** — `MinimapCorner`에 `bosses?: { x: number; z: number }[]` prop, `Minimap`이 `me`를 그리는 방식대로 빨간 점을 그린다. WorldScreen이 `bosses={hud.bosses}`를 넘긴다.
- [ ] **Step 4:** 세 검사 PASS. `?local`에서: 마을의 터 4곳에 더미, (디버그로 `grove` 기록을 2단계로 써서) 약초상 이름표 "짓는 중", 기부로 완공 → 집과 이름, 꽃과 안개 변화 스크린샷. 커밋 `feat: the grove and the village show in the world`.

---

### Task 9: 문서, 푸시

- [ ] README 기능 목록에 "숲 정화(주간, 서버 공동)와 마을 복구(기부로 건물 4채, 서버 혜택)" 한 줄, `docs/STORE.md` 한국어·영어 소개에 한 단락씩.
- [ ] 세 검사 + `npm run build`.
- [ ] 커밋 → worktree에서 develop 병합(+ `ui_grove.png` 추가 커밋) → 빌드 확인 → 두 곳 푸시. 컨테이너는 열지 않는다.
