import { describe, expect, it } from "vitest";
import { solidAt } from "../../src/game/rules/levelLayout";
import { gridRoute, lineClear, walkRoute } from "../../src/game/rules/pathing";
import { zoneLayout } from "../../src/game/world/zones";

describe("gridRoute", () => {
  it("finds a way over open ground from the spawn to every monster, ending at it", () => {
    const layout = zoneLayout("forest1");
    for (const spot of layout.zombieSpawns) {
      const route = gridRoute(layout, layout.playerSpawn, spot);
      expect(route).not.toBeNull();
      for (const p of route!) expect(solidAt(layout, p.x, p.z)).toBe(false);
      expect(route!.at(-1)).toEqual(spot);
    }
  });

  it("answers null from or to the forest", () => {
    const layout = zoneLayout("forest1");
    expect(gridRoute(layout, { x: 1, z: 1 }, layout.playerSpawn)).toBeNull();
  });
});

describe("lineClear", () => {
  it("sees the forest standing between two spots, and open ground where there is none", () => {
    const layout = zoneLayout("forest1");
    const t = layout.tileSize;
    // Find an open cell with forest two cells east and open ground beyond it.
    let blocked: { from: { x: number; z: number }; to: { x: number; z: number } } | null = null;
    for (let r = 1; r < layout.rows - 1 && !blocked; r++) {
      for (let c = 1; c < layout.cols - 3 && !blocked; c++) {
        if (!layout.solid[r][c] && layout.solid[r][c + 1] && !layout.solid[r][c + 2]) {
          blocked = { from: { x: (c + 0.5) * t, z: (r + 0.5) * t }, to: { x: (c + 2.5) * t, z: (r + 0.5) * t } };
        }
      }
    }
    expect(blocked).not.toBeNull();
    expect(lineClear(layout, blocked!.from, blocked!.to)).toBe(false);
    const spawn = layout.playerSpawn;
    expect(lineClear(layout, spawn, { x: spawn.x + 1, z: spawn.z })).toBe(true);
  });
});

describe("walkRoute", () => {
  const zones = ["forest1", "forest2", "forest3", "snow1", "snow2", "snow3", "village", "outpost", "boss", "snowboss"] as const;

  it("goes round every log pile, crate and boulder: each leg of the way is clear, from the spawn to every monster", () => {
    for (const zone of zones) {
      const layout = zoneLayout(zone);
      for (const spot of layout.zombieSpawns) {
        const route = walkRoute(layout, layout.playerSpawn, spot, 0.45);
        expect(route, `${zone} to ${spot.x},${spot.z}`).not.toBeNull();
        expect(route!.at(-1)).toEqual(spot);
        // Every leg but the last (which ends on the monster, wherever it stands) is walkable as it is.
        let at = layout.playerSpawn;
        for (const p of route!.slice(0, -1)) {
          expect(lineClear(layout, at, p, 0.4), `${zone} leg to ${p.x},${p.z}`).toBe(true);
          at = p;
        }
      }
    }
  });

  it("sees a platform standing in the way that the forest grid alone does not", () => {
    for (const zone of zones) {
      const layout = zoneLayout(zone);
      const p = layout.platforms[0];
      if (!p) continue;
      const from = { x: p.x - p.w / 2 - 1.5, z: p.z };
      const to = { x: p.x + p.w / 2 + 1.5, z: p.z };
      if (solidAt(layout, from.x, from.z) || solidAt(layout, to.x, to.z)) continue;
      expect(lineClear(layout, from, to)).toBe(false);
      return;
    }
    throw new Error("no zone with a platform in the open");
  });

  it("works a long way out quickly", () => {
    const layout = zoneLayout("forest3");
    const far = layout.zombieSpawns.reduce((a, b) =>
      Math.hypot(b.x - layout.playerSpawn.x, b.z - layout.playerSpawn.z) > Math.hypot(a.x - layout.playerSpawn.x, a.z - layout.playerSpawn.z) ? b : a);
    walkRoute(layout, layout.playerSpawn, far, 0.45);
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) walkRoute(layout, layout.playerSpawn, far, 0.45);
    expect((performance.now() - t0) / 5).toBeLessThan(40);
  });
});
