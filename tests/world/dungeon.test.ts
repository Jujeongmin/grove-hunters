import { describe, expect, it } from "vitest";
import {
  BRACKETS, DUNGEON_SIZE, FAST_MS, FIRST_GEMS, bossHpFor, bracketOf, clearReward, dungeonRoomId, pickGroups, readDungeonRoom, readRun,
  startSize, waveFor,
} from "../../src/game/world/dungeon";
import { MONSTERS } from "../../src/game/world/monsters";

const group = (id: string, at: number, size = 1) => ({ id, at, size });

describe("the Trial Dungeon", () => {
  it("picks a bracket by level, none below the first", () => {
    expect(bracketOf(9)).toBeNull();
    expect(bracketOf(10)?.id).toBe("low");
    expect(bracketOf(29)?.id).toBe("low");
    expect(bracketOf(30)?.id).toBe("mid");
    expect(bracketOf(70)?.id).toBe("high");
    for (const b of BRACKETS) for (const type of b.waves) expect(MONSTERS[type]).toBeDefined();
  });

  it("sizes the boss and the waves to how many came", () => {
    const low = BRACKETS[0];
    expect(bossHpFor(low, 4)).toBe(low.bossHp);
    expect(bossHpFor(low, 1)).toBe(Math.round(low.bossHp * 0.4));
    expect(bossHpFor(low, 9)).toBe(low.bossHp);
    expect(waveFor(1, 1)).toEqual({ count: 4, hpScale: 1 });
    expect(waveFor(2, 4)).toEqual({ count: 8, hpScale: 2.2 });
  });

  it("starts with fewer the longer the oldest has waited", () => {
    expect(startSize(0)).toBe(DUNGEON_SIZE);
    expect(startSize(30_000)).toBe(3);
    expect(startSize(60_000)).toBe(2);
    expect(startSize(90_000)).toBe(1);
  });

  it("matches whole groups, oldest first, never past four, and only as many as the wait allows", () => {
    const now = 100_000;
    // Four at once: a match at any time.
    expect(pickGroups([group("a", now), group("b", now - 1, 3)], now)?.map((g) => g.id)).toEqual(["b", "a"]);
    // Two after a few seconds: not yet; after a minute: yes.
    expect(pickGroups([group("a", now - 5_000), group("b", now - 4_000)], now)).toBeNull();
    expect(pickGroups([group("a", now - 61_000), group("b", now - 4_000)], now)?.length).toBe(2);
    // A party of three and two singles: the party and the oldest single make four; the other waits.
    expect(pickGroups([group("s1", now - 3_000), group("p", now - 2_000, 3), group("s2", now - 1_000)], now)?.map((g) => g.id)).toEqual(["s1", "p"]);
    // A group that does not fit is passed over, not split.
    expect(pickGroups([group("p3", now - 3_000, 3), group("p2", now - 2_000, 2), group("s", now - 1_000)], now)?.map((g) => g.id)).toEqual(["p3", "s"]);
    expect(pickGroups([], now)).toBeNull();
  });

  it("pays a clear: more gold when fast, gems the day's first time, gear by chance", () => {
    const mid = BRACKETS[1];
    const lucky = () => 0;
    expect(clearReward(mid, FAST_MS, true, lucky)).toEqual({ gold: mid.gold * 1.5, stones: mid.stones, gear: mid.gear[0], gems: FIRST_GEMS });
    expect(clearReward(mid, FAST_MS + 1, false, () => 0.99)).toEqual({ gold: mid.gold, stones: mid.stones, gear: null, gems: 0 });
  });

  it("names its rooms after the match, and reads a run back", () => {
    expect(readDungeonRoom(dungeonRoomId("m1"))).toEqual({ matchId: "m1" });
    expect(readDungeonRoom("w1-forest1-1")).toBeNull();
    expect(readRun({ match: "m1", bracket: "low", size: 2, wave: 1, status: "running", startedAt: 1, endsAt: 2 })?.clearMs).toBeNull();
    expect(readRun({ match: "m1", bracket: "nope", wave: 1, status: "running", startedAt: 1, endsAt: 2 })).toBeNull();
  });
});
