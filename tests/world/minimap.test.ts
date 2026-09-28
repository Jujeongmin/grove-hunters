import { describe, expect, it } from "vitest";
import { minimapFit, minimapHeading, minimapModel, minimapPick, minimapPoint } from "../../src/game/world/minimap";
import { stepPlayer } from "../../src/game/rules/movement";
import { NPCS, npcSpot } from "../../src/game/world/npcs";
import { ZONES, portalsOf, zoneLayout } from "../../src/game/world/zones";

describe("minimapModel", () => {
  it("paints the forest, the houses and the open ground of a zone", () => {
    const model = minimapModel("village");
    const layout = zoneLayout("village");
    expect([model.cols, model.rows]).toEqual([layout.cols, layout.rows]);
    expect([model.width, model.depth]).toEqual([layout.cols * layout.tileSize, layout.rows * layout.tileSize]);
    const seen = new Set(model.cells.flat());
    expect(seen).toEqual(new Set(["forest", "house", "ground"]));
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const want = !layout.solid[r][c] ? "ground" : layout.forest[r][c] ? "forest" : "house";
        expect(model.cells[r][c]).toBe(want);
      }
    }
  });

  it("marks every portal with the zone it leads to", () => {
    for (const zone of ["village", "forest1", "forest2", "boss"] as const) {
      const portals = portalsOf(zone);
      const marks = minimapModel(zone).marks.filter((m) => m.kind === "portal");
      expect(marks).toHaveLength(portals.length);
      expect(marks.map((m) => m.to)).toEqual(portals.map((p) => p.to));
      expect(marks.map((m) => [m.x, m.z])).toEqual(portals.map((p) => [p.x, p.z]));
    }
  });

  it("marks the villagers, and only in the village", () => {
    const village = minimapModel("village").marks.filter((m) => m.kind === "npc");
    expect(village.map((m) => m.npc)).toEqual(NPCS.map((n) => n.id));
    expect(village.map((m) => [m.x, m.z])).toEqual(NPCS.map((n) => [npcSpot(n.id).x, npcSpot(n.id).z]));
    expect(minimapModel("forest1").marks.some((m) => m.kind === "npc")).toBe(false);
  });

  it("gives the same model back for the same zone", () => {
    expect(minimapModel("forest2")).toBe(minimapModel("forest2"));
  });
});

describe("minimapFit", () => {
  it("fills the box along the zone's longer side and centres the rest", () => {
    const model = minimapModel("forest1");
    const fit = minimapFit(model, 200, 200);
    // The fields are wider than they are deep, so the width is what fills the box.
    expect(fit.width).toBe(200);
    expect(fit.scale).toBeCloseTo(200 / model.width);
    expect(fit.height).toBeCloseTo(model.depth * fit.scale);
    expect(fit.left).toBe(0);
    expect(fit.top).toBeCloseTo((200 - fit.height) / 2);
  });

  it("keeps the zone's shape in a box of any shape", () => {
    const model = minimapModel("boss");
    const fit = minimapFit(model, 300, 120);
    expect(fit.height).toBe(120);
    expect(fit.width / fit.height).toBeCloseTo(model.width / model.depth);
    expect(fit.top).toBe(0);
  });
});

describe("minimapPoint", () => {
  it("puts north up and the zone's corners on the drawn map's corners", () => {
    const model = minimapModel("forest1");
    const fit = minimapFit(model, 160, 160);
    expect(minimapPoint(fit, { x: 0, z: 0 })).toEqual({ x: fit.left, y: fit.top });
    const far = minimapPoint(fit, { x: model.width, z: model.depth });
    expect(far.x).toBeCloseTo(fit.left + fit.width);
    expect(far.y).toBeCloseTo(fit.top + fit.height);
    // Walking north (smaller z) moves up the map.
    expect(minimapPoint(fit, { x: 50, z: 10 }).y).toBeLessThan(minimapPoint(fit, { x: 50, z: 20 }).y);
  });
});

describe("minimapHeading", () => {
  const open = () => false;

  it("points the way walking forward takes you", () => {
    for (const yaw of [0, 0.7, Math.PI / 2, 2.4, Math.PI, -1.1]) {
      const from = { x: 100, z: 100, yaw };
      const to = stepPlayer(from, { forward: 1, strafe: 0 }, 0.5, open);
      const walked = Math.hypot(to.x - from.x, to.z - from.z);
      const heading = minimapHeading(yaw);
      expect(heading.x).toBeCloseTo((to.x - from.x) / walked);
      expect(heading.y).toBeCloseTo((to.z - from.z) / walked);
    }
  });

  it("points up the map when you look north", () => {
    expect(minimapHeading(0)).toEqual({ x: -0, y: -1 });
  });
});

describe("minimapPick", () => {
  const model = minimapModel("village");
  const fit = minimapFit(model, 700, 500);

  it("turns a tap into the place under it", () => {
    const spot = { x: 60, z: 40 };
    const hit = minimapPick(model, fit, minimapPoint(fit, spot), 10);
    expect(hit!.x).toBeCloseTo(spot.x);
    expect(hit!.z).toBeCloseTo(spot.z);
    expect(hit!.npc).toBeNull();
  });

  it("grabs a villager's mark from a few pixels away", () => {
    const elder = model.marks.find((m) => m.npc === "elder")!;
    const at = minimapPoint(fit, elder);
    const hit = minimapPick(model, fit, { x: at.x + 6, y: at.y - 6 }, 16);
    expect(hit).toMatchObject({ npc: "elder", x: elder.x, z: elder.z, open: true });
    // Further off, the tap is just the ground (or whatever stands there).
    expect(minimapPick(model, fit, { x: at.x + 40, y: at.y }, 16)!.npc).toBeNull();
  });

  it("says when a place cannot be walked on", () => {
    const layout = zoneLayout("village");
    const t = layout.tileSize;
    let forest: { x: number; z: number } | null = null;
    for (let r = 0; r < layout.rows && !forest; r++) {
      for (let c = 0; c < layout.cols && !forest; c++) if (layout.forest[r][c]) forest = { x: (c + 0.5) * t, z: (r + 0.5) * t };
    }
    expect(minimapPick(model, fit, minimapPoint(fit, forest!), 10)!.open).toBe(false);
    expect(minimapPick(model, fit, minimapPoint(fit, layout.playerSpawn), 10)!.open).toBe(true);
  });

  it("ignores a tap off the map", () => {
    // The zone does not fill the box on every side, so "off the map" is the drawn map's edge.
    expect(minimapPick(model, fit, { x: fit.left - 2, y: fit.top + 20 }, 10)).toBeNull();
    expect(minimapPick(model, fit, { x: fit.left + 20, y: fit.top + fit.height + 2 }, 10)).toBeNull();
    expect(minimapPick(model, fit, { x: fit.left + 1, y: fit.top + 1 }, 10)).not.toBeNull();
  });
});
