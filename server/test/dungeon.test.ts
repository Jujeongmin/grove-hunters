import { BRACKETS, DAILY_RUNS, DUNGEON_MS, FIRST_GEMS, READY_MS, WAVES } from "../../src/game/world/dungeon";
import { dailyDay } from "../../src/game/account/quests";
import { enterAs, errorOf, giveXp, join, makeCharacter } from "./helpers";

// Runs `run` as if it were `ms` from now.
async function later<T>(ms: number, run: () => Promise<T>): Promise<T> {
  const realNow = Date.now;
  Date.now = () => realNow() + ms;
  try {
    return await run();
  } finally {
    Date.now = realNow;
  }
}

// A character of the low bracket, in the world; answers its room.
async function hunter(server: any, account: string, name: string): Promise<string> {
  await makeCharacter(server, account, name);
  await giveXp(account, 200_000);
  return (await enterAs(server, account)).roomId;
}

// From `from` into the dungeon room, as the client does it.
async function goIn(server: any, account: string, from: string): Promise<string> {
  server.connect({ account, roomId: from });
  return (await join(server, account, await server.enterDungeon(), from)).roomId;
}

// Everything in the room falls (the waves, the boss and its brood), and the room ticks on.
async function clearRoom(server: any, account: string, roomId: string): Promise<void> {
  server.connect({ account, roomId });
  const { monsters } = await $room.getRoomState(["monsters"]);
  const down = Object.fromEntries(Object.entries(monsters ?? {}).map(([id, m]: [string, any]) => [id, { ...m, hp: 0, alive: false }]));
  await $room.updateRoomState({ monsters: down });
  await server.simulateTick(roomId, 200);
}

// A plain copy of what the server answered, to compare deeply.
const plain = (value: unknown): any => JSON.parse(JSON.stringify(value));

async function runOf(server: any, account: string, roomId: string): Promise<any> {
  server.connect({ account, roomId });
  return JSON.parse(JSON.stringify((await $room.getRoomState(["dungeon"])).dungeon));
}

// Both wait in the queue for `ms`, asking every 10 seconds as the screen does (a group that stops
// asking is dropped).
async function wait(server: any, players: [string, string][], ms: number): Promise<void> {
  for (let t = 10_000; t < ms; t += 10_000) {
    await later(t, async () => {
      for (const [account, roomId] of players) {
        server.connect({ account, roomId });
        await server.dungeonState();
      }
    });
  }
}

