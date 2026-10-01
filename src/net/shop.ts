import { VXShop } from "@verse8/platform";

// The Verse8 VX Shop, for what we sell (gem packs, the monthly pass). The dialog is Verse8's own; what
// was bought arrives on the server ($onItemPurchased), so after the dialog closes the screen asks it.

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

// Opens Verse8's dialog for one of our products.
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

