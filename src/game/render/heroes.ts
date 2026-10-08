import { CLASSES, WEAPONS, type PlayerClass } from "../combat/classes";
import { AIM_GRACE } from "../combat/melee";
import type { Skill } from "../combat/skills";
import type * as THREE from "three";
import type { ShotKind } from "./effects";

// The RPG Character Pack (Quaternius, CC0): one hero model per class, and which of its clips play
// for each thing a player does. The pack has no jump or strafe clips, so those borrow the run.
export interface HeroRig {
  playerClass: PlayerClass;
  model: string;
  idle: string;
  walk: string;
  run: string;
  attacks: readonly string[];
  // The dodge roll; a model without one borrows it from `rollFrom` (see heroClips).
  roll: string;
  rollFrom?: string;
  skill: string;
  death: string;
  // Accessory meshes the costume can take off (names as three.js reads them: dots dropped).
  gear: readonly string[];
  // What flies out on an attack (ranged classes), and how far.
  shot: ShotKind | null;
  // What an attack up close sounds like: a blade, the monk's fists or the cleric's staff.
  swingCue: "swing" | "punch" | "staff";
  // What its skills sound like: the bow's, magic, healing, or the shared one for the rest.
  skillCue: "skill" | "skill_arrow" | "skill_magic" | "skill_heal";
  reach: number;
  // The colour of the ring of light a skill leaves at the hero's feet.
  ringColor: number;
}

type Clips = Omit<HeroRig, "playerClass" | "shot" | "swingCue" | "skillCue" | "reach" | "ringColor">;

const SHOTS: Partial<Record<PlayerClass, ShotKind>> = { ranger: "arrow", wizard: "bolt" };
const SWING_CUES: Partial<Record<PlayerClass, "punch" | "staff">> = { monk: "punch", cleric: "staff" };
const SKILL_CUES: Partial<Record<PlayerClass, "skill_arrow" | "skill_magic" | "skill_heal">> = {
  ranger: "skill_arrow", wizard: "skill_magic", cleric: "skill_heal",
};
const RING_COLOR: Record<PlayerClass, number> = {
  warrior: 0xffd27a, ranger: 0x9be37a, wizard: 0xff7a3a, cleric: 0x9df2ff, rogue: 0xb07aff, monk: 0xffe9a8,
};

function rig(c: PlayerClass, clips: Clips): HeroRig {
  return { ...clips, playerClass: c, shot: SHOTS[c] ?? null, swingCue: SWING_CUES[c] ?? "swing", skillCue: SKILL_CUES[c] ?? "skill", reach: WEAPONS[c].reach + AIM_GRACE, ringColor: RING_COLOR[c] };
}

// What a skill shows: the ring of light it leaves (size and colour), and how far the one long shot of
// a narrow ranged skill flies (null for the rest).
export function skillFx(hero: HeroRig, skill: Skill): { ring: { radius: number; color: number }; shot: number | null } {
  return {
    // A narrow skill (a line of arrows, one stab) still shows a small ring at your feet.
    ring: { radius: skill.arc >= Math.PI ? skill.reach : 1.2, color: hero.ringColor },
    shot: hero.shot && skill.arc < Math.PI ? skill.reach : null,
  };
}

const CLIPS: Record<PlayerClass, Clips> = {
  warrior: {
    model: "hero_warrior", idle: "Idle_Weapon", walk: "Walk", run: "Run_Weapon",
    attacks: ["Sword_Attack", "Sword_Attack2", "Punch"], roll: "Roll", skill: "Sword_Attack2", death: "Death",
    gear: ["ShoulderPadL", "ShoulderPadR"],
  },
  ranger: {
    model: "hero_ranger", idle: "Idle_Weapon", walk: "Walk", run: "Run_Holding",
    attacks: ["Bow_Shoot"], roll: "Roll", skill: "Bow_Draw", death: "Death",
    gear: ["Cloak", "ArmGuardL", "ArmGuardR", "Pouch"],
  },
  wizard: {
    model: "hero_wizard", idle: "Idle_Weapon", walk: "Walk", run: "Run_Weapon",
    attacks: ["Spell1"], roll: "Roll", skill: "Spell2", death: "Death",
    gear: ["ShoulderPadL", "ShoulderPadR", "Pouch"],
  },
  cleric: {
    model: "hero_cleric", idle: "Idle_Weapon", walk: "Walk", run: "Run",
    attacks: ["Staff_Attack", "Punch"], roll: "Roll", rollFrom: "hero_warrior", skill: "Spell1", death: "Death",
    gear: ["ShoulderPads"],
  },
  rogue: {
    model: "hero_rogue", idle: "Idle", walk: "Walk", run: "Run",
    attacks: ["Dagger_Attack", "Dagger_Attack2", "Punch"], roll: "Roll", skill: "Dagger_Attack2", death: "Death",
    gear: ["Guard", "Belt", "Pouch"],
  },
  monk: {
    model: "hero_monk", idle: "Idle", walk: "Walk", run: "Run",
    attacks: ["Attack", "Attack2"], roll: "Roll", skill: "Attack2", death: "Death",
    gear: [],
  },
};

export const HEROES = Object.fromEntries(CLASSES.map((c) => [c, rig(c, CLIPS[c])])) as Record<PlayerClass, HeroRig>;

export const HERO_MODELS = CLASSES.map((c) => HEROES[c].model);

// Weapon meshes carry their own texture; the costume's weapon colour repaints them.
export function isWeaponMesh(name: string): boolean {
  return /(Sword|Bow|Staff|Dagger)$/.test(name);
}

// A hero's clips. The cleric's model has no roll: it takes the warrior's, the pack's heroes sharing one
// rig (the same 32 bones at the same rest pose), so it plays on the cleric as it is.
export function heroClips(
  library: { get(name: string): { animations: THREE.AnimationClip[] } }, rig: HeroRig,
): THREE.AnimationClip[] {
  const own = library.get(rig.model).animations;
  if (!rig.rollFrom || own.some((c) => c.name === rig.roll)) return own;
  let borrowed: THREE.AnimationClip | undefined;
  try {
    borrowed = library.get(rig.rollFrom).animations.find((c) => c.name === rig.roll);
  } catch {
    // Not loaded: the hero just does without the tumble (see PlayerActor).
  }
  return borrowed ? [...own, borrowed] : own;
}
