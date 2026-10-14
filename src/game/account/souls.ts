import { GROVE_GUARDIAN_ZONE, MONSTERS, ZONE_BOSS, ZONE_MONSTERS, type MonsterType } from "../world/monsters";
import { ZONES, ZONE_IDS, type Region, type ZoneId } from "../world/zones";

// The soul codex (영혼 도감, see docs/superpowers/specs/2026-10-14-soul-codex-design.md): felling a
// monster may leave its soul, which waits uncollected until the hunter collects it into the codex by
// hand; at SOUL_STAGES souls the monster's stages open, each adding to every fight for good. Kept per
// character: the souls waiting (souls) and those collected (codex). All the numbers are here.

export type Souls = Partial<Record<MonsterType, number>>;
export type SoulGroup = Region | "boss";

// The souls at which a monster's three stages open, and the most a monster takes.
export const SOUL_STAGES = [1, 5, 10] as const;
export const SOUL_MAX = SOUL_STAGES[SOUL_STAGES.length - 1];

// A field monster leaves its soul one time in a hundred; the bosses that come back every few minutes
// one in twenty; the grove's guardian, felled once a week by the whole server, one to everyone who hit it.
export const SOUL_CHANCE = 0.01;
export const BOSS_SOUL_CHANCE = 0.05;
export const SOUL_BOSSES: readonly MonsterType[] = ["mushroom_king", "grove_guardian", "frost_emperor", "flame_lord"];
export const EVERY_HITTER: MonsterType = "grove_guardian";

// Every monster with a soul, in the codex's order: the fields' in the world's order, then the bosses.
export const SOUL_MONSTERS: readonly MonsterType[] = [
  ...new Set(ZONE_IDS.flatMap((z) => ZONE_MONSTERS[z])),
  ...SOUL_BOSSES,
];

export function hasSoul(type: MonsterType): boolean {
  return SOUL_MONSTERS.includes(type);
}

// Where a monster is met: the fields it stands in, or its boss's own ground (the guardian's field).
export function soulZones(type: MonsterType): ZoneId[] {
  if (type === "grove_guardian") return [GROVE_GUARDIAN_ZONE];
  return ZONE_IDS.filter((z) => ZONE_MONSTERS[z].includes(type) || ZONE_BOSS[z] === type);
}

export function soulGroup(type: MonsterType): SoulGroup {
  if (SOUL_BOSSES.includes(type)) return "boss";
  return ZONES[soulZones(type)[0]].region;
}

// The chance a kill leaves the soul (1 for the guardian: everyone who hit it gets one).
export function soulChance(type: MonsterType): number {
  if (!hasSoul(type)) return 0;
  if (type === EVERY_HITTER) return 1;
  return SOUL_BOSSES.includes(type) ? BOSS_SOUL_CHANCE : SOUL_CHANCE;
}

const count = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? Math.min(SOUL_MAX, v) : 0);

export function readSouls(raw: unknown): Souls {
  const out: Souls = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [type, n] of Object.entries(raw as Record<string, unknown>)) {
    if (type in MONSTERS && hasSoul(type as MonsterType) && count(n) > 0) out[type as MonsterType] = count(n);
  }
  return out;
}

// How many of a monster's stages its collected souls have opened (0 to 3).
export function soulStage(collected: number): number {
  return SOUL_STAGES.filter((at) => collected >= at).length;
}

// What a stage adds: attack in the grove, health in the snow, a share of each blow stopped in the
// volcano; a boss gives all three, twice over.
export interface SoulBonus { power: number; hp: number; guard: number }
export const NO_SOUL_BONUS: SoulBonus = { power: 0, hp: 0, guard: 0 };
const STAGE_BONUS: Record<Region, readonly SoulBonus[]> = {
  grove: [{ power: 0.003, hp: 0, guard: 0 }, { power: 0.003, hp: 0, guard: 0 }, { power: 0.004, hp: 0, guard: 0 }],
  snow: [{ power: 0, hp: 5, guard: 0 }, { power: 0, hp: 5, guard: 0 }, { power: 0, hp: 10, guard: 0 }],
  volcano: [{ power: 0, hp: 0, guard: 0.001 }, { power: 0, hp: 0, guard: 0.001 }, { power: 0, hp: 0, guard: 0.001 }],
};

// What a monster's stage `stage` (0 to 2) adds.
export function stageBonus(type: MonsterType, stage: number): SoulBonus {
  const group = soulGroup(type);
  if (group !== "boss") return STAGE_BONUS[group][stage];
  const all = (["grove", "snow", "volcano"] as const).map((r) => STAGE_BONUS[r][stage]);
  return {
    power: 2 * all.reduce((n, b) => n + b.power, 0), hp: 2 * all.reduce((n, b) => n + b.hp, 0), guard: 2 * all.reduce((n, b) => n + b.guard, 0),
  };
}

const round = (n: number) => Math.round(n * 10000) / 10000;

// Everything the codex adds up to.
export function codexBonus(codex: Souls): SoulBonus {
  const out = { power: 0, hp: 0, guard: 0 };
  for (const type of SOUL_MONSTERS) {
    for (let s = 0; s < soulStage(codex[type] ?? 0); s++) {
      const b = stageBonus(type, s);
      out.power += b.power;
      out.hp += b.hp;
      out.guard += b.guard;
    }
  }
  return { power: round(out.power), hp: out.hp, guard: round(out.guard) };
}

// Whether a monster may still leave a soul for this character: not once collected and waiting fill it.
export function wantsSoul(type: MonsterType, codex: Souls, souls: Souls): boolean {
  return hasSoul(type) && (codex[type] ?? 0) + (souls[type] ?? 0) < SOUL_MAX;
}

// A soul gained: one more waiting, unless the monster is already full.
export function gainSoul(type: MonsterType, codex: Souls, souls: Souls): Souls {
  if (!wantsSoul(type, codex, souls)) return souls;
  return { ...souls, [type]: (souls[type] ?? 0) + 1 };
}

// Collects a monster's waiting souls into the codex: answers both, and the stages that opened.
export function collectSouls(type: MonsterType, codex: Souls, souls: Souls): { codex: Souls; souls: Souls; opened: number[] } {
  const have = codex[type] ?? 0;
  const moved = Math.min(souls[type] ?? 0, SOUL_MAX - have);
  if (moved <= 0) return { codex, souls, opened: [] };
  const rest = { ...souls };
  delete rest[type];
  const before = soulStage(have);
  const after = soulStage(have + moved);
  return {
    codex: { ...codex, [type]: have + moved }, souls: rest,
    opened: Array.from({ length: after - before }, (_, i) => before + i + 1),
  };
}
