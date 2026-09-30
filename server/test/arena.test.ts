import { levelCost } from "../../src/game/account/level";
import { GUILD_COST } from "../../src/game/account/guild";
import { GOLD } from "../../src/game/account/items";
import {
  ARENA_LEVEL, ARENA_SEATS, STAGE_REWARDS, bossMax, bossOfWeek, currentWeek,
} from "../../src/game/world/guildBoss";
import { zoneLayout } from "../../src/game/world/zones";
import { enterAs, errorOf, giveXp, makeCharacter, walkTo } from "./helpers";

function xpFor(level: number): number {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += levelCost(l);
  return xp;
}

// A character of `level`, in the village, in a guild: founding it (`guild` null) or joining `guild`.
async function member(server: any, account: string, name: string, guild: string | null, level = ARENA_LEVEL): Promise<string> {
  await makeCharacter(server, account, name);
  await giveXp(account, xpFor(level));
  let id = guild;
  if (!guild) {
    await $asset.mint(GOLD, GUILD_COST);
    id = (await server.createGuild(`${name}길드`)).guild.id;
  } else {
    await server.applyGuild(guild);
    const character = (await $global.getUserState(account)).active;
    const state = await $global.getCollectionItem("guilds", guild);
    const master = state.members.find((m: any) => m.role === "master").account;
    server.connect({ account: master });
    await server.answerApplication(character, true);
  }
  await enterAs(server, account);
  return id!;
}

// Into boss room `n` and standing in it, as the client does it.
async function intoArena(server: any, account: string, n = 1): Promise<any> {
  const here = (await $global.getUserState(account)).where;
  server.connect({ account, roomId: `rpg-${here.world}-${here.zone}-${here.channel}` });
  const entry = await server.enterArena(n);
  await server.simulateJoin(entry.roomId, account);
  server.connect({ account, roomId: entry.roomId });
  await server.arrive();
  return entry;
}

// Stands next to the boss facing it, with nothing on cooldown.
async function atBoss(server: any): Promise<void> {
  const boss = zoneLayout("arena").bossSpawn!;
  await walkTo(server, boss.x, boss.z + 2, 0);
  await $room.updateMyState({ strikeReadyAt: 0, skillReady: {} });
}

// Makes the room sync on its next tick.
async function syncNow(server: any, roomId: string): Promise<void> {
  const { arena } = await $room.getRoomState(["arena"]);
  await $room.updateRoomState({ arena: { ...arena, syncAt: 0 } });
  await server.simulateTick(roomId, 200);
}

const week = () => currentWeek(Date.now());
async function bossWeek(guild: string): Promise<any> {
  const rows = await $global.getCollectionItems("guildBoss", { filters: [{ field: "guild", operator: "==", value: guild }] });
  return rows.find((r: any) => r.week === week());
}

