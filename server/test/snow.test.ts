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
  await makeCharacter(server, "test-a", "설산사냥꾼");
  await giveXp("test-a", xpFor(level));
  const spawn = zoneLayout(zone as any).playerSpawn;
  await editActive("test-a", (c) => ({ ...c, spot: { zone, x: spawn.x, z: spawn.z } }));
  return enterAs(server, "test-a");
}

describe("the snow region", () => {
  test("the deep forest leads to the outpost, from Lv38", async (server) => {
    const low = await standingIn(server, "forest3", 30);
    const portal = portalsOf("forest3").find((p) => p.to === "outpost")!;
    await walkTo(server, portal.x, portal.z);
    expect(await errorOf(server.travel("outpost"))).toContain("too_low");
    await giveXp("test-a", xpFor(38));
    const into = await server.travel("outpost");
    expect(into.zone).toBe("outpost");
    await join(server, "test-a", into, low.roomId);
    // And on to the foothills, which want Lv40.
    const east = portalsOf("outpost").find((p) => p.to === "snow1")!;
    await walkTo(server, east.x, east.z);
    expect(await errorOf(server.travel("snow1"))).toContain("too_low");
  });

  test("the outpost's merchant sells, its smith crafts the new gear, its captain takes reports", async (server) => {
    await standingIn(server, "outpost", 45);
    await $asset.mint(GOLD, 50_000);
    const merchant = npcSpot("frost_merchant");
    await walkTo(server, merchant.x + 1, merchant.z);
    const bought = await server.buyItem("potion_big", 3);
    expect(bought.bag.potion_big).toBeGreaterThanOrEqual(3);
    // Crafting works anywhere; the outpost's materials make tier 6.
    await editActive("test-a", (c) => ({ ...c, bagTrade: { frost_shard: 12, snow_fur: 10, stone: 10 } }));
    const made = await server.craftItem("weapon_6");
    expect(made.pieces.some((p: any) => p.id === "weapon_6")).toBe(true);
    expect(ITEMS.weapon_6.tier).toBe(6);
    // The captain takes a finished quest's report, as the elder does.
    await editActive("test-a", (c) => ({ ...c, quest: { index: 0, count: QUESTS[0].count } }));
    const captain = npcSpot("captain");
    await walkTo(server, captain.x + 1, captain.z);
    expect((await server.claimQuest()).quest.index).toBe(1);
    // The grove's buildings are the village's: no gifts here.
    expect(await errorOf(server.donate({ stone: 1 }, 0))).toContain("not_in_village");
  });

  test("falling in the snow sends you back to the outpost, not the village", async (server) => {
    await standingIn(server, "snow1", 45);
    await $room.updateMyState({ dead: true, hp: 0 });
    expect((await server.respawn()).zone).toBe("outpost");
  });
});
