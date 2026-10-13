import { describe, expect, it } from "vitest";
import { bagCells, bulkOf, cellKey } from "../../src/ui/bagGrid";

describe("the bag's squares", () => {
  it("show a stack of more than 99 as full squares of 99 and the rest", () => {
    const cells = bagCells({ bag: { potion_small: 205 }, bagTrade: {}, pieces: [] });
    expect(cells.map((c) => (c.kind === "stack" ? c.n : 0))).toEqual([99, 99, 7]);
    expect(new Set(cells.map((c) => (c.kind === "stack" ? c.part : -1))).size).toBe(3);
  });
});

describe("throwing many away", () => {
  it("gathers the squares picked into pieces by uid and whole counts per stack", () => {
    const piece = { uid: "p1", id: "weapon_1" as const, plus: 0, trade: false };
    const cells = bagCells({ bag: { potion_small: 150 }, bagTrade: { silk: 4 }, pieces: [piece] });
    const keys = new Set(cells.map(cellKey));
    expect(bulkOf(cells, keys)).toEqual({ pieces: ["p1"], stacks: [{ id: "potion_small", n: 150, trade: false }, { id: "silk", n: 4, trade: true }] });
    // Only the full square of potions: 99 of them.
    const first = cells.find((c) => c.kind === "stack" && c.id === "potion_small" && c.part === 0)!;
    expect(bulkOf(cells, new Set([cellKey(first)]))).toEqual({ pieces: [], stacks: [{ id: "potion_small", n: 99, trade: false }] });
  });
});
