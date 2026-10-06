import { LISTING_MS, MAX_LISTINGS, sellerGets } from "../../src/game/account/market";
import { editActive, errorOf, makeCharacter } from "./helpers";

const piece = (uid: string, plus = 0, trade = true) => ({ uid, id: "weapon_3", plus, trade });

// A seller (test-a) with a +4 tradable weapon, one that may not be traded, and tradable silk; a
// buyer (test-b) with gems. Leaves the seller connected.
async function stalls(server: any, buyerGems = 500): Promise<void> {
  await makeCharacter(server, "test-b", "사는사람");
  await $global.updateUserState("test-b", { gems: buyerGems });
  await makeCharacter(server, "test-a", "파는사람");
  await editActive("test-a", (c) => ({ ...c, pieces: [piece("good", 4), piece("bound", 0, false)], bagTrade: { silk: 30 }, bag: { ...c.bag, silk: 5 } }));
}

// The market's letters in an account's mailbox (not the game's gifts).
async function marketMail(server: any, account: string): Promise<any[]> {
  server.connect({ account });
  return (await server.getMail()).mail.filter((m: any) => m.kind !== "gift");
}

describe("market", () => {
  test("a tradable piece goes up for gems and leaves the bag; others see it, the seller sees it as theirs", async (server) => {
    await stalls(server);
    const { bag, listings } = await server.sellOnMarket({ uid: "good" }, 100);
    expect(bag.pieces.map((p: any) => p.uid)).toEqual(["bound"]);
    expect(listings.length).toBe(1);
    expect(listings[0]).toMatchObject({ item: "weapon_3", plus: 4, price: 100, mine: true, sellerName: "파는사람", shelf: "weapon" });
    expect(listings[0].seller).toBeUndefined();
    server.connect({ account: "test-b" });
    const seen = await server.market({ shelf: "weapon" });
    expect(seen.listings.map((l: any) => [l.item, l.plus, l.price, l.mine])).toEqual([["weapon_3", 4, 100, false]]);
    expect(seen.gems).toBe(500);
    expect((await server.market({ shelf: "weapon", minPlus: 5 })).listings).toEqual([]);
    expect((await server.market({ shelf: "armor" })).listings).toEqual([]);
  });

  test("only what may be traded, at a price in range, up to the limit", async (server) => {
    await stalls(server);
    expect(await errorOf(server.sellOnMarket({ uid: "bound" }, 100))).toContain("not_tradable");
    expect(await errorOf(server.sellOnMarket({ uid: "nope" }, 100))).toContain("no_item");
    expect(await errorOf(server.sellOnMarket({ item: "potion_small", n: 1 }, 5))).toContain("not_tradable");
    expect(await errorOf(server.sellOnMarket({ uid: "good" }, 9))).toContain("bad_price");
    expect(await errorOf(server.sellOnMarket({ item: "silk", n: 31 }, 5))).toContain("no_item");
    expect(await errorOf(server.sellOnMarket({ item: "silk", n: 0 }, 5))).toContain("unavailable");
    // Nothing left the bag on a refusal.
    expect((await server.getBag()).pieces.length).toBe(2);
    for (let i = 0; i < MAX_LISTINGS; i++) await server.sellOnMarket({ item: "silk", n: 1 }, 1);
    expect(await errorOf(server.sellOnMarket({ uid: "good" }, 100))).toContain("listing_limit");
    const bag = await server.getBag();
    expect([bag.bagTrade.silk, bag.bag.silk, bag.pieces.length]).toEqual([30 - MAX_LISTINGS, 5, 2]);
  });

  test("buying: the gems go, the seller is paid less the fee by mail, the piece comes by mail as it was", async (server) => {
    await stalls(server);
    await server.sellOnMarket({ uid: "good" }, 100);
    server.connect({ account: "test-b" });
    const [listing] = (await server.market({ shelf: "weapon" })).listings;
    expect((await server.buyFromMarket(listing.id)).gems).toBe(400);
    expect((await server.market({ shelf: "weapon" })).listings).toEqual([]);
    // Gone already: a second buyer, or the same one again, finds nothing and pays nothing.
    expect(await errorOf(server.buyFromMarket(listing.id))).toContain("listing_gone");
    expect((await server.getMounts()).gems).toBe(400);

    const [bought] = await marketMail(server, "test-b");
    expect([bought.kind, bought.gems]).toEqual(["market_bought", 0]);
    expect(bought.params).toEqual({ item: "weapon_3", plus: 4, n: 1, price: 100 });
    await server.claimMail(bought.id);
    const bag = await server.getBag();
    // Still +4, and still tradable: it may go on the market again.
    expect(bag.pieces.map((p: any) => [p.uid, p.plus, p.trade])).toEqual([["good", 4, true]]);

    const [sold] = await marketMail(server, "test-a");
    expect([sold.kind, sold.gems, sold.items]).toEqual(["market_sold", sellerGets(100), []]);
    await server.claimMail(sold.id);
    expect((await server.getMounts()).gems).toBe(sellerGets(100));
  });

  test("not your own, and not without the gems", async (server) => {
    await stalls(server, 50);
    await server.sellOnMarket({ uid: "good" }, 100);
    const [mine] = (await server.myListings()).listings;
    expect(await errorOf(server.buyFromMarket(mine.id))).toContain("own_listing");
    server.connect({ account: "test-b" });
    expect(await errorOf(server.buyFromMarket(mine.id))).toContain("not_enough_gems");
    expect((await server.getMounts()).gems).toBe(50);
    expect((await server.market({ shelf: "weapon" })).listings.length).toBe(1);
    expect(await errorOf(server.buyFromMarket("nope"))).toContain("listing_gone");
  });

  test("materials are priced by the one, and a buyer takes as many as they like; the rest stays up", async (server) => {
    await stalls(server);
    await server.sellOnMarket({ item: "silk", n: 20 }, 3);
    expect((await server.getBag()).bagTrade.silk).toBe(10);
    server.connect({ account: "test-b" });
    const [listing] = (await server.market({ shelf: "material", item: "silk" })).listings;
    expect(listing).toMatchObject({ item: "silk", n: 20, price: 3, piece: null });
    // 5 of the 20, at 3 each.
    expect((await server.buyFromMarket(listing.id, 5)).gems).toBe(500 - 15);
    const [left] = (await server.market({ shelf: "material", item: "silk" })).listings;
    expect([left.id, left.n, left.price]).toEqual([listing.id, 15, 3]);
    // More than is left, or none, is refused and costs nothing.
    expect(await errorOf(server.buyFromMarket(listing.id, 16))).toContain("too_many");
    expect(await errorOf(server.buyFromMarket(listing.id, 0))).toContain("too_many");
    expect((await server.getMounts()).gems).toBe(485);
    // The rest: the listing is gone.
    await server.buyFromMarket(listing.id, 15);
    expect((await server.market({ shelf: "material", item: "silk" })).listings).toEqual([]);
    const bought = await marketMail(server, "test-b");
    expect(bought.map((m: any) => [m.params.n, m.params.price]).sort()).toEqual([[15, 45], [5, 15]]);
    for (const letter of bought) await server.claimMail(letter.id);
    // Bought materials may be traded again.
    expect((await server.getBag()).bagTrade.silk).toBe(20);
    // The seller is paid per sale, less 5% (nothing kept under 20 gems).
    const sold = await marketMail(server, "test-a");
    expect(sold.map((m: any) => m.gems).sort((x: number, y: number) => x - y)).toEqual([sellerGets(15), sellerGets(45)]);
  });

  test("taken down, or out of time, it comes back by mail", async (server) => {
    await stalls(server);
    await server.sellOnMarket({ uid: "good" }, 100);
    const [listing] = (await server.myListings()).listings;
    server.connect({ account: "test-b" });
    expect(await errorOf(server.cancelMarketListing(listing.id))).toContain("listing_gone");
    server.connect({ account: "test-a" });
    expect((await server.cancelMarketListing(listing.id)).listings).toEqual([]);
    const [back] = await marketMail(server, "test-a");
    expect(back).toMatchObject({ kind: "market_returned" });
    await server.claimMail(back.id);
    expect((await server.getBag()).pieces.map((p: any) => [p.uid, p.plus, p.trade])).toEqual([["bound", 0, false], ["good", 4, true]]);

    // Up again, then past its time: the next look at the market sends it back.
    await server.sellOnMarket({ uid: "good" }, 100);
    const [again] = (await server.myListings()).listings;
    await $global.updateCollectionItem("market", { __id: again.id, until: Date.now() - LISTING_MS });
    server.connect({ account: "test-b" });
    expect((await server.market({ shelf: "weapon" })).listings).toEqual([]);
    const returned = await marketMail(server, "test-a");
    expect(returned.map((m: any) => m.kind)).toEqual(["market_returned"]);
    expect((await server.myListings()).listings).toEqual([]);
  });

  test("from VIP 8 a sale pays all of it, no fee", async (server) => {
    await stalls(server);
    await $global.updateUserState("test-a", { vipPoints: 50_000 });
    server.connect({ account: "test-a" });
    await server.sellOnMarket({ uid: "good" }, 100);
    server.connect({ account: "test-b" });
    const [listing] = (await server.market({ shelf: "weapon" })).listings;
    await server.buyFromMarket(listing.id, 1);
    const [sold] = await marketMail(server, "test-a");
    expect([sold.gems, sold.params.fee]).toEqual([100, 0]);
  });
});
