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
