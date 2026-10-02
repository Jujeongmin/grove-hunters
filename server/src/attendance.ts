import {
  ATTEND_REWARDS, attendanceView, readAttendance, stampToday, type AttendanceView,
} from "../../src/game/account/attendance";
import { dailyDay } from "../../src/game/account/quests";
import { sendMail } from "./mail";

// The attendance sheet (see attendance.ts), changed under the account's own lock so two tabs coming
// in together stamp one box.
function withAttendLock<T>(account: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`attend:${account}`, fn);
}

async function readOf(account: string) {
  return readAttendance((await $global.getUserState(account)).attendance);
}

// Today's box, the first time the account comes into the world today: stamped, and its reward sent by
// mail. Nothing on a day stamped already.
export async function stampAttendance(account: string, now: number): Promise<void> {
  await withAttendLock(account, async () => {
    const stamped = stampToday(await readOf(account), dailyDay(now));
    if (!stamped) return;
    // Stamped first: should the letter fail, the day is missed rather than paid twice.
    await $global.updateUserState(account, { attendance: stamped.next });
    const reward = ATTEND_REWARDS[stamped.box - 1];
    await sendMail(account, {
      kind: "attendance", gold: reward.gold, gems: reward.gems, tickets: reward.tickets, items: reward.items, params: { day: stamped.box },
    }, now);
  });
}

export async function attendanceOf(account: string, now: number): Promise<AttendanceView> {
  return attendanceView(await readOf(account), dailyDay(now));
}

// Today's sheet has been looked at (it opens by itself only once a day).
export async function markAttendanceSeen(account: string, now: number): Promise<AttendanceView> {
  return withAttendLock(account, async () => {
    const next = { ...(await readOf(account)), seenDay: dailyDay(now) };
    await $global.updateUserState(account, { attendance: next });
    return attendanceView(next, dailyDay(now));
  });
}
