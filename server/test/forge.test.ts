import { RECIPES, enhanceCost } from "../../src/game/account/forge";
import { protectCost } from "../../src/game/account/premium";
import { TRADE_CRAFT_CHANCE } from "../../src/game/account/inventory";
import { ITEMS } from "../../src/game/account/items";
import { enterAs, errorOf, makeCharacter, toNpc } from "./helpers";
import { readProfile, updateActive } from "../src/store";

// A worn weapon_2 at `plus`.
const weapon = (plus = 0, trade = false) => ({ uid: "g-test", id: "weapon_2" as const, plus, trade });

// A character by the smith (the forge works anywhere), wearing a weapon, with gold and 강화석 to spend.
async function atTheForge(server: any, stones = 20, gold = 5000): Promise<void> {
  await makeCharacter(server, "test-a", "대장장이손님");
  await enterAs(server, "test-a");
  await updateActive("test-a", (c) => ({ ...c, bag: { ...c.bag, stone: stones, jelly: 10 }, gear: { ...c.gear, weapon: weapon() } }));
  if (gold > 0) await $asset.mint("gold", gold);
  await toNpc(server, "smith");
}

// Every roll of the server comes out as `value` while `run` runs.
// What the server answers is untyped here, as everywhere in these tests.
async function rolling(value: number, run: () => Promise<unknown>): Promise<any> {
  const real = Math.random;
  Math.random = () => value;
  try {
    return await run();
  } finally {
    Math.random = real;
  }
}

describe("the smith", () => {
  test("enhancing spends gold and 강화석, and a success adds a + to the worn piece that makes it stronger", async (server) => {
    await atTheForge(server);
    const cost = enhanceCost("weapon_2", 0)!;
    const { outcome, bag } = await rolling(0, () => server.enhanceGear("weapon"));
    expect(outcome).toBe("success");
    expect(bag.gear.weapon).toEqual(weapon(1));
    expect(bag.bag.stone).toBe(20 - cost.stones);
    expect(bag.gold).toBe(5000 - cost.gold);
    expect((await $room.getMyState()).gear.power).toBeGreaterThan(ITEMS.weapon_2.power);
  });

  test("a piece that may be traded keeps that through enhancing, and 강화석 that may not be traded goes first", async (server) => {
    await atTheForge(server, 1);
    await updateActive("test-a", (c) => ({ ...c, bagTrade: { stone: 5 }, gear: { ...c.gear, weapon: weapon(1, true) } }));
    const { bag } = await rolling(0, () => server.enhanceGear("weapon"));
    expect(bag.gear.weapon).toEqual(weapon(2, true));
    // +2 costs two: the one that may not be traded, then one of the five.
    expect(bag.bag.stone).toBeUndefined();
    expect(bag.bagTrade.stone).toBe(4);
  });

  test("a failure below +6 keeps the piece; from +6 it may break it", async (server) => {
    await atTheForge(server, 40, 50000);
    // At +1, going for +2 (+1 never fails): a roll of 0.99 fails, and below +6 nothing breaks.
    await updateActive("test-a", (c) => ({ ...c, gear: { ...c.gear, weapon: weapon(1) } }));
    const failed = await rolling(0.99, () => server.enhanceGear("weapon"));
    expect(failed.outcome).toBe("fail");
    expect(failed.bag.gear.weapon).toEqual(weapon(1));
    // At +5, going for +6: a failed roll whose break roll comes under the chance breaks it.
    await updateActive("test-a", (c) => ({ ...c, gear: { ...c.gear, weapon: weapon(5) } }));
    const risky = enhanceCost("weapon_2", 5)!;
    expect(risky.breaks).toBeGreaterThan(0);
    const real = Math.random;
    const rolls = [0.99, 0];
    Math.random = () => rolls.shift() ?? 0.99;
    let broken: any;
    try {
      broken = await server.enhanceGear("weapon");
    } finally {
      Math.random = real;
    }
    expect(broken.outcome).toBe("broken");
    expect(broken.bag.gear.weapon).toBeNull();
    expect(broken.bag.pieces).toEqual([]);
  });

  test("protected with gems, a failure from +6 never breaks the piece; below +6 there is nothing to protect", async (server) => {
    await atTheForge(server, 40, 50000);
    await $global.updateUserState("test-a", { gems: 25 });
    expect(await errorOf(server.enhanceGear("weapon", true))).toContain("unavailable");
    await updateActive("test-a", (c) => ({ ...c, gear: { ...c.gear, weapon: weapon(5) } }));
    // A failed roll and a breaking one: protected, it only fails, and the gems are spent.
    const real = Math.random;
    const rolls = [0.99, 0];
    Math.random = () => rolls.shift() ?? 0.99;
    let kept: any;
    try {
      kept = await server.enhanceGear("weapon", true);
    } finally {
      Math.random = real;
    }
    expect(kept.outcome).toBe("fail");
    expect(kept.bag.gear.weapon).toEqual(weapon(5));
    expect(kept.bag.gems).toBe(25 - protectCost(6)!);
    // Not enough gems left for another: refused, and nothing is spent.
    const gold = kept.bag.gold;
    expect(await errorOf(server.enhanceGear("weapon", true))).toContain("not_enough_gems");
    expect((await server.getBag()).gold).toBe(gold);
  });

  test("wants what it costs, and works anywhere", async (server) => {
    await atTheForge(server, 0, 0);
    expect(await errorOf(server.enhanceGear("weapon"))).toContain("no_item");
    await updateActive("test-a", (c) => ({ ...c, bag: { ...c.bag, stone: 5 } }));
    expect(await errorOf(server.enhanceGear("weapon"))).toContain("not_enough_gold");
    expect(await errorOf(server.enhanceGear("armor"))).toContain("unavailable");
    await updateActive("test-a", (c) => ({ ...c, gear: { ...c.gear, weapon: weapon(10) } }));
    expect(await errorOf(server.enhanceGear("weapon"))).toContain("max_plus");
    // Away from the smith it works all the same.
    await toNpc(server, "merchant");
    await updateActive("test-a", (c) => ({ ...c, bag: { ...c.bag, jelly: 4 } }));
    await $asset.mint("gold", 100);
    expect((await server.craftItem("potion_big")).bag.potion_big).toBe(2);
  });

  test("makes things from materials and gold; made gear may be traded on its chance", async (server) => {
    await atTheForge(server);
    await updateActive("test-a", (c) => ({ ...c, bag: { ...c.bag, jelly: 20 } }));
    const recipe = RECIPES.find((r) => r.id === "weapon_1")!;
    const bound = await rolling(TRADE_CRAFT_CHANCE, () => server.craftItem("weapon_1"));
    expect(bound.pieces.map((p: any) => [p.id, p.trade])).toEqual([["weapon_1", false]]);
    expect(bound.bag.jelly).toBe(20 - recipe.needs[0].n);
    expect(bound.gold).toBe(5000 - recipe.gold);
    const traded = await rolling(TRADE_CRAFT_CHANCE - 0.001, () => server.craftItem("weapon_1"));
    expect(traded.pieces.map((p: any) => [p.id, p.trade])).toEqual([["weapon_1", false], ["weapon_1", true]]);
    expect(await errorOf(server.craftItem("weapon_4"))).toContain("no_item");
    expect(await errorOf(server.craftItem("nothing"))).toContain("unavailable");
    expect((await readProfile("test-a")).active!.pieces.length).toBe(2);
  });
});
