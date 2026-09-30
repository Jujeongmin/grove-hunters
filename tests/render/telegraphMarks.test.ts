import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { TelegraphLayer } from "../../src/game/render/telegraphMarks";
import type { Telegraph } from "../../src/game/world/telegraphs";

function fillOf(layer: TelegraphLayer): THREE.Mesh {
  const group = layer.object.children[0] as THREE.Group;
  return group.children[1] as THREE.Mesh;
}

describe("telegraph marks", () => {
  const circle: Telegraph = { id: "c", shape: { kind: "circle", x: 0, z: 0, r: 3 }, startAt: 0, hitAt: 1000 };

  it("grow their fill by scaling it, not by building new geometry every frame", () => {
    const layer = new TelegraphLayer();
    layer.sync([circle], 0);
    const built = fillOf(layer).geometry;
    for (let t = 16; t < 1000; t += 16) layer.sync([circle], t);
    expect(fillOf(layer).geometry).toBe(built);
    expect(fillOf(layer).scale.x).toBeGreaterThan(0.9);
  });

  it("rebuild a ring only in coarse steps", () => {
    const ring: Telegraph = { id: "r", shape: { kind: "ring", x: 0, z: 0, inner: 2, outer: 6 }, startAt: 0, hitAt: 1000 };
    const layer = new TelegraphLayer();
    layer.sync([ring], 0);
    const seen = new Set<THREE.BufferGeometry>();
    for (let t = 16; t < 1000; t += 16) {
      layer.sync([ring], t);
      seen.add(fillOf(layer).geometry);
    }
    expect(seen.size).toBeLessThanOrEqual(10);
  });

  it("let go of their geometry and materials once gone", () => {
    const layer = new TelegraphLayer();
    layer.sync([circle], 0);
    const fill = fillOf(layer);
    let disposed = 0;
    (fill.material as THREE.Material).addEventListener("dispose", () => disposed++);
    fill.geometry.addEventListener("dispose", () => disposed++);
    layer.sync([], 100);
    expect(disposed).toBe(2);
    expect(layer.object.children).toHaveLength(0);
  });
});
