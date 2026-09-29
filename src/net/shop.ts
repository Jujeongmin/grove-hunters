import { VXShop } from "@verse8/platform";
import { FULL_GAME_PRICE_VX, FULL_GAME_PRODUCT, readOffer, type Offer } from "../game/account/purchase";

// The Verse8 VX Shop, for the one product we sell. The dialog is Verse8's own; the unlock itself
// arrives on the server ($onItemPurchased), so after the dialog closes the menu asks the server.

// The Agent8 v2 editor preview runs on its own host, which the SDK 2.1.0 does not recognise as a
// preview, so there the dialog is opened with the PREVIEW stage spelled out (as bastion-line does).
const V2_EDITOR_PREVIEW_HOST = /^agent8-container-v2-[a-z0-9-]+\.agent8\.verse8\.net$/;

function inEditorPreview(): boolean {
  try {
    return V2_EDITOR_PREVIEW_HOST.test(window.location.hostname.toLowerCase());
  } catch {
    return false;
  }
}

let started = false;

export function startShop(verseId: string, account: string): void {
  if (started) return;
  started = true;
  try {
    VXShop.init({ verseId, account, autoRefresh: true });
  } catch {
    // Outside Verse8 the shop has nothing to talk to; the price falls back to the listed one.
  }
}

export function fullGamePrice(): number {
  return fullGameOffer().price;
}

// What the shop is asking, and what it is marked down from, if the product says so.
export function fullGameOffer(): Offer {
  try {
    const item = VXShop.getItem(FULL_GAME_PRODUCT);
    if (!item) return readOffer(FULL_GAME_PRICE_VX, null);
    return readOffer(item.price, item.metadata);
  } catch {
    return readOffer(FULL_GAME_PRICE_VX, null);
  }
}

export function buyFullGame(verseId: string): void {
  buyProduct(verseId, FULL_GAME_PRODUCT);
}

// Opens Verse8's dialog for one of our products (the full game, a gem pack).
export function buyProduct(verseId: string, productId: string): void {
  if (inEditorPreview() && window.parent !== window) {
    window.parent.postMessage(
      { type: "OPEN_VX_SHOP_DIALOG", payload: { verseId, productId, stage: "PREVIEW" } },
      "*",
    );
    return;
  }
  VXShop.buyItem(productId);
}

// What a product costs in VX, as the shop lists it; null when the shop does not know it (outside
// Verse8, or a product not yet registered in the dashboard).
export function productPrice(productId: string): number | null {
  try {
    return VXShop.getItem(productId)?.price ?? null;
  } catch {
    return null;
  }
}

// Called when the dialog for any product closes: which, and whether it was bought.
export function onAnyShopClosed(listener: (productId: string, purchased: boolean) => void): () => void {
  try {
    return VXShop.onClose((payload) => listener(payload.productId, payload.purchased));
  } catch {
    return () => undefined;
  }
}

// Called with true when the player went through with the purchase, false when they closed it.
export function onShopClosed(listener: (purchased: boolean) => void): () => void {
  try {
    return VXShop.onClose((payload) => {
      if (payload.productId === FULL_GAME_PRODUCT) listener(payload.purchased);
    });
  } catch {
    return () => undefined;
  }
}
