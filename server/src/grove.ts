import { addItem, type ItemId } from "../../src/game/account/items";
import { completionRewards, donation, giveTo, settle, underWay, type Offer } from "../../src/game/world/grove";
import type { Character } from "../../src/game/account/characters";
import { RuleViolation } from "../../src/game/world/types";
import {
  FLUSH_MS, addKills, groveView, markHunted, openSite, readGrove, readUserGrove, readVillage, weekOf,
  type GroveRecord, type GroveView, type VillageRecord,
} from "../../src/game/world/grove";
import { GROVE_GUARDIAN_ZONE, MONSTERS, type MonsterState } from "../../src/game/world/monsters";
import { readChannelRoom, zoneLayout, type ZoneId } from "../../src/game/world/zones";
import { withRoomLock } from "./hunt";

// A server's grove and village records (one item each in these collections), and the room side of
// the grove: kills counted in the room and added to the record every FLUSH_MS of ticks.
const GROVE_COLLECTION = "grove";
const VILLAGE_COLLECTION = "village";
// Perks are read on every kill; the village is kept this long between reads (a write refreshes it).
const VILLAGE_CACHE_MS = 30_000;

export function withGroveLock<T>(world: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`grove-${world}`, fn);
}

async function readItem(collection: string, world: string): Promise<{ id: string | null; raw: unknown }> {
  const [item] = await $global.getCollectionItems(collection, { filters: [{ field: "world", operator: "==", value: world }], limit: 1 });
  return { id: (item as { __id?: string } | undefined)?.__id ?? null, raw: item ?? null };
}

async function writeItem(collection: string, world: string, id: string | null, value: object): Promise<void> {
  if (id) await $global.updateCollectionItem(collection, { __id: id, world, ...value });
  else await $global.addCollectionItem(collection, { world, ...value });
}

export async function readGroveRecord(world: string): Promise<{ id: string | null; record: GroveRecord }> {
  const { id, raw } = await readItem(GROVE_COLLECTION, world);
  return { id, record: readGrove(raw) };
}

export async function readVillageRecord(world: string): Promise<{ id: string | null; village: VillageRecord }> {
  const { id, raw } = await readItem(VILLAGE_COLLECTION, world);
  return { id, village: readVillage(raw) };
}

const villageCache = new Map<string, { at: number; village: VillageRecord }>();

export async function writeVillageRecord(world: string, id: string | null, village: VillageRecord): Promise<void> {
  await writeItem(VILLAGE_COLLECTION, world, id, village);
  villageCache.set(world, { at: Date.now(), village });
}

export async function villageOf(world: string): Promise<VillageRecord> {
  const cached = villageCache.get(world);
  if (cached && Date.now() - cached.at < VILLAGE_CACHE_MS) return cached.village;
  const { village } = await readVillageRecord(world);
  villageCache.set(world, { at: Date.now(), village });
  return village;
}

export async function viewOf(world: string, now: number): Promise<GroveView> {
  const [{ record }, { village }] = await Promise.all([readGroveRecord(world), readVillageRecord(world)]);
  return groveView(record, village, now);
}

// Kills felled in a room, counted there until the next flush.
export async function countGroveKills(roomId: string, n: number): Promise<void> {
  if (n <= 0) return;
  await withRoomLock(roomId, async () => {
    const { groveKills } = await $room.getRoomState(["groveKills"]);
    await $room.updateRoomState({ groveKills: (typeof groveKills === "number" ? groveKills : 0) + n });
  });
}

// Marks an account as having hunted on this server this week (written once a week).
export async function markHunter(account: string, world: string, now: number): Promise<void> {
  const all = (await $global.getUserState(account)).grove;
  const mine = readUserGrove(all && typeof all === "object" ? (all as Record<string, unknown>)[world] : null);
  const next = markHunted(mine, weekOf(now));
  if (next) await $global.updateUserState(account, { grove: { ...(all ?? {}), [world]: next } });
}

// The guardian comes to this channel's first field only: one for the whole server, where everyone
// knows to look.
const GUARDIAN_CHANNEL = 1;

// Every tick: once FLUSH_MS of ticks have passed, the room's kills go into the server's record (which
// may open a site), and the first field of channel 1 calls up the guardian in a week the grove was
// cleansed, once: the record keeps the week, so a room that forgot it does not call it again.
// How much of each room's ticks has passed since it last flushed. Kept in memory, not in the room:
// writing it every tick would be a room write five times a second. A restart only delays a flush.
const sinceFlush = new Map<string, number>();

