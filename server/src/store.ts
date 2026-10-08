import { isOnline, readFriendLists, type FriendEntry, type FriendSide } from "../../src/game/account/friends";
import { levelOf, readXp } from "../../src/game/account/level";
import { EMPTY_INVENTORY } from "../../src/game/account/inventory";
import { QUEST_START, readDaily } from "../../src/game/account/quests";
import { skillLearned } from "../../src/game/account/tutorial";
import {
  GUILDLESS, characterMap, legacyMatchXp, readCharacters, readSpot, type Character, type Spot,
} from "../../src/game/account/characters";
import { DEFAULT_WORLD, readWorld, type World } from "../../src/game/account/worlds";
import { announce } from "./announce";
import type { PurchaseEvent } from "../../src/game/account/purchase";
import { RANKING_SIZE, rankRows, type Board, type RankRow } from "../../src/game/account/ranking";
import { COSTUMES, costumeById } from "../../src/game/render/costumes";
import { readClass } from "../../src/game/combat/classes";
import { readSlot } from "../../src/game/combat/skills";
import { RuleViolation, readSwing, type Pose } from "../../src/game/world/types";
import {
  CHANNEL_CAPACITY, MAX_CHANNELS, ZONE_IDS, channelRoomId, readWhereabouts, zoneLayout, type Whereabouts, type ZoneId, type ZoneLook,
} from "../../src/game/world/zones";
import { solidAt } from "../../src/game/rules/levelLayout";
import { WALK_SPEED, readJumpY } from "../../src/game/rules/movement";
import { ROLL } from "../../src/game/combat/roll";
import { maxFeetY } from "../../src/game/rules/platforms";

// One row per purchase the platform reported, so a replayed receipt is noticed.
const PURCHASES_COLLECTION = "purchases";
// One row per character, so the board is a short read instead of a scan over every account.
const RANKING_COLLECTION = "ranking";
// Read a few more rows than the board shows, so a row that has slipped down still lands in order.
const RANKING_READ = RANKING_SIZE * 5;

// Writes a character's line on the board. Called whenever its XP, its name or its advanced class changes; a character
// with no XP yet leaves no row behind.
// The line kept for a character on the boards. With `power` changed by gear or a mount (`crown`), a
// character that takes 전투력's first place from another is told to every server.
export async function writeRanking(account: string, character: Character, vip = 0, power = 0, crown = false): Promise<void> {
  if (character.xp <= 0) return;
  const row: RankRow = {
    id: character.id, account, nickname: character.name, xp: character.xp, level: levelOf(character.xp).level,
    playerClass: character.playerClass, job: character.job, vip, power,
  };
  if (crown && power > 0) {
    const [top] = await readRanking("power");
    if (top && top.id !== character.id && power > (top.power ?? 0)) {
      await announce("power_top", { name: character.name, world: character.world, power }, Date.now()).catch(() => undefined);
    }
  }
  const [stored] = await $global.getCollectionItems(RANKING_COLLECTION, {
    filters: [{ field: "id", operator: "==", value: character.id }],
    limit: 1,
  });
  if (stored) await $global.updateCollectionItem(RANKING_COLLECTION, { __id: stored.__id, ...row });
  else await $global.addCollectionItem(RANKING_COLLECTION, { ...row });
}

// The board, best first. The store sorts before it cuts, or a board longer than RANKING_READ would
// be read from wherever the store happened to start.
export async function readRanking(board: Board = "xp"): Promise<RankRow[]> {
  const items = await $global.getCollectionItems(RANKING_COLLECTION, { orderBy: [{ field: board, direction: "desc" }], limit: RANKING_READ });
  return rankRows(items as unknown as RankRow[], board);
}

// Keeps a purchase's receipt, once: false when it was seen before. `grant` gives what was bought and
// calls `credited` once the gems are the buyer's. Should it fail before that, the receipt is taken
// back so the platform's retry grants it then; after that, the receipt stays (the retry finds it and
// grants nothing twice) and only the failure is reported.
export async function onceper(event: PurchaseEvent, grant: (credited: () => void) => Promise<void>): Promise<boolean> {
  const seen = await $global.getCollectionItems(PURCHASES_COLLECTION, {
    filters: [{ field: "purchaseId", operator: "==", value: event.purchaseId }],
    limit: 1,
  });
  if (seen.length > 0) return false;
  const kept = await $global.addCollectionItem(PURCHASES_COLLECTION, { ...event, at: Date.now() });
  let paid = false;
  try {
    await grant(() => {
      paid = true;
    });
  } catch (error) {
    const id = (kept as { __id?: string } | undefined)?.__id;
    if (id && !paid) await $global.deleteCollectionItem(PURCHASES_COLLECTION, id);
    throw error;
  }
  return true;
}

