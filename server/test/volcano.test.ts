import { levelCost } from "../../src/game/account/level";
import { GOLD, ITEMS } from "../../src/game/account/items";
import { QUESTS } from "../../src/game/account/quests";
import { npcSpot } from "../../src/game/world/npcs";
import { portalsOf, zoneLayout } from "../../src/game/world/zones";
import { editActive, enterAs, errorOf, giveXp, join, makeCharacter, walkTo } from "./helpers";

function xpFor(level: number): number {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += levelCost(l);
  return xp;
}

// A character of `level` standing in `zone` (by its saved spot), as the client comes in.
async function standingIn(server: any, zone: string, level: number): Promise<any> {
  await makeCharacter(server, "test-a", "화산사냥꾼");
  await giveXp("test-a", xpFor(level));
  const spawn = zoneLayout(zone as any).playerSpawn;
  await editActive("test-a", (c) => ({ ...c, spot: { zone, x: spawn.x, z: spawn.z } }));
  return enterAs(server, "test-a");
}

describe("the volcano", () => {
  test("the peaks lead to the camp, from Lv58, and on to the ash plain from Lv60", async (server) => {
    const low = await standingIn(server, "snow3", 55);
    const portal = portalsOf("snow3").find((p) => p.to === "camp")!;
    await walkTo(server, portal.x, portal.z);
    expect(await errorOf(server.travel("camp"))).toContain("too_low");
    await giveXp("test-a", xpFor(58));
    const into = await server.travel("camp");
    expect(into.zone).toBe("camp");
    await join(server, "test-a", into, low.roomId);
    const east = portalsOf("camp").find((p) => p.to === "lava1")!;
    await walkTo(server, east.x, east.z);
    expect(await errorOf(server.travel("lava1"))).toContain("too_low");
  });

  test("the camp's merchant sells, its smith crafts the volcano's gear, its warden takes reports", async (server) => {
    await standingIn(server, "camp", 65);
    await $asset.mint(GOLD, 200_000);
    const merchant = npcSpot("ember_merchant");
    await walkTo(server, merchant.x + 1, merchant.z);
    expect((await server.buyItem("potion_big", 3)).bag.potion_big).toBeGreaterThanOrEqual(3);
    await editActive("test-a", (c) => ({ ...c, bagTrade: { ember_shard: 15, magma_scale: 12, stone: 20 } }));
    const made = await server.craftItem("weapon_8");
    expect(made.pieces.some((p: any) => p.id === "weapon_8")).toBe(true);
    expect(ITEMS.weapon_8.tier).toBe(8);
    await editActive("test-a", (c) => ({ ...c, quest: { index: 0, count: QUESTS[0].count } }));
    const warden = npcSpot("warden");
    await walkTo(server, warden.x + 1, warden.z);
    expect((await server.claimQuest()).quest.index).toBe(1);
  });

  test("falling in the volcano sends you back to the camp", async (server) => {
    await standingIn(server, "lava2", 70);
    await $room.updateMyState({ dead: true, hp: 0 });
    expect((await server.respawn()).zone).toBe("camp");
  });
});
