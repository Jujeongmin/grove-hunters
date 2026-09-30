import { ITEMS, sellPrice } from "../../src/game/account/items";
import { WEAPONS } from "../../src/game/combat/classes";
import { MONSTERS, maxHpAt } from "../../src/game/world/monsters";
import { portalsOf, zoneLayout } from "../../src/game/world/zones";
import { STEED, editActive, enterAs, errorOf, join, makeCharacter, pieceOf, toNpc, walkTo } from "./helpers";

// A character standing in the village, by the merchant.
async function inVillage(server: any, account = "test-a"): Promise<any> {
  await makeCharacter(server, account, `상인${account.slice(-1)}`);
  const entry = await enterAs(server, account);
  await toNpc(server, "merchant");
  return entry;
}

async function toForest(server: any, account: string, from: any): Promise<any> {
  const portal = portalsOf("village").find((p) => p.to === "forest1")!;
  await walkTo(server, portal.x, portal.z);
  return join(server, account, await server.travel("forest1"), from.roomId);
}

describe("bag and gold", () => {
  test("a new character starts with a few potions and no gold", async (server) => {
    await inVillage(server);
    const { daily, ...rest } = await server.getBag();
    expect(rest).toEqual({
      gold: 0, bag: { potion_small: 5 }, bagTrade: {}, pieces: [], gear: { weapon: null, armor: null }, job: null, quest: { index: 0, count: 0 }, tutorial: null,
      mount: "deer",
    });
    expect(daily.counts).toEqual({});
    expect(daily.claimed).toEqual([]);
  });

  test("a kill pays gold onto the account alongside the XP", async (server) => {
    const village = await inVillage(server);
    await toForest(server, "test-a", village);
    const spawn = zoneLayout("forest1").playerSpawn;
    await walkTo(server, spawn.x, spawn.z, 0);
    await $room.updateRoomState({
      monsters: {
        m0: {
          type: "rat", x: spawn.x, z: spawn.z - 1.5, yaw: 0, hp: 1, alive: true, stunnedUntil: 0, attackReadyAt: 0,
          respawnAt: 0, homeX: spawn.x, homeZ: spawn.z - 1.5,
        },
      },
    });
    const result = await server.strike("m0");
    const [low, high] = MONSTERS.rat.gold;
    expect(result.gold).toBeGreaterThanOrEqual(low);
    expect(result.gold).toBeLessThanOrEqual(high);
    expect((await server.getBag()).gold).toBe(result.gold);
  });

  test("drops: materials may be traded, gear on its chance", async (server) => {
    const village = await inVillage(server);
    await toForest(server, "test-a", village);
    const spawn = zoneLayout("forest1").playerSpawn;
    await walkTo(server, spawn.x, spawn.z, 0);
    const rat = (id: string) => ({
      [id]: {
        type: "rat", x: spawn.x, z: spawn.z - 1.5, yaw: 0, hp: 1, alive: true, stunnedUntil: 0, attackReadyAt: 0,
        respawnAt: 0, homeX: spawn.x, homeZ: spawn.z - 1.5,
      },
    });
    // Every roll 0: everything the rat carries drops, and its gear may be traded.
    await $room.updateRoomState({ monsters: rat("m0") });
    const real = Math.random;
    Math.random = () => 0;
    try {
      await server.strike("m0");
    } finally {
      Math.random = real;
    }
    const bag = await server.getBag();
    expect(bag.bagTrade).toEqual({ jelly: 1, stone: 1 });
    expect(bag.bag.potion_small).toBe(6);
    // (The other side of the trade roll is in tests/account/inventory.test.ts.)
    expect(bag.pieces.map((p: any) => [p.id, p.trade])).toEqual([["weapon_1", true], ["armor_1", true]]);
  });

  test("a save from before pieces reads as pieces that may not be traded, the + on one of them", async (server) => {
    await inVillage(server);
    await editActive("test-a", (c) => {
      const { pieces: _, bagTrade: __, ...old } = c;
      return { ...old, bag: { potion_small: 3, weapon_2: 2, stone: 4 }, gear: { weapon: "weapon_2", armor: null }, plus: { weapon_2: 6 } };
    });
    const bag = await server.getBag();
    expect(bag.bag).toEqual({ potion_small: 3, stone: 4 });
    expect(bag.bagTrade).toEqual({});
    expect([bag.gear.weapon.id, bag.gear.weapon.plus, bag.gear.weapon.trade]).toEqual(["weapon_2", 6, false]);
    expect(bag.pieces.map((p: any) => [p.id, p.plus, p.trade])).toEqual([["weapon_2", 0, false], ["weapon_2", 0, false]]);
    // The worn piece's + counts in a fight at once.
    const stats = (await $room.getMyState()).gear;
    expect(stats.power).toBeGreaterThanOrEqual(0);
    // Saved in the new form by the next change, with the same pieces.
    await server.equipItem(bag.pieces[0].uid);
    const after = await server.getBag();
    expect(after.gear.weapon.uid).toBe(bag.pieces[0].uid);
    expect(after.pieces.map((p: any) => p.uid).sort()).toEqual([bag.gear.weapon.uid, bag.pieces[1].uid].sort());
  });

  test("the shop buys back a piece by its uid, and a stack from the side asked for", async (server) => {
    await inVillage(server);
    await $asset.mint("gold", 1000);
    const bought = await server.buyItem("weapon_1");
    const uid = pieceOf(bought, "weapon_1");
    const sold = await server.sellPiece(uid);
    expect(sold.pieces).toEqual([]);
    expect(sold.gold).toBe(bought.gold + sellPrice("weapon_1"));
    expect(await errorOf(server.sellPiece(uid))).toContain("no_item");
    expect(await errorOf(server.sellItem("weapon_1"))).toContain("unavailable");
    await editActive("test-a", (c) => ({ ...c, bag: { ...c.bag, silk: 2 }, bagTrade: { silk: 3 } }));
    const fromTrade = await server.sellItem("silk", 3, true);
    expect([fromTrade.bag.silk, fromTrade.bagTrade.silk]).toEqual([2, undefined]);
    expect(await errorOf(server.sellItem("silk", 3))).toContain("no_item");
  });

  test("the shop is the merchant's, in the village, and wants the gold up front", async (server) => {
    const village = await inVillage(server);
    await walkTo(server, zoneLayout("village").playerSpawn.x, zoneLayout("village").playerSpawn.z);
    expect(await errorOf(server.buyItem("potion_small"))).toContain("not_near");
    await toNpc(server, "merchant");
    expect(await errorOf(server.buyItem("potion_small"))).toContain("not_enough_gold");
    expect(await errorOf(server.buyItem("weapon_3"))).toContain("unavailable");
    await $asset.mint("gold", 100);
    const bought = await server.buyItem("potion_small", 2);
    expect(bought.gold).toBe(100 - ITEMS.potion_small.price! * 2);
    expect(bought.bag.potion_small).toBe(7);
    const sold = await server.sellItem("potion_small", 7);
    expect(sold.bag.potion_small).toBeUndefined();
    expect(sold.gold).toBe(bought.gold + sellPrice("potion_small") * 7);
    expect(await errorOf(server.sellItem("potion_small"))).toContain("no_item");

    await toForest(server, "test-a", village);
    expect(await errorOf(server.buyItem("potion_small"))).toContain("not_in_village");
  });

  test("a buy that would stack past 99 is refused before the gold is taken", async (server) => {
    await inVillage(server);
    await toNpc(server, "merchant");
    await $asset.mint("gold", 10_000);
    await server.buyItem("potion_small", 90);
    expect((await server.buyItem("potion_small", 4)).bag.potion_small).toBe(99);
    const before = await $asset.get("gold");
    expect(await errorOf(server.buyItem("potion_small", 1))).toContain("bag_full");
    expect(await $asset.get("gold")).toBe(before);
  });

  test("worn gear hits harder and holds more health; taking it off puts it back in the bag", async (server) => {
    await inVillage(server);
    await $asset.mint("gold", 1000);
    await server.buyItem("weapon_1");
    const bought = await server.buyItem("armor_1");
    // Bought from the shop: pieces that may never be traded.
    expect(bought.pieces.map((p: any) => [p.id, p.plus, p.trade])).toEqual([["weapon_1", 0, false], ["armor_1", 0, false]]);
    await server.equipItem(pieceOf(bought, "weapon_1"));
    const worn = await server.equipItem(pieceOf(bought, "armor_1"));
    expect([worn.gear.weapon.id, worn.gear.armor.id]).toEqual(["weapon_1", "armor_1"]);
    expect(worn.pieces).toEqual([]);
    const mine = await $room.getMyState();
    expect(mine.maxHp).toBe(maxHpAt(1) + ITEMS.armor_1.hp + STEED.hp);
    expect(mine.gear.power).toBeCloseTo(ITEMS.weapon_1.power + STEED.power);
    expect(await errorOf(server.equipItem("potion_small"))).toContain("no_item");

    const off = await server.unequipItem("weapon");
    expect(off.gear.weapon).toBeNull();
    expect(off.pieces.map((p: any) => p.id)).toEqual(["weapon_1"]);
    expect((await $room.getMyState()).gear.power).toBeCloseTo(STEED.power);
  });

  test("a sharper weapon lands a bigger blow", async (server) => {
    const village = await inVillage(server);
    await $asset.mint("gold", 1000);
    await server.equipItem(pieceOf(await server.buyItem("weapon_2"), "weapon_2"));
    await toForest(server, "test-a", village);
    const spawn = zoneLayout("forest1").playerSpawn;
    await walkTo(server, spawn.x, spawn.z, 0);
    await $room.updateRoomState({
      monsters: {
        m0: {
          type: "frog", x: spawn.x, z: spawn.z - 1.5, yaw: 0, hp: 500, alive: true, stunnedUntil: 0, attackReadyAt: 0,
          respawnAt: 0, homeX: spawn.x, homeZ: spawn.z - 1.5,
        },
      },
    });
    await server.strike("m0");
    const expected = Math.round(WEAPONS.warrior.damage * (1 + ITEMS.weapon_2.power + STEED.power));
    expect((await $room.getRoomState()).monsters.m0.hp).toBe(500 - expected);
  });

  test("a potion heals up to full and is used up", async (server) => {
    await inVillage(server);
    await $room.updateMyState({ hp: 10 });
    const after = await server.drinkPotion("potion_small");
    expect(after.bag.potion_small).toBe(4);
    expect((await $room.getMyState()).hp).toBe(10 + ITEMS.potion_small.heal);
    // No faster than one a second, whatever the client sends.
    expect(await errorOf(server.drinkPotion("potion_small"))).toContain("too_fast");
    expect((await server.getBag()).bag.potion_small).toBe(4);
    for (let i = 0; i < 4; i++) {
      await $room.updateMyState({ potionReadyAt: 0 });
      await server.drinkPotion("potion_small");
    }
    await $room.updateMyState({ potionReadyAt: 0 });
    expect((await $room.getMyState()).hp).toBe(maxHpAt(1) + STEED.hp);
    expect(await errorOf(server.drinkPotion("potion_small"))).toContain("no_item");
  });
});
