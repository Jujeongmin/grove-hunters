import { CHANNEL_CAPACITY, arrivalFrom, channelRoomId, portalsOf, zoneLayout } from "../../src/game/world/zones";
import { enterAs, errorOf, giveXp, join, makeCharacter, walkTo } from "./helpers";

// A real wallet account: it does not play for free like the test- accounts.
const BUYER = "0x1111111111111111111111111111111111111111";

// Stands at the portal to `to` and goes through, as the client does.
async function through(server: any, account: string, entry: any, to: string): Promise<any> {
  const portal = portalsOf(entry.zone).find((p) => p.to === to)!;
  await walkTo(server, portal.x, portal.z);
  const next = await server.travel(to);
  return join(server, account, next, entry.roomId);
}

describe("entering the world", () => {
  test("a new character starts in the village, channel 1 of its server, showing its look", async (server) => {
    server.connect({ account: "test-a" });
    await server.setWorld("w2");
    await server.createCharacter("새싹", "ranger", "0000");
    const entry = await server.enterWorld();
    const spawn = zoneLayout("village").playerSpawn;
    expect(entry).toEqual({ roomId: "rpg-w2-village-1", zone: "village", channel: 1, x: spawn.x, z: spawn.z });
    await join(server, "test-a", entry);
    const mine = await $room.getMyState();
    expect(mine.look).toMatchObject({ name: "새싹", playerClass: "ranger", level: 1 });
    expect(mine.pose).toMatchObject({ x: spawn.x, z: spawn.z });
  });

  test("players on different servers never share a room", async (server) => {
    server.connect({ account: "test-a" });
    await server.setWorld("w1");
    await server.createCharacter("에이", "warrior", "0000");
    const a = await server.enterWorld();
    server.connect({ account: "test-b" });
    await server.setWorld("w4");
    await server.createCharacter("비이", "warrior", "0000");
    const b = await server.enterWorld();
    expect(a.roomId === b.roomId).toBe(false);
  });

  test("a full channel sends the next player to the next one", async (server) => {
    for (let i = 0; i < CHANNEL_CAPACITY; i++) {
      await makeCharacter(server, `test-p${i}`, `손님${i}`);
      expect((await enterAs(server, `test-p${i}`)).channel).toBe(1);
    }
    await makeCharacter(server, "test-late", "늦은손님");
    server.connect({ account: "test-late" });
    expect((await server.enterWorld()).channel).toBe(2);
  });

  test("a channel counts its players across every zone", async (server) => {
    // Seated straight into rooms of channel 1, some in the village and some out in the field.
    for (let i = 0; i < CHANNEL_CAPACITY; i++) {
      await server.simulateJoin(channelRoomId("w1", i % 2 === 0 ? "village" : "forest1", 1), `test-x${i}`);
    }
    await makeCharacter(server, "test-late", "늦은손님");
    server.connect({ account: "test-late" });
    expect((await server.enterWorld()).channel).toBe(2);
  });

  test("you move to another channel where you stand, and not into a full one", async (server) => {
    await makeCharacter(server, "test-a", "에이");
    const first = await enterAs(server, "test-a");
    await walkTo(server, 10, 13, 1);
    const listed = await server.channels();
    expect(listed.current).toBe(1);
    expect(listed.players[0]).toBe(1);
    const moved = await server.changeChannel(3);
    expect(moved).toMatchObject({ zone: "village", channel: 3, x: 10, z: 13 });
    await join(server, "test-a", moved, first.roomId);
    expect(await errorOf(server.changeChannel(3))).toContain("unavailable");
    for (let i = 0; i < CHANNEL_CAPACITY; i++) await server.simulateJoin(channelRoomId("w1", "forest1", 5), `test-x${i}`);
    server.connect({ account: "test-a", roomId: moved.roomId });
    expect(await errorOf(server.changeChannel(5))).toContain("channel_full");
  });

  test("you keep your channel through a portal", async (server) => {
    await makeCharacter(server, "test-a", "에이");
    const first = await enterAs(server, "test-a");
    const moved = await join(server, "test-a", await server.changeChannel(4), first.roomId);
    const field = await through(server, "test-a", moved, "forest1");
    expect(field).toMatchObject({ zone: "forest1", channel: 4 });
  });

  test("you come in on the channel you last played on, or else your friends'", async (server) => {
    await makeCharacter(server, "test-a", "에이");
    await makeCharacter(server, "test-b", "비이");
    server.connect({ account: "test-a" });
    await server.requestFriend("비이");
    server.connect({ account: "test-b" });
    await server.acceptFriend("test-a");
    const b = await enterAs(server, "test-b");
    const six = await join(server, "test-b", await server.changeChannel(6), b.roomId);
    // The friends heartbeat is what says someone is online.
    server.connect({ account: "test-b", roomId: six.roomId });
    await server.syncFriends();
    server.connect({ account: "test-a" });
    const a = await server.enterWorld();
    expect(a.channel).toBe(6);
    await join(server, "test-a", a);
    const moved = await join(server, "test-a", await server.changeChannel(2), a.roomId);
    server.connect({ account: "test-a", roomId: moved.roomId });
    await server.leaveWorld();
    server.connect({ account: "test-a" });
    expect((await server.enterWorld()).channel).toBe(2);
  });

  test("comes back where it left, by leaving or by just going away", async (server) => {
    await makeCharacter(server, "test-a", "에이");
    await enterAs(server, "test-a");
    await walkTo(server, 10, 13, 1);
    await server.leaveWorld();
    server.connect({ account: "test-a" });
    const back = await server.enterWorld();
    expect(back).toMatchObject({ zone: "village", x: 10, z: 13 });

    // A closed tab: no leaveWorld, only the platform's leave hook.
    await join(server, "test-a", back);
    await walkTo(server, 14, 13, 1);
    await server.simulateLeave(back.roomId, "test-a");
    server.connect({ account: "test-a" });
    expect(await server.enterWorld()).toMatchObject({ zone: "village", x: 14, z: 13 });
  });
});

