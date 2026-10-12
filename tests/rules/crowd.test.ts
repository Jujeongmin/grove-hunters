import { describe, expect, it } from "vitest";
import { crowdBlocks, stepPastCrowd } from "../../src/game/rules/crowd";

describe("crowdBlocks", () => {
  const other = [{ x: 0, z: 0, r: 1 }];

  it("stops a step into another body", () => {
    expect(crowdBlocks(other, { x: 2, z: 0 }, 0.9, 0)).toBe(true);
    expect(crowdBlocks(other, { x: 2, z: 0 }, 1.2, 0)).toBe(false);
  });

  it("lets two bodies that already overlap move apart, but not closer", () => {
    expect(crowdBlocks(other, { x: 0.5, z: 0 }, 0.6, 0)).toBe(false);
    expect(crowdBlocks(other, { x: 0.5, z: 0 }, 0.4, 0)).toBe(true);
  });
});

describe("stepPastCrowd", () => {
  const open = () => false;

  it("gets through the gap between two monsters standing side by side", () => {
    // Two monsters 1.2 m apart across the way (-z), each keeping 0.85 m: no way between them.
    const bodies = [{ x: -0.6, z: 0, r: 0.85 }, { x: 0.6, z: 0, r: 0.85 }];
    let pose = { x: 0, z: 1.2, yaw: 0 };
    for (let i = 0; i < 30; i++) {
      const from = pose;
      pose = stepPastCrowd(pose, 0, 0.1, (x, z) => crowdBlocks(bodies, from, x, z), open, 4);
    }
    expect(pose.z).toBeLessThan(-1.5);
  });

  it("still goes round a lone monster instead of through it", () => {
    const bodies = [{ x: 0, z: 0, r: 0.85 }];
    let pose = { x: 0, z: 1.2, yaw: 0 };
    for (let i = 0; i < 40; i++) {
      const from = pose;
      pose = stepPastCrowd(pose, 0, 0.1, (x, z) => crowdBlocks(bodies, from, x, z), open, 4);
      expect(Math.hypot(pose.x, pose.z)).toBeGreaterThanOrEqual(0.85 - 1e-6);
    }
    expect(pose.z).toBeLessThan(-1);
  });

  it("never steps into the forest, crowd or not", () => {
    const wall = (_x: number, z: number) => z < 0;
    const bodies = [{ x: -0.6, z: 0.8, r: 0.85 }, { x: 0.6, z: 0.8, r: 0.85 }];
    let pose = { x: 0, z: 2, yaw: 0 };
    for (let i = 0; i < 30; i++) {
      const from = pose;
      pose = stepPastCrowd(pose, 0, 0.1, (x, z) => wall(x, z) || crowdBlocks(bodies, from, x, z), wall, 4);
    }
    expect(pose.z).toBeGreaterThanOrEqual(0.35);
  });

  it("lets a trip sent elsewhere pass through monsters but not fixed walls", () => {
    const bodies = [{ x: 0, z: 0, r: 0.85 }];
    let pose = { x: 0, z: 1.2, yaw: 0 };
    for (let i = 0; i < 12; i++) {
      const from = pose;
      pose = stepPastCrowd(
        pose, 0, 0.1, (x, z) => crowdBlocks(bodies, from, x, z), open, 4, true,
      );
    }
    expect(pose.z).toBeLessThan(-3);

    const wall = (_x: number, z: number) => z < 0;
    pose = { x: 0, z: 1.2, yaw: 0 };
    for (let i = 0; i < 12; i++) pose = stepPastCrowd(pose, 0, 0.1, wall, wall, 4, true);
    expect(pose.z).toBeGreaterThanOrEqual(0.35);
  });
});
