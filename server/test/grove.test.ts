import { BUILDINGS, readUserGrove } from "../../src/game/world/grove";
import { ITEMS } from "../../src/game/account/items";
import { errorOf, toNpc } from "./helpers";
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
    const entry = await inVillage(server);
    // The server the room belongs to (rpg-<world>-<zone>-<channel>).
    const world = entry.roomId.split("-")[1];
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
    const entry = await inVillage(server);
    // The server the room belongs to (rpg-<world>-<zone>-<channel>).
    const world = entry.roomId.split("-")[1];
    await openFirstSite(world, weekOf(Date.now()));
    await $asset.mint("gold", BUILDINGS[0].gold);
    await toNpc(server, "elder");
    // A bag holds 99 of a thing, so the jelly goes in a few gifts; the gold with the last.
    let left = BUILDINGS[0].needs.jelly!;
    let view: any = null;
    while (left > 0) {
      const n = Math.min(99, left);
      const state = await $global.getUserState("test-a");
      const map = { ...state.characterMap };
      map[state.active] = { ...map[state.active], bag: { ...map[state.active].bag, jelly: n } };
      await $global.updateUserState("test-a", { characterMap: map });
      left -= n;
      view = await server.donate({ jelly: n }, left === 0 ? BUILDINGS[0].gold : 0);
    }
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
