import {
  DAILY_RUNS, DUNGEON_MS, DUNGEON_SIZE, QUEUE_STALE_MS, READY_MS, WAVES, bossHpFor, bracketById, bracketOf, clearReward, dungeonRoomId, pickGroups,
  readDungeonRoom, readRun, waveFor, type Bracket, type BracketId, type DungeonRun, type DungeonView,
} from "../../src/game/world/dungeon";
import type { Character } from "../../src/game/account/characters";
import { levelOf } from "../../src/game/account/level";
import { fightStats } from "../../src/game/combat/power";
import { makeMercs, readMercs, type Mate, type Merc } from "../../src/game/world/mercenary";
import { dailyDay } from "../../src/game/account/quests";
import { MONSTERS, type MonsterState } from "../../src/game/world/monsters";
import { zoneLayout } from "../../src/game/world/zones";
import { RuleViolation } from "../../src/game/world/types";
import { sendMail } from "./mail";
import { partyGroupOf } from "./party";
import { readProfile } from "./store";
import { tickRoom, withRoomLock } from "./hunt";

// The Trial Dungeon's queue, matches and rooms (see dungeon.ts). Nothing runs on its own on the
// platform, so the queue is worked through whenever someone waiting asks how things stand.
export const QUEUE_COLLECTION = "dungeonQueue";
export const MATCHES_COLLECTION = "dungeonMatches";
const QUEUE_READ = 50;

interface Member { account: string; characterId: string; name: string }
interface QueueRow { id: string; account: string; bracket: BracketId; group: Member[]; at: number; seenAt: number }
interface Match { id: string; bracket: BracketId; members: Member[]; made: number; readyBy: number; ready: string[]; startedAt: number | null }

// What the account keeps: the match it is in, and once in its room where it came from.
interface Pass { match: string; roomId?: string; channel?: number; until?: number }

const withBracketLock = <T>(bracket: string, fn: () => Promise<T>) => $lock(`dq:${bracket}`, fn);
const withMatchLock = <T>(id: string, fn: () => Promise<T>) => $lock(`dmatch:${id}`, fn);
const withAccountLock = <T>(account: string, fn: () => Promise<T>) => $lock(`dungeon:${account}`, fn);

function readMembers(raw: unknown): Member[] {
  return Array.isArray(raw)
    ? raw.filter((m): m is Member => !!m && typeof m.account === "string" && typeof m.characterId === "string" && typeof m.name === "string")
    : [];
}

function readQueueRow(row: unknown): QueueRow | null {
  const r = row as Record<string, unknown> | null;
  const bracket = bracketById(r?.bracket);
  if (!r || typeof r.__id !== "string" || typeof r.account !== "string" || !bracket || typeof r.at !== "number") return null;
  return { id: r.__id, account: r.account, bracket: bracket.id, group: readMembers(r.group), at: r.at, seenAt: typeof r.seenAt === "number" ? r.seenAt : r.at };
}

function readMatch(row: unknown): Match | null {
  const r = row as Record<string, unknown> | null;
  const bracket = bracketById(r?.bracket);
  if (!r || typeof r.__id !== "string" || !bracket || typeof r.readyBy !== "number") return null;
  return {
    id: r.__id, bracket: bracket.id, members: readMembers(r.members), made: typeof r.made === "number" ? r.made : 0, readyBy: r.readyBy,
    ready: Array.isArray(r.ready) ? r.ready.filter((a): a is string => typeof a === "string") : [],
    startedAt: typeof r.startedAt === "number" ? r.startedAt : null,
  };
}

async function readMatchById(id: string): Promise<Match | null> {
  return readMatch(await $global.getCollectionItem(MATCHES_COLLECTION, id).catch(() => null));
}

async function writeMatch(match: Match): Promise<void> {
  const { id, ...row } = match;
  await $global.updateCollectionItem(MATCHES_COLLECTION, { __id: id, ...row });
}

function readPass(raw: unknown): Pass | null {
  const p = raw as Partial<Pass> | null;
  return p && typeof p.match === "string" ? { match: p.match, roomId: p.roomId, channel: p.channel, until: p.until } : null;
}

async function passOf(account: string): Promise<Pass | null> {
  return readPass((await $global.getUserState(account)).dungeon);
}

