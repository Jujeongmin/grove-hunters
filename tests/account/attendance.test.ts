import { describe, expect, it } from "vitest";
import {
  ATTEND_DAYS, ATTEND_REWARDS, ATTEND_TICKETS, NO_ATTENDANCE, attendanceView, readAttendance, stampToday,
} from "../../src/game/account/attendance";

describe("attendance", () => {
  it("has a reward and a mount ticket for every box, the most gems at the end of each week, and no potions", () => {
    expect(ATTEND_REWARDS.length).toBe(ATTEND_DAYS);
    expect(ATTEND_REWARDS.every((r) => r.tickets === ATTEND_TICKETS)).toBe(true);
    for (const week of [0, 1, 2, 3]) {
      const days = ATTEND_REWARDS.slice(week * 7, week * 7 + 7);
      expect(Math.max(...days.map((r) => r.gems))).toBe(days[6].gems);
    }
    expect(ATTEND_REWARDS.reduce((n, r) => n + r.gems, 0)).toBe(550);
    expect(ATTEND_REWARDS.reduce((n, r) => n + r.gold, 0)).toBe(98000);
    for (const r of ATTEND_REWARDS) expect(r.items.every((item) => item.id === "stone" && item.n > 0 && item.n <= 99)).toBe(true);
  });

  it("reads a saved sheet, keeping only what makes sense", () => {
    expect(readAttendance(undefined)).toEqual(NO_ATTENDANCE);
    expect(readAttendance({ stamps: 40, lastDay: "2026-10-02", seenDay: "yesterday", total: 3 }))
      .toEqual({ stamps: ATTEND_DAYS, lastDay: "2026-10-02", seenDay: null, total: ATTEND_DAYS });
  });

  it("stamps one box a day, and never twice on one day", () => {
    const first = stampToday(NO_ATTENDANCE, "2026-10-02")!;
    expect(first.box).toBe(1);
    expect(first.next).toMatchObject({ stamps: 1, lastDay: "2026-10-02", total: 1 });
    expect(stampToday(first.next, "2026-10-02")).toBeNull();
    // A day missed breaks nothing.
    expect(stampToday(first.next, "2026-10-05")!.box).toBe(2);
  });

  it("starts a new sheet the day after the last box", () => {
    const full = { ...NO_ATTENDANCE, stamps: ATTEND_DAYS, lastDay: "2026-10-01", total: 30 };
    const next = stampToday(full, "2026-10-02")!;
    expect(next.box).toBe(1);
    expect(next.next).toMatchObject({ stamps: 1, total: 31 });
  });

  it("tells the screen whether today is stamped and looked at", () => {
    const a = { stamps: 3, lastDay: "2026-10-02", seenDay: null, total: 3 };
    expect(attendanceView(a, "2026-10-02")).toEqual({ stamps: 3, stampedToday: true, seen: false, total: 3 });
    expect(attendanceView({ ...a, seenDay: "2026-10-02" }, "2026-10-02").seen).toBe(true);
    expect(attendanceView(a, "2026-10-03").stampedToday).toBe(false);
  });
});
