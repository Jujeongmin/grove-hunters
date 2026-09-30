import { RuleViolation } from "../world/types";
import {
  ITEMS, MAX_PLUS, MAX_STACK, NO_GEAR, addItem, readBag, readItemId, readPiece, slotOf,
  type Bag, type Gear, type GearPiece, type ItemId, type Slot,
} from "./items";

// Everything a character carries, and the rules for moving it. Potions and materials are counted in
// stacks; materials in two (bag: stays with the character, bagTrade: may go to the market). Gear is
// carried piece by piece, each with its own + and whether it may be traded.

export interface Inventory {
  bag: Bag;
  bagTrade: Bag;
  // Gear in the bag (what is worn is in gear).
  pieces: GearPiece[];
  gear: Gear;
}

export const EMPTY_INVENTORY: Inventory = { bag: {}, bagTrade: {}, pieces: [], gear: NO_GEAR };
// Gear in the bag, worn gear not counted.
export const MAX_PIECES = 50;
// The share of dropped gear that may be traded, and of gear the smith makes.
export const TRADE_DROP_CHANCE = 0.3;
export const TRADE_CRAFT_CHANCE = 0.1;

// A new piece's id. The server makes them; tests pass their own.
export type MakeUid = () => string;

export interface ItemCount { id: ItemId; n: number }

// --- Reading what was saved ------------------------------------------------------------------------

// A character's things as saved. Saves from before pieces (gear counted like potions, and a + per
// kind of gear) are turned into pieces here, the same way on every read until the next save writes
// the new form: every piece may not be traded, and a kind's + goes to one piece only (the worn one,
// or else the first in the bag), so no + is ever copied.
export function readInventory(raw: Record<string, unknown>, characterId: string): Inventory {
  if (Array.isArray(raw.pieces)) {
    const seen = new Set<string>();
    const pieces: GearPiece[] = [];
    for (const entry of raw.pieces) {
      const piece = readPiece(entry);
      if (piece && !seen.has(piece.uid)) {
        seen.add(piece.uid);
        pieces.push(piece);
      }
    }
    const g = (raw.gear ?? {}) as Record<string, unknown>;
    const worn = (slot: Slot) => {
      const piece = readPiece(g[slot]);
      return piece && slotOf(piece.id) === slot && !seen.has(piece.uid) ? piece : null;
    };
    return { bag: readBag(raw.bag), bagTrade: onlyMaterials(readBag(raw.bagTrade)), pieces, gear: { weapon: worn("weapon"), armor: worn("armor") } };
  }
  return fromLegacy(raw, characterId);
}

function onlyMaterials(bag: Bag): Bag {
  return Object.fromEntries(Object.entries(bag).filter(([id]) => ITEMS[id as ItemId].kind === "material"));
}

function fromLegacy(raw: Record<string, unknown>, characterId: string): Inventory {
  const counts: Partial<Record<ItemId, number>> = {};
  if (raw.bag && typeof raw.bag === "object") {
    for (const [id, n] of Object.entries(raw.bag as Record<string, unknown>)) {
      const item = readItemId(id);
      if (item && typeof n === "number" && Number.isInteger(n) && n > 0) counts[item] = Math.min(n, MAX_STACK);
    }
  }
  const plus: Partial<Record<ItemId, number>> = {};
  if (raw.plus && typeof raw.plus === "object") {
    for (const [id, n] of Object.entries(raw.plus as Record<string, unknown>)) {
      const item = readItemId(id);
      if (item && slotOf(item) && typeof n === "number" && Number.isInteger(n) && n > 0) plus[item] = Math.min(n, MAX_PLUS);
    }
  }
  const pieces: GearPiece[] = [];
  const bag: Bag = {};
  for (const [id, n] of Object.entries(counts) as [ItemId, number][]) {
    if (!slotOf(id)) {
      bag[id] = n;
      continue;
    }
    for (let i = 0; i < n; i++) pieces.push({ uid: `m-${characterId}-${id}-${i}`, id, plus: 0, trade: false });
  }
  const g = (raw.gear ?? {}) as Record<string, unknown>;
  const worn = (slot: Slot): GearPiece | null => {
    const id = readItemId(g[slot]);
    return id && slotOf(id) === slot ? { uid: `m-${characterId}-${id}-w`, id, plus: 0, trade: false } : null;
  };
  const gear = { weapon: worn("weapon"), armor: worn("armor") };
  for (const [id, n] of Object.entries(plus) as [ItemId, number][]) {
    const slot = slotOf(id)!;
    const wornPiece = gear[slot];
    if (wornPiece?.id === id) gear[slot] = { ...wornPiece, plus: n };
    else {
      const at = pieces.findIndex((p) => p.id === id);
      if (at >= 0) pieces[at] = { ...pieces[at], plus: n };
    }
  }
  return { bag, bagTrade: {}, pieces, gear };
}

