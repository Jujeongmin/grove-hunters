import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { MONSTER_SKINS } from "../../src/game/render/monsterLooks";

// Where a model's head ends up, in the model's own space at rest (its bones' transforms composed).
function headOf(model: string): THREE.Vector3 | null {
  const glb = readFileSync(`public/assets/models/${model}.glb`);
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString()) as {
    scene?: number; scenes: { nodes: number[] }[];
    nodes: { name?: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[] }[];
  };
  const found: Record<string, THREE.Vector3> = {};
  const walk = (i: number, parent: THREE.Matrix4) => {
    const n = json.nodes[i];
    const local = n.matrix ? new THREE.Matrix4().fromArray(n.matrix) : new THREE.Matrix4().compose(
      new THREE.Vector3(...(n.translation ?? [0, 0, 0])), new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])),
      new THREE.Vector3(...(n.scale ?? [1, 1, 1])),
    );
    const world = parent.clone().multiply(local);
    if (n.name) found[n.name] = new THREE.Vector3().setFromMatrixPosition(world);
    for (const c of n.children ?? []) walk(c, world);
  };
  for (const i of json.scenes[json.scene ?? 0].nodes) walk(i, new THREE.Matrix4());
  return found.Head_end ?? found.Head ?? null;
}

describe("monster models", () => {
  it("face the way they go once turned: their head points along +z, not off to a side", () => {
    for (const [type, skin] of Object.entries(MONSTER_SKINS)) {
      if (!skin.model.startsWith("mon_")) continue;
      const head = headOf(skin.model);
      if (!head || Math.hypot(head.x, head.z) < 0.3) continue;
      head.applyAxisAngle(new THREE.Vector3(0, 1, 0), skin.look.turn ?? 0);
      expect(head.z, `${type} (${skin.model}): head at ${head.x.toFixed(2)}, ${head.z.toFixed(2)}`).toBeGreaterThan(Math.abs(head.x));
    }
  });
});
