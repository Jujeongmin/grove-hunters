import type { MountId } from "./mounts";
import type { JobId } from "../combat/jobs";
import type { TutorialStep } from "./tutorial";
import { RuleViolation } from "../world/types";
import type { DailyProgress, QuestProgress } from "./quests";

// Everything a character can carry, in one table: potions to drink, a weapon and armour to wear, and
// the materials monsters drop for the smith (see forge.ts). Gear fits every class. Prices are in gold,
// the game's coin (a Verse8 $asset on the account).

export const GOLD = "gold";

export type ItemId =
  | "potion_small" | "potion_big"
  | "weapon_1" | "weapon_2" | "weapon_3" | "weapon_4" | "weapon_5" | "weapon_6" | "weapon_7"
  | "armor_1" | "armor_2" | "armor_3" | "armor_4" | "armor_5" | "armor_6" | "armor_7"
  | "stone" | "jelly" | "silk" | "core" | "spore" | "frost_shard" | "snow_fur" | "ever_ice";

export type Slot = "weapon" | "armor";

export interface ItemSpec {
  // A potion is drunk; gear is worn in its slot; a material goes to the smith.
  kind: "potion" | Slot | "material";
  // Gold at the village shop; null when only monsters drop it (or the smith makes it). Selling gives
  // back half, or `sell` for what the shop does not stock.
  price: number | null;
  sell?: number;
  // Gear: how good it is, 1 to 5; enhancing costs more the better it is.
  tier?: number;
  // Potion: health it gives back.
  heal: number;
  // Weapon: extra share of damage on every hit and skill.
  power: number;
  // Armour: extra health, and the share of every blow it stops.
  hp: number;
  guard: number;
}

const none = { heal: 0, power: 0, hp: 0, guard: 0 };

export const ITEMS: Record<ItemId, ItemSpec> = {
  potion_small: { ...none, kind: "potion", price: 20, heal: 40 },
  potion_big: { ...none, kind: "potion", price: 70, heal: 120 },
  weapon_1: { ...none, kind: "weapon", price: 150, power: 0.1, tier: 1 },
  weapon_2: { ...none, kind: "weapon", price: 600, power: 0.25, tier: 2 },
  weapon_4: { ...none, kind: "weapon", price: null, sell: 700, power: 0.35, tier: 3 },
  weapon_3: { ...none, kind: "weapon", price: null, power: 0.45, tier: 4 },
  weapon_5: { ...none, kind: "weapon", price: null, sell: 1800, power: 0.55, tier: 5 },
  armor_1: { ...none, kind: "armor", price: 120, hp: 25, tier: 1 },
  armor_2: { ...none, kind: "armor", price: 500, hp: 60, guard: 0.1, tier: 2 },
  armor_4: {
    ...none, kind: "armor", price: null, sell: 650, hp: 85, guard: 0.12, tier: 3,
  },
  armor_3: { ...none, kind: "armor", price: null, hp: 100, guard: 0.2, tier: 4 },
  armor_5: {
    ...none, kind: "armor", price: null, sell: 1700, hp: 140, guard: 0.2, tier: 5,
  },
  // The snow region's: the canyon's and the peaks' gear, and the Glacier Emperor's.
  weapon_6: { ...none, kind: "weapon", price: null, sell: 3000, power: 0.7, tier: 6 },
  armor_6: { ...none, kind: "armor", price: null, sell: 2800, hp: 190, guard: 0.25, tier: 6 },
  weapon_7: { ...none, kind: "weapon", price: null, sell: 6000, power: 0.85, tier: 7 },
  armor_7: { ...none, kind: "armor", price: null, sell: 5500, hp: 250, guard: 0.3, tier: 7 },
  stone: { ...none, kind: "material", price: null, sell: 15 },
  jelly: { ...none, kind: "material", price: null, sell: 5 },
  silk: { ...none, kind: "material", price: null, sell: 12 },
  core: { ...none, kind: "material", price: null, sell: 30 },
  spore: { ...none, kind: "material", price: null, sell: 150 },
  frost_shard: { ...none, kind: "material", price: null, sell: 40 },
  snow_fur: { ...none, kind: "material", price: null, sell: 35 },
  ever_ice: { ...none, kind: "material", price: null, sell: 250 },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
// What the shop sells, in shelf order.
export const SHOP_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].price !== null);
// No stack grows past this.
export const MAX_STACK = 99;
// Potions go down no faster than this (the server holds the client to it, with a little grace).
export const POTION_GAP_MS = 1000;

