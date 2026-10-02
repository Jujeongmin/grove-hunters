import { crowdBlocks, PLAYER_BODY, type Body } from "../rules/crowd";
import { solidWith, type LevelLayout } from "../rules/levelLayout";
import { MAX_STEP_SECONDS, stepAround, type SolidTest } from "../rules/movement";
import { BOSS_MOVES, MONSTERS, respawned, type MonsterState } from "./monsters";
import type { Telegraph } from "./telegraphs";
import {
  BROOD_COUNT, GUILD_BOSSES, PATTERN_BOSSES, RAGE_BELOW, castPattern, nextPattern, patternGap, type PatternBossType,
} from "./guildBoss";

// The Mushroom King's own moves (the slam, the brood); the bosses that cast marked patterns instead
// (the guild bosses and the snow's emperor); and the guild bosses, whose health is their guild's.
const BOSSES = new Set<string>(["mushroom_king"]);
const PATTERN_BOSS_TYPES = new Set<string>(PATTERN_BOSSES);
const GUILD_BOSS_TYPES = new Set<string>(GUILD_BOSSES);
// A guild boss waits this long after the fight starts before its first pattern.
const FIRST_PATTERN_MS = 3_000;

// A player as the monsters see them.
export interface Prey { account: string; x: number; z: number }

export interface MonsterHit { monsterId: string; account: string; damage: number }

// A monster this far from where it started gives up the chase and walks home, heeding no one and
// taking no harm on the way, and heals there. Heeding no one on the way back is what keeps it from
// turning at the edge again and again while an archer shoots it from beyond.
export const LEASH = 20;

// Left be and whole, a monster ambles about where it started: a few metres off, at a stroll, then a
// rest of a few seconds before the next (so most stand at any moment and the room's state seldom
// changes for it). Bosses, the guild bosses and the brood stay put.
export const WANDER = { radius: 3.5, min: 1.2, pace: 0.35, restMs: 2_500, restSpreadMs: 5_000 };

// One step of every monster in a room: the fallen come back when their time is up, the rest leave
// players be until hit (the aggressive kinds not) and then chase whoever hit them, walk round each
// other, the players and the forest, and swing when close enough. Returns the blows landed; the caller takes them off the players.
// A boss's marked attacks go into `telegraphs` (the room's), which land later (see telegraphs.ts).
export function stepMonsters(
  monsters: Record<string, MonsterState>, prey: readonly Prey[], layout: LevelLayout, dt: number, now: number,
  telegraphs: Telegraph[] = [], random: () => number = Math.random,
): MonsterHit[] {
  const hits: MonsterHit[] = [];
  const walls: SolidTest = solidWith(layout, 0);
  for (const [id, m] of Object.entries(monsters)) {
    const spec = MONSTERS[m.type];
    if (!m.alive) {
      // The boss's brood is gone for good; everything else comes back where it started.
      if (m.summoned) delete monsters[id];
      else if (now >= m.respawnAt) monsters[id] = respawned(m);
      continue;
    }
    // Monsters are neutral until a player hits them: then they turn on whoever did. The aggressive
    // kinds, and the boss's brood called up mid-fight, go for any hunter in sight as well.
    const provoked = m.hitters ? prey.filter((p) => m.hitters![p.account]) : [];
    if (BOSSES.has(m.type) && provoked.length > 0 && stepBoss(id, m, monsters, prey, now, telegraphs)) continue;
    if (PATTERN_BOSS_TYPES.has(m.type) && !m.returning && stepGuildBoss(id, m, monsters, prey, now, telegraphs, random)) continue;
    if (now < m.stunnedUntil) continue;

    const fromHome = Math.hypot(m.x - m.homeX, m.z - m.homeZ);
    // A guild boss never gives up (its health is the guild's: going home would heal it).
    if (!m.returning && fromHome > LEASH && !GUILD_BOSS_TYPES.has(m.type)) {
      delete m.nextPatternAt;
      m.returning = true;
      delete m.hitters;
    }
    let target: { prey: Prey; d: number } | null = null;
    if (!m.returning) {
      // Whoever hit it is chased from any distance (an archer out of its sight included); a hunting
      // kind takes the nearest it can see too. Past the leash it gives up and goes home to heal.
      const hunts = m.summoned || spec.aggressive;
      for (const p of hunts ? prey : provoked) {
        const d = Math.hypot(p.x - m.x, p.z - m.z);
        const seen = !!m.hitters?.[p.account] || d <= spec.aggro;
        if (seen && (!target || d < target.d)) target = { prey: p, d };
      }
    }
    if (!target && !m.returning && !m.hitters && m.hp >= spec.hp && wanders(m)) {
      amble(id, m, monsters, prey, walls, dt, now, random);
      continue;
    }
    delete m.wanderX;
    delete m.wanderZ;
    const goal = target ? target.prey : { x: m.homeX, z: m.homeZ };
    const d = Math.hypot(goal.x - m.x, goal.z - m.z);
    const yaw = Math.atan2(-(goal.x - m.x), -(goal.z - m.z));

    if (target && d <= spec.range) {
      m.yaw = yaw;
      if (now >= m.attackReadyAt) {
        // A raging boss swings faster and harder.
        const rage = BOSSES.has(m.type) && m.hp < spec.hp * BOSS_MOVES.rageBelow;
        m.attackReadyAt = now + spec.attackMs * (rage ? BOSS_MOVES.rageSpeed : 1);
        hits.push({ monsterId: id, account: target.prey.account, damage: Math.round(spec.damage * (rage ? BOSS_MOVES.rageDamage : 1)) });
      }
      continue;
    }
    if (!target && d < 0.5) {
      // Home: whole again after a lost chase (a boss forgets its calls and its slam).
      m.hp = spec.hp;
      delete m.hitters;
      delete m.returning;
      if (BOSSES.has(m.type)) {
        m.calls = 0;
        m.slamAt = undefined;
        m.slamming = false;
      }
      continue;
    }

    walk(id, m, monsters, prey, walls, yaw, spec.speed, dt);
  }
  return hits;
}