// An account's gems (kept in its global user state; see mounts.ts).
// The paid side belongs to a character, not the account (2026-10-08): its gems, mount tickets, mounts
// (owned, picked, their stars) and its count toward the draw's pity, each under `<field>@<characterId>`
// in the account's state, for the character playing. Before any character exists (gems bought first)
// they wait in the account's own field and go to the first character with the split below.
export const WALLET_FIELDS = ["gems", "tickets", "mounts", "mount", "mountStars", "pity"] as const;
export type WalletField = typeof WALLET_FIELDS[number];

// Once per account: what it held as an account (from before the split) goes to its strongest
// character, the one with the most XP; the others start from the deer and no gems.
export async function splitWallet(account: string): Promise<void> {
  if ((await $global.getUserState(account)).walletSplit === true) return;
  await $lock(`wallet:${account}`, async () => {
    const state = await $global.getUserState(account);
    if (state.walletSplit === true) return;
    const { characters } = await readProfile(account);
    if (characters.length === 0) return;
    const heir = characters.reduce((best, c) => (c.xp > best.xp ? c : best));
    const patch: Record<string, unknown> = { walletSplit: true };
    for (const field of WALLET_FIELDS) {
      if (state[field] === undefined || state[field] === null) continue;
      patch[`${field}@${heir.id}`] = state[field];
      patch[field] = null;
    }
    await $global.updateUserState(account, patch);
  });
}

// Where a field of the paid side is kept for the character playing now.
export async function walletKey(account: string, field: WalletField, characterId?: string): Promise<string> {
  await splitWallet(account);
  const id = characterId ?? (await readProfile(account)).active?.id ?? null;
  return id ? `${field}@${id}` : field;
}

export async function readWallet(account: string, field: WalletField, characterId?: string): Promise<unknown> {
  const key = await walletKey(account, field, characterId);
  return (await $global.getUserState(account))[key];
}

export async function writeWallet(account: string, patch: Partial<Record<WalletField, unknown>>): Promise<void> {
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch)) out[await walletKey(account, field as WalletField)] = value;
  await $global.updateUserState(account, out);
}

export async function readGems(account: string): Promise<number> {
  const gems = await readWallet(account, "gems");
  return typeof gems === "number" && Number.isInteger(gems) && gems > 0 ? gems : 0;
}

// Adds (or, negative, takes) gems under the account's gem lock; taking more than there are is refused.
export async function changeGems(account: string, delta: number): Promise<number> {
  await splitWallet(account);
  return $lock(`gems:${account}`, async () => {
    const next = (await readGems(account)) + delta;
    if (next < 0) throw new RuleViolation("not_enough_gems");
    await writeWallet(account, { gems: next });
    return next;
  });
}

// An account's mount tickets (소환권: one free hatch each; see attendance.ts), kept like its gems.
export async function readTickets(account: string): Promise<number> {
  const tickets = await readWallet(account, "tickets");
  return typeof tickets === "number" && Number.isInteger(tickets) && tickets > 0 ? tickets : 0;
}

export async function changeTickets(account: string, delta: number): Promise<number> {
  await splitWallet(account);
  return $lock(`tickets:${account}`, async () => {
    const next = (await readTickets(account)) + delta;
    if (next < 0) throw new RuleViolation("no_ticket");
    await writeWallet(account, { tickets: next });
    return next;
  });
}

// An account's characters and the active one. Reading never writes: accounts from before characters
// (one nickname and class on the account) read back as one character on the server they last picked,
// with the XP of their old match record, and are saved that way the next time anything changes.
export interface Profile { characters: Character[]; active: Character | null }

