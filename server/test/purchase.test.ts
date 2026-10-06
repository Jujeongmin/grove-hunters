import { errorOf } from "./helpers";

// Real Verse8 accounts are wallet addresses; "test-" accounts are the local practice and test seats.
const BUYER = "0x1111111111111111111111111111111111111111";

const purchase = (account: string, purchaseId: string, productId = "gems-100") => ({
  account, purchaseId, productId, quantity: 1,
});

describe("purchases", () => {
  test("the same receipt twice grants once and still reports success", async (server) => {
    expect(await server.$onItemPurchased(purchase(BUYER, "p-1"))).toEqual({ success: true, code: "granted" });
    expect(await server.$onItemPurchased(purchase(BUYER, "p-1"))).toEqual({ success: true, code: "already_granted" });
    expect(await $global.countCollectionItems("purchases")).toBe(1);
  });

  test("gems credited before a later step fails keep the receipt: the retry grants nothing twice", async (server) => {
    const real = $global.updateUserState;
    $global.updateUserState = async (account: string, state: Record<string, any>) => {
      if ("vipPoints" in state) throw new Error("write failed");
      return real.call($global, account, state);
    };
    try {
      expect(await errorOf(server.$onItemPurchased(purchase(BUYER, "p-9")))).toContain("write failed");
    } finally {
      $global.updateUserState = real;
    }
    server.connect({ account: BUYER });
    // A first pack, doubled: the gems are the buyer's.
    expect((await server.getMounts()).gems).toBe(200);
    expect(await server.$onItemPurchased(purchase(BUYER, "p-9"))).toEqual({ success: true, code: "already_granted" });
    expect((await server.getMounts()).gems).toBe(200);
  });

  test("a grant that fails before any gems are credited gives the receipt back for the retry", async (server) => {
    const real = $global.updateUserState;
    $global.updateUserState = async (account: string, state: Record<string, any>) => {
      if ("gems" in state) throw new Error("write failed");
      return real.call($global, account, state);
    };
    try {
      expect(await errorOf(server.$onItemPurchased(purchase(BUYER, "p-8")))).toContain("write failed");
    } finally {
      $global.updateUserState = real;
    }
    expect(await server.$onItemPurchased(purchase(BUYER, "p-8"))).toEqual({ success: true, code: "granted" });
    server.connect({ account: BUYER });
    expect((await server.getMounts()).gems).toBe(200);
  });

  test("turns away products it does not sell (the full game is gone) and broken events", async (server) => {
    expect((await server.$onItemPurchased(purchase(BUYER, "p-2", "gold-pack"))).success).toBe(false);
    expect((await server.$onItemPurchased(purchase(BUYER, "p-3", "full-game"))).success).toBe(false);
    expect((await server.$onItemPurchased({ account: BUYER })).success).toBe(false);
    server.connect({ account: BUYER });
    expect((await server.getMounts()).gems).toBe(0);
  });
});
