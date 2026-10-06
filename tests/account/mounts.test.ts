import { describe, expect, it } from "vitest";
import {
  BASE_MOUNT, DUPLICATE_REFUND, GACHA_ODDS, GEM_PRODUCTS, MOUNTS, MOUNT_IDS, PULL_COST, gemsFor, ownedMounts,
  MAX_STARS, NO_HERD, STAR_BONUS, herdBonus, mountBonus, ownedBonus, readMountId, readStars, rollMount, tierOf,
} from "../../src/game/account/mounts";
import { combatPowerAt } from "../../src/game/combat/power";

describe("mounts", () => {
  it("run faster the rarer they are, the deer everyone has at 1.2", () => {
    expect(MOUNTS[BASE_MOUNT].speed).toBe(1.2);
    const speed = { common: 1.3, rare: 1.4, epic: 1.5, legendary: 1.6, mythic: 1.75 } as const;
    for (const id of MOUNT_IDS) if (id !== BASE_MOUNT) expect(MOUNTS[id].speed).toBe(speed[tierOf(id)!]);
  });

  it("the picked mount adds to 전투력, more the rarer it is; none adds nothing", () => {
    expect(mountBonus(null)).toEqual({ power: 0, hp: 0 });
    const order = [BASE_MOUNT, "pig", "panda", "yeti", "dragon", "golden_dragon"] as const;
    const power = order.map((id) => combatPowerAt(10, "warrior", { weapon: null, armor: null }, null, id));
    expect(power[0]).toBeGreaterThan(combatPowerAt(10, "warrior", { weapon: null, armor: null }, null, null));
    for (let i = 1; i < power.length; i++) expect(power[i]).toBeGreaterThan(power[i - 1]);
  });

  it("the draw's odds add up to all of it, and are what the screen shows", () => {
    expect(GACHA_ODDS.reduce((a, o) => a + o.chance, 0)).toBeCloseTo(1);
    expect(GACHA_ODDS.map((o) => o.tier)).toEqual(["common", "rare", "epic", "legendary", "mythic"]);
  });

  it("a draw picks a tier by its odds, then one of that tier's mounts evenly; never the deer everyone has", () => {
    expect(tierOf(rollMount(() => 0))).toBe("common");
    expect(tierOf(rollMount(() => 0.599))).toBe("common");
    expect(tierOf(rollMount(() => 0.6))).toBe("rare");
    expect(tierOf(rollMount(() => 0.95))).toBe("epic");
    expect(tierOf(rollMount(() => 0.995))).toBe("legendary");
    expect(rollMount(() => 0.9999)).toBe("void_emperor");
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(rollMount(Math.random));
    expect(seen.has(BASE_MOUNT)).toBe(false);
  });

  it("a player owns everyone's own mount and what they drew", () => {
    expect(ownedMounts(["pig", "nope", "pig"])).toEqual([BASE_MOUNT, "pig"]);
    expect(ownedMounts(null)).toEqual([BASE_MOUNT]);
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

describe("breaking through", () => {
  it("each star adds a fifth of the tier's bonus; ★5 doubles it", () => {
    expect(mountBonus("dragon", 0)).toEqual(mountBonus("dragon"));
    expect(mountBonus("dragon", MAX_STARS).power).toBeCloseTo(mountBonus("dragon").power * 2);
    expect(mountBonus("dragon", MAX_STARS).hp).toBe(mountBonus("dragon").hp * 2);
    expect(mountBonus("pig", 1).hp).toBe(Math.round(mountBonus("pig").hp * (1 + STAR_BONUS)));
    // No more than MAX_STARS counts.
    expect(mountBonus("dragon", 9)).toEqual(mountBonus("dragon", MAX_STARS));
    expect(mountBonus(null, 3)).toEqual({ power: 0, hp: 0 });
  });

  it("reads saved stars, only whole ones in range for known mounts", () => {
    expect(readStars({ dragon: 3, pig: 9, moon: 2, cat: 0, dog: 1.5 })).toEqual({ dragon: 3, pig: MAX_STARS });
    expect(readStars(null)).toEqual({});
  });
});

describe("owning mounts (보유 효과)", () => {
  it("adds each owned mount's tier share, the deer nothing, stars growing it as they do the picked bonus", () => {
    expect(ownedBonus(BASE_MOUNT)).toEqual(NO_HERD);
    expect(ownedBonus("pig")).toEqual({ power: 0.05, hp: 15 });
    expect(ownedBonus("dragon")).toEqual({ power: 0.28, hp: 84 });
    expect(ownedBonus("pig", MAX_STARS)).toEqual({ power: 0.1, hp: 30 });
    expect(herdBonus([BASE_MOUNT, "pig", "chicken", "pig"], { chicken: 1 })).toEqual({ power: 0.11, hp: 33 });
  });

  it("makes you stronger whichever mount is picked", () => {
    const gear = { weapon: null, armor: null };
    const without = combatPowerAt(20, "warrior", gear, null, "pig", 0, 0);
    const owning = combatPowerAt(20, "warrior", gear, null, "pig", 0, 0, herdBonus(["pig", "dragon"], {}));
    expect(owning).toBeGreaterThan(without);
  });
});
