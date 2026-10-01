// Mounts: ridden anywhere at a mount's speed, off again on attacking or being hit. Every account has
// the deer; the rest come from the draw, paid for in gems, which are only ever bought (the Verse8
// shop's gem products). All the numbers live here.

export type MountTier = "common" | "rare" | "epic" | "legendary";
export type MountId =
  | "deer"
  | "pig" | "chicken" | "penguin" | "cat" | "dog" | "pigeon"
  | "panda" | "crab" | "armabee" | "glub" | "squidle"
  | "yeti" | "drake" | "hywirl" | "alpaking" | "queen_armabee"
  | "elder_glub" | "alpaking_emperor" | "dragon";

export interface Mount {
  model: string;
  // null: everyone's own, never drawn.
  tier: MountTier | null;
  // Times walking speed.
  speed: number;
  // Flies a little off the ground instead of walking.
  flies?: boolean;
}

// Every account's own mount.
export const BASE_MOUNT: MountId = "deer";

const TIER_SPEED: Record<MountTier, number> = { common: 1.3, rare: 1.4, epic: 1.5, legendary: 1.6 };

export const MOUNTS: Record<MountId, Mount> = {
  deer: { model: "mnt_deer", tier: null, speed: 1.2 },
  pig: { model: "mnt_pig", tier: "common", speed: TIER_SPEED.common },
  chicken: { model: "mnt_chicken", tier: "common", speed: TIER_SPEED.common },
  penguin: { model: "mnt_penguin", tier: "common", speed: TIER_SPEED.common },
  cat: { model: "mnt_cat", tier: "common", speed: TIER_SPEED.common },
  dog: { model: "mnt_dog", tier: "common", speed: TIER_SPEED.common },
  pigeon: { model: "mnt_pigeon", tier: "common", speed: TIER_SPEED.common },
  panda: { model: "mnt_panda", tier: "rare", speed: TIER_SPEED.rare },
  crab: { model: "mnt_crab", tier: "rare", speed: TIER_SPEED.rare },
  armabee: { model: "mnt_armabee", tier: "rare", speed: TIER_SPEED.rare, flies: true },
  glub: { model: "mnt_glub", tier: "rare", speed: TIER_SPEED.rare, flies: true },
  squidle: { model: "mnt_squidle", tier: "rare", speed: TIER_SPEED.rare, flies: true },
  yeti: { model: "mnt_yeti", tier: "epic", speed: TIER_SPEED.epic },
  drake: { model: "mnt_drake", tier: "epic", speed: TIER_SPEED.epic, flies: true },
  hywirl: { model: "mnt_hywirl", tier: "epic", speed: TIER_SPEED.epic, flies: true },
  alpaking: { model: "mnt_alpaking", tier: "epic", speed: TIER_SPEED.epic, flies: true },
  queen_armabee: { model: "mnt_armabee_evolved", tier: "epic", speed: TIER_SPEED.epic, flies: true },
  elder_glub: { model: "mnt_glub_evolved", tier: "legendary", speed: TIER_SPEED.legendary, flies: true },
  alpaking_emperor: { model: "mnt_alpaking_evolved", tier: "legendary", speed: TIER_SPEED.legendary, flies: true },
  dragon: { model: "mnt_dragon", tier: "legendary", speed: TIER_SPEED.legendary, flies: true },
};
export const MOUNT_IDS = Object.keys(MOUNTS) as MountId[];

// The mount you have picked makes you stronger whether you ride it or not: a share more damage and
// more health, more the rarer it is (the full game's own counts as below common).
export interface MountBonus { power: number; hp: number }
const TIER_BONUS: Record<MountTier | "base", MountBonus> = {
  base: { power: 0.1, hp: 30 },
  common: { power: 0.15, hp: 45 },
  rare: { power: 0.2, hp: 60 },
  epic: { power: 0.25, hp: 80 },
  legendary: { power: 0.3, hp: 100 },
};
export function mountBonus(id: MountId | null | undefined, stars = 0): MountBonus {
  if (!id) return { power: 0, hp: 0 };
  const base = TIER_BONUS[MOUNTS[id].tier ?? "base"];
  const grown = 1 + STAR_BONUS * Math.max(0, Math.min(MAX_STARS, stars));
  return { power: Math.round(base.power * grown * 1000) / 1000, hp: Math.round(base.hp * grown) };
}

// Breaking through (돌파): a mount drawn again when already owned gains a star instead of gems back,
// up to MAX_STARS; each star adds STAR_BONUS of its tier's bonus (★5 doubles it). Only past ★5 does a
// repeat come back as DUPLICATE_REFUND gems.
export const MAX_STARS = 5;
export const STAR_BONUS = 0.2;

// The stars an account's mounts have, as saved (★0 is not written down).
export function readStars(raw: unknown): Partial<Record<MountId, number>> {
  const out: Partial<Record<MountId, number>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, n] of Object.entries(raw as Record<string, unknown>)) {
    const mount = readMountId(id);
    if (mount && typeof n === "number" && Number.isInteger(n) && n > 0) out[mount] = Math.min(MAX_STARS, n);
  }
  return out;
}

// The draw: a tier by these odds (shown to the player as they are, as Korean law requires of paid
// draws), then one of that tier's mounts, each as likely as the others.
export const GACHA_ODDS: readonly { tier: MountTier; chance: number }[] = [
  { tier: "common", chance: 0.6 },
  { tier: "rare", chance: 0.3 },
  { tier: "epic", chance: 0.09 },
  { tier: "legendary", chance: 0.01 },
];
export const PULL_COST = 100;
// A mount already at MAX_STARS, drawn again, comes back as this many gems.
export const DUPLICATE_REFUND = 30;

// Gems are kept on the account (its global user state, changed only under the account's gem lock);
// how many each shop product gives.
export const GEM_PRODUCTS: Readonly<Record<string, number>> = {
  "gems-100": 100,
  "gems-550": 550,
  "gems-1200": 1200,
};

export function gemsFor(productId: string, quantity: number): number | null {
  const each = GEM_PRODUCTS[productId];
  return each === undefined ? null : each * quantity;
}

export function readMountId(raw: unknown): MountId | null {
  return typeof raw === "string" && raw in MOUNTS ? (raw as MountId) : null;
}

export function tierOf(id: MountId): MountTier | null {
  return MOUNTS[id].tier;
}

export function mountsOfTier(tier: MountTier): MountId[] {
  return MOUNT_IDS.filter((id) => MOUNTS[id].tier === tier);
}

// One draw. random gives numbers in [0, 1).
export function rollMount(random: () => number): MountId {
  const r = random();
  let edge = 0;
  let tier: MountTier = GACHA_ODDS[GACHA_ODDS.length - 1].tier;
  for (const odds of GACHA_ODDS) {
    edge += odds.chance;
    if (r < edge) {
      tier = odds.tier;
      break;
    }
  }
  const pool = mountsOfTier(tier);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

// What an account can ride: everyone's own, and what it drew (saved on the account).
export function ownedMounts(drawn: unknown): MountId[] {
  const list = Array.isArray(drawn) ? drawn.map(readMountId).filter((id): id is MountId => id !== null) : [];
  return [...new Set([BASE_MOUNT, ...list])];
}
