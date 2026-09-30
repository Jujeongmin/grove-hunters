import * as THREE from "three";
import type { Shape, Telegraph } from "../world/telegraphs";

// The marks of telegraphed attacks on the ground (see world/telegraphs.ts): a faint red area where a
// blow will land, filling up until it does, so whoever stands in it has time to step out. A pool left
// behind stays dark purple until it dries.
//
// The fill is built once and grown by scaling it (a circle from its middle, a fan from its mouth, a
// lane from its start), so a boss's patterns make no new geometry frame by frame on a phone. Only a
// ring, which closes in from its outer edge, is rebuilt, and then only in coarse steps.

const WARN = 0xff3a2a;
const POOL = 0x7a3ad0;
const Y = 0.06;
const SEGMENTS = 32;
// A ring's fill is rebuilt only when it has grown by this much.
const RING_STEP = 0.1;

// The area's flat geometry in the ground plane, with its origin where the shape starts (a fan or a
// lane runs toward -z, which the group's yaw turns). `fill` matters only to a ring (see growFill).
function geometry(shape: Shape, fill: number): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  switch (shape.kind) {
    case "circle":
      g = new THREE.CircleGeometry(shape.r, SEGMENTS);
      break;
    case "ring": {
      const inner = shape.inner + (shape.outer - shape.inner) * (1 - fill);
      g = new THREE.RingGeometry(fill >= 1 ? shape.inner : inner, shape.outer, SEGMENTS);
      break;
    }
    case "cone":
      g = new THREE.CircleGeometry(shape.r, SEGMENTS, Math.PI / 2 - shape.arc / 2, shape.arc);
      break;
    case "line":
      g = new THREE.PlaneGeometry(shape.width, shape.length);
      g.translate(0, shape.length / 2, 0);
      break;
  }
  g.rotateX(-Math.PI / 2);
  return g;
}

interface Mark {
  group: THREE.Group;
  area: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  fill: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  // When this client first saw it, and how long it was to land after that (the server's clock may
  // differ from ours: the mark's own length is what counts).
  seenAt: number;
  lasts: number;
  lastFill: number;
  // Where a ring's fill was last rebuilt.
  builtFill: number;
}

// Grows a mark's fill to `fill` (0 to 1). A ring is rebuilt only a step past where it was last built
// (`built`); answers where its fill now stands.
function growFill(mesh: THREE.Mesh, shape: Shape, fill: number, built: number): number {
  const f = Math.max(0.001, fill);
  if (shape.kind === "circle" || shape.kind === "cone") mesh.scale.set(f, 1, f);
  else if (shape.kind === "line") mesh.scale.set(1, 1, f);
  else if (fill - built >= RING_STEP) {
    mesh.geometry.dispose();
    mesh.geometry = geometry(shape, fill);
    return fill;
  }
  return built;
}

function material(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
}

export class TelegraphLayer {
  readonly object = new THREE.Group();
  private readonly marks = new Map<string, Mark>();

  // Brings the marks in line with the room's; answers whether a new one appeared (for a warning sound)
  // and the ids that just landed (for a shockwave).
  sync(telegraphs: readonly Telegraph[], now: number): { appeared: boolean; landed: Telegraph[] } {
    let appeared = false;
    const landed: Telegraph[] = [];
    const seen = new Set<string>();
    for (const t of telegraphs) {
      seen.add(t.id);
      let mark = this.marks.get(t.id);
      if (!mark) {
        mark = this.add(t, now);
        appeared = true;
      }
      const fill = Math.min(1, (now - mark.seenAt) / mark.lasts);
      if (fill >= 1 && mark.lastFill < 1) {
        landed.push(t);
        // A pool stays on as a dark patch; anything else is gone once it lands.
        if (t.pool) {
          mark.area.material.color.setHex(POOL);
          mark.area.material.opacity = 0.4;
          mark.fill.visible = false;
        } else mark.group.visible = false;
      }
      if (fill < 1 && fill !== mark.lastFill) {
        mark.builtFill = growFill(mark.fill, t.shape, fill, mark.builtFill);
        mark.fill.material.opacity = 0.3 + 0.3 * fill;
      }
      mark.lastFill = fill;
    }
    for (const [id, mark] of this.marks) {
      if (seen.has(id)) continue;
      this.object.remove(mark.group);
      mark.area.geometry.dispose();
      mark.fill.geometry.dispose();
      mark.area.material.dispose();
      mark.fill.material.dispose();
      this.marks.delete(id);
    }
    return { appeared, landed };
  }

  private add(t: Telegraph, now: number): Mark {
    const group = new THREE.Group();
    group.position.set(t.shape.x, Y, t.shape.z);
    if (t.shape.kind === "cone" || t.shape.kind === "line") group.rotation.y = t.shape.yaw;
    const area = new THREE.Mesh(geometry(t.shape, 1), material(WARN, 0.22));
    const fill = new THREE.Mesh(geometry(t.shape, 0), material(WARN, 0.3));
    growFill(fill, t.shape, 0, 0);
    fill.position.y = 0.01;
    area.renderOrder = 2;
    fill.renderOrder = 3;
    group.add(area, fill);
    this.object.add(group);
    const mark: Mark = { group, area, fill, seenAt: now, lasts: Math.max(1, t.hitAt - t.startAt), lastFill: 0, builtFill: 0 };
    this.marks.set(t.id, mark);
    return mark;
  }

  dispose(): void {
    this.sync([], 0);
  }
}