describe("guild boss", () => {
  test("a member of Lv10 goes in once a day; the week's boss stands in the middle with the guild's health", async (server) => {
    const guild = await member(server, "test-a", "보스장", null);
    const entry = await intoArena(server, "test-a");
    expect(entry.zone).toBe("arena");
    await server.simulateTick(entry.roomId, 200);
    const { monsters, arena } = await $room.getRoomState(["monsters", "arena"]);
    expect(monsters.boss.type).toBe(bossOfWeek(week()));
    expect(monsters.boss.hp).toBe(bossMax(1));
    expect(arena.guild).toBe(guild);
    // Once a day.
    await server.leaveArena();
    await enterAs(server, "test-a");
    const here = (await $global.getUserState("test-a")).where;
    server.connect({ account: "test-a", roomId: `rpg-${here.world}-${here.zone}-${here.channel}` });
    expect(await errorOf(server.enterArena(2))).toContain("entered_today");
  });

  test("not below Lv10, not without a guild", async (server) => {
    await member(server, "test-a", "낮은이", null, ARENA_LEVEL - 1);
    const here = (await $global.getUserState("test-a")).where;
    server.connect({ account: "test-a", roomId: `rpg-${here.world}-${here.zone}-${here.channel}` });
    expect(await errorOf(server.enterArena(1))).toContain("too_low");
    await makeCharacter(server, "test-b", "외톨이");
    await giveXp("test-b", xpFor(ARENA_LEVEL));
    await enterAs(server, "test-b");
    const there = (await $global.getUserState("test-b")).where;
    server.connect({ account: "test-b", roomId: `rpg-${there.world}-${there.zone}-${there.channel}` });
    expect(await errorOf(server.enterArena(1))).toContain("no_guild");
  });

  test("damage done in two rooms joins the guild's week, and each room's boss shows what is left", async (server) => {
    const guild = await member(server, "test-a", "보스장", null);
    await member(server, "test-b", "둘째", guild);
    const one = await intoArena(server, "test-a", 1);
    await server.simulateTick(one.roomId, 200);
    await atBoss(server);
    const hit = await server.strike("boss");
    const first = hit.dealt.boss;
    expect(first).toBeGreaterThan(0);
    await syncNow(server, one.roomId);
    expect((await bossWeek(guild)).damage).toBe(first);

    const two = await intoArena(server, "test-b", 2);
    await server.simulateTick(two.roomId, 200);
    expect((await $room.getRoomState(["monsters"])).monsters.boss.hp).toBe(bossMax(2) - first);
    await atBoss(server);
    const second = (await server.strike("boss")).dealt.boss;
    await syncNow(server, two.roomId);
    const w = await bossWeek(guild);
    expect(w.damage).toBe(first + second);
    expect(Object.keys(w.hitters).length).toBe(2);
    expect((await server.guildBoss()).rooms.slice(0, 2)).toEqual([1, 1]);
  });

  test("three minutes, then no more blows; falling there costs no XP", async (server) => {
    await member(server, "test-a", "보스장", null);
    const entry = await intoArena(server, "test-a");
    await server.simulateTick(entry.roomId, 200);
    await atBoss(server);
    const xp = (await server.getAccount()).xp;
    await $room.updateMyState({ hp: 1 });
    const now = Date.now();
    const boss = zoneLayout("arena").bossSpawn!;
    await $room.updateRoomState({
      telegraphs: [{ id: "t", shape: { kind: "circle", x: boss.x, z: boss.z + 2, r: 3 }, startAt: now - 1000, hitAt: now - 1, share: 0.5 }],
    });
    await server.simulateTick(entry.roomId, 200);
    expect((await $room.getMyState()).dead).toBe(true);
    expect((await server.getAccount()).xp).toBe(xp);

    await $room.updateMyState({ dead: false, hp: 100, arenaUntil: Date.now() - 1 });
    expect(await errorOf(server.strike("boss"))).toContain("arena_over");
    await server.simulateTick(entry.roomId, 200);
    expect((await $room.getMyState()).timeUp).toBe(true);
    // Out again, back in the field.
    const back = await server.leaveArena();
    expect(back.zone).toBe("village");
  });

  test("a room holds six", async (server) => {
    const guild = await member(server, "test-a", "보스장", null);
    for (let i = 0; i < ARENA_SEATS; i++) await server.simulateJoin(`gboss-${guild}-1`, `test-x${i}`);
    const here = (await $global.getUserState("test-a")).where;
    server.connect({ account: "test-a", roomId: `rpg-${here.world}-${here.zone}-${here.channel}` });
    expect(await errorOf(server.enterArena(1))).toContain("room_full");
  });

  test("each stage passed pays everyone who went in that week, once; the last brings tradable gear and closes the week", async (server) => {
    const guild = await member(server, "test-a", "보스장", null);
    await member(server, "test-b", "구경꾼", guild);
    const entry = await intoArena(server, "test-a");
    await server.simulateTick(entry.roomId, 200);
    const max = bossMax(2);
    // Just short of the first quarter.
    const w = await bossWeek(guild);
    await $global.updateCollectionItem("guildBoss", { __id: w.__id, damage: max * 0.25 - 1 });
    await atBoss(server);
    await server.strike("boss");
    await syncNow(server, entry.roomId);
    server.connect({ account: "test-a" });
    const mine = (await server.getMail()).mail.filter((m: any) => m.kind === "guild_boss");
    expect(mine.length).toBe(1);
    expect(mine[0].gold).toBe(STAGE_REWARDS[0].gold);
    // test-b never went in: nothing.
    server.connect({ account: "test-b" });
    expect((await server.getMail()).mail.filter((m: any) => m.kind === "guild_boss")).toEqual([]);

    // All the way: the rest of the stages at once, and gear that may be traded.
    await $global.updateCollectionItem("guildBoss", { __id: w.__id, damage: max - 1 });
    server.connect({ account: "test-a", roomId: entry.roomId });
    await $room.updateMyState({ strikeReadyAt: 0 });
    await server.strike("boss");
    await syncNow(server, entry.roomId);
    server.connect({ account: "test-a" });
    const all = (await server.getMail()).mail.filter((m: any) => m.kind === "guild_boss");
    expect(all.map((m: any) => m.params.stage).sort()).toEqual([1, 2, 3, 4]);
    const last = all.find((m: any) => m.params.stage === 4);
    expect(last.items.find((i: any) => i.id !== "stone").trade).toBe(true);
    expect((await bossWeek(guild)).damage).toBe(max);
    server.connect({ account: "test-a", roomId: entry.roomId });
    expect((await $room.getRoomState(["monsters"])).monsters.boss.alive).toBe(false);
    // The boss is down: no one goes in again this week.
    await server.leaveArena();
    await enterAs(server, "test-b");
    const here = (await $global.getUserState("test-b")).where;
    server.connect({ account: "test-b", roomId: `rpg-${here.world}-${here.zone}-${here.channel}` });
    expect(await errorOf(server.enterArena(1))).toContain("boss_down");
  });
});