describe("the Trial Dungeon", () => {
  test("alone: straight in, two waves and the boss, then the clear's reward by mail and a run used", async (server) => {
    const field = await hunter(server, "test-a", "던전왕");
    server.connect({ account: "test-a", roomId: field });
    const view = await server.soloDungeon();
    expect(view.match.started).toBe(true);
    expect(view.runsLeft).toBe(DAILY_RUNS);
    const room = await goIn(server, "test-a", field);
    await server.simulateTick(room, 200);
    const first = await runOf(server, "test-a", room);
    expect(first).toMatchObject({ bracket: "low", size: 1, wave: 1, status: "running" });
    const { monsters } = await $room.getRoomState(["monsters"]);
    expect(Object.values(monsters).filter((m: any) => m.alive).length).toBe(4);
    for (let wave = 2; wave <= WAVES + 1; wave++) {
      await clearRoom(server, "test-a", room);
      expect((await runOf(server, "test-a", room)).wave).toBe(wave);
    }
    const boss = (await $room.getRoomState(["monsters"])).monsters.boss;
    expect(boss.type).toBe(BRACKETS[0].boss);
    expect(boss.maxHp).toBe(Math.round(BRACKETS[0].bossHp * 0.4));
    await clearRoom(server, "test-a", room);
    const done = await runOf(server, "test-a", room);
    expect(done.status).toBe("cleared");
    server.connect({ account: "test-a" });
    const [letter] = (await server.getMail()).mail.filter((m: any) => m.kind === "dungeon");
    expect(letter.gems).toBe(FIRST_GEMS);
    expect(letter.gold).toBeGreaterThanOrEqual(BRACKETS[0].gold);
    expect(plain(letter.items[0])).toEqual({ id: "stone", n: BRACKETS[0].stones });
    // Out again, back in the field, with a run used.
    server.connect({ account: "test-a", roomId: room });
    const back = await server.leaveDungeon();
    expect(back.zone === "dungeon").toBe(false);
    server.connect({ account: "test-a", roomId: back.roomId });
    expect((await server.dungeonState()).runsLeft).toBe(DAILY_RUNS - 1);
  });

  test("two queued are matched once they have waited, say yes, and go in together", async (server) => {
    const fa = await hunter(server, "test-a", "매칭하나");
    const fb = await hunter(server, "test-b", "매칭둘둘");
    server.connect({ account: "test-a", roomId: fa });
    expect((await server.queueDungeon()).queued === null).toBe(false);
    server.connect({ account: "test-b", roomId: fb });
    expect((await server.queueDungeon()).match).toBeNull();
    await wait(server, [["test-a", fa], ["test-b", fb]], 61_000);
    // A minute on, two are enough.
    const matched = await later(61_000, async () => {
      server.connect({ account: "test-a", roomId: fa });
      return server.dungeonState();
    });
    expect(plain(matched.match.names).sort()).toEqual(["매칭둘둘", "매칭하나"].sort());
    expect(matched.match.started).toBe(false);
    await later(61_000, async () => {
      server.connect({ account: "test-a", roomId: fa });
      await server.readyDungeon();
      server.connect({ account: "test-b", roomId: fb });
      expect((await server.readyDungeon()).match.started).toBe(true);
    });
    const ra = await goIn(server, "test-a", fa);
    const rb = await goIn(server, "test-b", fb);
    expect(ra).toBe(rb);
    await server.simulateTick(ra, 200);
    expect((await runOf(server, "test-a", ra)).size).toBe(2);
  });

  test("a match starts with those who said yes in time; the rest are let go", async (server) => {
    const fa = await hunter(server, "test-a", "준비완료");
    const fb = await hunter(server, "test-b", "잠수중임");
    server.connect({ account: "test-a", roomId: fa });
    await server.queueDungeon();
    server.connect({ account: "test-b", roomId: fb });
    await server.queueDungeon();
    await wait(server, [["test-a", fa], ["test-b", fb]], 61_000);
    await later(61_000, async () => {
      server.connect({ account: "test-a", roomId: fa });
      await server.dungeonState();
      await server.readyDungeon();
    });
    const after = await later(61_000 + READY_MS + 1, async () => {
      server.connect({ account: "test-a", roomId: fa });
      const a = await server.dungeonState();
      server.connect({ account: "test-b", roomId: fb });
      return { a, b: await server.dungeonState() };
    });
    expect(plain(after.a.match)).toMatchObject({ started: true, names: ["준비완료"] });
    expect(after.b.match).toBeNull();
    server.connect({ account: "test-b", roomId: fb });
    expect(await errorOf(server.enterDungeon())).toContain("no_match");
  });

  test("three runs a day", async (server) => {
    const field = await hunter(server, "test-a", "세번까지");
    await $global.updateUserState("test-a", { dungeonRuns: { day: dailyDay(Date.now()), n: DAILY_RUNS } });
    server.connect({ account: "test-a", roomId: field });
    expect(await errorOf(server.soloDungeon())).toContain("no_runs");
    expect(await errorOf(server.queueDungeon())).toContain("no_runs");
  });

  test("time running out fails the run, and pays nothing", async (server) => {
    const field = await hunter(server, "test-a", "시간초과");
    server.connect({ account: "test-a", roomId: field });
    await server.soloDungeon();
    const room = await goIn(server, "test-a", field);
    await server.simulateTick(room, 200);
    await later(DUNGEON_MS + 1, () => server.simulateTick(room, 200));
    expect((await runOf(server, "test-a", room)).status).toBe("failed");
    server.connect({ account: "test-a" });
    expect((await server.getMail()).mail.filter((m: any) => m.kind === "dungeon")).toEqual([]);
  });
});