// Walks a monster along yaw at speed for dt, round the forest, the other monsters and the players.
function walk(
  id: string, m: MonsterState, monsters: Record<string, MonsterState>, prey: readonly Prey[], walls: SolidTest,
  yaw: number, speed: number, dt: number,
): void {
  const spec = MONSTERS[m.type];
  const bodies: Body[] = [];
  for (const [otherId, other] of Object.entries(monsters)) {
    if (otherId !== id && other.alive) bodies.push({ x: other.x, z: other.z, r: spec.body + MONSTERS[other.type].body });
  }
  for (const p of prey) bodies.push({ x: p.x, z: p.z, r: spec.body + PLAYER_BODY });
  // The movement rules take at most MAX_STEP_SECONDS at a time.
  let left = dt;
  while (left > 1e-6) {
    const step = Math.min(left, MAX_STEP_SECONDS);
    left -= step;
    const blocked: SolidTest = (x, z) => walls(x, z) || crowdBlocks(bodies, m, x, z);
    const moved = stepAround({ x: m.x, z: m.z, yaw }, yaw, step, blocked, speed);
    m.x = moved.x;
    m.z = moved.z;
  }
  m.yaw = yaw;
}

function wanders(m: MonsterState): boolean {
  return !m.summoned && !BOSSES.has(m.type) && !PATTERN_BOSS_TYPES.has(m.type);
}

// One step of a monster left be (see WANDER): resting, picking a spot near home, or strolling there.
function amble(
  id: string, m: MonsterState, monsters: Record<string, MonsterState>, prey: readonly Prey[], walls: SolidTest,
  dt: number, now: number, random: () => number,
): void {
  const rest = () => {
    delete m.wanderX;
    delete m.wanderZ;
    m.restUntil = now + WANDER.restMs + random() * WANDER.restSpreadMs;
  };
  if (m.wanderX === undefined || m.wanderZ === undefined) {
    if (now < (m.restUntil ?? 0)) return;
    // A few tries at a spot on open ground; none found, it rests again.
    for (let i = 0; i < 4; i++) {
      const a = random() * Math.PI * 2;
      const r = WANDER.min + random() * (WANDER.radius - WANDER.min);
      const x = m.homeX + Math.cos(a) * r;
      const z = m.homeZ + Math.sin(a) * r;
      if (!walls(x, z)) {
        m.wanderX = x;
        m.wanderZ = z;
        return;
      }
    }
    rest();
    return;
  }
  const d = Math.hypot(m.wanderX - m.x, m.wanderZ - m.z);
  if (d < 0.3) {
    rest();
    return;
  }
  const yaw = Math.atan2(-(m.wanderX - m.x), -(m.wanderZ - m.z));
  const from = { x: m.x, z: m.z };
  const speed = MONSTERS[m.type].speed * WANDER.pace;
  walk(id, m, monsters, prey, walls, yaw, speed, dt);
  // Something in the way (another monster, a player standing there): it gives up on that spot.
  if (Math.hypot(m.x - from.x, m.z - from.z) < speed * dt * 0.2) rest();
}