export async function readProfile(account: string): Promise<Profile> {
  const state = await $global.getUserState(account);
  const oldXp = state.legacyXpApplied === true ? 0 : legacyMatchXp(state.profile);
  // Saved as characterMap; the first saves were under characters, as an array or however the
  // platform handed that array back (an object keyed by index).
  const saved = isObject(state.characterMap) ? state.characterMap
    : Array.isArray(state.characters) || isObject(state.characters) ? state.characters : null;
  let characters = readCharacters(saved);
  if (!saved && typeof state.nickname === "string" && readClass(state.playerClass)) {
    characters = [{
      // Fixed per account, so two reads of an unsaved account agree on it.
      id: `c-legacy-${account}`,
      world: readWorld(state.world)?.id ?? DEFAULT_WORLD.id,
      name: state.nickname,
      playerClass: readClass(state.playerClass)!,
      costume: costumeById(state.costume)?.id ?? COSTUMES[0].id,
      xp: Math.max(readXp(state.xp), oldXp),
      spot: readSpot(state.spot),
      made: 0,
      ...EMPTY_INVENTORY,
      ...GUILDLESS,
      daily: readDaily(null),
      job: null,
      // Past the tutorial (it came before it), so the first quest is taken already.
      quest: { ...QUEST_START, taken: true },
      tutorial: null,
    }];
  } else if (oldXp > 0) {
    // Moved over before its old XP was carried: the character named like the account's first name
    // (the name claimed before characters existed) gets it.
    const names = (await $global.getCollectionItems(NICKNAMES_COLLECTION, {
      filters: [{ field: "account", operator: "==", value: account }],
    })) as unknown as NicknameItem[];
    const first = names.find((i) => !i.character);
    characters = characters.map((c) => (first && c.name === first.name ? { ...c, xp: Math.max(c.xp, oldXp) } : c));
  }
  // Deleted characters stay listed by id and are left out here, whatever the platform does with a
  // key dropped from an object it merges.
  const deleted = readDeleted(state.deletedCharacters);
  characters = characters.filter((c) => !deleted.includes(c.id));
  const activeId = saved ? state.active : characters[0]?.id;
  return { characters, active: characters.find((c) => c.id === activeId) ?? null };
}

function readDeleted(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
}

// Deletes a character for good: it is listed as deleted (see readProfile), dropped from the saved
// characters, and another character plays in its place (one on the same server, if there is one).
// Call inside withProfileLock.
export async function deleteCharacter(account: string, doomed: Character, characters: Character[], activeId: string | null): Promise<void> {
  const deleted = readDeleted((await $global.getUserState(account)).deletedCharacters);
  const rest = characters.filter((c) => c.id !== doomed.id);
  const next = activeId && activeId !== doomed.id ? activeId : rest.find((c) => c.world === doomed.world)?.id ?? null;
  await $global.updateUserState(account, { deletedCharacters: [...deleted, doomed.id] });
  await saveProfile(account, rest, next);
}

// Takes a deleted character's line off the board.
export async function dropRanking(character: string): Promise<void> {
  const rows = await $global.getCollectionItems(RANKING_COLLECTION, { filters: [{ field: "id", operator: "==", value: character }] });
  for (const row of rows) await $global.deleteCollectionItem(RANKING_COLLECTION, row.__id);
}

// Saves the characters, and mirrors the active one's name on the account (friends find you by it).
// Call inside withProfileLock.
export async function saveProfile(account: string, characters: Character[], activeId: string | null): Promise<void> {
  const active = characters.find((c) => c.id === activeId) ?? null;
  await $global.updateUserState(account, {
    characterMap: characterMap(characters), active: active?.id ?? null, nickname: active?.name ?? null, legacyXpApplied: true,
  });
}

// One writer at a time for an account's characters, so a spot saved while a character is made or
// picked does not undo the other.
function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function withProfileLock<T>(account: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`profile-${account}`, fn);
}

// Changes the active character with `change` and saves.
export async function updateActive(account: string, change: (c: Character) => Character): Promise<Character> {
  return withProfileLock(account, async () => {
    const { characters, active } = await readProfile(account);
    if (!active) throw new RuleViolation("no_character");
    const next = change(active);
    await saveProfile(account, characters.map((c) => (c.id === active.id ? next : c)), next.id);
    return next;
  });
}

