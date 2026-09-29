import { describe, expect, it } from "vitest";
import { FLOOR_RATIO, FrameGovernor } from "../../src/game/render/frameGovernor";

// Runs frames `gap` ms apart for `ms`, from `start`; answers the last change and when it stopped.
function run(g: FrameGovernor, start: number, ms: number, gap: number): { at: number; changes: number[] } {
  const changes: number[] = [];
  let t = start;
  for (; t < start + ms; t += gap) {
    const r = g.frame(t);
    if (r !== null) changes.push(r);
  }
  return { at: t, changes };
}

describe("the frame governor", () => {
  it("leaves a game that keeps 60 alone", () => {
    const g = new FrameGovernor(1.5);
    expect(run(g, 0, 20_000, 16.7).changes).toEqual([]);
    expect(g.pixelRatio).toBe(1.5);
  });

  it("draws at fewer pixels while frames come late, down to its floor and no further", () => {
    const g = new FrameGovernor(1.5);
    const slow = run(g, 0, 20_000, 33);
    expect(slow.changes).toEqual([1.25, 1, FLOOR_RATIO]);
    expect(g.pixelRatio).toBe(FLOOR_RATIO);
  });

  it("sharpens again once frames have kept time a while, but not if that brings the lateness back", () => {
    const g = new FrameGovernor(1.5);
    let t = run(g, 0, 2000, 33).at;
    expect(g.pixelRatio).toBe(1.25);
    const calm = run(g, t, 12_000, 16.7);
    expect(calm.changes).toEqual([1.5]);
    t = calm.at;
    // Late again right after: down, and it stays down for a good while.
    t = run(g, t, 2000, 33).at;
    expect(g.pixelRatio).toBe(1.25);
    expect(run(g, t, 30_000, 16.7).changes).toEqual([]);
  });

  it("does not count a pause (another tab) as a slow frame", () => {
    const g = new FrameGovernor(1.5);
    let t = 0;
    for (let i = 0; i < 20; i++) {
      t = run(g, t, 500, 16.7).at + 5000;
    }
    expect(g.pixelRatio).toBe(1.5);
  });
});
