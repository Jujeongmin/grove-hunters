import { describe, expect, it } from "vitest";
import {
  EDGE_GRACE, POOL_TICK_MS, facingOf, inShape, readTelegraphs, resolveTelegraphs, yawToward, type Telegraph,
} from "../../src/game/world/telegraphs";

describe("telegraphs", () => {
  it("faces the way the rest of the game does", () => {
    const f = facingOf(0);
    expect(f.x).toBeCloseTo(0);
    expect(f.z).toBeCloseTo(-1);
    const yaw = yawToward(0, 0, 5, 0);
    expect(facingOf(yaw).x).toBeCloseTo(1);
  });

  it("circles let off the edge", () => {
    const c = { kind: "circle" as const, x: 0, z: 0, r: 3 };
    expect(inShape(c, 0, 0)).toBe(true);
    expect(inShape(c, 3 - EDGE_GRACE - 0.01, 0)).toBe(true);
    expect(inShape(c, 3 - EDGE_GRACE + 0.01, 0)).toBe(false);
  });

  it("a doughnut is safe in the middle", () => {
    const ring = { kind: "ring" as const, x: 0, z: 0, inner: 3, outer: 10 };
    expect(inShape(ring, 1, 0)).toBe(false);
    expect(inShape(ring, 5, 0)).toBe(true);
    expect(inShape(ring, 10, 0)).toBe(false);
  });

  it("a fan covers what lies before it", () => {
    // Facing +x, 90° wide, 10 out.
    const cone = { kind: "cone" as const, x: 0, z: 0, yaw: yawToward(0, 0, 1, 0), r: 10, arc: Math.PI / 2 };
    expect(inShape(cone, 5, 0)).toBe(true);
    expect(inShape(cone, 5, 4)).toBe(true);
    expect(inShape(cone, 5, 6)).toBe(false);
    expect(inShape(cone, -5, 0)).toBe(false);
    expect(inShape(cone, 11, 0)).toBe(false);
  });

  it("a lane runs from its start", () => {
    const line = { kind: "line" as const, x: 0, z: 0, yaw: yawToward(0, 0, 0, 1), length: 14, width: 3 };
    expect(inShape(line, 0, 7)).toBe(true);
    expect(inShape(line, 1.1, 7)).toBe(true);
    expect(inShape(line, 1.3, 7)).toBe(false);
    expect(inShape(line, 0, -2)).toBe(false);
    expect(inShape(line, 0, 14)).toBe(false);
  });

  it("lands when its time comes, on whoever is inside", () => {
    const t: Telegraph = { id: "a", shape: { kind: "circle", x: 0, z: 0, r: 3 }, startAt: 0, hitAt: 1000, share: 0.5 };
    const fixed: Telegraph = { id: "b", shape: { kind: "circle", x: 0, z: 0, r: 3 }, startAt: 0, hitAt: 1000, damage: 140 };
    const targets = [{ account: "in", x: 1, z: 0, maxHp: 200 }, { account: "out", x: 5, z: 0, maxHp: 200 }];
    const early = resolveTelegraphs([t], targets, 999);
    expect(early.hits).toEqual([]);
    expect(early.left).toEqual([t]);
    const landed = resolveTelegraphs([t, fixed], targets, 1000);
    expect(landed.hits).toEqual([{ account: "in", damage: 100 }, { account: "in", damage: 140 }]);
    expect(landed.left).toEqual([]);
  });

  it("a pool keeps hurting until it dries", () => {
    const pool: Telegraph = {
      id: "p", shape: { kind: "circle", x: 0, z: 0, r: 3 }, startAt: 0, hitAt: 1000, share: 0.3,
      pool: { until: 1000 + 3 * POOL_TICK_MS, tickShare: 0.1, nextAt: 1000 },
    };
    const in1 = [{ account: "in", x: 0, z: 0, maxHp: 100 }];
    const first = resolveTelegraphs([pool], in1, 1000);
    expect(first.hits).toEqual([{ account: "in", damage: 30 }]);
    expect(first.left[0].pool!.nextAt).toBe(2000);
    expect(resolveTelegraphs(first.left, in1, 1500).hits).toEqual([]);
    const tick = resolveTelegraphs(first.left, in1, 2000);
    expect(tick.hits).toEqual([{ account: "in", damage: 10 }]);
    expect(resolveTelegraphs(tick.left, in1, 4000).left).toEqual([]);
  });

  it("reads back only whole marks", () => {
    const good = { id: "a", shape: { kind: "line", x: 1, z: 2, yaw: 0, length: 5, width: 2 }, startAt: 0, hitAt: 5, share: 0.4 };
    expect(readTelegraphs([good, { id: "b", shape: { kind: "star", x: 0, z: 0 }, startAt: 0, hitAt: 1 }, null])).toEqual([good]);
    expect(readTelegraphs("nope")).toEqual([]);
  });
});