async function setPass(account: string, pass: Pass | null): Promise<void> {
  await $global.updateUserState(account, { dungeon: pass });
}

// Runs used today (Korean time).
async function runsUsed(account: string, now: number): Promise<number> {
  const r = (await $global.getUserState(account)).dungeonRuns as { day?: unknown; n?: unknown } | undefined;
  return r?.day === dailyDay(now) && typeof r.n === "number" ? r.n : 0;
}

export async function runsLeft(account: string, now: number): Promise<number> {
  return Math.max(0, DAILY_RUNS - (await runsUsed(account, now)));
}

// Who goes in with the caller: alone, or (leading a party) the whole party. A member of someone
// else's party waits for its leader. Each must be of the bracket's level, have a run left today and be
// in no match yet.
async function groupOf(account: string, character: Character, now: number): Promise<{ bracket: Bracket; group: Member[] }> {
  const bracket = bracketOf(levelOf(character.xp).level);
  if (!bracket) throw new RuleViolation("too_low");
  const party = await partyGroupOf(account, character);
  if (party && !party.leads) throw new RuleViolation("not_allowed");
  const group = party ? party.members : [{ account, characterId: character.id, name: character.name }];
  for (const m of group) {
    const { active } = await readProfile(m.account);
    if (!active || active.id !== m.characterId || levelOf(active.xp).level < bracket.minLevel) throw new RuleViolation("too_low");
    if ((await runsLeft(m.account, now)) <= 0) throw new RuleViolation("no_runs");
    const pass = await passOf(m.account);
    if (pass && (await readMatchById(pass.match))) throw new RuleViolation("in_dungeon");
  }
  return { bracket, group: group.map((m) => ({ account: m.account, characterId: m.characterId, name: m.name })) };
}

async function myRows(account: string): Promise<QueueRow[]> {
  const rows = await $global.getCollectionItems(QUEUE_COLLECTION, { filters: [{ field: "account", operator: "==", value: account }], limit: 5 });
  return rows.map(readQueueRow).filter((r: QueueRow | null): r is QueueRow => r !== null);
}

async function unqueue(account: string): Promise<void> {
  for (const row of await myRows(account)) await $global.deleteCollectionItem(QUEUE_COLLECTION, row.id).catch(() => undefined);
}

// A match of these members, each told of it; `ready` have said they are coming already. Starts at once
// when everyone has.
async function makeMatch(bracket: BracketId, members: Member[], ready: string[], now: number): Promise<string> {
  const row = { bracket, members, made: now, readyBy: now + READY_MS, ready, startedAt: null };
  const id = ((await $global.addCollectionItem(MATCHES_COLLECTION, row)) as { __id: string }).__id;
  for (const m of members) await setPass(m.account, { match: id });
  if (members.every((m) => ready.includes(m.account))) await settleMatch(id, now);
  return id;
}

// The queue of a bracket worked through once: the stale go, and the next match is made if there is one.
async function tryMatch(bracket: BracketId, now: number): Promise<void> {
  await withBracketLock(bracket, async () => {
    const rows = await $global.getCollectionItems(QUEUE_COLLECTION, { filters: [{ field: "bracket", operator: "==", value: bracket }], limit: QUEUE_READ });
    const live: QueueRow[] = [];
    for (const raw of rows) {
      const row = readQueueRow(raw);
      if (!row || now - row.seenAt > QUEUE_STALE_MS || row.group.length === 0) {
        await $global.deleteCollectionItem(QUEUE_COLLECTION, (raw as { __id: string }).__id).catch(() => undefined);
      } else live.push(row);
    }
    const picked = pickGroups(live.map((row) => ({ id: row.id, at: row.at, size: row.group.length, row })), now);
    if (!picked) return;
    for (const g of picked) await $global.deleteCollectionItem(QUEUE_COLLECTION, g.id).catch(() => undefined);
    await makeMatch(bracket, picked.flatMap((g) => g.row.group), [], now);
  });
}