// Changes one of an account's characters (any, not only the active one) with `change` and saves;
// null when the account no longer has it. For guild changes made by someone else.
export async function updateCharacter(
  account: string, id: string, change: (c: Character) => Character,
): Promise<Character | null> {
  return withProfileLock(account, async () => {
    const { characters, active } = await readProfile(account);
    const found = characters.find((c) => c.id === id);
    if (!found) return null;
    const next = change(found);
    await saveProfile(account, characters.map((c) => (c.id === id ? next : c)), active?.id ?? null);
    return next;
  });
}

export function token(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 36).toString(36);
  return out;
}

// One item per taken nickname, looked up by its case-insensitive key.
export const NICKNAMES_COLLECTION = "nicknames";

interface NicknameItem { __id: string; key: string; name: string; account: string; character?: string }

// One claim or release at a time for a name, by its key: names are unique by key, so two claims of
// different names never need to wait for each other. (Encoded: a lock key may not hold braces.)
export function withNicknameLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`nickname:${encodeURIComponent(key)}`, fn);
}

export async function findNickname(key: string): Promise<NicknameItem | null> {
  const [item] = await $global.getCollectionItems(NICKNAMES_COLLECTION, {
    filters: [{ field: "key", operator: "==", value: key }],
    limit: 1,
  });
  return (item as NicknameItem | undefined) ?? null;
}

// Takes a name for a new character. Call inside withNicknameLock.
export async function claimName(account: string, character: string, key: string, name: string): Promise<void> {
  if (await findNickname(key)) throw new RuleViolation("nickname_taken");
  await $global.addCollectionItem(NICKNAMES_COLLECTION, { key, name, account, character });
}

// Gives a deleted character's name back for anyone to take. Only the owner's claim on it goes (a
// name claimed before characters existed carries no character id, so the key is what finds it).
// Call inside withNicknameLock.
export async function releaseName(account: string, key: string): Promise<void> {
  const item = await findNickname(key);
  if (item && item.account === account) await $global.deleteCollectionItem(NICKNAMES_COLLECTION, item.__id);
}

// The active character's name, which is how friends and parties see the account.
export async function readNickname(account: string): Promise<string | null> {
  const nickname: unknown = (await $global.getUserState(account)).nickname;
  return typeof nickname === "string" ? nickname : null;
}

// One writer at a time for the friend lists of both accounts of a pair. Each account's lists have
// their own lock, as two pairs can share an account (you, and two friends at once); both are taken,
// always in the same order, so two calls on the same pair from either side cannot hold one each.
export function withFriendsLock<T>(a: string, b: string, fn: () => Promise<T>): Promise<T> {
  const [first, second] = [a, b].sort();
  const lock = (account: string, inner: () => Promise<T>) => $lock(`friends:${account}`, inner);
  return first === second ? lock(first, fn) : lock(first, () => lock(second, fn));
}

export async function readFriendSide(account: string): Promise<FriendSide> {
  return { account, lists: readFriendLists((await $global.getUserState(account)).friendLists) };
}

export async function writeFriendSide(side: FriendSide): Promise<void> {
  await $global.updateUserState(side.account, { friendLists: side.lists });
}

export async function markSeen(account: string, now: number): Promise<void> {
  await $global.updateUserState(account, { lastSeenAt: now });
}

export async function friendEntry(account: string, now: number): Promise<FriendEntry> {
  const state = await $global.getUserState(account);
  return {
    account,
    nickname: typeof state.nickname === "string" ? state.nickname : null,
    online: isOnline(state.lastSeenAt, now),
    where: isOnline(state.lastSeenAt, now) ? readWhereabouts(state.where) : null,
  };
}

// The server an account picked when it last started; the first one for anyone who never picked.
export async function readAccountWorld(account: string): Promise<World> {
  return readWorld((await $global.getUserState(account)).world) ?? DEFAULT_WORLD;
}

// Where the active character comes back in. A spot that is no longer open ground (the map changed)
// sends it to the zone's own spawn.
export function returnSpot(spot: Spot | null): Spot | null {
  if (!spot) return null;
  if (solidAt(zoneLayout(spot.zone), spot.x, spot.z)) return { zone: spot.zone, ...zoneLayout(spot.zone).playerSpawn };
  return spot;
}

export async function saveSpot(account: string, spot: Spot): Promise<void> {
  await updateActive(account, (c) => ({ ...c, spot }));
}

