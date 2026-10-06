import { ITEMS, MAX_PLUS, MAX_STACK, readItemId, readPiece, slotOf, type GearPiece, type ItemId, type Slot } from "./items";

// The market, shared by every server: tradable gear (one piece, its + and all) and tradable materials
// (a heap, priced by the one, from which a buyer takes as many as they like) for gems, the ones the
// mount draw takes. The seller's gems and the buyer's goods come by mail.

// Gems: a piece of gear from 10, one of a material from 1.
export const MIN_GEAR_PRICE = 10;
export const MIN_MATERIAL_PRICE = 1;
export const MAX_PRICE = 100_000;
// The market keeps this share of a sale (rounded down, so sales of 9 gems or less keep all of it).
export const FEE_SHARE = 0.1;
// Listings an account may have up at once, and how long each stays up.
export const MAX_LISTINGS = 10;
export const LISTING_MS = 48 * 60 * 60 * 1000;
// Listings shown per page.
export const PAGE_SIZE = 20;

export type Shelf = Slot | "material";

export interface Listing {
  // The row's id in the market collection.
  id: string;
  // The seller's account and the name of the character that listed it.
  seller: string;
  sellerName: string;
  shelf: Shelf;
  item: ItemId;
  // Gear: the piece itself. Materials: null.
  piece: GearPiece | null;
  // How many are left (gear: 1).
  n: number;
  // For finding it: the piece's + (0 for materials).
  plus: number;
  // Gems for one (for gear, the piece).
  price: number;
  at: number;
  until: number;
}

// A listing as the buy and my-listings tabs show it: the seller by name only.
export type ListingView = Omit<Listing, "seller"> & { mine: boolean };

export function marketFee(price: number): number {
  return Math.floor(price * FEE_SHARE);
}

export function sellerGets(price: number): number {
  return price - marketFee(price);
}

// What `count` of a listing cost.
export function costOf(listing: Pick<Listing, "price">, count: number): number {
  return listing.price * count;
}

// A price asked for a piece of gear or one of a material: a whole number of gems in range, or null.
export function readPrice(raw: unknown, shelf: Shelf): number | null {
  const min = shelf === "material" ? MIN_MATERIAL_PRICE : MIN_GEAR_PRICE;
  return typeof raw === "number" && Number.isInteger(raw) && raw >= min && raw <= MAX_PRICE ? raw : null;
}

// How many of a material to list: 1 to a full stack.
export function readBundle(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= MAX_STACK ? raw : null;
}

// How many of a listing a buyer takes: 1 to all that are left; null otherwise.
export function readBuyCount(raw: unknown, listing: Pick<Listing, "n">): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= listing.n ? raw : null;
}

export function shelfOf(id: ItemId): Shelf | null {
  const slot = slotOf(id);
  if (slot) return slot;
  return ITEMS[id].kind === "material" ? "material" : null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// A row of the market collection as a listing; null for anything that does not read back whole.
export function readListing(row: unknown): Listing | null {
  const r = row as Record<string, unknown> | null;
  const item = readItemId(r?.item);
  if (!r || !item || typeof r.__id !== "string" || typeof r.seller !== "string") return null;
  const shelf = shelfOf(item);
  // Rows from before prices were by the one (marked `each` since) priced a material heap whole: read
  // as the price of one, rounded up, so the seller never gets less than they asked.
  const n = shelf === "material" ? readBundle(r.n) : 1;
  const asked = shelf === "material" && r.each !== true && n !== null && typeof r.price === "number" ? Math.ceil(r.price / n) : r.price;
  const price = readPrice(asked, shelf ?? "material");
  const at = num(r.at);
  const until = num(r.until);
  if (!shelf || shelf !== r.shelf || price === null || at === null || until === null) return null;
  const sellerName = typeof r.sellerName === "string" ? r.sellerName : "";
  if (shelf === "material") {
    return n === null ? null : { id: r.__id, seller: r.seller, sellerName, shelf, item, piece: null, n, plus: 0, price, at, until };
  }
  const piece = readPiece(r.piece);
  if (!piece || piece.id !== item || !piece.trade) return null;
  return { id: r.__id, seller: r.seller, sellerName, shelf, item, piece, n: 1, plus: piece.plus, price, at, until };
}

// What the buy tab looks for: a shelf, a kind of item on it, a lowest +.
export interface MarketFilter { shelf: Shelf; item: ItemId | null; minPlus: number; page: number }

export function readFilter(raw: unknown): MarketFilter {
  const f = (raw ?? {}) as Record<string, unknown>;
  const shelf: Shelf = f.shelf === "weapon" || f.shelf === "armor" || f.shelf === "material" ? f.shelf : "weapon";
  const item = readItemId(f.item);
  const minPlus = typeof f.minPlus === "number" && Number.isInteger(f.minPlus) ? Math.max(0, Math.min(MAX_PLUS, f.minPlus)) : 0;
  const page = typeof f.page === "number" && Number.isInteger(f.page) && f.page >= 0 ? Math.min(f.page, 1000) : 0;
  return { shelf, item: item && shelfOf(item) === shelf ? item : null, minPlus, page };
}

// The listings a filter finds, cheapest (by the one) first, then the oldest first, one page of them;
// `pages` is how many there are.
export function pageOf(listings: readonly Listing[], filter: MarketFilter, now: number): { listings: Listing[]; page: number; pages: number } {
  const found = listings
    .filter((l) => l.shelf === filter.shelf && (!filter.item || l.item === filter.item) && l.plus >= filter.minPlus && l.until > now)
    .sort((a, b) => a.price - b.price || a.at - b.at);
  const pages = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
  const page = Math.min(filter.page, pages - 1);
  return { listings: found.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), page, pages };
}