// A match that everyone has answered, or whose time to answer is up, starts with those who said yes;
// the rest are let go. None said yes: there is no match.
async function settleMatch(id: string, now: number): Promise<Match | null> {
  return withMatchLock(id, async () => {
    const match = await readMatchById(id);
    if (!match || match.startedAt !== null) return match;
    const allIn = match.members.every((m) => match.ready.includes(m.account));
    if (!allIn && now < match.readyBy) return match;
    const coming = match.members.filter((m) => match.ready.includes(m.account));
    for (const m of match.members) if (!coming.includes(m)) await setPass(m.account, null);
    if (coming.length === 0) {
      await $global.deleteCollectionItem(MATCHES_COLLECTION, id).catch(() => undefined);
      return null;
    }
    const started = { ...match, members: coming, startedAt: now };
    await writeMatch(started);
    return started;
  });
}

// Into the queue (alone, or as a party's leader with the party).
export async function queue(account: string, character: Character, now: number): Promise<void> {
  await withAccountLock(account, async () => {
    const { bracket, group } = await groupOf(account, character, now);
    await unqueue(account);
    await $global.addCollectionItem(QUEUE_COLLECTION, { account, bracket: bracket.id, group, at: now, seenAt: now });
  });
  const bracket = bracketOf(levelOf(character.xp).level)!;
  await tryMatch(bracket.id, now);
}

export async function cancel(account: string): Promise<void> {
  await unqueue(account);
}

// Straight in without waiting: alone, or a party's leader with the party (the others say yes first).
export async function solo(account: string, character: Character, now: number): Promise<void> {
  await withAccountLock(account, async () => {
    const { bracket, group } = await groupOf(account, character, now);
    await unqueue(account);
    await makeMatch(bracket.id, group, [account], now);
  });
}

// Saying yes to a match.
export async function ready(account: string, now: number): Promise<void> {
  const pass = await passOf(account);
  if (!pass) throw new RuleViolation("no_match");
  await withMatchLock(pass.match, async () => {
    const match = await readMatchById(pass.match);
    if (!match || !match.members.some((m) => m.account === account)) throw new RuleViolation("no_match");
    if (!match.ready.includes(account)) await writeMatch({ ...match, ready: [...match.ready, account] });
  });
  await settleMatch(pass.match, now);
}

// How things stand for the screen: the bracket, runs left, the queue (kept alive by asking) and the
// match. Asking works the queue through.
export async function viewOf(account: string, character: Character, now: number): Promise<DungeonView> {
  const bracket = bracketOf(levelOf(character.xp).level);
  const [row] = await myRows(account);
  if (row) {
    await $global.updateCollectionItem(QUEUE_COLLECTION, { __id: row.id, seenAt: now });
    await tryMatch(row.bracket, now);
  }
  let match: Match | null = null;
  const pass = await passOf(account);
  if (pass) {
    match = await settleMatch(pass.match, now);
    if (!match || !match.members.some((m) => m.account === account)) {
      match = null;
      if ((await passOf(account))?.match === pass.match) await setPass(account, null);
    }
  }
  const stillQueued = match ? null : (await myRows(account))[0] ?? null;
  return {
    bracket: bracket?.id ?? null,
    runsLeft: await runsLeft(account, now),
    queued: stillQueued ? { since: stillQueued.at } : null,
    match: match ? {
      id: match.id, names: match.members.map((m) => m.name), readyBy: match.readyBy, ready: match.ready.includes(account),
      started: match.startedAt !== null,
    } : null,
  };
}

// Into the match's room: only a started match's member who said yes, while it still runs. A run is
// counted the first time in; where you came from is kept for the way back.
export async function enter(account: string, character: Character, channel: number, now: number): Promise<string> {
  return withAccountLock(account, async () => {
    const pass = await passOf(account);
    const match = pass ? await readMatchById(pass.match) : null;
    if (!pass || !match || match.startedAt === null || !match.members.some((m) => m.account === account && m.characterId === character.id)) {
      throw new RuleViolation("no_match");
    }
    if (now >= match.startedAt + DUNGEON_MS) throw new RuleViolation("dungeon_over");
    const roomId = dungeonRoomId(match.id);
    if (!pass.roomId) {
      const used = await runsUsed(account, now);
      if (used >= DAILY_RUNS) throw new RuleViolation("no_runs");
      await $global.updateUserState(account, { dungeonRuns: { day: dailyDay(now), n: used + 1 } });
    }
    await setPass(account, { match: match.id, roomId, channel: pass.channel ?? channel, until: match.startedAt + DUNGEON_MS });
    return roomId;
  });
}

