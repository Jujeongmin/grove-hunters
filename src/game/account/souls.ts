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

// What a stage adds, as flat numbers that grow with the monster's level: attack (each blow's damage)
// in the grove, health in the snow, defence (taken off each bite, see bittenFor in power.ts) in the
// volcano; a boss gives all three, twice over. Each of a monster's three stages adds the same.
export interface SoulBonus { atk: number; def: number; hp: number }
export const NO_SOUL_BONUS: SoulBonus = { atk: 0, def: 0, hp: 0 };
const ATK_PER = 25;
const HP_PER = 6;
const DEF_PER = 60;

function regionBonus(region: Region, level: number): SoulBonus {
  if (region === "grove") return { atk: Math.max(1, Math.round(level / ATK_PER)), def: 0, hp: 0 };
  if (region === "snow") return { atk: 0, def: 0, hp: Math.round(level / HP_PER) };
  return { atk: 0, def: Math.max(1, Math.round(level / DEF_PER)), hp: 0 };
}

// What a monster's stage `stage` (0 to 2) adds.
export function stageBonus(type: MonsterType, _stage: number): SoulBonus {
  const level = MONSTERS[type].level;
  const group = soulGroup(type);
  if (group !== "boss") return regionBonus(group, level);
  return {
    atk: 2 * regionBonus("grove", level).atk, def: 2 * regionBonus("volcano", level).def, hp: 2 * regionBonus("snow", level).hp,
  };
}

// Everything the codex adds up to.
export function codexBonus(codex: Souls): SoulBonus {
  const out = { atk: 0, def: 0, hp: 0 };
  for (const type of SOUL_MONSTERS) {
    for (let s = 0; s < soulStage(codex[type] ?? 0); s++) {
      const b = stageBonus(type, s);
      out.atk += b.atk;
      out.def += b.def;
      out.hp += b.hp;
    }
  }
  return out;
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
