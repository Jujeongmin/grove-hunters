import type { Souls } from "./souls";
import type { MountBonus, MountId } from "./mounts";
import type { JobId } from "../combat/jobs";
import type { TutorialStep } from "./tutorial";
import { RuleViolation } from "../world/types";
import type { DailyProgress, QuestProgress } from "./quests";

// Everything a character can carry, in one table: potions to drink, a weapon and armour to wear, and
// the materials monsters drop for the smith (see forge.ts). Gear fits every class. Prices are in gold,
// the game's coin (a Verse8 $asset on the account).

export const GOLD = "gold";

export type ItemId =
  | "potion_small" | "potion_big" | "potion_huge"
  | "weapon_1" | "weapon_2" | "weapon_3" | "weapon_4" | "weapon_5" | "weapon_6" | "weapon_7" | "weapon_8" | "weapon_9"
  | "armor_1" | "armor_2" | "armor_3" | "armor_4" | "armor_5" | "armor_6" | "armor_7" | "armor_8" | "armor_9"
  | "stone" | "jelly" | "silk" | "core" | "spore" | "frost_shard" | "snow_fur" | "ever_ice"
  | "ember_shard" | "magma_scale" | "flame_core";

export type Slot = "weapon" | "armor";

export interface ItemSpec {
  // A potion is drunk; gear is worn in its slot; a material goes to the smith.
  kind: "potion" | Slot | "material";
  // Gold at the village shop; null when only monsters drop it (or the smith makes it). Selling gives
  // back half, or `sell` for what the shop does not stock.
  price: number | null;
  sell?: number;
  // Gear: how good it is, 1 to 9; enhancing costs more the better it is.
  tier?: number;
  // Potion: health it gives back.
  heal: number;
  // Weapon: attack, added to every hit and skill (see damageAt).
  atk: number;
  // Armour: extra health, and defence, taken off every blow (see bittenFor).
  hp: number;
  def: number;
}

const none = { heal: 0, atk: 0, hp: 0, def: 0 };

export const ITEMS: Record<ItemId, ItemSpec> = {
  potion_small: { ...none, kind: "potion", price: 20, heal: 40 },
  potion_big: { ...none, kind: "potion", price: 70, heal: 120 },
  // For the volcano, whose blows run past 150: one takes back several.
  potion_huge: { ...none, kind: "potion", price: 220, heal: 400 },
  weapon_1: { ...none, kind: "weapon", price: 150, atk: 5, tier: 1 },
  weapon_2: { ...none, kind: "weapon", price: 600, atk: 18, tier: 2 },
  weapon_4: { ...none, kind: "weapon", price: null, sell: 700, atk: 32, tier: 3 },
  weapon_3: { ...none, kind: "weapon", price: null, atk: 51, tier: 4 },
  weapon_5: { ...none, kind: "weapon", price: null, sell: 1800, atk: 67, tier: 5 },
  armor_1: { ...none, kind: "armor", price: 120, hp: 25, def: 2, tier: 1 },
  armor_2: { ...none, kind: "armor", price: 500, hp: 60, def: 7, tier: 2 },
  armor_4: {
    ...none, kind: "armor", price: null, sell: 650, hp: 85, def: 10, tier: 3,
  },
  armor_3: { ...none, kind: "armor", price: null, hp: 100, def: 23, tier: 4 },
  armor_5: {
    ...none, kind: "armor", price: null, sell: 1700, hp: 140, def: 25, tier: 5,
  },
  // The snow region's: the canyon's and the peaks' gear, and the Glacier Emperor's.
  weapon_6: { ...none, kind: "weapon", price: null, sell: 3000, atk: 110, tier: 6 },
  armor_6: { ...none, kind: "armor", price: null, sell: 2800, hp: 190, def: 43, tier: 6 },
  weapon_7: { ...none, kind: "weapon", price: null, sell: 6000, atk: 154, tier: 7 },
  armor_7: { ...none, kind: "armor", price: null, sell: 5500, hp: 250, def: 60, tier: 7 },
  // The volcano's: the canyon's and the summit's gear, and the Flame Lord's.
  weapon_8: { ...none, kind: "weapon", price: null, sell: 10000, atk: 200, tier: 8 },
  armor_8: { ...none, kind: "armor", price: null, sell: 9500, hp: 320, def: 74, tier: 8 },
  weapon_9: { ...none, kind: "weapon", price: null, sell: 18000, atk: 275, tier: 9 },
  armor_9: { ...none, kind: "armor", price: null, sell: 17000, hp: 400, def: 94, tier: 9 },
  stone: { ...none, kind: "material", price: null, sell: 15 },
  jelly: { ...none, kind: "material", price: null, sell: 5 },
  silk: { ...none, kind: "material", price: null, sell: 12 },
  core: { ...none, kind: "material", price: null, sell: 30 },
  spore: { ...none, kind: "material", price: null, sell: 150 },
  frost_shard: { ...none, kind: "material", price: null, sell: 40 },
  snow_fur: { ...none, kind: "material", price: null, sell: 35 },
  ever_ice: { ...none, kind: "material", price: null, sell: 250 },
  ember_shard: { ...none, kind: "material", price: null, sell: 70 },
  magma_scale: { ...none, kind: "material", price: null, sell: 60 },
  flame_core: { ...none, kind: "material", price: null, sell: 450 },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
// What the shop sells, in shelf order.
export const SHOP_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].price !== null);
// What one square of the bag holds: a stack past it goes on in the next square (the bag screen draws
// it so), and the shop, the market and throwing away deal at most this many at a time.
export const MAX_STACK = 99;
// How many of one kind a character may carry in all, across its squares.
export const MAX_CARRY = 9999;
// The potions, smallest first.
export const POTIONS: readonly ItemId[] = ITEM_IDS.filter((id) => ITEMS[id].kind === "potion").sort((a, b) => ITEMS[a].heal - ITEMS[b].heal);

