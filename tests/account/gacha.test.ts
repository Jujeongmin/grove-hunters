import { describe, expect, it } from "vitest";
import { MYTHIC_PITY, PITY, PULL10, mountsOfTier, readPity, rollMounts, tierOf, vipMounts } from "../../src/game/account/mounts";

// Rolls that always land on the commonest tier: only the guarantees lift a draw above it.
const unlucky = () => 0;

describe("the draw's guarantees", () => {
  it("a ten-draw of nine commons makes its last rare or better", () => {
    const { mounts } = rollMounts(PULL10, { legendary: 0, mythic: 0 }, unlucky);
    expect(mounts.slice(0, 9).every((m) => tierOf(m) === "common")).toBe(true);
    expect(tierOf(mounts[9])).toBe("rare");
    // One draw alone promises nothing.
    expect(tierOf(rollMounts(1, { legendary: 0, mythic: 0 }, unlucky).mounts[0])).toBe("common");
  });

  it("the PITY-th draw without a legendary is one, and the count starts over", () => {
    const { mounts, since } = rollMounts(2, { legendary: PITY - 1, mythic: 10 }, unlucky);
    expect(tierOf(mounts[0])).toBe("legendary");
    expect(tierOf(mounts[1])).toBe("common");
    expect(since).toEqual({ legendary: 1, mythic: 12 });
  });

  it("the MYTHIC_PITY-th draw without a mythic is one, and it counts as a legendary too", () => {
    const { mounts, since } = rollMounts(1, { legendary: 50, mythic: MYTHIC_PITY - 1 }, unlucky);
    expect(tierOf(mounts[0])).toBe("mythic");
    expect(since).toEqual({ legendary: 0, mythic: 0 });
  });

  it("reads the counts as saved, including the plain number from before mythics", () => {
    expect(readPity(undefined)).toEqual({ legendary: 0, mythic: 0 });
    expect(readPity(37)).toEqual({ legendary: 37, mythic: 0 });
    expect(readPity({ legendary: 400, mythic: 9999 })).toEqual({ legendary: PITY - 1, mythic: MYTHIC_PITY - 1 });
  });

  it("never draws VIP 10's own mythic; the rank gives it", () => {
    expect(mountsOfTier("mythic")).toEqual(["golden_dragon", "void_emperor"]);
    expect(vipMounts(9)).toEqual([]);
    expect(vipMounts(10)).toEqual(["celestial_dragon"]);
  });
});
