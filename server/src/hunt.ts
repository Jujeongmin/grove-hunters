import { WEAPONS, readClass, type PlayerClass } from "../../src/game/combat/classes";
import { inStrikeReach } from "../../src/game/combat/melee";
import { dodging } from "../../src/game/combat/roll";
import { readSlot, skillAt, skillTargets } from "../../src/game/combat/skills";
import { readJob, type JobId } from "../../src/game/combat/jobs";
import type { FightBonus } from "../../src/game/combat/power";
import { stepMonsters, type Prey } from "../../src/game/world/monsterAi";
import { readTelegraphs, resolveTelegraphs } from "../../src/game/world/telegraphs";
import {
  ZONE_BOSS, ZONE_MONSTERS, damageAt, maxHpAt, readMonsterType, respawnDelay, spawnMonsters, type MonsterState,
  type MonsterType,
} from "../../src/game/world/monsters";
import { RANGE_SLACK, RuleViolation, isPose, type Pose } from "../../src/game/world/types";
import { zoneLayout, type ZoneId } from "../../src/game/world/zones";
import { stepMercs, type Ally, type Merc } from "../../src/game/world/mercenary";

// Hunting, all decided here: the monsters of a channel live in its room state and move on every room
// tick; your health, and when your next attack and skill are allowed, live in your room user state.

// Clients send an attack as soon as their own clock allows; this much earlier still counts (jitter).
const COOLDOWN_GRACE = 0.8;
// Out of a fight this long, you heal REGEN_SHARE of your health every REGEN_MS.
const CALM_MS = 5_000;
const REGEN_MS = 2_000;
const REGEN_SHARE = 0.05;
// A room tick after a long pause moves monsters at most this far in time.
const MAX_TICK_MS = 1_000;
// Monsters that only walked are written (and so sent to everyone in the room) at most this often;
// a blow, a swing, a death or a respawn is written at once. Between writes the walk is not lost: the
// next tick steps them on from where they were last written, by the whole time since.
export const MONSTER_SYNC_MS = 300;

export function hasMonsters(zone: ZoneId): boolean {
  return ZONE_MONSTERS[zone].length > 0 || !!ZONE_BOSS[zone];
}

// One writer at a time for a room's monsters and players' health.
export function withRoomLock<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`room-${roomId}`, fn);
}

// What your room user state says about you in a fight.
interface Fighter {
  pose: Pose | null;
  playerClass: PlayerClass;
  // The advanced path, which the second and third skills come from.
  job: JobId | null;
  level: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  // What the worn gear and the advanced class add.
  gear: FightBonus;
  // Whether the first skill is learned yet (see tutorial.ts).
  learned: boolean;
}


const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function readFighter(state: Record<string, any>): Fighter {
  const level = typeof state.look?.level === "number" ? state.look.level : 1;
  const gear = {
    power: num(state.gear?.power), hp: num(state.gear?.hp), guard: Math.min(0.8, num(state.gear?.guard)), heal: num(state.gear?.heal),
  };
  const maxHp = typeof state.maxHp === "number" ? state.maxHp : maxHpAt(level) + gear.hp;
  return {
    gear,
    pose: isPose(state.pose) ? state.pose : null,
    playerClass: readClass(state.look?.playerClass) ?? "warrior",
    job: readJob(state.look?.job),
    level,
    hp: typeof state.hp === "number" ? state.hp : maxHp,
    maxHp,
    dead: state.dead === true,
    learned: state.look?.learned !== false,
  };
}

