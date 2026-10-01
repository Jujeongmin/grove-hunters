import { BASE_MOUNT, DUPLICATE_REFUND, MAX_STARS, PULL_COST, mountBonus } from "../../src/game/account/mounts";
import { maxHpAt } from "../../src/game/world/monsters";
import { enterAs, errorOf, makeCharacter } from "./helpers";

const BUYER = "0x2222222222222222222222222222222222222222";
const gems = (id: string, productId = "gems-100", quantity = 1) => ({ account: BUYER, purchaseId: id, productId, quantity });

// Draws with Math.random held at `value`.
async function drawing(value: number, run: () => Promise<any>): Promise<any> {
  const real = Math.random;
  Math.random = () => value;
  try {
    return await run();
  } finally {
    Math.random = real;
  }
}

describe("gems", () => {
  test("come only from the shop's gem products, once per receipt", async (server) => {
    expect(await server.$onItemPurchased(gems("g-1", "gems-550"))).toEqual({ success: true, code: "granted" });
    expect(await server.$onItemPurchased(gems("g-1", "gems-550"))).toEqual({ success: true, code: "already_granted" });
    server.connect({ account: BUYER });
    expect((await server.getMounts()).gems).toBe(550);
  });
});

describe("the mount draw", () => {
  test("costs gems, gives a mount to keep; a repeat breaks through a star, and past ★5 comes back as gems", async (server) => {
    server.connect({ account: BUYER });
    expect(await errorOf(server.pullMount())).toContain("not_enough_gems");
    await server.$onItemPurchased(gems("g-2", "gems-100", 10));
    server.connect({ account: BUYER });
    const first = await drawing(0, () => server.pullMount());
    expect(first).toMatchObject({ mount: "pig", repeat: false, gems: 1000 - PULL_COST, star: null });
    expect((await server.getMounts()).owned).toEqual(["deer", "pig"]);
    const again = await drawing(0, () => server.pullMount());
    // No gems back: a star instead.
    expect([again.repeat, again.star, again.gems]).toEqual([true, 1, 1000 - 2 * PULL_COST]);
    expect((await server.getMounts()).stars).toEqual({ pig: 1 });
    for (let s = 2; s <= MAX_STARS; s++) expect((await drawing(0, () => server.pullMount())).star).toBe(s);
    const past = await drawing(0, () => server.pullMount());
    expect([past.star, past.gems]).toEqual([null, 1000 - (MAX_STARS + 2) * PULL_COST + DUPLICATE_REFUND]);
    expect((await server.getMounts()).stars).toEqual({ pig: MAX_STARS });
    expect((await server.getMounts()).owned).toEqual(["deer", "pig"]);
  });

  test("the picked mount's stars add to the fight, and the big moments are told to everyone", async (server) => {
    await makeCharacter(server, "test-a", "별기수");
    await enterAs(server, "test-a");
    await server.$onItemPurchased({ account: "test-a", purchaseId: "g-9", productId: "gems-1200", quantity: 1 });
    server.connect({ account: "test-a" });
    await drawing(0.999, () => server.pullMount());
    await server.selectMount("dragon");
    const told = await server.announcements(0);
    expect(told.map((a: any) => [a.kind, a.params.mount, a.params.name])).toEqual([["mount_legendary", "dragon", "별기수"]]);
    for (let s = 1; s <= MAX_STARS; s++) await drawing(0.999, () => server.pullMount());
    const hp = (await $room.getMyState()).maxHp;
    expect(hp).toBe(maxHpAt(1) + mountBonus("dragon", MAX_STARS).hp);
    expect(mountBonus("dragon", MAX_STARS).power).toBeCloseTo(mountBonus("dragon").power * 2);
    const all = await server.announcements(0);
    expect(all.map((a: any) => a.kind)).toEqual(["mount_legendary", "mount_star5"]);
    expect(await server.announcements(all[all.length - 1].at)).toEqual([]);
  });

  test("the full game comes with its own, and only an owned mount can be picked", async (server) => {
    await makeCharacter(server, "test-a", "기수");
    expect((await server.getMounts()).owned).toEqual([BASE_MOUNT]);
    expect(await errorOf(server.selectMount("dragon"))).toContain("no_mount");
    expect((await server.selectMount(BASE_MOUNT)).selected).toBe(BASE_MOUNT);
    await enterAs(server, "test-a");
    expect((await server.ride(true)).riding).toBe(BASE_MOUNT);
    expect((await $room.getMyState()).riding).toBe(BASE_MOUNT);
    expect((await server.ride(false)).riding).toBeNull();
  });

  test("the picked mount makes you stronger at once, ridden or not", async (server) => {
    await makeCharacter(server, "test-a", "기수");
    await enterAs(server, "test-a");
    expect((await $room.getMyState()).maxHp).toBe(maxHpAt(1) + mountBonus(BASE_MOUNT).hp);
    await server.$onItemPurchased({ account: "test-a", purchaseId: "g-3", productId: "gems-100", quantity: 1 });
    server.connect({ account: "test-a" });
    expect(await drawing(0.999, () => server.pullMount())).toMatchObject({ mount: "dragon", repeat: false });
    const before = (await server.getBag()).mount;
    expect(before).toBe(BASE_MOUNT);
    await server.selectMount("dragon");
    expect((await $room.getMyState()).maxHp).toBe(maxHpAt(1) + mountBonus("dragon").hp);
    expect((await server.getBag()).mount).toBe("dragon");
  });
});
