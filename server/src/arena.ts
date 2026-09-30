import { SYNC_MS, readArenaRoom, type Hitter } from "../../src/game/world/guildBoss";
import type { MonsterState } from "../../src/game/world/monsters";
import { zoneLayout } from "../../src/game/world/zones";
import { addDamage, findWeek } from "./guildBoss";
import { tickRoom, withRoomLock } from "./hunt";

// A guild boss room (see guildBoss.ts): the boss stands in the middle with the guild's shared health
// for the week. Damage done here waits in the room state and joins the week every SYNC_MS; then the
// room's boss takes the week's health again (the other rooms' damage with it).

// What the room keeps of the fight: whose boss, which week, its full health, when it last synced.
interface ArenaState { guild: string; week: number; max: number; syncAt: number }

function readArena(raw: unknown): ArenaState | null {
  const a = raw as Partial<ArenaState> | null;
  return a && typeof a.guild === "string" && typeof a.week === "number" && typeof a.max === "number" && typeof a.syncAt === "number"
    ? { guild: a.guild, week: a.week, max: a.max, syncAt: a.syncAt } : null;
}

function readPending(raw: unknown): Record<string, Hitter> {
  const out: Record<string, Hitter> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, h] of Object.entries(raw as Record<string, Partial<Hitter>>)) {
    if (h && typeof h.account === "string" && typeof h.name === "string" && typeof h.damage === "number") out[id] = h as Hitter;
  }
  return out;
}

// Puts the week's boss in a room that has none yet. Nothing, if the guild has no week this week (no one
// has gone in: entering makes it).
async function setUp(guildId: string, week: number, now: number): Promise<void> {
  const w = await findWeek(guildId, week);
  if (!w) return;
  const at = zoneLayout("arena").bossSpawn!;
  const hp = Math.max(0, w.max - w.damage);
  const boss: MonsterState = {
    type: w.boss, x: at.x, z: at.z, yaw: 0, hp, maxHp: w.max, alive: hp > 0, stunnedUntil: 0, attackReadyAt: 0,
    respawnAt: Number.MAX_SAFE_INTEGER, homeX: at.x, homeZ: at.z,
  };
  await $room.updateRoomState({ arena: { guild: guildId, week, max: w.max, syncAt: now + SYNC_MS }, monsters: { boss }, telegraphs: [] });
}

// Damage a character did to the boss here, waiting for the next sync.
export async function noteArenaDamage(roomId: string, characterId: string, account: string, name: string, dealt: number): Promise<void> {
  if (dealt <= 0) return;
  await withRoomLock(roomId, async () => {
    const pending = readPending((await $room.getRoomState(["arenaPending"])).arenaPending);
    const was = pending[characterId]?.damage ?? 0;
    await $room.updateRoomState({ arenaPending: { ...pending, [characterId]: { account, name, damage: was + dealt } } }, { returnState: false });
  });
}

// One tick of a boss room: set up on the first, the fight itself (see tickRoom), anyone whose three
// minutes are up told so, and every SYNC_MS the damage joins the week. Answers who fell.
export async function tickArena(roomId: string, week: number, delta: number, now: number): Promise<string[]> {
  const place = readArenaRoom(roomId);
  if (!place) return [];
  const { arena } = await $room.getRoomState(["arena"]);
  const state = readArena(arena);
  if (!state || state.week !== week) {
    await withRoomLock(roomId, () => setUp(place.guildId, week, now));
    if (!readArena((await $room.getRoomState(["arena"])).arena)) return [];
  }
  const fell = await withRoomLock(roomId, () => tickRoom("arena", delta, now));
  await timeUp(now);
  const current = readArena((await $room.getRoomState(["arena"])).arena);
  if (current && now >= current.syncAt) await sync(roomId, current, now);
  return fell;
}

// Those whose three minutes are over are told (their client takes them out; the server takes no more
// blows from them).
async function timeUp(now: number): Promise<void> {
  const accounts: string[] = (await $room.getRoomState([])).$users ?? [];
  if (accounts.length === 0) return;
  const users: (Record<string, unknown> & { account: string })[] = await $room.getUserStates(accounts, ["arenaUntil", "timeUp"]);
  for (const u of users) {
    if (typeof u.arenaUntil === "number" && now >= u.arenaUntil && u.timeUp !== true) {
      await $room.updateUserState(u.account, { timeUp: true }, { returnState: false });
    }
  }
}

async function sync(roomId: string, state: ArenaState, now: number): Promise<void> {
  const pending = await withRoomLock(roomId, async () => {
    const taken = readPending((await $room.getRoomState(["arenaPending"])).arenaPending);
    await $room.updateRoomState({ arenaPending: {}, arena: { ...state, syncAt: now + SYNC_MS } }, { returnState: false });
    return taken;
  });
  const w = await addDamage(state.guild, state.week, pending, now);
  if (!w) return;
  const left = Math.max(0, w.max - w.damage);
  await withRoomLock(roomId, async () => {
    const monsters = (await $room.getRoomState(["monsters"])).monsters as Record<string, MonsterState> | undefined;
    const boss = monsters?.boss;
    if (!boss) return;
    // Damage done here since the sync began is still on the room's boss, not yet in the week.
    const since = Object.values(readPending((await $room.getRoomState(["arenaPending"])).arenaPending)).reduce((n, h) => n + h.damage, 0);
    const hp = Math.max(0, left - since);
    const next = { ...boss, hp, maxHp: w.max, alive: boss.alive && hp > 0 };
    if (!next.alive) next.respawnAt = Number.MAX_SAFE_INTEGER;
    await $room.updateRoomState({ monsters: { ...monsters, boss: next } }, { returnState: false });
  });
}

