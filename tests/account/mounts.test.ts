import { describe, expect, it } from "vitest";
import {
  BASE_MOUNT, DUPLICATE_REFUND, GACHA_ODDS, GEM_PRODUCTS, MOUNTS, MOUNT_IDS, PULL_COST, gemsFor, ownedMounts,
  readMountId, rollMount, tierOf,
} from "../../src/game/account/mounts";

describe("mounts", () => {
  it("run faster the rarer they are, the full game's own at 1.5", () => {
    expect(MOUNTS[BASE_MOUNT].speed).toBe(1.5);
    const speed = { common: 1.5, rare: 1.6, epic: 1.7, legendary: 1.8 } as const;
    for (const id of MOUNT_IDS) if (id !== BASE_MOUNT) expect(MOUNTS[id].speed).toBe(speed[tierOf(id)!]);
  });

  it("the draw's odds add up to all of it, and are what the screen shows", () => {
    expect(GACHA_ODDS.reduce((a, o) => a + o.chance, 0)).toBeCloseTo(1);
    expect(GACHA_ODDS.map((o) => o.tier)).toEqual(["common", "rare", "epic", "legendary"]);
  });

  it("a draw picks a tier by its odds, then one of that tier's mounts evenly; never the full game's own", () => {
    expect(tierOf(rollMount(() => 0))).toBe("common");
    expect(tierOf(rollMount(() => 0.599))).toBe("common");
    expect(tierOf(rollMount(() => 0.6))).toBe("rare");
    expect(tierOf(rollMount(() => 0.95))).toBe("epic");
    expect(rollMount(() => 0.9999)).toBe("dragon");
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(rollMount(Math.random));
    expect(seen.has(BASE_MOUNT)).toBe(false);
  });

  it("a player owns what they drew, and the full game's own once they own the full game", () => {
    expect(ownedMounts(["pig", "nope", "pig"], false)).toEqual(["pig"]);
    expect(ownedMounts(["pig"], true)).toEqual([BASE_MOUNT, "pig"]);
    expect(ownedMounts(null, false)).toEqual([]);
    expect(readMountId("dragon")).toBe("dragon");
    expect(readMountId("horse")).toBeNull();
  });

  it("gems come only from the shop's gem products, and a draw costs more than a repeat gives back", () => {
    expect(gemsFor("gems-100", 2)).toBe(200);
    expect(gemsFor("full-game", 1)).toBeNull();
    expect(Object.keys(GEM_PRODUCTS).length).toBeGreaterThan(0);
    expect(DUPLICATE_REFUND).toBeLessThan(PULL_COST);
  });
});
