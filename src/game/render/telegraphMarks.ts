import * as THREE from "three";
import type { Shape, Telegraph } from "../world/telegraphs";

// The marks of telegraphed attacks on the ground (see world/telegraphs.ts): a faint red area where a
// blow will land, filling up until it does, so whoever stands in it has time to step out. A pool left
// behind stays dark purple until it dries.

const WARN = 0xff3a2a;
const POOL = 0x7a3ad0;
const Y = 0.06;
const SEGMENTS = 48;

// The area's flat geometry in the ground plane, with its origin where the shape starts (a fan or a
// lane runs toward -z, which the group's yaw turns).
function geometry(shape: Shape, fill: number): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  switch (shape.kind) {
    case "circle":
      // Fills from the rim inward.
      g = fill >= 1 ? new THREE.CircleGeometry(shape.r, SEGMENTS) : new THREE.RingGeometry(shape.r * (1 - fill), shape.r, SEGMENTS);
      break;
    case "ring": {
      const inner = shape.inner + (shape.outer - shape.inner) * (1 - fill);
      g = new THREE.RingGeometry(fill >= 1 ? shape.inner : inner, shape.outer, SEGMENTS);
      break;
    }
    case "cone":
      // Grows out from the mouth.
      g = new THREE.CircleGeometry(Math.max(0.01, shape.r * fill), SEGMENTS, Math.PI / 2 - shape.arc / 2, shape.arc);
      break;
    case "line": {
      const length = Math.max(0.01, shape.length * fill);
      g = new THREE.PlaneGeometry(shape.width, length);
      g.translate(0, length / 2, 0);
      break;
    }
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
      if (fill < 1 && Math.abs(fill - mark.lastFill) > 0.02) {
        mark.fill.geometry.dispose();
        mark.fill.geometry = geometry(t.shape, fill);
        mark.fill.material.opacity = 0.3 + 0.3 * fill;
      }
      mark.lastFill = fill;
    }
    for (const [id, mark] of this.marks) {
      if (seen.has(id)) continue;
      this.object.remove(mark.group);
      mark.area.geometry.dispose();
      mark.fill.geometry.dispose();
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
    fill.position.y = 0.01;
    area.renderOrder = 2;
    fill.renderOrder = 3;
    group.add(area, fill);
    this.object.add(group);
    const mark: Mark = { group, area, fill, seenAt: now, lasts: Math.max(1, t.hitAt - t.startAt), lastFill: 0 };
    this.marks.set(t.id, mark);
    return mark;
  }

  dispose(): void {
    this.sync([], 0);
  }
}