// The potion to drink for `missing` health: the biggest carried that gives no more than is missing,
// or, when every one would, the smallest carried. Null with none.
export function pickPotion(bag: Bag, missing: number): ItemId | null {
  const have = POTIONS.filter((id) => (bag[id] ?? 0) > 0);
  if (have.length === 0) return null;
  const fit = have.filter((id) => ITEMS[id].heal <= missing);
  return fit.length > 0 ? fit[fit.length - 1] : have[0];
}

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

export const MAX_PLUS = 15;
// Past this + each one counts twice (+11 to +15, the hardest to reach, give the most).
export const PLUS_DOUBLED_FROM = 10;
// What each + adds: a weapon attack by its tier (a better weapon's + is worth more), armour health
// and defence.
export const PLUS_ATK: readonly number[] = [0, 2, 3, 4, 5, 5, 6, 7, 8, 9];
export const PLUS_HP = 12;
export const PLUS_DEF = 1;

export function plusAtk(id: ItemId): number {
  return PLUS_ATK[ITEMS[id].tier ?? 1] ?? 2;
}

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
    if (item && !slotOf(item) && typeof n === "number" && Number.isInteger(n) && n > 0) out[item] = Math.min(n, MAX_CARRY);
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

// The bag with n more of an item (never past MAX_CARRY), or n fewer; fewer than it has is refused.
export function addItem(bag: Bag, id: ItemId, n: number): Bag {
  const have = bag[id] ?? 0;
  const next = have + n;
  if (next < 0) throw new RuleViolation("no_item");
  const out = { ...bag };
  if (next === 0) delete out[id];
  else out[id] = Math.min(next, MAX_CARRY);
  return out;
}

// What the worn gear adds up to in a fight.
export interface GearStats { atk: number; hp: number; def: number }

// What a piece's + is worth in steps of its + bonus: one a +, two a + past +10.
export function plusSteps(plus: number): number {
  return Math.min(plus, PLUS_DOUBLED_FROM) + 2 * Math.max(0, plus - PLUS_DOUBLED_FROM);
}

export function gearStats(gear: Gear): GearStats {
  const out = { atk: 0, hp: 0, def: 0 };
  if (gear.weapon) out.atk += ITEMS[gear.weapon.id].atk + plusSteps(gear.weapon.plus) * plusAtk(gear.weapon.id);
  if (gear.armor) {
    const n = plusSteps(gear.armor.plus);
    out.hp += ITEMS[gear.armor.id].hp + n * PLUS_HP;
    out.def += ITEMS[gear.armor.id].def + n * PLUS_DEF;
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
  // What every mount the account owns adds by being owned (보유 효과; see mounts.ts).
  herd: MountBonus;
  // The account's VIP rank (see premium.ts).
  vip: number;
  // Souls waiting to be collected, and the codex they go into (see souls.ts).
  souls: Souls;
  codex: Souls;
}

export function sellPrice(id: ItemId): number {
  const spec = ITEMS[id];
  if (spec.sell !== undefined) return spec.sell;
  const price = spec.price;
  // Drop-only gear has no shop price; the shop pays a flat sum for it.
  if (price === null) return 400;
  return Math.floor(price / 2);
}
