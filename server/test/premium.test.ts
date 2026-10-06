import { PASS_GEMS_DAILY, PASS_GEMS_NOW, PASS_POINTS, PASS_PRODUCT } from "../../src/game/account/premium";
import { enterAs, makeCharacter } from "./helpers";

// Real Verse8 accounts are wallet addresses.
const BUYER = "0x2222222222222222222222222222222222222222";
const DAY = 24 * 60 * 60 * 1000;

const buy = (purchaseId: string, productId: string, quantity = 1, account = BUYER) => ({ account, purchaseId, productId, quantity });

async function premiumOf(server: any, account = BUYER): Promise<any> {
  server.connect({ account });
  return server.getMounts();
}

describe("premium", () => {
  test("a gem pack gives its own gems, first purchase or not, and every gem bought counts toward VIP", async (server) => {
    await server.$onItemPurchased(buy("p1", "gems-100"));
    let view = await premiumOf(server);
    expect(view.gems).toBe(100);
    expect(view.premium).toMatchObject({ vip: 1, vipPoints: 100, firstBought: ["gems-100"] });
    await server.$onItemPurchased(buy("p2", "gems-100"));
    await server.$onItemPurchased(buy("p3", "gems-550"));
    view = await premiumOf(server);
    expect(view.gems).toBe(100 + 100 + 550);
    expect(view.premium).toMatchObject({ vip: 2, vipPoints: 750, nextVipAt: 1200 });
    expect([...view.premium.firstBought].sort()).toEqual(["gems-100", "gems-550"]);
  });

  test("the monthly pass: gems now, thirty days that a second one extends, and VIP points", async (server) => {
    await server.$onItemPurchased(buy("m1", PASS_PRODUCT));
    let view = await premiumOf(server);
    expect(view.gems).toBe(PASS_GEMS_NOW);
    expect(view.premium).toMatchObject({ passDaysLeft: 30, vipPoints: PASS_POINTS, vip: 2 });
    await server.$onItemPurchased(buy("m2", PASS_PRODUCT));
    view = await premiumOf(server);
    expect(view.premium.passDaysLeft).toBe(60);
    // A receipt seen before grants nothing more.
    expect(await server.$onItemPurchased(buy("m2", PASS_PRODUCT))).toEqual({ success: true, code: "already_granted" });
    expect((await premiumOf(server)).gems).toBe(2 * PASS_GEMS_NOW);
  });

  test("while the pass runs, the first visit of each day brings its gems by mail, once", async (server) => {
    await makeCharacter(server, BUYER, "월정액러");
    await server.$onItemPurchased(buy("m1", PASS_PRODUCT));
    await enterAs(server, BUYER);
    await enterAs(server, BUYER);
    server.connect({ account: BUYER });
    const letters = (await server.getMail()).mail.filter((m: any) => m.kind === "monthly_pass");
    expect(letters.map((m: any) => m.gems)).toEqual([PASS_GEMS_DAILY]);
    // The next day, another.
    const realNow = Date.now;
    Date.now = () => realNow() + DAY;
    try {
      await enterAs(server, BUYER);
    } finally {
      Date.now = realNow;
    }
    server.connect({ account: BUYER });
    expect((await server.getMail()).mail.filter((m: any) => m.kind === "monthly_pass").length).toBe(2);
  });

  test("no pass, no daily gems", async (server) => {
    await makeCharacter(server, BUYER, "무과금러");
    await enterAs(server, BUYER);
    server.connect({ account: BUYER });
    expect((await server.getMail()).mail.filter((m: any) => m.kind === "monthly_pass")).toEqual([]);
  });

  test("VIP 10 brings its own mythic mount, to ride like any other", async (server) => {
    await $global.updateUserState(BUYER, { vipPoints: 200_000 });
    const view = await premiumOf(server);
    expect(view.premium.vip).toBe(10);
    expect(view.owned).toContain("celestial_dragon");
    expect((await server.selectMount("celestial_dragon")).selected).toBe("celestial_dragon");
  });
});
