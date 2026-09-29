import { BASE_MOUNT, DUPLICATE_REFUND, PULL_COST, mountBonus } from "../../src/game/account/mounts";
import { maxHpAt } from "../../src/game/world/monsters";
import { enterAs, errorOf, makeCharacter } from "./helpers";

const BUYER = "0x2222222222222222222222222222222222222222";
const gems = (id: string, productId = "gems-100", quantity = 1) => ({ account: BUYER, purchaseId: id, productId, quantity });

// Draws with Math.random held at `value`.
async function drawing<T>(value: number, run: () => Promise<T>): Promise<T> {
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
  test("costs gems, gives a mount to keep, and a repeat comes back as gems", async (server) => {
    server.connect({ account: BUYER });
    expect(await errorOf(server.pullMount())).toContain("not_enough_gems");
    await server.$onItemPurchased(gems("g-2", "gems-100", 3));
    server.connect({ account: BUYER });
    const first = await drawing(0, () => server.pullMount());
    expect(first).toMatchObject({ mount: "pig", repeat: false, gems: 300 - PULL_COST });
    expect((await server.getMounts()).owned).toEqual(["pig"]);
    const again = await drawing(0, () => server.pullMount());
    expect(again).toMatchObject({ mount: "pig", repeat: true, gems: 300 - 2 * PULL_COST + DUPLICATE_REFUND });
    expect((await server.getMounts()).owned).toEqual(["pig"]);
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
