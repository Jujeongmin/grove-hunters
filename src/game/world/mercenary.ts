import { WEAPONS, type PlayerClass } from "../combat/classes";
import { solidAt, type LevelLayout } from "../rules/levelLayout";
import { COSTUMES } from "../render/costumes";
import { MONSTERS, damageAt, type MonsterState } from "./monsters";
import { inShape, yawToward, type Telegraph } from "./telegraphs";

// Mercenaries (용병): server-run companions that fill a Trial Dungeon match's empty seats (see
// docs/superpowers/specs/2026-10-02-dungeon-design.md). They are shown as such, fight a little worse
// than a player of the same strength, step out of marked attacks, and a cleric among them heals.
// The monsters hunt and strike them like anyone else; they take no reward.

// What they do as a share of a like player: their blows, and their health.
export const MERC_EFFICIENCY = 0.75;
export const MERC_HP_SHARE = 0.85;
// Metres a second, how close they keep to a player when there is nothing to fight, and how far
// they step to get out of a mark.
export const MERC_SPEED = 4.5;
const FOLLOW_DIST = 3;
const DODGE_STEP = 3;
// A cleric heals the most hurt ally under HEAL_BELOW of their health within HEAL_RANGE, for HEAL_SHARE
// of the ally's health, every HEAL_MS.
export const HEAL_BELOW = 0.6;
export const HEAL_RANGE = 9;
export const HEAL_SHARE = 0.25;
export const HEAL_MS = 6_000;
// Ranged ones keep this far from what they shoot.
const KEEP_OFF = 6;

export const MERC_NAMES = ["루카", "미라", "토르", "세나", "카이", "리아"] as const;

export interface Merc {
  name: string;
  playerClass: PlayerClass;
  costume: string;
  level: number;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  // What its gear adds to its blows, and the share of a blow it stops.
  power: number;
  guard: number;
  attackReadyAt: number;
  healReadyAt: number;
  // Counts up with every blow and every heal, for the screen to swing and cast.
  swing: number;
  skill: number;
  // When it was last struck (for the room's healing out of a fight).
  hitAt: number;
}

// The players a match brings, as their fight stats say.
export interface Mate { playerClass: PlayerClass; level: number; maxHp: number; power: number; guard: number }

// The classes empty seats are filled with: a healer when no player is one, then a front line and
// a ranged one, as the players lack them.
export function mercClasses(mates: readonly Mate[], seats: number): PlayerClass[] {
  const have = new Set(mates.map((m) => m.playerClass));
  const wanted: PlayerClass[] = [];
  if (!have.has("cleric")) wanted.push("cleric");
  if (!have.has("warrior") && !have.has("monk")) wanted.push("warrior");
  if (!have.has("ranger") && !have.has("wizard")) wanted.push("ranger");
  for (const c of ["warrior", "ranger", "wizard", "monk", "rogue"] as PlayerClass[]) wanted.push(c);
  return wanted.slice(0, Math.max(0, seats));
}

// Mercenaries for `seats` empty seats, as strong as the players on average (a little less), standing
// round (x, z). random gives numbers in [0, 1).
export function makeMercs(mates: readonly Mate[], seats: number, at: { x: number; z: number }, random: () => number): Record<string, Merc> {
  const avg = (f: (m: Mate) => number, fallback: number) => (mates.length > 0 ? mates.reduce((n, m) => n + f(m), 0) / mates.length : fallback);
  const level = Math.max(1, Math.round(avg((m) => m.level, 10)));
  const maxHp = Math.round(avg((m) => m.maxHp, 300) * MERC_HP_SHARE);
  const power = avg((m) => m.power, 0);
  const guard = avg((m) => m.guard, 0);
  const names = [...MERC_NAMES].sort(() => random() - 0.5);
  const out: Record<string, Merc> = {};
  mercClasses(mates, seats).forEach((playerClass, i) => {
    const a = (i / Math.max(1, seats)) * Math.PI * 2;
    out[`m${i}`] = {
      name: names[i % names.length], playerClass, costume: COSTUMES[i % COSTUMES.length].id, level,
      x: at.x + Math.cos(a) * 2, z: at.z + Math.sin(a) * 2, yaw: 0, hp: maxHp, maxHp, dead: false, power, guard,
      attackReadyAt: 0, healReadyAt: 0, swing: 0, skill: 0, hitAt: 0,
    };
  });
  return out;
}

// An ally a cleric may heal: a player or another mercenary.
export interface Ally { id: string; x: number; z: number; hp: number; maxHp: number; dead: boolean }

// Where a step of up to `d` from (x, z) toward (tx, tz) ends, stopping short of walls.
function stepToward(layout: LevelLayout, x: number, z: number, tx: number, tz: number, d: number): { x: number; z: number } {
  const dist = Math.hypot(tx - x, tz - z);
  if (dist < 1e-3) return { x, z };
  const k = Math.min(1, d / dist);
  const nx = x + (tx - x) * k;
  const nz = z + (tz - z) * k;
  return solidAt(layout, nx, nz) ? { x, z } : { x: nx, z: nz };
}