// --- Counting ---------------------------------------------------------------------------------------

// How many of a potion or material, in both stacks.
export function countOf(inv: Inventory, id: ItemId): number {
  return (inv.bag[id] ?? 0) + (inv.bagTrade[id] ?? 0);
}

// Both stacks as one (what a recipe or the village sees).
export function allStacks(inv: Inventory): Bag {
  const out: Bag = { ...inv.bag };
  for (const [id, n] of Object.entries(inv.bagTrade) as [ItemId, number][]) out[id] = (out[id] ?? 0) + n;
  return out;
}

// Whether `items` all fit: no stack past MAX_STACK, no more than MAX_PIECES pieces. `trade` says which
// stack materials go to.
export function fits(inv: Inventory, items: readonly ItemCount[], trade: boolean): boolean {
  let gear = 0;
  const adding: Partial<Record<ItemId, number>> = {};
  for (const { id, n } of items) {
    if (slotOf(id)) gear += n;
    else adding[id] = (adding[id] ?? 0) + n;
  }
  if (gear > 0 && inv.pieces.length + gear > MAX_PIECES) return false;
  return (Object.entries(adding) as [ItemId, number][]).every(([id, n]) => (stackFor(inv, id, trade)[id] ?? 0) + n <= MAX_STACK);
}

// Potions have no market; a material goes to the stack its trade says.
function stackFor(inv: Inventory, id: ItemId, trade: boolean): Bag {
  return trade && ITEMS[id].kind === "material" ? inv.bagTrade : inv.bag;
}

// --- Getting things ---------------------------------------------------------------------------------

// A uid no piece the character has already carries (a clash is all but impossible, but two pieces
// with one uid would read back as one).
function freshUid(inv: Inventory, made: readonly GearPiece[], makeUid: MakeUid): string {
  const taken = new Set([...inv.pieces, ...made].map((p) => p.uid));
  if (inv.gear.weapon) taken.add(inv.gear.weapon.uid);
  if (inv.gear.armor) taken.add(inv.gear.armor.uid);
  let uid = makeUid();
  for (let n = 1; taken.has(uid); n++) uid = `${makeUid()}-${n}`;
  return uid;
}

// Hands over `items` (from the shop, a quest, a letter…): all of it or, if it does not fit, nothing
// (bag_full). Gear comes as new pieces with `trade`; materials go to that stack.
export function give<I extends Inventory>(inv: I, items: readonly ItemCount[], trade: boolean, makeUid: MakeUid): I {
  if (!fits(inv, items, trade)) throw new RuleViolation("bag_full");
  let next = inv;
  for (const { id, n } of items) {
    if (slotOf(id)) {
      const made: GearPiece[] = [];
      for (let i = 0; i < n; i++) made.push({ uid: freshUid(next, made, makeUid), id, plus: 0, trade });
      next = { ...next, pieces: [...next.pieces, ...made] };
    } else if (trade && ITEMS[id].kind === "material") next = { ...next, bagTrade: addItem(next.bagTrade, id, n) };
    else next = { ...next, bag: addItem(next.bag, id, n) };
  }
  return next;
}