export async function flushRoom(world: string, zone: ZoneId, roomId: string, delta: number, now: number): Promise<void> {
  const since = (sinceFlush.get(roomId) ?? 0) + delta;
  sinceFlush.set(roomId, since);
  if (since < FLUSH_MS) return;
  sinceFlush.set(roomId, 0);
  const state = await $room.getRoomState(["groveKills"]);
  const kills = typeof state.groveKills === "number" ? state.groveKills : 0;
  const callsGuardian = zone === GROVE_GUARDIAN_ZONE && readChannelRoom(roomId)?.channel === GUARDIAN_CHANNEL;
  const summon = await withGroveLock(world, async () => {
    const { id, record } = await readGroveRecord(world);
    const added = addKills(record, kills, now);
    const guardian = callsGuardian && added.record.paid >= 3 && added.record.guardian !== added.record.week;
    const next = guardian ? { ...added.record, guardian: added.record.week } : added.record;
    if (kills > 0 || next.week !== record.week || guardian) await writeItem(GROVE_COLLECTION, world, id, next);
    if (added.opened) {
      const { id: villageId, village } = await readVillageRecord(world);
      await writeVillageRecord(world, villageId, openSite(village));
    }
    return guardian;
  });
  await withRoomLock(roomId, async () => {
    const latest = (await $room.getRoomState(["groveKills"])).groveKills;
    await $room.updateRoomState({ groveKills: Math.max(0, (typeof latest === "number" ? latest : 0) - kills) });
    if (summon) {
      const monsters = ((await $room.getRoomState(["monsters"])).monsters ?? {}) as Record<string, MonsterState>;
      const at = guardianSpot();
      monsters.guardian = {
        type: "grove_guardian", x: at.x, z: at.z, yaw: 0, hp: MONSTERS.grove_guardian.hp, alive: true, stunnedUntil: 0,
        attackReadyAt: 0, respawnAt: 0, homeX: at.x, homeZ: at.z,
      };
      await $room.updateRoomState({ monsters });
    }
  });
}

// Where the guardian stands: the monster spot nearest the middle of the first field.
function guardianSpot(): { x: number; z: number } {
  const layout = zoneLayout(GROVE_GUARDIAN_ZONE);
  const mid = { x: (layout.cols * layout.tileSize) / 2, z: (layout.rows * layout.tileSize) / 2 };
  return [...layout.zombieSpawns].sort((a, b) => Math.hypot(a.x - mid.x, a.z - mid.z) - Math.hypot(b.x - mid.x, b.z - mid.z))[0];
}

async function userGroves(account: string): Promise<Record<string, unknown>> {
  const all = (await $global.getUserState(account)).grove;
  return all && typeof all === "object" ? (all as Record<string, unknown>) : {};
}

// On coming into a zone: the stages owed (this week's and last week's) and what finished buildings
// left the account, paid once. Answers what to pay; the caller mints the gold and adds the XP.
export async function settleOnArrive(account: string, world: string): Promise<{ gold: number; xp: number }> {
  const all = await userGroves(account);
  const user = readUserGrove(all[world]);
  const [{ record }, village] = await Promise.all([readGroveRecord(world), villageOf(world)]);
  const out = settle(user, record, village);
  if (out.gold === 0 && out.xp === 0 && JSON.stringify(out.user) === JSON.stringify(user)) return { gold: 0, xp: 0 };
  await $global.updateUserState(account, { grove: { ...all, [world]: out.user } });
  return { gold: out.gold, xp: out.xp };
}

// A gift to the building under way. Takes no more than it needs; a finished building leaves each
// giver's reward on their account. Answers what was taken and the village after.
export async function giveToVillage(
  account: string, world: string, character: Character, offer: Offer, gold: number,
): Promise<{ take: Offer; village: VillageRecord }> {
  return withGroveLock(world, async () => {
    const { id, village } = await readVillageRecord(world);
    const gift = donation(village, offer, character.bag, gold);
    if (!gift) throw new RuleViolation(underWay(village) ? "nothing" : "no_building");
    const next = giveTo(village, gift.building.id, gift.take, gift.points, account, character.name);
    await writeVillageRecord(world, id, next);
    if (next.buildings[gift.building.id].done) {
      for (const [giver, reward] of Object.entries(completionRewards(next.buildings[gift.building.id]))) {
        const all = await userGroves(giver);
        const user = readUserGrove(all[world]);
        await $global.updateUserState(giver, {
          grove: { ...all, [world]: { ...user, pending: { gold: user.pending.gold + reward.gold, xp: user.pending.xp + reward.xp } } },
        });
      }
    }
    return { take: gift.take, village: next };
  });
}

export function takeFromBag(bag: Character["bag"], take: Offer): Character["bag"] {
  let next = bag;
  for (const [item, n] of Object.entries(take.items) as [ItemId, number][]) next = addItem(next, item, -n);
  return next;
}
