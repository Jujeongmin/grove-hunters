import { describe, expect, it } from "vitest";
import { uiScaleFor } from "../../src/ui/useUiScale";

describe("the overlay's scale", () => {
  it("is not shrunk on a phone's stage: the text stays readable", () => {
    expect(uiScaleFor(667)).toBeCloseTo(667 / 800);
    expect(uiScaleFor(720)).toBeCloseTo(0.9);
  });

  it("is shrunk by 15% on a big one, and never grows past its cap", () => {
    expect(uiScaleFor(960)).toBeCloseTo(1.2 * 0.85);
    expect(uiScaleFor(1920)).toBeCloseTo(1.2 * 0.85);
  });

  it("shrinks a little at a time in between, and always leaves room for the 800-wide layout", () => {
    expect(uiScaleFor(800)).toBeLessThan(1);
    expect(uiScaleFor(800)).toBeGreaterThan(0.85);
    for (let w = 600; w <= 1400; w += 10) expect(w / uiScaleFor(w)).toBeGreaterThanOrEqual(800 - 1e-9);
  });
});