// Out of the dungeon: the channel to go back to (null when unknown), and the match let go.
export async function leave(account: string): Promise<number | null> {
  const pass = await passOf(account);
  await setPass(account, null);
  return typeof pass?.channel === "number" ? pass.channel : null;
}

// Whether the caller may be in this dungeon room (arriving): its pass names the room.
export async function passFor(account: string, roomId: string): Promise<boolean> {
  const pass = await passOf(account);
  return pass?.roomId === roomId;
}

// --- The room ----------------------------------------------------------------------------------------

// A wave (1 or 2) or the boss (WAVES + 1), set down round the middle.
function spawn(bracket: Bracket, wave: number, size: number, now: number): Record<string, MonsterState> {
  const layout = zoneLayout("dungeon");
  const centre = layout.bossSpawn ?? layout.playerSpawn;
  if (wave > WAVES) {
    const hp = bossHpFor(bracket, size);
    return {
      boss: {
        type: bracket.boss, x: centre.x, z: centre.z, yaw: 0, hp, maxHp: hp, alive: true, stunnedUntil: 0, attackReadyAt: now + 2000,
        respawnAt: Number.MAX_SAFE_INTEGER, homeX: centre.x, homeZ: centre.z,
      },
    };
  }
  const { count, hpScale } = waveFor(wave, size);
  const out: Record<string, MonsterState> = {};
  for (let i = 0; i < count; i++) {
    const type = bracket.waves[i % bracket.waves.length];
    const a = (i / count) * Math.PI * 2;
    const x = centre.x + Math.cos(a) * 5;
    const z = centre.z + Math.sin(a) * 5;
    const hp = Math.round(MONSTERS[type].hp * hpScale);
    out[`w${wave}-${i}`] = {
      type, x, z, yaw: 0, hp, maxHp: hp, alive: true, stunnedUntil: 0, attackReadyAt: now + 1500, respawnAt: Number.MAX_SAFE_INTEGER,
      homeX: centre.x, homeZ: centre.z, summoned: true,
    };
  }
  return out;
}

// The match's members, as the room keeps them (written when the run is set up, so a tick needs no
// read of the match); read from the match for a run set up before the room kept them.
async function roomMembers(run: DungeonRun): Promise<Member[]> {
  const kept = readMembers((await $room.getRoomState(["dungeonMembers"])).dungeonMembers);
  if (kept.length > 0) return kept;
  const members = (await readMatchById(run.match))?.members ?? [];
  if (members.length > 0) await $room.updateRoomState({ dungeonMembers: members }, { returnState: false });
  return members;
}

// Who in the room is one of the match's members: the account and the character it arrived with
// (arriving needs the pass) are a member's. A client can join any room, so an outsider standing in
// it is no one here: not paid, and not counted among the living. With `pass`, the account's saved
// pass must name this room too (it is let go on the way out).
async function membersHere(roomId: string, run: DungeonRun, pass: boolean): Promise<{ account: string; dead: boolean }[]> {
  const accounts: string[] = (await $room.getRoomState([])).$users ?? [];
  if (accounts.length === 0) return [];
  const members = await roomMembers(run);
  const states: Record<string, unknown>[] = await $room.getUserStates(accounts, ["characterId", "dead"]);
  const out: { account: string; dead: boolean }[] = [];
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    if (!members.some((m) => m.account === account && m.characterId === states[i]?.characterId)) continue;
    if (pass && !(await passFor(account, roomId))) continue;
    out.push({ account, dead: states[i]?.dead === true });
  }
  return out;
}

// Pays the members in the room at the clear, by mail. The first clear of the day is told apart under
// the account's lock, so two clears at once cannot both be the first.
async function payClear(run: DungeonRun, accounts: readonly string[], now: number): Promise<void> {
  const bracket = bracketById(run.bracket)!;
  const today = dailyDay(now);
  for (const account of accounts) {
    const first = await withAccountLock(account, async () => {
      if ((await $global.getUserState(account)).dungeonFirst === today) return false;
      await $global.updateUserState(account, { dungeonFirst: today });
      return true;
    });
    const reward = clearReward(bracket, run.clearMs ?? DUNGEON_MS, first, Math.random);
    const items = [{ id: "stone" as const, n: reward.stones }, ...(reward.gear ? [{ id: reward.gear, n: 1 }] : [])];
    await sendMail(account, {
      kind: "dungeon", gold: reward.gold, gems: reward.gems, items, params: { bracket: run.bracket, ms: run.clearMs ?? 0 },
    }, now);
  }
}