// A channel is one copy of the whole world on a server, as in MapleStory: you stay in yours as you
// go from zone to zone, so two players on the same channel can always walk to each other. Its
// players are counted across every zone, which also caps any one zone's room at CHANNEL_CAPACITY.
export async function channelPlayers(world: string, channel: number): Promise<string[]> {
  const rooms = await Promise.all(ZONE_IDS.map((zone) => $global.getRoomUserAccounts(channelRoomId(world, zone, channel))));
  return rooms.flat();
}

// A channel of this server with room for `account`: the ones in `prefer` first (the last one you
// played on, your friends'), then counting from 1. The client joins it (Verse8 2.0 moves room joins
// to the client), so two players picked at the same moment can both land in the last seat: the cap
// is soft by one or two.
export async function pickChannel(world: string, account: string, prefer: number[] = []): Promise<number> {
  const order = [...new Set([...prefer, ...Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1)])];
  for (const channel of order) {
    const players = await channelPlayers(world, channel);
    if (players.includes(account) || players.length < CHANNEL_CAPACITY) return channel;
  }
  throw new RuleViolation("zone_full");
}

// Kept on the account when you enter a zone, cleared when you go back to the menu.
export async function writeWhereabouts(account: string, where: Whereabouts | null): Promise<void> {
  await $global.updateUserState(account, where ? { where, lastChannel: { world: where.world, channel: where.channel } } : { where });
}

// The channels your friends are playing on in this server, the busiest first.
export async function friendChannels(account: string, world: string): Promise<number[]> {
  const now = Date.now();
  const { lists } = await readFriendSide(account);
  const counts = new Map<number, number>();
  for (const friend of lists.friends) {
    const state = await $global.getUserState(friend);
    const where = readWhereabouts(state.where);
    if (where && where.world === world && isOnline(state.lastSeenAt, now)) counts.set(where.channel, (counts.get(where.channel) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([channel]) => channel);
}

// What the others in a zone see of a character: name, class, costume and level.
export function zoneLook(c: Character, vip = 0): ZoneLook {
  // The advanced class goes out as its id, not its name: every client says it in its own language.
  return {
    name: c.name, costume: c.costume, playerClass: c.playerClass, level: levelOf(c.xp).level, job: c.job,
    learned: skillLearned(c.tutorial, 0), guild: c.guild?.name ?? null, vip,
  };
}

// How far a reported pose may be from the last one: walking speed with room for lag, plus a little.
const STEP_ALLOWANCE = 1.5;
const STEP_SLACK = 1;

// Stores the caller's reported pose in their room, held to the zone: inside the map, no farther from
// the last pose than walking allows, and no higher than what is underfoot plus a jump. Returns where
// it put them.
// `rolling`: a dodge roll under way (see roll.ts), which carries you further than walking.
export async function writeZonePose(
  zone: ZoneId, pose: Pose, now: number, last: { x: number; z: number; at: number } | null, speed = 1, rolling = false,
): Promise<{ x: number; z: number }> {
  const layout = zoneLayout(zone);
  let x = Math.min(Math.max(pose.x, 0), layout.cols * layout.tileSize);
  let z = Math.min(Math.max(pose.z, 0), layout.rows * layout.tileSize);
  if (last) {
    const most = (WALK_SPEED * speed * STEP_ALLOWANCE * Math.max(0, now - last.at)) / 1000 + STEP_SLACK + (rolling ? ROLL.distance : 0);
    const d = Math.hypot(x - last.x, z - last.z);
    if (d > most) {
      x = last.x + ((x - last.x) * most) / d;
      z = last.z + ((z - last.z) * most) / d;
    }
  }
  // Never into the forest or a house: the client walks round them, a modified one would not.
  if (last && solidAt(layout, x, z)) {
    x = last.x;
    z = last.z;
  }
  const y = Math.min(readJumpY(pose.y), maxFeetY(layout.platforms, x, z));
  await $room.updateMyState(
    {
      pose: {
        x, z, yaw: pose.yaw, y, swing: readSwing(pose.swing), skill: readSwing(pose.skill), roll: readSwing(pose.roll),
        slot: readSlot(pose.slot) ?? 0, at: now,
      },
    },
    { returnState: false },
  );
  return { x, z };
}
