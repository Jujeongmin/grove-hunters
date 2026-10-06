import type { ItemId } from "./items";

// The attendance sheet (출석부, see docs/superpowers/specs/2026-10-02-attendance-achievements-design.md):
// the first time an account comes into the world on a day (Korean time), the next of the sheet's
// ATTEND_DAYS boxes is stamped and its reward sent by mail. Days missed break nothing; the day after the
// last box, a new sheet starts. Kept on the account, so every server and character shares it.

export const ATTEND_DAYS = 28;

// Twice a week, on these days of each week (1 to 7), a box also brings a mount ticket (소환권: a hatch at
// the stable without gems).
export const TICKET_WEEKDAYS: readonly number[] = [7];

export interface AttendReward { gold: number; gems: number; tickets: number; items: { id: ItemId; n: number }[] }

const gold = (n: number): AttendReward => ({ gold: n, gems: 0, tickets: 0, items: [] });
const gems = (n: number): AttendReward => ({ gold: 0, gems: n, tickets: 0, items: [] });
const stones = (n: number): AttendReward => ({ gold: 0, gems: 0, tickets: 0, items: [{ id: "stone", n }] });

// Box n's reward is ATTEND_REWARDS[n - 1]: gold, a few gems and 강화석 in turn, more gems at the end of
// each week, and a ticket on the ticket days.
export const ATTEND_REWARDS: readonly AttendReward[] = [
  gold(3000), gems(5), stones(5), gold(5000), gems(5), stones(10), gems(25),
  gold(8000), gems(8), stones(10), gold(10000), gems(8), stones(15), gems(40),
  gold(12000), gems(10), stones(15), gold(15000), gems(10), stones(20), gems(40),
  gold(20000), gems(12), stones(20), gold(25000), gems(12), stones(30), gems(100),
].map((reward, i) => (TICKET_WEEKDAYS.includes((i % 7) + 1) ? { ...reward, tickets: 1 } : reward));

export interface Attendance {
  // Boxes stamped on the sheet in hand (0 to ATTEND_DAYS).
  stamps: number;
  // The last day stamped, and the last day its sheet was looked at (YYYY-MM-DD, Korean time).
  lastDay: string | null;
  seenDay: string | null;
  // Every day ever stamped.
  total: number;
}

export const NO_ATTENDANCE: Attendance = { stamps: 0, lastDay: null, seenDay: null, total: 0 };

const count = (v: unknown, cap = Infinity) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? Math.min(v, cap) : 0);
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// An account's attendance as saved (its user state's `attendance`), whatever it holds.
export function readAttendance(raw: unknown): Attendance {
  const r = (raw ?? {}) as Record<string, unknown>;
  const stamps = count(r.stamps, ATTEND_DAYS);
  return { stamps, lastDay: day(r.lastDay), seenDay: day(r.seenDay), total: Math.max(count(r.total), stamps) };
}

// Today's stamp: the sheet after it and the box stamped (1 to ATTEND_DAYS), or null when today is
// stamped already. A full sheet starts over at box 1.
export function stampToday(a: Attendance, today: string): { next: Attendance; box: number } | null {
  if (a.lastDay === today) return null;
  const box = a.stamps >= ATTEND_DAYS ? 1 : a.stamps + 1;
  return { next: { ...a, stamps: box, lastDay: today, total: a.total + 1 }, box };
}

// What the sheet's screen is given.
export interface AttendanceView {
  stamps: number;
  stampedToday: boolean;
  // Whether today's sheet has been looked at.
  seen: boolean;
  total: number;
}

export function attendanceView(a: Attendance, today: string): AttendanceView {
  return { stamps: a.stamps, stampedToday: a.lastDay === today, seen: a.seenDay === today, total: a.total };
}
