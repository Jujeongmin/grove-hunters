import { ATTEND_DAYS, ATTEND_REWARDS } from "../../src/game/account/attendance";
import { achievementById } from "../../src/game/account/achievements";
import { DAILY_QUESTS, dailyDay } from "../../src/game/account/quests";
import { enhanceCost } from "../../src/game/account/forge";
import { spawnMonsters } from "../../src/game/world/monsters";
import { portalsOf, zoneLayout } from "../../src/game/world/zones";
import { enterAs, errorOf, giveXp, join, makeCharacter, toNpc, walkTo } from "./helpers";
import { readProfile, updateActive } from "../src/store";

const DAY = 24 * 60 * 60 * 1000;

// Runs `run` as if it were `days` days from now.
async function later<T>(days: number, run: () => Promise<T>): Promise<T> {
  const realNow = Date.now;
  Date.now = () => realNow() + days * DAY;
  try {
    return await run();
  } finally {
    Date.now = realNow;
  }
}

async function attendanceMail(server: any, account: string): Promise<any[]> {
  server.connect({ account });
  return (await server.getMail()).mail.filter((m: any) => m.kind === "attendance").sort((a: any, b: any) => a.params.day - b.params.day);
}

describe("the attendance sheet", () => {
  test("the first visit of a day stamps a box and mails its reward, once a day", async (server) => {
    await makeCharacter(server, "test-a", "출석왕");
    await enterAs(server, "test-a");
    await enterAs(server, "test-a");
    const letters = await attendanceMail(server, "test-a");
    expect(letters.map((m) => m.params.day)).toEqual([1]);
    expect(letters[0].gold).toBe(ATTEND_REWARDS[0].gold);
    expect(await server.getAttendance()).toEqual({ stamps: 1, stampedToday: true, seen: false, total: 1 });
    // Looked at: it opens by itself no more today.
    expect((await server.markAttendanceSeen()).seen).toBe(true);

    // Two days later (one missed), the next box.
    await later(2, () => enterAs(server, "test-a"));
    const next = await attendanceMail(server, "test-a");
    expect(next.map((m) => m.params.day)).toEqual([1, 2]);
    expect(next[1].gems).toBe(ATTEND_REWARDS[1].gems);
  });

  test("a box's mount ticket goes to the account, and hatches a mount at the stable without gems", async (server) => {
    await makeCharacter(server, "test-a", "소환왕");
    await enterAs(server, "test-a");
    const [letter] = await attendanceMail(server, "test-a");
    expect(letter.tickets).toBe(ATTEND_REWARDS[0].tickets);
    await server.claimMail(letter.id);
    expect((await server.getMounts()).tickets).toBe(1);

    const pulled = await server.pullMount(true);
    expect(pulled.pulls.length).toBe(1);
    expect(pulled.tickets).toBe(0);
    expect(pulled.gems).toBe(0);
    expect(await errorOf(server.pullMount(true))).toContain("no_ticket");
  });

  test("after the last box, a new sheet starts at the first", async (server) => {
    await makeCharacter(server, "test-a", "개근상");
    await $global.updateUserState("test-a", { attendance: { stamps: ATTEND_DAYS, lastDay: "2000-01-01", total: 40 } });
    await enterAs(server, "test-a");
    expect((await attendanceMail(server, "test-a")).map((m) => m.params.day)).toEqual([1]);
    expect(await server.getAttendance()).toMatchObject({ stamps: 1, total: 41 });
  });
});

describe("achievements", () => {
  test("a goal met pays its gems once; one not met, or unknown, is refused", async (server) => {
    await makeCharacter(server, "test-a", "업적왕");
    await giveXp("test-a", 1_000_000);
    server.connect({ account: "test-a" });
    const view = await server.getAchievements();
    const row = (id: string) => view.list.find((a: any) => a.id === id);
    expect(row("level-10").progress).toBe(10);
    expect(view.claimable).toBeGreaterThan(0);

    const claimed = await server.claimAchievement("level-10");
    expect(claimed.gems).toBe(achievementById("level-10")!.gems);
    expect(claimed.list.find((a: any) => a.id === "level-10").claimed).toBe(true);
    expect(claimed.claimable).toBe(view.claimable - 1);
    expect(await errorOf(server.claimAchievement("level-10"))).toContain("unavailable");
    expect(await errorOf(server.claimAchievement("level-60"))).toContain("unavailable");
    expect(await errorOf(server.claimAchievement("nope"))).toContain("unavailable");
  });

  test("claiming all pays every goal met at once, then has nothing left to claim", async (server) => {
    await makeCharacter(server, "test-a", "몽땅왕");
    await giveXp("test-a", 1_000_000);
    server.connect({ account: "test-a" });
    const view = await server.getAchievements();
    const ready = view.list.filter((a: any) => !a.claimed && a.progress >= a.goal);
    const all = await server.claimAllAchievements();
    expect(all.claimed).toBe(ready.length);
    expect(all.gems).toBe(ready.reduce((n: number, a: any) => n + a.gems, 0));
    expect(all.claimable).toBe(0);
    expect(await errorOf(server.claimAllAchievements())).toContain("unavailable");
  });

  test("counts across every character the account has", async (server) => {
    await makeCharacter(server, "test-a", "첫째");
    await updateActive("test-a", (c) => ({ ...c, record: { kills: 60, bosses: {}, dailies: 0, bestPlus: 0 } }));
    await makeCharacter(server, "test-a", "둘째");
    await updateActive("test-a", (c) => ({ ...c, record: { kills: 50, bosses: {}, dailies: 0, bestPlus: 0 } }));
    server.connect({ account: "test-a" });
    expect((await server.getAchievements()).list.find((a: any) => a.id === "kills-100").progress).toBe(100);
  });

  test("hunting, daily rewards and enhancing add to the character's record", async (server) => {
    await makeCharacter(server, "test-a", "기록왕");
    const village = await enterAs(server, "test-a");
    // A rat felled in the first field.
    const portal = portalsOf("village").find((p) => p.to === "forest1")!;
    await walkTo(server, portal.x, portal.z);
    await join(server, "test-a", await server.travel("forest1"), village.roomId);
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
    expect((await server.strike("m0")).killed).toEqual(["m0"]);

    // A daily reward taken.
    const quest = DAILY_QUESTS[0];
    await updateActive("test-a", (c) => ({ ...c, daily: { day: dailyDay(Date.now()), counts: { [quest.id]: quest.count }, claimed: [] } }));
    await server.claimDaily(quest.id);

    // An enhancement to +1.
    await updateActive("test-a", (c) => ({ ...c, bag: { ...c.bag, stone: 5 }, gear: { ...c.gear, weapon: { uid: "g-w", id: "weapon_2", plus: 0, trade: false } } }));
    await $asset.mint("gold", enhanceCost("weapon_2", 0)!.gold);
    await toNpc(server, "smith");
    const real = Math.random;
    Math.random = () => 0;
    try {
      expect((await server.enhanceGear("weapon")).outcome).toBe("success");
    } finally {
      Math.random = real;
    }

    const { active } = await readProfile("test-a");
    expect(active!.record).toEqual({ kills: 1, bosses: {}, dailies: 1, bestPlus: 1 });
  });
});
