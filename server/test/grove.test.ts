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
