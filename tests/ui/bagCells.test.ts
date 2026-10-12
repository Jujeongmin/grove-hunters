import { describe, expect, it } from "vitest";
import { bagCells } from "../../src/ui/bagGrid";

describe("the bag's squares", () => {
  it("show a stack of more than 99 as full squares of 99 and the rest", () => {
    const cells = bagCells({ bag: { potion_small: 205 }, bagTrade: {}, pieces: [] });
    expect(cells.map((c) => (c.kind === "stack" ? c.n : 0))).toEqual([99, 99, 7]);
    expect(new Set(cells.map((c) => (c.kind === "stack" ? c.part : -1))).size).toBe(3);
  });
});
