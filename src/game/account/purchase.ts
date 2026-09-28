// The one thing on sale: the full game. It must match the Product ID registered in the Verse8
// dashboard (500 VX, one per account). Practice is free; online matches need it.
export const FULL_GAME_PRODUCT = "full-game";
export const FULL_GAME_PRICE_VX = 500;

// What the platform sends when a purchase completes (the server's $onItemPurchased hook).
export interface PurchaseEvent {
  account: string;
  purchaseId: string;
  productId: string;
  quantity: number;
}

export function readPurchaseEvent(value: unknown): PurchaseEvent | null {
  if (!value || typeof value !== "object") return null;
  const e = value as Record<string, unknown>;
  const purchaseId = typeof e.purchaseId === "string" || typeof e.purchaseId === "number" ? String(e.purchaseId).trim() : "";
  if (typeof e.account !== "string" || e.account === "" || purchaseId === "" || purchaseId.length > 200) return null;
  if (typeof e.productId !== "string" || !Number.isInteger(e.quantity) || (e.quantity as number) < 1) return null;
  return { account: e.account, purchaseId, productId: e.productId, quantity: e.quantity as number };
}

// Local test and practice seats ("test-…") play online without buying.
export function playsFree(account: string): boolean {
  return account.startsWith("test-");
}

// What the shop is asking for the full game right now. A sale is only ever what the Verse8 product
// itself says: the price comes from the product, and the price it is marked down from comes from
// the product's metadata. Nothing here invents a price the game never charged — set the product's
// real price to the higher one and put it on sale to the lower one, and this shows the difference.
//
// The metadata is JSON on the product, both fields optional:
//   { "listPrice": 1000, "saleEndsAt": "2026-10-31T23:59:59+09:00" }
export interface Offer {
  // What it costs now.
  price: number;
  // What it costs when it is not on sale, when that is more than the price now; null otherwise.
  listPrice: number | null;
  // Whole percent off, 1 to 99; null when there is no sale.
  off: number | null;
  // When the sale ends, as a timestamp; null when the product does not say.
  endsAt: number | null;
}

export function readOffer(price: number, metadata: unknown, now: number): Offer {
  const plain: Offer = { price, listPrice: null, off: null, endsAt: null };
  if (typeof metadata !== "string" || metadata.trim() === "") return plain;
  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    return plain;
  }
  if (!parsed || typeof parsed !== "object") return plain;
  const m = parsed as Record<string, unknown>;
  const endsAt = typeof m.saleEndsAt === "string" ? Date.parse(m.saleEndsAt) : NaN;
  // A sale that has run out is over, whatever the price says.
  if (Number.isFinite(endsAt) && endsAt <= now) return plain;
  const listPrice = typeof m.listPrice === "number" && Number.isFinite(m.listPrice) ? Math.round(m.listPrice) : 0;
  if (listPrice <= price) return { ...plain, endsAt: Number.isFinite(endsAt) ? endsAt : null };
  return {
    price,
    listPrice,
    off: Math.min(99, Math.max(1, Math.round((1 - price / listPrice) * 100))),
    endsAt: Number.isFinite(endsAt) ? endsAt : null,
  };
}