// One tick of a dungeon room: the run set up on the first (from its match), the monsters, the next
// wave once one is cleared, the clear once the boss falls, and the end when time runs out or everyone
// here has fallen.
export async function tickDungeon(roomId: string, delta: number, now: number): Promise<void> {
  const place = readDungeonRoom(roomId);
  if (!place) return;
  let run = readRun((await $room.getRoomState(["dungeon"])).dungeon);
  if (!run) {
    const match = await readMatchById(place.matchId);
    if (!match || match.startedAt === null) return;
    const bracket = bracketById(match.bracket)!;
    // Empty seats are taken by mercenaries about as strong as the players.
    const mates: Mate[] = [];
    for (const m of match.members) {
      const { characters } = await readProfile(m.account);
      const c = characters.find((x) => x.id === m.characterId);
      if (!c) continue;
      const stats = fightStats(c);
      mates.push({ playerClass: c.playerClass, level: levelOf(c.xp).level, maxHp: stats.maxHp, power: stats.gear.power, guard: stats.gear.guard });
    }
    const seats = Math.max(0, DUNGEON_SIZE - match.members.length);
    const mercs = makeMercs(mates, seats, zoneLayout("dungeon").playerSpawn, Math.random);
    const started: DungeonRun = {
      match: match.id, bracket: bracket.id, size: match.members.length + seats, mercs: seats, wave: 1, status: "running", startedAt: now,
      endsAt: match.startedAt + DUNGEON_MS, clearMs: null,
    };
    // Set up once: a tick that comes second finds the first one's run and keeps it.
    run = await withRoomLock(roomId, async () => {
      const set = readRun((await $room.getRoomState(["dungeon"])).dungeon);
      if (set) return set;
      await $room.updateRoomState({
        dungeon: started, mercs, monsters: spawn(bracket, 1, started.size, now), telegraphs: [], dungeonMembers: match.members,
      });
      return started;
    });
  }
  await withRoomLock(roomId, async () => {
    const mercs: Record<string, Merc> = JSON.parse(JSON.stringify(readMercs((await $room.getRoomState(["mercs"])).mercs)));
    const before = JSON.stringify(mercs);
    await tickRoom("dungeon", delta, now, Object.keys(mercs).length > 0 ? mercs : undefined);
    if (JSON.stringify(mercs) !== before) await $room.updateRoomState({ mercs }, { returnState: false });
  });
  if (run.status !== "running") return;
  const monsters = ((await $room.getRoomState(["monsters"])).monsters ?? {}) as Record<string, MonsterState>;
  const cleared = Object.values(monsters).every((m) => !m.alive);
  const seen = run;
  // Each change is made under the room's lock on the run as it stands there, and only while it is
  // still the run this tick looked at (running, on the same wave): ticks at once change it once, and
  // only the tick that ended it pays.
  const change = (next: DungeonRun, more: Record<string, unknown> = {}) => withRoomLock(roomId, async () => {
    const current = readRun((await $room.getRoomState(["dungeon"])).dungeon);
    if (!current || current.status !== "running" || current.wave !== seen.wave) return false;
    await $room.updateRoomState({ dungeon: next, telegraphs: [], ...more });
    return true;
  });
  if (cleared && run.wave <= WAVES) {
    const wave = run.wave + 1;
    await change({ ...run, wave }, { monsters: spawn(bracketById(run.bracket)!, wave, run.size, now) });
    return;
  }
  if (cleared) {
    const next: DungeonRun = { ...run, status: "cleared", clearMs: now - run.startedAt };
    if (await change(next)) await payClear(next, (await membersHere(roomId, run, true)).map((m) => m.account), now);
    return;
  }
  // Everyone here has fallen: the match's members only, so an idle outsider cannot keep a run alive.
  const here = now >= run.endsAt ? [] : await membersHere(roomId, run, false);
  if (now >= run.endsAt || (here.length > 0 && here.every((m) => m.dead))) await change({ ...run, status: "failed" });
}

// Whether blows still count in this room: the run is under way.
export async function runOpen(): Promise<boolean> {
  const run = readRun((await $room.getRoomState(["dungeon"])).dungeon);
  return !!run && run.status === "running" && Date.now() < run.endsAt;
}