// The boss's own moves, before its ordinary chase and bite. Calls its brood at set shares of its
// health; with a hunter near, marks the ground round itself on a timer and slams it when the mark
// lands (see telegraphs.ts). Returns true while it is rearing up for a slam (it neither moves nor
// bites then).
function stepBoss(
  id: string, m: MonsterState, monsters: Record<string, MonsterState>, prey: readonly Prey[], now: number, telegraphs: Telegraph[],
): boolean {
  const spec = MONSTERS[m.type];
  const calls = m.calls ?? 0;
  const threshold = BOSS_MOVES.summonAt[calls];
  if (threshold !== undefined && m.hp <= spec.hp * threshold) {
    for (let i = 0; i < BOSS_MOVES.summonCount; i++) {
      const a = (i / BOSS_MOVES.summonCount) * Math.PI * 2;
      const x = m.x + Math.cos(a) * 3;
      const z = m.z + Math.sin(a) * 3;
      const type = BOSS_MOVES.summonType;
      monsters[`${id}-brood-${calls}-${i}`] = {
        type, x, z, yaw: 0, hp: MONSTERS[type].hp, alive: true, stunnedUntil: 0, attackReadyAt: 0, respawnAt: 0,
        homeX: x, homeZ: z, summoned: true,
      };
    }
    m.calls = calls + 1;
  }

  const near = prey.filter((p) => Math.hypot(p.x - m.x, p.z - m.z) <= spec.aggro);
  if (near.length === 0) {
    m.slamming = false;
    m.slamAt = undefined;
    return false;
  }
  if (m.slamAt === undefined) m.slamAt = now + BOSS_MOVES.slamEveryMs;
  if (!m.slamming && now >= m.slamAt - BOSS_MOVES.slamWarnMs) {
    m.slamming = true;
    telegraphs.push({
      id: `${id}-slam-${m.slamAt}`, shape: { kind: "circle", x: m.x, z: m.z, r: BOSS_MOVES.slamRadius },
      startAt: now, hitAt: m.slamAt, damage: BOSS_MOVES.slamDamage,
    });
  }
  if (m.slamming && now >= m.slamAt) {
    m.slamming = false;
    m.slamAt = now + BOSS_MOVES.slamEveryMs;
    // The slam is its swing: the client plays the attack and a shockwave.
    m.attackReadyAt = now + spec.attackMs;
  }
  return m.slamming === true;
}

// A pattern boss's own moves (see guildBoss.ts), before its ordinary chase and bite: a pattern every
// few seconds at the players it can see, standing still while its marks are down; the yeti's charge;
// the glub's brood. Returns true while it is busy with them (it neither moves nor bites then).
function stepGuildBoss(
  id: string, m: MonsterState, monsters: Record<string, MonsterState>, prey: readonly Prey[], now: number, telegraphs: Telegraph[],
  random: () => number,
): boolean {
  const aggro = MONSTERS[m.type].aggro;
  const seen = prey.filter((p) => Math.hypot(p.x - m.x, p.z - m.z) <= aggro);
  // A guild boss waits in its arena for someone to come; a field boss goes about as any monster does.
  if (seen.length === 0) return GUILD_BOSS_TYPES.has(m.type);
  prey = seen;
  if (m.chargeAt !== undefined && now >= m.chargeAt) {
    // The charge: it is at the lane's end the moment the lane lands.
    m.x = m.chargeX ?? m.x;
    m.z = m.chargeZ ?? m.z;
    delete m.chargeAt;
    delete m.chargeX;
    delete m.chargeZ;
  }
  if (m.castUntil !== undefined && now < m.castUntil) return true;
  if (m.nextPatternAt === undefined) m.nextPatternAt = now + FIRST_PATTERN_MS;
  if (now < m.nextPatternAt) return false;
  const rage = m.hp < (m.maxHp ?? MONSTERS[m.type].hp) * RAGE_BELOW;
  const index = nextPattern(m.lastPattern ?? null, random);
  const cast = castPattern(m.type as PatternBossType, index, m, prey, now, rage, random, `${id}-${now}`);
  telegraphs.push(...cast.telegraphs);
  if (cast.chargeTo) {
    m.chargeAt = cast.chargeTo.at;
    m.chargeX = cast.chargeTo.x;
    m.chargeZ = cast.chargeTo.z;
  }
  for (let i = 0; i < (cast.summon ?? 0); i++) {
    const a = (i / BROOD_COUNT) * Math.PI * 2;
    const x = m.x + Math.cos(a) * 3;
    const z = m.z + Math.sin(a) * 3;
    monsters[`${id}-brood-${now}-${i}`] = {
      type: "glub_brood", x, z, yaw: 0, hp: MONSTERS.glub_brood.hp, alive: true, stunnedUntil: 0, attackReadyAt: 0, respawnAt: 0,
      homeX: x, homeZ: z, summoned: true,
    };
  }
  const lands = Math.max(now, ...cast.telegraphs.map((t) => t.hitAt));
  m.castUntil = lands;
  m.lastPattern = index;
  m.nextPatternAt = lands + patternGap(rage, random);
  // Casting is its swing: the client plays its attack.
  m.attackReadyAt = now + MONSTERS[m.type].attackMs;
  return true;
}
