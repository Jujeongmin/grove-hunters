import type { PlayerClass } from "./classes";
import { ADVANCE_LEVEL, JOBS, type JobId } from "./jobs";
import { inStrikeReach } from "./melee";
import type { Pose, Vec2 } from "../world/types";

// What a skill needs to know of a monster.
interface Target extends Vec2 { alive: boolean; returning?: boolean }

// Three skills, on keys 1, 2 and 3, each on its own cooldown. The first is the class's own, from
// the start. The other two come with the path taken at advancement (전직, see jobs.ts): the second on
// advancing, the third at a higher level. Two characters of one class fight alike until they part
// ways, and differently after.
export interface Skill {
  // The level it opens up at.
  level: number;
  cooldownMs: number;
  damage: number;
  reach: number;
  // Radians, total; a full turn hits all round.
  arc: number;
  // How long a monster it hits stands dazed, unable to move or attack.
  stunMs: number;
  // Only the nearest this many monsters are hit; 0 means every one in reach.
  maxTargets: number;
  // Health given back to you and every living player within reach.
  heal: number;
}

export const SKILL_SLOTS = 3;
// Keys 1, 2 and 3.
export const SKILL_KEYS = ["Digit1", "Digit2", "Digit3"] as const;
// The path's second skill opens this many levels after advancing.
export const THIRD_SKILL_LEVEL = 20;

const deg = (d: number) => (d * Math.PI) / 180;
const base = { stunMs: 0, maxTargets: 0, heal: 0 };
const all = deg(360);
const second = { ...base, level: ADVANCE_LEVEL };
const third = { ...base, level: THIRD_SKILL_LEVEL };

// Each class's own skill, on key 1 from level 1.
export const CLASS_SKILLS: Record<PlayerClass, Skill> = {
  warrior: { ...base, level: 1, cooldownMs: 8000, damage: 55, reach: 2.8, arc: all },
  ranger: { ...base, level: 1, cooldownMs: 8000, damage: 45, reach: 11, arc: deg(12) },
  wizard: { ...base, level: 1, cooldownMs: 10000, damage: 50, reach: 4.5, arc: all },
  cleric: { ...base, level: 1, cooldownMs: 12000, damage: 0, reach: 6, arc: all, heal: 35 },
  rogue: { ...base, level: 1, cooldownMs: 7000, damage: 90, reach: 3, arc: deg(90), maxTargets: 1 },
  monk: { ...base, level: 1, cooldownMs: 10000, damage: 20, reach: 2.6, arc: deg(120), stunMs: 2500 },
};

// The two skills each path brings, on keys 2 and 3. Of a class's two paths, the one leaning on damage
// hits harder; the one leaning on health stuns and heals.
export const JOB_SKILLS: Record<JobId, readonly [Skill, Skill]> = {
  berserker: [
    { ...second, cooldownMs: 9000, damage: 75, reach: 4, arc: deg(70), stunMs: 800 },
    { ...third, cooldownMs: 20000, damage: 110, reach: 4.5, arc: all, stunMs: 1500 },
  ],
  guardian: [
    { ...second, cooldownMs: 7000, damage: 45, reach: 2.6, arc: deg(90), maxTargets: 1, stunMs: 1800 },
    { ...third, cooldownMs: 22000, damage: 30, reach: 6, arc: all, heal: 60 },
  ],
  sniper: [
    { ...second, cooldownMs: 6000, damage: 80, reach: 11, arc: deg(30), maxTargets: 1 },
    { ...third, cooldownMs: 18000, damage: 90, reach: 7, arc: all },
  ],
  tracker: [
    { ...second, cooldownMs: 7000, damage: 40, reach: 11, arc: deg(20), maxTargets: 1, stunMs: 2000 },
    { ...third, cooldownMs: 14000, damage: 65, reach: 10, arc: deg(60) },
  ],
  elementalist: [
    { ...second, cooldownMs: 8000, damage: 60, reach: 11, arc: deg(20), maxTargets: 1, stunMs: 2000 },
    { ...third, cooldownMs: 22000, damage: 140, reach: 6, arc: all },
  ],
  warder: [
    { ...second, cooldownMs: 9000, damage: 35, reach: 5, arc: all, stunMs: 1500 },
    { ...third, cooldownMs: 24000, damage: 0, reach: 7, arc: all, heal: 70 },
  ],
  high_priest: [
    { ...second, cooldownMs: 9000, damage: 50, reach: 10, arc: deg(20), maxTargets: 1, heal: 20 },
    { ...third, cooldownMs: 25000, damage: 40, reach: 8, arc: all, heal: 90 },
  ],
  paladin: [
    { ...second, cooldownMs: 8000, damage: 60, reach: 3, arc: deg(110), stunMs: 1000 },
    { ...third, cooldownMs: 20000, damage: 120, reach: 4, arc: all, stunMs: 1200 },
  ],
  assassin: [
    { ...second, cooldownMs: 6000, damage: 55, reach: 5, arc: deg(100) },
    { ...third, cooldownMs: 18000, damage: 130, reach: 3.5, arc: all },
  ],
  scout: [
    { ...second, cooldownMs: 12000, damage: 20, reach: 4, arc: all, stunMs: 2000 },
    { ...third, cooldownMs: 14000, damage: 70, reach: 9, arc: deg(50) },
  ],
  fist_master: [
    { ...second, cooldownMs: 7000, damage: 50, reach: 2.8, arc: all },
    { ...third, cooldownMs: 18000, damage: 160, reach: 3, arc: deg(90), maxTargets: 1, stunMs: 2000 },
  ],
  iron_monk: [
    { ...second, cooldownMs: 8000, damage: 45, reach: 3, arc: deg(100), stunMs: 1500 },
    { ...third, cooldownMs: 24000, damage: 60, reach: 4, arc: all, heal: 50 },
  ],
};

// The skill in slot `index` of a character: 0 is the class's own, 1 and 2 are its path's. Null for a
// path skill before advancing, or for a path that is not the class's.
export function skillAt(playerClass: PlayerClass, job: JobId | null, index: number): Skill | null {
  if (index === 0) return CLASS_SKILLS[playerClass];
  if (index < 0 || index >= SKILL_SLOTS || !job || JOBS[job].playerClass !== playerClass) return null;
  return JOB_SKILLS[job][index - 1];
}

// A skill slot number from a client: 0, 1 or 2.
export function readSlot(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < SKILL_SLOTS ? value : null;
}

// The living monsters a skill used from pose lands on, nearest first. The server passes slack for lag.
export function skillTargets(
  pose: Pose, monsters: Record<string, Target>, skill: Skill, slack = false,
): string[] {
  if (skill.damage <= 0 && skill.stunMs <= 0) return [];
  const reachOf = {
    damage: skill.damage, intervalMs: 0, reach: skill.reach, arc: skill.arc, block: 0, ranged: false,
  };
  const hit = Object.entries(monsters)
    .filter(([, m]) => m.alive && !m.returning && inStrikeReach(pose, m, reachOf, slack))
    .sort(([, a], [, b]) => dist(pose, a) - dist(pose, b))
    .map(([id]) => id);
  return skill.maxTargets > 0 ? hit.slice(0, skill.maxTargets) : hit;
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
