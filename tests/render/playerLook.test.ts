import { describe, expect, it } from "vitest";
import { costumeName } from "../../src/ui/names";
import { COSTUMES, PARTS, costumeForSeat } from "../../src/game/render/costumes";

describe("costume presets", () => {
  it("wraps the seat number around the clothes colours", () => {
    const n = PARTS.clothColor.options.length;
    expect(costumeForSeat(n)).toEqual(costumeForSeat(0));
    expect(costumeForSeat(-1)).toEqual(costumeForSeat(n - 1));
  });

  it("offers a few ready-made looks", () => {
    // The looks are their parts and their ids; the names they go by are the screen's (see names.ts).
    expect(COSTUMES.map((c) => c.id)).toEqual(["0000", "1413", "0626"]);
    expect(COSTUMES.map((c) => costumeName(c, COSTUMES))).toEqual(["기본", "가벼운 차림", "그림자"]);
  });
});