// The room's monsters, spawned the first time anyone asks. A room kept from before a zone gained
// monsters (more slimes, say) gets the new ones too.
async function readMonsters(zone: ZoneId): Promise<Record<string, MonsterState>> {
  const stored = (await $room.getRoomState(["monsters"])).monsters;
  if (!stored || typeof stored !== "object") return spawnMonsters(zone);
  const out: Record<string, MonsterState> = {};
  for (const [id, m] of Object.entries(stored as Record<string, MonsterState>)) {
    if (m && readMonsterType(m.type)) out[id] = m;
  }
  for (const [id, m] of Object.entries(spawnMonsters(zone))) if (!(id in out)) out[id] = m;
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

function tidy(monsters: Record<string, MonsterState>): Record<string, MonsterState> {
  for (const m of Object.values(monsters)) {
    m.x = round(m.x);
    m.z = round(m.z);
    m.yaw = round(m.yaw);
  }
  return monsters;
}

// Whether the only change from what is stored is where monsters stand and face.
function onlyWalked(now: Record<string, MonsterState>, stored: unknown): boolean {
  if (!stored || typeof stored !== "object") return false;
  const before = stored as Record<string, MonsterState>;
  for (const [id, m] of Object.entries(now)) {
    const was = before[id];
    if (!was) return false;
    for (const key of Object.keys(m) as (keyof MonsterState)[]) {
      if (key === "x" || key === "z" || key === "yaw") continue;
      if (JSON.stringify(m[key]) !== JSON.stringify(was[key])) return false;
    }
  }
  return true;
}

async function writeMonsters(monsters: Record<string, MonsterState>): Promise<void> {
  await $room.updateRoomState({ monsters: tidy(monsters) }, { returnState: false });
}

// One room tick: monsters move and swing, blows land on players, marked attacks land on whoever is
// still inside them, and players out of a fight heal a little. A player mid dodge roll (see roll.ts)
// takes neither. Answers who fell in it.
// A Trial Dungeon room's mercenaries (see mercenary.ts) come too: they act first (out of marks, a
// cleric's heal, their blows), then the monsters hunt and strike them like players. Their state is
// changed in place for the caller to keep.
export async function tickRoom(zone: ZoneId, deltaMs: number, now: number, mercs?: Record<string, Merc>): Promise<string[]> {
  const state = await $room.getRoomState(["monsters", "monstersAt", "regenAt", "telegraphs"]);
  const accounts: string[] = state.$users;
  if (accounts.length === 0) return [];
  const monsters = await readMonsters(zone);
  // How long since the monsters as stored were where they are (see MONSTER_SYNC_MS).
  const writtenAt = typeof state.monstersAt === "number" ? state.monstersAt : null;
  const stepMs = Math.min(writtenAt === null ? deltaMs : Math.max(deltaMs, now - writtenAt), MAX_TICK_MS);
  const users: (Record<string, any> & { account: string })[] = await $room.getUserStates(
    accounts, ["pose", "look", "hp", "maxHp", "dead", "hitAt", "safeUntil", "strikeReadyAt", "rolledAt"],
  );
  const fighters = new Map(users.map((u) => [u.account, {
    ...readFighter(u), hitAt: typeof u.hitAt === "number" ? u.hitAt : 0,
    strikeReadyAt: typeof u.strikeReadyAt === "number" ? u.strikeReadyAt : 0,
    rolledAt: typeof u.rolledAt === "number" ? u.rolledAt : undefined,
  }]));
  const prey: Prey[] = [];
  // Just stood up where they fell: the monsters leave them be for a moment.
  const safe = new Set(users.filter((u) => typeof u.safeUntil === "number" && now < u.safeUntil).map((u) => u.account));
  for (const [account, f] of fighters) if (f.pose && !f.dead && !safe.has(account)) prey.push({ account, x: f.pose.x, z: f.pose.z });

  const marks = readTelegraphs(state.telegraphs);
  const healed = new Set<string>();
  if (mercs) {
    const dt = Math.min(deltaMs, MAX_TICK_MS) / 1000;
    const players = [...fighters.values()].filter((f) => f.pose && !f.dead).map((f) => ({ x: f.pose!.x, z: f.pose!.z }));
    const allies: Ally[] = [
      ...[...fighters].filter(([, f]) => f.pose).map(([id, f]) => ({ id, x: f.pose!.x, z: f.pose!.z, hp: f.hp, maxHp: f.maxHp, dead: f.dead })),
      ...Object.entries(mercs).map(([id, m]) => ({ id: `merc:${id}`, x: m.x, z: m.z, hp: m.hp, maxHp: m.maxHp, dead: m.dead })),
    ];
    stepMercs(mercs, monsters, marks, allies, players, zoneLayout(zone), dt, now);
    for (const a of allies) {
      const f = fighters.get(a.id);
      if (f && a.hp !== f.hp) {
        f.hp = a.hp;
        healed.add(a.id);
      }
      const merc = a.id.startsWith("merc:") ? mercs[a.id.slice(5)] : undefined;
      if (merc) merc.hp = a.hp;
    }
    // The monsters see them as fighters like any other.
    for (const [id, m] of Object.entries(mercs)) {
      const key = `merc:${id}`;
      fighters.set(key, {
        pose: { x: m.x, z: m.z, yaw: m.yaw, y: 0, swing: 0, skill: 0, roll: 0, slot: 0 } as Pose, playerClass: m.playerClass, job: null,
        level: m.level, hp: m.hp, maxHp: m.maxHp, dead: m.dead, gear: { power: m.power, hp: 0, guard: m.guard, heal: 0 }, learned: true,
        hitAt: m.hitAt, strikeReadyAt: 0, rolledAt: undefined,
      });
      if (!m.dead) prey.push({ account: key, x: m.x, z: m.z });
    }
  }
  const hits = stepMonsters(monsters, prey, zoneLayout(zone), stepMs / 1000, now, marks);
  const struck = resolveTelegraphs(marks, prey.map((p) => ({ ...p, maxHp: fighters.get(p.account)!.maxHp })), now);
  const hurt = new Set<string>();
  const fell: string[] = [];
  for (const hit of struck.hits) {
    const f = fighters.get(hit.account);
    if (!f || f.dead || dodging(f.rolledAt, now)) continue;
    f.hp = Math.max(0, f.hp - Math.max(1, Math.round(hit.damage * (1 - f.gear.guard))));
    f.dead = f.hp <= 0;
    if (f.dead) fell.push(hit.account);
    f.hitAt = now;
    hurt.add(hit.account);
  }
  for (const hit of hits) {
    const f = fighters.get(hit.account);
    const m = monsters[hit.monsterId];
    // Rolling, the blow goes by.
    if (!f || f.dead || !m || dodging(f.rolledAt, now)) continue;
    const damage = Math.max(1, Math.round(hit.damage * (1 - f.gear.guard)));
    f.hp = Math.max(0, f.hp - damage);
    f.dead = f.hp <= 0;
    if (f.dead) fell.push(hit.account);
    f.hitAt = now;
    hurt.add(hit.account);
  }
  const regen = now >= (typeof state.regenAt === "number" ? state.regenAt : 0);
  for (const [account, f] of fighters) {
    if (account.startsWith("merc:")) {
      // A mercenary's health is kept by the caller with the rest of it; it heals out of a fight too.
      const m = mercs![account.slice(5)];
      m.hp = !hurt.has(account) && regen && !f.dead && f.hp < f.maxHp && now - f.hitAt >= CALM_MS
        ? Math.min(f.maxHp, f.hp + Math.ceil(f.maxHp * REGEN_SHARE)) : f.hp;
      m.dead = f.dead;
      m.hitAt = f.hitAt;
      continue;
    }
    if (hurt.has(account)) {
      // A blow takes a rider off the mount.
      await $room.updateUserState(account, { hp: f.hp, dead: f.dead, hitAt: f.hitAt, riding: null }, { returnState: false });
    } else if (regen && !f.dead && f.hp < f.maxHp && now - f.hitAt >= CALM_MS) {
      const hp = Math.min(f.maxHp, f.hp + Math.ceil(f.maxHp * REGEN_SHARE));
      await $room.updateUserState(account, { hp }, { returnState: false });
    } else if (healed.has(account)) {
      await $room.updateUserState(account, { hp: f.hp }, { returnState: false });
    }
  }
  // Written only when something changed (or they were just spawned): most ticks of a quiet room write
  // nothing, and a walk alone waits for MONSTER_SYNC_MS (a Trial Dungeon's, with its mercenaries, never).
  if (JSON.stringify(tidy(monsters)) !== JSON.stringify(state.monsters ?? null)) {
    const urgent = mercs !== undefined || hits.length > 0 || struck.hits.length > 0 || writtenAt === null
      || now - writtenAt >= MONSTER_SYNC_MS || !onlyWalked(monsters, state.monsters);
    if (urgent) {
      await writeMonsters(monsters);
      await $room.updateRoomState({ monstersAt: now }, { returnState: false });
    }
  }
  if (regen) await $room.updateRoomState({ regenAt: now + REGEN_MS }, { returnState: false });
  if (JSON.stringify(struck.left) !== JSON.stringify(readTelegraphs(state.telegraphs))) {
    await $room.updateRoomState({ telegraphs: struck.left }, { returnState: false });
  }
  return fell.filter((account) => !account.startsWith("merc:"));
}

// What one blow or skill did: the monsters it hit and felled. Each felled one comes with everyone
// who hit it and how hard, for the server to pay out (see reward in server.ts); what the caller
// itself was paid (XP, gold, items) is filled in there.
export interface Kill {
  type: MonsterType;
  hitters: Record<string, number>;
}

export interface HitResult {
  hit: string[];
  killed: string[];
  kills: Kill[];
  // What it took off each monster it hit (the guild boss's rooms add it to the guild's week).
  dealt: Record<string, number>;
  xp: number;
  gold: number;
  items: string[];
}

export const NOTHING: HitResult = { hit: [], killed: [], kills: [], dealt: {}, xp: 0, gold: 0, items: [] };

// `account` hits the monsters for damage (and a stun); what it takes off each is written down
// against its name.
// `hunters` is how many share the room: a busy room brings its monsters back sooner (respawnDelay).
function land(
  monsters: Record<string, MonsterState>, ids: string[], damage: number, stunMs: number, now: number, account: string,
  hunters: number,
): HitResult {
  const out: HitResult = { ...NOTHING, hit: [], killed: [], kills: [], dealt: {}, items: [] };
  for (const id of ids) {
    const m = monsters[id];
    // One walking home from a lost chase takes no harm.
    if (!m?.alive || m.returning) continue;
    out.hit.push(id);
    const dealt = Math.min(m.hp, damage);
    m.hp -= dealt;
    out.dealt[id] = (out.dealt[id] ?? 0) + dealt;
    m.hitters = { ...m.hitters, [account]: (m.hitters?.[account] ?? 0) + dealt };
    if (stunMs > 0) m.stunnedUntil = Math.max(m.stunnedUntil, now + stunMs);
    if (m.hp <= 0) {
      m.alive = false;
      m.respawnAt = now + respawnDelay(m.type, hunters);
      out.killed.push(id);
      out.kills.push({ type: m.type, hitters: m.hitters });
      delete m.hitters;
    }
  }
  return out;
}

// How many players are in the caller's room.
async function huntersHere(): Promise<number> {
  const users = (await $room.getRoomState([])).$users;
  return Array.isArray(users) ? users.length : 1;
}

// You, able to fight: standing somewhere and not fallen. Also your whole room user state. Where you
// face comes with the attack itself (turning is free, and the pose it would ride on may lag behind).
async function me(yaw: unknown): Promise<{ f: Fighter & { pose: Pose }; state: Record<string, any> }> {
  const state = await $room.getMyState();
  const f = readFighter(state);
  if (f.dead || !f.pose) throw new RuleViolation("unavailable");
  const facing = typeof yaw === "number" && Number.isFinite(yaw) ? yaw : f.pose.yaw;
  return { f: { ...f, pose: { ...f.pose, yaw: facing } }, state };
}

// Your attack on one monster: in reach of where you stand, facing it, no sooner than your weapon allows.
export async function strike(zone: ZoneId, account: string, monsterId: unknown, yaw: unknown, now: number): Promise<HitResult> {
  if (typeof monsterId !== "string") throw new RuleViolation("no_monster");
  const { f, state } = await me(yaw);
  const readyAt = state.strikeReadyAt;
  if (typeof readyAt === "number" && now < readyAt) throw new RuleViolation("too_fast");
  const monsters = await readMonsters(zone);
  const m = monsters[monsterId];
  if (!m) throw new RuleViolation("no_monster");
  if (!m.alive) throw new RuleViolation("monster_dead");
  const weapon = WEAPONS[f.playerClass];
  if (!inStrikeReach(f.pose, m, weapon, true)) throw new RuleViolation("out_of_range");
  // Striking takes a rider off the mount.
  await $room.updateMyState({ strikeReadyAt: now + weapon.intervalMs * COOLDOWN_GRACE, riding: null }, { returnState: false });
  const result = land(monsters, [monsterId], damageAt(weapon.damage, f.level, f.gear.power), 0, now, account, await huntersHere());
  await writeMonsters(monsters);
  return result;
}

// One of your skills (slot 0 is the class's own, 1 and 2 come with your advanced path), once your
// path and level have opened it and its own cooldown is over: every monster it reaches takes its damage (and stun); a heal also mends you and everyone
// standing close.
export async function useSkill(zone: ZoneId, account: string, rawSlot: unknown, yaw: unknown, now: number): Promise<HitResult> {
  const slot = readSlot(rawSlot ?? 0);
  if (slot === null) throw new RuleViolation("unavailable");
  const { f, state: mine } = await me(yaw);
  const skill = skillAt(f.playerClass, f.job, slot);
  if (!skill || f.level < skill.level) throw new RuleViolation("unavailable");
  if (slot === 0 && !f.learned) throw new RuleViolation("unavailable");
  const ready: Record<string, unknown> = mine.skillReady && typeof mine.skillReady === "object" ? mine.skillReady : {};
  const readyAt = ready[slot];
  if (typeof readyAt === "number" && now < readyAt) throw new RuleViolation("too_fast");
  await $room.updateMyState(
    // A skill takes a rider off the mount too.
    { skillReady: { ...ready, [slot]: now + skill.cooldownMs * COOLDOWN_GRACE }, riding: null },
    { returnState: false },
  );
  if (skill.heal > 0) {
    const state = await $room.getRoomState([]);
    const users: (Record<string, any> & { account: string })[] = await $room.getUserStates(
      state.$users, ["pose", "look", "hp", "maxHp", "dead"],
    );
    for (const u of users) {
      const other = readFighter(u);
      if (other.dead || !other.pose) continue;
      if (Math.hypot(other.pose.x - f.pose.x, other.pose.z - f.pose.z) > skill.reach + RANGE_SLACK) continue;
      const heal = Math.round(skill.heal * (1 + f.gear.heal));
      await $room.updateUserState(u.account, { hp: Math.min(other.maxHp, other.hp + heal) }, { returnState: false });
    }
  }
  const monsters = await readMonsters(zone);
  const targets = skillTargets(f.pose, monsters, skill, true);
  if (targets.length === 0) return { ...NOTHING, dealt: {} };
  const result = land(monsters, targets, damageAt(skill.damage, f.level, f.gear.power), skill.stunMs, now, account, await huntersHere());
  await writeMonsters(monsters);
  return result;
}

