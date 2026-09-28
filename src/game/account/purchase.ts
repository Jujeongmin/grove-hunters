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
// The metadata is JSON on the product:
//   { "listPrice": 1000 }
export interface Offer {
  // What it costs now.
  price: number;
  // What it costs when it is not on sale, when that is more than the price now; null otherwise.
  listPrice: number | null;
  // Whole percent off, 1 to 99; null when there is no sale.
  off: number | null;
}

export function readOffer(price: number, metadata: unknown): Offer {
  const plain: Offer = { price, listPrice: null, off: null };
  if (typeof metadata !== "string" || metadata.trim() === "") return plain;
  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    return plain;
  }
  if (!parsed || typeof parsed !== "object") return plain;
  const listPrice = (parsed as Record<string, unknown>).listPrice;
  if (typeof listPrice !== "number" || !Number.isFinite(listPrice)) return plain;
  const whole = Math.round(listPrice);
  if (whole <= price) return plain;
  return { price, listPrice: whole, off: Math.min(99, Math.max(1, Math.round((1 - price / whole) * 100))) };
}
