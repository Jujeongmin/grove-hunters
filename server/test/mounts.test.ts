import {
  BASE_MOUNT, DUPLICATE_REFUND, MAX_STARS, MYTHIC_PITY, PITY, PULL10, PULL10_COST, PULL_COST, mountBonus, ownedBonus,
} from "../../src/game/account/mounts";
import { maxHpAt } from "../../src/game/world/monsters";
import { enterAs, errorOf, makeCharacter, setWallet } from "./helpers";

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
    // Bought before, so these come without the first purchase's double.
    await $global.updateUserState(BUYER, { firstBought: ["gems-100"] });
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
    await drawing(0.995, () => server.pullMount());
    await server.selectMount("dragon");
    const told = await server.announcements(0);
    expect(told.map((a: any) => [a.kind, a.params.mount, a.params.name])).toEqual([["mount_legendary", "dragon", "별기수"]]);
    for (let s = 1; s <= MAX_STARS; s++) await drawing(0.995, () => server.pullMount());
    const hp = (await $room.getMyState()).maxHp;
    // The picked bonus and the owned one, both at ★5.
    expect(hp).toBe(maxHpAt(1) + mountBonus("dragon", MAX_STARS).hp + ownedBonus("dragon", MAX_STARS).hp);
    expect(mountBonus("dragon", MAX_STARS).power).toBeCloseTo(mountBonus("dragon").power * 2);
    const all = await server.announcements(0);
    expect(all.map((a: any) => a.kind)).toEqual(["mount_legendary", "mount_star5"]);
    expect(await server.announcements(all[all.length - 1].at)).toEqual([]);
  });

  test("everyone has the deer, and only an owned mount can be picked", async (server) => {
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
    expect(await drawing(0.995, () => server.pullMount())).toMatchObject({ mount: "dragon", repeat: false });
    const before = (await server.getBag()).mount;
    expect(before).toBe(BASE_MOUNT);
    await server.selectMount("dragon");
    expect((await $room.getMyState()).maxHp).toBe(maxHpAt(1) + mountBonus("dragon").hp + ownedBonus("dragon").hp);
    expect((await server.getBag()).mount).toBe("dragon");
  });
});

describe("ten at once, and the pity", () => {
  test("ten draws for PULL10_COST, the last rare when nine were common; the pity counts down", async (server) => {
    await setWallet(BUYER, { gems: 2000 });
    server.connect({ account: BUYER });
    const ten = await drawing(0, () => server.pullMount10());
    expect(ten.pulls.length).toBe(PULL10);
    expect(ten.pulls.map((p: any) => p.mount)).toEqual([...Array(9).fill("pig"), "panda"]);
    // The pig: new, five stars, then three back as gems.
    expect(ten.gems).toBe(2000 - PULL10_COST + 3 * DUPLICATE_REFUND);
    expect(ten.pity).toEqual({ legendary: PITY - PULL10, mythic: MYTHIC_PITY - PULL10 });
    await setWallet(BUYER, { gems: PULL10_COST - 1 });
    expect(await errorOf(drawing(0, () => server.pullMount10()))).toContain("not_enough_gems");
  });

  test("the hundredth draw without a legendary is one", async (server) => {
    await setWallet(BUYER, { gems: 500, pity: { legendary: PITY - 1, mythic: 0 } });
    server.connect({ account: BUYER });
    const pulled = await drawing(0, () => server.pullMount());
    expect(pulled.mount).toBe("elder_glub");
    expect(pulled.pity.legendary).toBe(PITY);
  });
});