// What a kill drops: materials may always be traded; gear may be one time in TRADE_DROP_CHANCE
// (`random` in [0, 1)). What does not fit is lost, as loot past a full stack always was.
export function loot<I extends Inventory>(inv: I, ids: readonly ItemId[], random: () => number, makeUid: MakeUid): I {
  let next = inv;
  for (const id of ids) {
    if (slotOf(id)) {
      const trade = random() < TRADE_DROP_CHANCE;
      if (next.pieces.length < MAX_PIECES) next = { ...next, pieces: [...next.pieces, { uid: freshUid(next, [], makeUid), id, plus: 0, trade }] };
    } else if (ITEMS[id].kind === "material") next = { ...next, bagTrade: addItem(next.bagTrade, id, 1) };
    else next = { ...next, bag: addItem(next.bag, id, 1) };
  }
  return next;
}

// --- Using things -----------------------------------------------------------------------------------

// Uses up potions or materials: what may not be traded goes first, so what may is kept for the
// market. Short of any of it, nothing is used (no_item).
export function spend<I extends Inventory>(inv: I, needs: readonly ItemCount[]): I {
  let { bag, bagTrade } = inv;
  for (const { id, n } of needs) {
    if (slotOf(id)) throw new RuleViolation("unavailable");
    const fromBag = Math.min(n, bag[id] ?? 0);
    const fromTrade = n - fromBag;
    if (fromTrade > (bagTrade[id] ?? 0)) throw new RuleViolation("no_item");
    if (fromBag > 0) bag = addItem(bag, id, -fromBag);
    if (fromTrade > 0) bagTrade = addItem(bagTrade, id, -fromTrade);
  }
  return { ...inv, bag, bagTrade };
}

// Takes n from one stack (the shop buying back, the market): `trade` says which.
export function takeStack<I extends Inventory>(inv: I, id: ItemId, n: number, trade: boolean): I {
  if (slotOf(id)) throw new RuleViolation("unavailable");
  return trade ? { ...inv, bagTrade: addItem(inv.bagTrade, id, -n) } : { ...inv, bag: addItem(inv.bag, id, -n) };
}

// Takes a piece out of the bag (not one that is worn).
export function takePiece<I extends Inventory>(inv: I, uid: string): { inv: I; piece: GearPiece } {
  const piece = inv.pieces.find((p) => p.uid === uid);
  if (!piece) throw new RuleViolation("no_item");
  return { inv: { ...inv, pieces: inv.pieces.filter((p) => p.uid !== uid) }, piece };
}

// Puts a whole piece back (a letter from the market); bag_full past MAX_PIECES.
export function putPiece<I extends Inventory>(inv: I, piece: GearPiece): I {
  if (inv.pieces.length >= MAX_PIECES) throw new RuleViolation("bag_full");
  if (inv.pieces.some((p) => p.uid === piece.uid)) throw new RuleViolation("unavailable");
  return { ...inv, pieces: [...inv.pieces, piece] };
}

// Wears a piece from the bag; whatever was in its slot goes back into the bag in its place.
export function equipPiece<I extends Inventory>(inv: I, uid: string): I {
  const { inv: without, piece } = takePiece(inv, uid);
  const slot = slotOf(piece.id)!;
  const old = inv.gear[slot];
  return { ...without, pieces: old ? [...without.pieces, old] : without.pieces, gear: { ...inv.gear, [slot]: piece } };
}

// Takes off what is worn in a slot, into the bag (bag_full if the bag has no room for it).
export function unequipSlot<I extends Inventory>(inv: I, slot: Slot): I {
  const old = inv.gear[slot];
  if (!old) return inv;
  if (inv.pieces.length >= MAX_PIECES) throw new RuleViolation("bag_full");
  return { ...inv, pieces: [...inv.pieces, old], gear: { ...inv.gear, [slot]: null } };
}
