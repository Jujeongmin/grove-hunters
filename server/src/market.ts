import {
  LISTING_MS, MAX_LISTINGS, readListing, sellerGets, type Listing, type Shelf,
} from "../../src/game/account/market";
import type { MailItem } from "../../src/game/account/mail";
import type { GearPiece, ItemId } from "../../src/game/account/items";
import { RuleViolation } from "../../src/game/world/types";
import { MAIL_COLLECTION, sendMail } from "./mail";
import { changeGems } from "./store";

// One row per listing, on every server at once. A listing changes hands only under its own lock,
// so two buyers (or a buyer and the seller calling it off) can never both have it.
export const MARKET_COLLECTION = "market";
// Read at most this many rows of a shelf (or of one kind of item) to sort and page through.
const SHELF_READ = 500;
// Listings past their time put back each time the market is read.
const SWEEP = 20;

function withListingLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`market:${id}`, fn);
}

// An account's listings are counted and added one at a time, so the limit holds.
export function withSellerLock<T>(account: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`market-seller:${account}`, fn);
}

async function rowById(id: string): Promise<Record<string, unknown> | null> {
  return ((await $global.getCollectionItem(MARKET_COLLECTION, id).catch(() => null)) as Record<string, unknown> | null) ?? null;
}

// What a listing carries, as it goes back into a mailbox: the piece as it was, or the bundle.
function goods(listing: Pick<Listing, "item" | "piece" | "n">): MailItem[] {
  return listing.piece ? [{ id: listing.piece.id, n: 1, piece: listing.piece }] : [{ id: listing.item, n: listing.n, trade: true }];
}

// Words for a market letter: what it was about, and for how much.
function about(listing: Pick<Listing, "item" | "plus" | "n" | "price">): Record<string, string | number> {
  return { item: listing.item, plus: listing.plus, n: listing.n, price: listing.price };
}

function readAll(rows: readonly unknown[]): Listing[] {
  return rows.map((row) => readListing(row)).filter((l): l is Listing => l !== null);
}

// A new listing: the piece or bundle has already left the seller's bag. Answers its id.
export async function addListing(
  seller: string, sellerName: string, what: { piece: GearPiece } | { item: ItemId; n: number }, shelf: Shelf, price: number, now: number,
): Promise<string> {
  const piece = "piece" in what ? what.piece : null;
  const row = await $global.addCollectionItem(MARKET_COLLECTION, {
    seller, sellerName, shelf, item: piece ? piece.id : (what as { item: ItemId }).item, piece,
    n: piece ? 1 : (what as { n: number }).n, plus: piece ? piece.plus : 0, price, at: now, until: now + LISTING_MS,
  });
  return (row as { __id: string }).__id;
}

// How many listings an account has up (past their time or not: those are on their way back).
export async function countListings(seller: string): Promise<number> {
  return (await $global.getCollectionItems(MARKET_COLLECTION, {
    filters: [{ field: "seller", operator: "==", value: seller }],
    limit: MAX_LISTINGS + 1,
  })).length;
}

// Listings past their time go back to their sellers by mail, a few at a time.
export async function sweepExpired(now: number): Promise<void> {
  const rows = await $global.getCollectionItems(MARKET_COLLECTION, {
    filters: [{ field: "until", operator: "<=", value: now }],
    limit: SWEEP,
  });
  for (const row of rows) {
    await withListingLock(row.__id as string, async () => {
      const listing = readListing(await rowById(row.__id as string));
      await $global.deleteCollectionItem(MARKET_COLLECTION, row.__id as string).catch(() => undefined);
      if (listing) await sendMail(listing.seller, { kind: "market_returned", gold: 0, gems: 0, items: goods(listing), params: about(listing) }, now);
    });
  }
}

// A shelf's listings (or one kind of item's), as they read back.
export async function shelfListings(shelf: Shelf, item: ItemId | null): Promise<Listing[]> {
  const rows = await $global.getCollectionItems(MARKET_COLLECTION, {
    filters: item ? [{ field: "item", operator: "==", value: item }] : [{ field: "shelf", operator: "==", value: shelf }],
    limit: SHELF_READ,
  });
  return readAll(rows);
}

export async function sellerListings(seller: string): Promise<Listing[]> {
  const rows = await $global.getCollectionItems(MARKET_COLLECTION, {
    filters: [{ field: "seller", operator: "==", value: seller }],
    limit: MAX_LISTINGS * 2,
  });
  return readAll(rows).sort((a, b) => b.at - a.at);
}

// Buys a listing: the buyer's gems go (not_enough_gems if short), the row goes, the seller gets the
// price less the fee by mail and the buyer the goods. Should a letter fail, the gems come back and
// the listing stays up.
export async function buyListing(buyer: string, id: string, now: number): Promise<Listing> {
  return withListingLock(id, async () => {
    const listing = readListing(await rowById(id));
    if (!listing || listing.until <= now) throw new RuleViolation("listing_gone");
    if (listing.seller === buyer) throw new RuleViolation("own_listing");
    await changeGems(buyer, -listing.price);
    let sent: string[] = [];
    try {
      await $global.deleteCollectionItem(MARKET_COLLECTION, id);
      sent = [
        await sendMail(listing.seller, { kind: "market_sold", gold: 0, gems: sellerGets(listing.price), items: [], params: about(listing) }, now),
        await sendMail(buyer, { kind: "market_bought", gold: 0, gems: 0, items: goods(listing), params: about(listing) }, now),
      ];
    } catch (error) {
      for (const letter of sent) await $global.deleteCollectionItem(MAIL_COLLECTION, letter).catch(() => undefined);
      const { id: _, ...row } = listing;
      await $global.addCollectionItem(MARKET_COLLECTION, row);
      await changeGems(buyer, listing.price);
      throw error;
    }
    return listing;
  });
}

// Takes one of your listings down; the goods come back by mail.
export async function cancelListing(seller: string, id: string, now: number): Promise<void> {
  await withListingLock(id, async () => {
    const listing = readListing(await rowById(id));
    if (!listing || listing.seller !== seller) throw new RuleViolation("listing_gone");
    await $global.deleteCollectionItem(MARKET_COLLECTION, id);
    await sendMail(seller, { kind: "market_returned", gold: 0, gems: 0, items: goods(listing), params: about(listing) }, now);
  });
}