const marked = (marks: readonly Telegraph[], x: number, z: number, now: number) =>
  marks.some((t) => (t.hitAt > now || (t.pool && now < t.pool.until)) && inShape(t.shape, x, z, 0.6));

// One tick of every mercenary: out of any mark first; a cleric heals; then each goes for the nearest
// monster (a ranged one from a little way off) and strikes when it can, or with nothing to fight
// keeps near the players. Blows land on `monsters` as a player's would (hitters `merc:<id>`).
export function stepMercs(
  mercs: Record<string, Merc>, monsters: Record<string, MonsterState>, marks: readonly Telegraph[], allies: Ally[],
  players: readonly { x: number; z: number }[], layout: LevelLayout, dt: number, now: number,
): void {
  const reach = dt * MERC_SPEED;
  for (const [id, m] of Object.entries(mercs)) {
    if (m.dead) continue;
    // Out of a mark: the nearest of eight steps around that is clear.
    if (marked(marks, m.x, m.z, now)) {
      let best: { x: number; z: number } | null = null;
      for (let i = 0; i < 8 && !best; i++) {
        for (const d of [DODGE_STEP, DODGE_STEP * 2]) {
          const a = (i / 8) * Math.PI * 2;
          const x = m.x + Math.cos(a) * d;
          const z = m.z + Math.sin(a) * d;
          if (!solidAt(layout, x, z) && !marked(marks, x, z, now)) {
            best = { x, z };
            break;
          }
        }
      }
      if (best) {
        const to = stepToward(layout, m.x, m.z, best.x, best.z, reach);
        m.yaw = yawToward(m.x, m.z, best.x, best.z);
        m.x = to.x;
        m.z = to.z;
        continue;
      }
    }
    if (m.playerClass === "cleric" && now >= m.healReadyAt) {
      const hurt = allies
        .filter((a) => !a.dead && a.hp < a.maxHp * HEAL_BELOW && Math.hypot(a.x - m.x, a.z - m.z) <= HEAL_RANGE)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) {
        hurt.hp = Math.min(hurt.maxHp, hurt.hp + Math.round(hurt.maxHp * HEAL_SHARE));
        m.healReadyAt = now + HEAL_MS;
        m.skill += 1;
        continue;
      }
    }
    const weapon = WEAPONS[m.playerClass];
    let target: { id: string; mon: MonsterState; d: number } | null = null;
    for (const [mid, mon] of Object.entries(monsters)) {
      if (!mon.alive || mon.returning) continue;
      const d = Math.hypot(mon.x - m.x, mon.z - m.z);
      if (!target || d < target.d) target = { id: mid, mon, d };
    }
    if (!target) {
      // Nothing to fight: near the nearest player.
      const near = [...players].sort((a, b) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(b.x - m.x, b.z - m.z))[0];
      if (near && Math.hypot(near.x - m.x, near.z - m.z) > FOLLOW_DIST) {
        const to = stepToward(layout, m.x, m.z, near.x, near.z, reach);
        m.yaw = yawToward(m.x, m.z, near.x, near.z);
        m.x = to.x;
        m.z = to.z;
      }
      continue;
    }
    const range = (weapon.ranged ? Math.min(weapon.reach, KEEP_OFF + 1) : weapon.reach) + MONSTERS[target.mon.type].body;
    m.yaw = yawToward(m.x, m.z, target.mon.x, target.mon.z);
    if (target.d > range) {
      const to = stepToward(layout, m.x, m.z, target.mon.x, target.mon.z, Math.min(reach, target.d - range + 0.2));
      m.x = to.x;
      m.z = to.z;
      continue;
    }
    if (now < m.attackReadyAt) continue;
    m.attackReadyAt = now + weapon.intervalMs;
    m.swing += 1;
    const mon = target.mon;
    const dealt = Math.min(mon.hp, Math.max(1, Math.round(damageAt(weapon.damage, m.level, m.power) * MERC_EFFICIENCY)));
    mon.hp -= dealt;
    mon.hitters = { ...mon.hitters, [`merc:${id}`]: (mon.hitters?.[`merc:${id}`] ?? 0) + dealt };
    if (mon.hp <= 0) {
      mon.alive = false;
      mon.respawnAt = Number.MAX_SAFE_INTEGER;
      delete mon.hitters;
    }
  }
}

export function readMercs(raw: unknown): Record<string, Merc> {
  const out: Record<string, Merc> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, Partial<Merc>>)) {
    if (v && typeof v.name === "string" && typeof v.playerClass === "string" && typeof v.x === "number" && typeof v.z === "number"
      && typeof v.hp === "number" && typeof v.maxHp === "number") {
      out[id] = v as Merc;
    }
  }
  return out;
}
