import * as THREE from "three";
import type { ModelSource, StaticPiece } from "./staticBatch";
import { crossedCards, spriteMaterial, type TreeSprites } from "./treeSprites";

// Many copies of a few models that only need to be drawn in full near the camera: trees, which turn
// into their picture (see treeSprites.ts) further off, and ground cover, which is left out further
// off (the fog and the grass colour hide it). One instanced mesh per model part plus one for the
// pictures, refilled whenever the camera has moved a few metres or turned a little. Only what lies in
// the way the camera looks is filled in (an instanced mesh is drawn whole or not at all, so the
// trees behind you would otherwise all be drawn); what is very close is always in.

// Within this distance a piece is its model; beyond it, its picture (or nothing). Set by the graphics
// quality (see QUALITY in settings.ts).
export const LOD_NEAR = 38;
// Refill after the camera moves this far.
const REFILL_MOVE = 3;
// Refill after the camera turns this far (radians), but no oftener than this while it keeps turning.
const REFILL_TURN = 0.2;
const REFILL_MIN_MS = 90;
// Beyond the edge of the view, this much more is filled in (radians), so a turn between refills never
// shows a gap; and this close (metres) everything is, whichever way it lies.
const VIEW_MARGIN = 0.45;
const ALWAYS_WITHIN = 9;

// Which way the camera looks (its yaw, three.js convention: 0 looks down -z) and half its view across.
export interface LodView { yaw: number; halfWidth: number }

interface Kind {
  pieces: StaticPiece[];
  where: THREE.Vector3[];
  // Each part of the model, with where it sits in the model.
  parts: { mesh: THREE.InstancedMesh; relative: THREE.Matrix4 }[];
  // The picture of each piece, as a crossed-cards matrix; null where far pieces are left out.
  far: { mesh: THREE.InstancedMesh; matrices: THREE.Matrix4[] } | null;
}

export class LodBatch {
  readonly object = new THREE.Group();
  private readonly kinds: Kind[] = [];
  private last: { x: number; z: number; at: number; yaw: number | null } | null = null;
  private near = LOD_NEAR;

  // A new distance refills at the next update.
  setNear(near: number): void {
    if (near === this.near) return;
    this.near = near;
    this.last = null;
  }

  // `sprites`: the pictures of the models that have one; any other model is left out when far.
  constructor(library: ModelSource, pieces: StaticPiece[], sprites: TreeSprites) {
    const byModel = new Map<string, StaticPiece[]>();
    for (const p of pieces) {
      const list = byModel.get(p.model) ?? [];
      list.push(p);
      byModel.set(p.model, list);
    }
    const cards = crossedCards();
    const at = new THREE.Vector3();
    const size = new THREE.Vector3();
    for (const [model, list] of byModel) {
      const template = library.get(model).scene;
      template.updateMatrixWorld(true);
      const rootInverse = template.matrixWorld.clone().invert();
      const parts: Kind["parts"] = [];
      template.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
        const instanced = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
        instanced.name = `${model}:${mesh.name}`;
        instanced.count = 0;
        // Filled only with what lies in view (see update): no bounds to test, and none to work out
        // over every instance at each refill.
        instanced.frustumCulled = false;
        parts.push({ mesh: instanced, relative: rootInverse.clone().multiply(mesh.matrixWorld) });
        this.object.add(instanced);
      });
      const sprite = sprites.get(model);
      let far: Kind["far"] = null;
      if (sprite) {
        new THREE.Box3().setFromObject(template).getSize(size);
        const scale = new THREE.Vector3();
        const turn = new THREE.Quaternion();
        const matrices = list.map((p) => {
          p.matrix.decompose(at, turn, scale);
          const height = size.y * scale.y;
          const width = height * sprite.aspect;
          return new THREE.Matrix4().compose(at.clone(), turn, new THREE.Vector3(width, height, width));
        });
        const mesh = new THREE.InstancedMesh(cards, spriteMaterial(sprite), list.length);
        mesh.name = `${model}:picture`;
        mesh.count = 0;
        mesh.frustumCulled = false;
        this.object.add(mesh);
        far = { mesh, matrices };
      }
      this.kinds.push({ pieces: list, where: list.map((p) => new THREE.Vector3().setFromMatrixPosition(p.matrix)), parts, far });
    }
  }

  // Sorts every piece into near (its model) and far (its picture, or nothing) round (x, z), where the
  // camera stands; with a view, only what lies within it.
  update(x: number, z: number, force = false, view: LodView | null = null): void {
    const now = performance.now();
    const last = this.last;
    const turned = view !== null && last !== null && (last.yaw === null || Math.abs(angleBetween(view.yaw, last.yaw)) > REFILL_TURN);
    if (!force && last) {
      const moved = Math.hypot(x - last.x, z - last.z) >= REFILL_MOVE;
      if (!moved && !turned) return;
      if (now - last.at < REFILL_MIN_MS) return;
    }
    this.last = { x, z, at: now, yaw: view?.yaw ?? null };
    // The direction the camera looks, and how far round from it a piece may lie and still be filled in.
    const ahead = view ? { x: -Math.sin(view.yaw), z: -Math.cos(view.yaw) } : null;
    const reach = view ? Math.cos(Math.min(Math.PI, view.halfWidth + VIEW_MARGIN)) : -1;
    const inView = (w: THREE.Vector3, d: number): boolean => {
      if (!ahead || d <= ALWAYS_WITHIN) return true;
      return ((w.x - x) * ahead.x + (w.z - z) * ahead.z) / d >= reach;
    };
    const m = new THREE.Matrix4();
    for (const kind of this.kinds) {
      let near = 0;
      let far = 0;
      kind.pieces.forEach((piece, i) => {
        const w = kind.where[i];
        const d = Math.hypot(w.x - x, w.z - z);
        if (!inView(w, d)) return;
        if (d <= this.near) {
          for (const part of kind.parts) part.mesh.setMatrixAt(near, m.multiplyMatrices(piece.matrix, part.relative));
          near++;
        } else if (kind.far) {
          kind.far.mesh.setMatrixAt(far++, kind.far.matrices[i]);
        }
      });
      for (const part of kind.parts) {
        part.mesh.count = near;
        part.mesh.instanceMatrix.needsUpdate = true;
      }
      if (kind.far) {
        kind.far.mesh.count = far;
        kind.far.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
}

// The shortest turn from b to a (radians, -PI to PI).
function angleBetween(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
