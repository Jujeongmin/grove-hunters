import { PARTY_MAX, shareOf } from "../../src/game/account/party";
import { spawnMonsters, xpFor } from "../../src/game/world/monsters";
import { portalsOf, readChannelRoom, zoneLayout } from "../../src/game/world/zones";
import { enterAs, errorOf, join, makeCharacter, walkTo } from "./helpers";
import { readProfile } from "../src/store";

// Into the world as `account` (a character named after it), and its room.
async function player(server: any, account: string, name: string): Promise<string> {
  await makeCharacter(server, account, name);
  return (await enterAs(server, account)).roomId;
}

// Calls as `account`, standing in `roomId`.
function as(server: any, account: string, roomId: string): any {
  server.connect({ account, roomId });
  return server;
}

// `from` invites `to`, and `to` takes it.
async function team(server: any, from: [string, string], to: [string, string]): Promise<any> {
  await as(server, ...from).inviteToParty(to[0]);
  const { invites } = await as(server, ...to).partyState();
  return server.answerPartyInvite(invites[0].id, true);
}

describe("parties", () => {
  test("an invitation taken makes a party of the two, led by the one who invited", async (server) => {
    const ra = await player(server, "test-a", "파티장");
    const rb = await player(server, "test-b", "파티원");
    await as(server, "test-a", ra).partyState();
    await as(server, "test-a", ra).inviteToParty("test-b");
    const seen = await as(server, "test-b", rb).partyState();
    expect(seen.invites.map((i: any) => i.fromName)).toEqual(["파티장"]);
    expect(await server.answerPartyInvite(seen.invites[0].id, true)).toEqual({ channel: null });
    const { party } = await as(server, "test-a", ra).partyState();
    expect(party.leader).toBe("test-a");
    expect(party.members.map((m: any) => m.name)).toEqual(["파티장", "파티원"]);
    // The invitation is used up.
    expect((await as(server, "test-b", rb).partyState()).invites).toEqual([]);
  });

  test("a turned-down invitation makes nothing; one cannot invite oneself or someone in a party", async (server) => {
    const ra = await player(server, "test-a", "에이");
    const rb = await player(server, "test-b", "비이");
    const rc = await player(server, "test-c", "씨이");
    await as(server, "test-a", ra).inviteToParty("test-b");
    const { invites } = await as(server, "test-b", rb).partyState();
    await server.answerPartyInvite(invites[0].id, false);
    expect((await as(server, "test-a", ra).partyState()).party).toBeNull();
    expect(await errorOf(as(server, "test-a", ra).inviteToParty("test-a"))).toContain("unavailable");
    await team(server, ["test-a", ra], ["test-b", rb]);
    expect(await errorOf(as(server, "test-c", rc).inviteToParty("test-b"))).toContain("in_party");
  });

  test(`holds ${PARTY_MAX} at most, and only the leader invites`, async (server) => {
    const rooms: Record<string, string> = {};
    for (const [account, name] of [["test-a", "하나하나"], ["test-b", "둘둘둘"], ["test-c", "셋셋셋"], ["test-d", "넷넷넷"], ["test-e", "다섯다섯"]]) {
      rooms[account] = await player(server, account, name);
    }
    await team(server, ["test-a", rooms["test-a"]], ["test-b", rooms["test-b"]]);
    expect(await errorOf(as(server, "test-b", rooms["test-b"]).inviteToParty("test-c"))).toContain("not_allowed");
    await team(server, ["test-a", rooms["test-a"]], ["test-c", rooms["test-c"]]);
    await team(server, ["test-a", rooms["test-a"]], ["test-d", rooms["test-d"]]);
    expect((await as(server, "test-a", rooms["test-a"]).partyState()).party.members.length).toBe(PARTY_MAX);
    expect(await errorOf(as(server, "test-a", rooms["test-a"]).inviteToParty("test-e"))).toContain("party_full");
  });

  test("the leader leaving hands the lead on; kicking and passing are the leader's; one left is no party", async (server) => {
    const ra = await player(server, "test-a", "에이");
    const rb = await player(server, "test-b", "비이");
    const rc = await player(server, "test-c", "씨이");
    await team(server, ["test-a", ra], ["test-b", rb]);
    await team(server, ["test-a", ra], ["test-c", rc]);
    expect(await errorOf(as(server, "test-b", rb).kickFromParty("test-c"))).toContain("not_allowed");
    await as(server, "test-a", ra).leaveParty();
    expect((await as(server, "test-a", ra).partyState()).party).toBeNull();
    const after = (await as(server, "test-b", rb).partyState()).party;
    expect(after.leader).toBe("test-b");
    await as(server, "test-b", rb).passPartyLeader("test-c");
    expect((await as(server, "test-c", rc).partyState()).party.leader).toBe("test-c");
    await as(server, "test-c", rc).kickFromParty("test-b");
    // Two became one: the party is gone for both.
    expect((await as(server, "test-b", rb).partyState()).party).toBeNull();
    expect((await as(server, "test-c", rc).partyState()).party).toBeNull();
    expect(await errorOf(as(server, "test-c", rc).leaveParty())).toContain("no_party");
  });

  test("taking an invitation from another channel tells you the leader's channel to move to", async (server) => {
    const ra = await player(server, "test-a", "에이");
    const here = readChannelRoom(ra)!;
    await makeCharacter(server, "test-b", "비이");
    await $global.updateUserState("test-b", { lastChannel: { world: here.world, channel: here.channel + 1 } });
    const rb = (await enterAs(server, "test-b")).roomId;
    expect(readChannelRoom(rb)!.channel).toBe(here.channel + 1);
    expect(await team(server, ["test-a", ra], ["test-b", rb])).toEqual({ channel: here.channel });
  });

  test("a kill is shared by the owner's party members in the same room, each by their level; not by those elsewhere", async (server) => {
    // Three in one party: a and b hunt in the first field, c stays in the village.
    const village = await player(server, "test-a", "사냥꾼");
    const rb = await player(server, "test-b", "동료");
    const rc = await player(server, "test-c", "집지기");
    await team(server, ["test-a", village], ["test-b", rb]);
    await team(server, ["test-a", village], ["test-c", rc]);
    const portal = portalsOf("village").find((p) => p.to === "forest1")!;
    let field = "";
    for (const [account, from] of [["test-b", rb], ["test-a", village]] as const) {
      server.connect({ account, roomId: from });
      await walkTo(server, portal.x, portal.z);
      field = (await join(server, account, await server.travel("forest1"), from)).roomId;
    }
    // In the field, each one's room state learns the party (as the screen's poll does).
    await as(server, "test-b", field).partyState();
    await as(server, "test-a", field).partyState();
    const spawn = zoneLayout("forest1").playerSpawn;
    const felled = Object.fromEntries(
      Object.entries(spawnMonsters("forest1")).map(([id, m]) => [id, { ...m, alive: false, respawnAt: Number.MAX_SAFE_INTEGER }]),
    );
    await walkTo(server, spawn.x, spawn.z, 0);
    await $room.updateMyState({ strikeReadyAt: 0, skillReady: {} });
    await $room.updateRoomState({
      monsters: {
        ...felled,
        m0: { type: "rat", x: spawn.x, z: spawn.z - 1.5, yaw: 0, hp: 1, alive: true, stunnedUntil: 0, attackReadyAt: 0, respawnAt: 0, homeX: spawn.x, homeZ: spawn.z },
      },
    });
    const xpBefore = async (account: string) => (await readProfile(account)).active!.xp;
    const [a0, b0, c0] = [await xpBefore("test-a"), await xpBefore("test-b"), await xpBefore("test-c")];
    expect((await as(server, "test-a", field).strike("m0")).killed).toEqual(["m0"]);
    const each = Math.round(xpFor("rat", 1) * shareOf(2));
    expect((await xpBefore("test-a")) - a0).toBe(each);
    expect((await xpBefore("test-b")) - b0).toBe(each);
    expect((await xpBefore("test-c")) - c0).toBe(0);
    // b counts the rat toward its record (and quests) too.
    expect((await readProfile("test-b")).active!.record?.kills).toBe(1);
  });
});
