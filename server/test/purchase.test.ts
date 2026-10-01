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

  test("turns away products it does not sell (the full game is gone) and broken events", async (server) => {
    expect((await server.$onItemPurchased(purchase(BUYER, "p-2", "gold-pack"))).success).toBe(false);
    expect((await server.$onItemPurchased(purchase(BUYER, "p-3", "full-game"))).success).toBe(false);
    expect((await server.$onItemPurchased({ account: BUYER })).success).toBe(false);
    server.connect({ account: BUYER });
    expect((await server.getMounts()).gems).toBe(0);
  });
});
