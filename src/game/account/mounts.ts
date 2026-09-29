// Mounts: ridden anywhere at a mount's speed, off again on attacking or being hit. The full game
// comes with one; the rest come from the draw, paid for in gems, which are only ever bought (the
// Verse8 shop's gem products). All the numbers live here.

export type MountTier = "common" | "rare" | "epic" | "legendary";
export type MountId = "deer" | "pig" | "chicken" | "penguin" | "panda" | "crab" | "yeti" | "drake" | "dragon";

export interface Mount {
  model: string;
  // null: the full game's own, never drawn.
  tier: MountTier | null;
  // Times walking speed.
  speed: number;
  // Flies a little off the ground instead of walking.
  flies?: boolean;
}

// The full game's own mount.
export const BASE_MOUNT: MountId = "deer";

const TIER_SPEED: Record<MountTier, number> = { common: 1.3, rare: 1.4, epic: 1.5, legendary: 1.6 };

export const MOUNTS: Record<MountId, Mount> = {
  deer: { model: "mnt_deer", tier: null, speed: 1.2 },
  pig: { model: "mnt_pig", tier: "common", speed: TIER_SPEED.common },
  chicken: { model: "mnt_chicken", tier: "common", speed: TIER_SPEED.common },
  penguin: { model: "mnt_penguin", tier: "common", speed: TIER_SPEED.common },
  panda: { model: "mnt_panda", tier: "rare", speed: TIER_SPEED.rare },
  crab: { model: "mnt_crab", tier: "rare", speed: TIER_SPEED.rare },
  yeti: { model: "mnt_yeti", tier: "epic", speed: TIER_SPEED.epic },
  drake: { model: "mnt_drake", tier: "epic", speed: TIER_SPEED.epic, flies: true },
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
export function mountBonus(id: MountId | null | undefined): MountBonus {
  return id ? TIER_BONUS[MOUNTS[id].tier ?? "base"] : { power: 0, hp: 0 };
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
// A mount already owned comes back as this many gems.
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

// What an account can ride: what it drew (saved on the account), and the full game's own.
export function ownedMounts(drawn: unknown, ownsFullGame: boolean): MountId[] {
  const list = Array.isArray(drawn) ? drawn.map(readMountId).filter((id): id is MountId => id !== null) : [];
  const out = ownsFullGame ? [BASE_MOUNT, ...list] : list;
  return [...new Set(out)];
}