describe("a room the server did not send you to", () => {
  test("takes you nowhere: no arriving, no walking, however you joined it", async (server) => {
    await makeCharacter(server, "test-a", "에이");
    await enterAs(server, "test-a");
    const boss = channelRoomId("w1", "boss", 1);
    await server.simulateJoin(boss, "test-a");
    server.connect({ account: "test-a", roomId: boss });
    expect(await errorOf(server.arrive())).toContain("unavailable");
    expect(await errorOf(server.reportPose({ x: 10, z: 10, yaw: 0 }))).toContain("unavailable");
  });
});

describe("a late leave", () => {
  test("lands on the character that left, not on one picked on the menu since", async (server) => {
    await makeCharacter(server, "test-a", "에이");
    const first = await enterAs(server, "test-a");
    await walkTo(server, 14, 13, 1);
    await $room.updateMyState({ hp: 7 });
    await server.leaveWorld();
    server.connect({ account: "test-a" });
    await makeCharacter(server, "test-a", "비이");
    // The platform's leave hook comes late, after the menu has moved on to the new character.
    await server.simulateLeave(first.roomId, "test-a");
    server.connect({ account: "test-a" });
    const entry = await server.enterWorld();
    expect(entry).toMatchObject({ zone: "village" });
    expect(entry.x === 14 && entry.z === 13).toBe(false);
    await join(server, "test-a", entry);
    expect((await $room.getMyState()).hp).toBe((await $room.getMyState()).maxHp);
  });
});

describe("portals", () => {
  test("take you to the next zone only while you stand at the portal", async (server) => {
    await makeCharacter(server, "test-a", "에이");
    const entry = await enterAs(server, "test-a");
    expect(await errorOf(server.travel("forest1"))).toContain("not_near");
    const field = await through(server, "test-a", entry, "forest1");
    const at = arrivalFrom("forest1", "village");
    expect(field).toMatchObject({ zone: "forest1", roomId: "rpg-w1-forest1-1", x: at.x, z: at.z });
    expect((await $room.getMyState()).pose).toMatchObject({ x: at.x, z: at.z });
  });

  test("lead nowhere but the zones next door", async (server) => {
    await makeCharacter(server, "test-a", "에이");
    await enterAs(server, "test-a");
    expect(await errorOf(server.travel("boss"))).toContain("no_zone");
    expect(await errorOf(server.travel("moon"))).toContain("no_zone");
  });

  test("the second field is free to all, from level 10", async (server) => {
    await makeCharacter(server, BUYER, "구매자");
    const field = await through(server, BUYER, await enterAs(server, BUYER), "forest1");
    expect(await errorOf(through(server, BUYER, field, "forest2"))).toContain("too_low");
    await giveXp(BUYER, 20_000);
    server.connect({ account: BUYER, roomId: field.roomId });
    expect((await through(server, BUYER, field, "forest2")).zone).toBe("forest2");
  });
});