export function readItemId(value: unknown): ItemId | null {
  return typeof value === "string" && value in ITEMS ? (value as ItemId) : null;
}

// How many of each potion and material a character carries (gear is carried piece by piece; see
// inventory.ts). Only items it has are listed.
export type Bag = Partial<Record<ItemId, number>>;

// One piece of gear: its own + and whether it may be sold on the market. uid tells two pieces of the
// same kind apart.
export interface GearPiece { uid: string; id: ItemId; plus: number; trade: boolean }

// What a character wears, a piece in each slot.
export interface Gear { weapon: GearPiece | null; armor: GearPiece | null }

export const MAX_PLUS = 10;
// What each + adds: a weapon's share of damage; armour's health and share of each blow stopped.
export const PLUS_POWER = 0.04;
export const PLUS_HP = 12;
export const PLUS_GUARD = 0.005;

export const NO_GEAR: Gear = { weapon: null, armor: null };

// The slot a kind of item is worn in; null for potions and materials.
export function slotOf(id: ItemId): Slot | null {
  const kind = ITEMS[id].kind;
  return kind === "weapon" || kind === "armor" ? kind : null;
}

// Potions and materials, as saved; gear kinds are left out (they are pieces now).
export function readBag(raw: unknown): Bag {
  const out: Bag = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, n] of Object.entries(raw as Record<string, unknown>)) {
    const item = readItemId(id);
    if (item && !slotOf(item) && typeof n === "number" && Number.isInteger(n) && n > 0) out[item] = Math.min(n, MAX_STACK);
  }
  return out;
}

export function readPiece(raw: unknown): GearPiece | null {
  const p = raw as Partial<Record<keyof GearPiece, unknown>> | null;
  const id = readItemId(p?.id);
  if (!p || !id || !slotOf(id) || typeof p.uid !== "string" || p.uid.length === 0 || p.uid.length > 64) return null;
  const plus = typeof p.plus === "number" && Number.isInteger(p.plus) ? Math.max(0, Math.min(MAX_PLUS, p.plus)) : 0;
  return { uid: p.uid, id, plus, trade: p.trade === true };
}

// The bag with n more of an item (never past MAX_STACK), or n fewer; fewer than it has is refused.
export function addItem(bag: Bag, id: ItemId, n: number): Bag {
  const have = bag[id] ?? 0;
  const next = have + n;
  if (next < 0) throw new RuleViolation("no_item");
  const out = { ...bag };
  if (next === 0) delete out[id];
  else out[id] = Math.min(next, MAX_STACK);
  return out;
}

// What the worn gear adds up to in a fight.
export interface GearStats { power: number; hp: number; guard: number }

export function gearStats(gear: Gear): GearStats {
  const out = { power: 0, hp: 0, guard: 0 };
  if (gear.weapon) out.power += ITEMS[gear.weapon.id].power + gear.weapon.plus * PLUS_POWER;
  if (gear.armor) {
    const n = gear.armor.plus;
    out.hp += ITEMS[gear.armor.id].hp + n * PLUS_HP;
    out.guard += ITEMS[gear.armor.id].guard + n * PLUS_GUARD;
  }
  return out;
}

// A character's things as the bag screen shows them, with the account's gold and gems (both always on
// the HUD): its bag and gear, its advanced class (전직) and where it is in the quests.
export interface BagView {
  gold: number;
  gems: number;
  // Potions and materials that stay with the character, and materials that may go to the market.
  bag: Bag;
  bagTrade: Bag;
  // Gear in the bag, piece by piece, and what is worn.
  pieces: GearPiece[];
  gear: Gear;
  job: JobId | null;
  quest: QuestProgress;
  // Today's daily quests.
  daily: DailyProgress;
  // The first tutorial's step; null once done (see tutorial.ts).
  tutorial: TutorialStep | null;
  // The account's picked mount (it adds to every fight, ridden or not; see mounts.ts), and its stars.
  mount: MountId | null;
  mountStars: number;
}

export function sellPrice(id: ItemId): number {
  const spec = ITEMS[id];
  if (spec.sell !== undefined) return spec.sell;
  const price = spec.price;
  // Drop-only gear has no shop price; the shop pays a flat sum for it.
  if (price === null) return 400;
  return Math.floor(price / 2);
}
