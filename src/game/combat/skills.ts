import type { PlayerClass } from "./classes";
import { inStrikeReach } from "./melee";
import type { Pose, Vec2 } from "../world/types";

// What a skill needs to know of a monster.
interface Target extends Vec2 { alive: boolean }

// Each class has three skills, on keys 1, 2 and 3, each on its own cooldown; the second and third
// open up at higher levels. They are what make the six play differently.
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

const deg = (d: number) => (d * Math.PI) / 180;
const base = { stunMs: 0, maxTargets: 0, heal: 0 };
const all = deg(360);

export const SKILLS: Record<PlayerClass, readonly Skill[]> = {
  warrior: [
    { ...base, level: 1, cooldownMs: 8000, damage: 55, reach: 2.8, arc: all },
    {
      ...base, level: 10,
      cooldownMs: 9000, damage: 75, reach: 4, arc: deg(70), stunMs: 800,
    },
    {
      ...base, level: 20,
      cooldownMs: 20000, damage: 110, reach: 4.5, arc: all, stunMs: 1500,
    },
  ],
  ranger: [
    { ...base, level: 1, cooldownMs: 8000, damage: 45, reach: 16, arc: deg(12) },
    {
      ...base, level: 10,
      cooldownMs: 6000, damage: 80, reach: 14, arc: deg(30), maxTargets: 1,
    },
    { ...base, level: 20, cooldownMs: 18000, damage: 90, reach: 7, arc: all },
  ],
  wizard: [
    { ...base, level: 1, cooldownMs: 10000, damage: 50, reach: 4.5, arc: all },
    {
      ...base, level: 10,
      cooldownMs: 8000, damage: 60, reach: 11, arc: deg(20), maxTargets: 1, stunMs: 2000,
    },
    { ...base, level: 20, cooldownMs: 22000, damage: 140, reach: 6, arc: all },
  ],
  cleric: [
    { ...base, level: 1, cooldownMs: 12000, damage: 0, reach: 6, arc: all, heal: 35 },
    {
      ...base, level: 10,
      cooldownMs: 8000, damage: 60, reach: 3, arc: deg(110), stunMs: 1000,
    },
    {
      ...base, level: 20,
      cooldownMs: 25000, damage: 40, reach: 8, arc: all, heal: 90,
    },
  ],
  rogue: [
    { ...base, level: 1, cooldownMs: 7000, damage: 90, reach: 3, arc: deg(90), maxTargets: 1 },
    { ...base, level: 10, cooldownMs: 6000, damage: 55, reach: 5, arc: deg(100) },
    { ...base, level: 20, cooldownMs: 18000, damage: 130, reach: 3.5, arc: all },
  ],
  monk: [
    { ...base, level: 1, cooldownMs: 10000, damage: 20, reach: 2.6, arc: deg(120), stunMs: 2500 },
    { ...base, level: 10, cooldownMs: 7000, damage: 50, reach: 2.8, arc: all },
    {
      ...base, level: 20,
      cooldownMs: 18000, damage: 160, reach: 3, arc: deg(90), maxTargets: 1, stunMs: 2000,
    },
  ],
};

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
    .filter(([, m]) => m.alive && inStrikeReach(pose, m, reachOf, slack))
    .sort(([, a], [, b]) => dist(pose, a) - dist(pose, b))
    .map(([id]) => id);
  return skill.maxTargets > 0 ? hit.slice(0, skill.maxTargets) : hit;
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
