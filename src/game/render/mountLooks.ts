import * as THREE from "three";
import { MOUNTS, type MountId } from "../account/mounts";
import type { ModelLibrary } from "../assets/ModelLibrary";

// How each mount is drawn under its rider: its height (as a share of the rider's), where its back is
// (as a share of its own height), how far forward the rider sits (metres, +z is its head), and the
// clips it plays standing and moving. A flier hovers this far off the ground. The walkers are the
// Quaternius pack's round little beasts: the rider sits on top of the ball; the dragons are mostly head, and
// the rider sits on it, a little back.
export interface MountLook {
  height: number;
  seat: number;
  forward: number;
  idle: string;
  move: string;
  hover?: number;
}

export const MOUNT_LOOKS: Record<MountId, MountLook> = {
  deer: { height: 0.62, seat: 0.9, forward: 0, idle: "Idle", move: "Walk" },
  pig: { height: 0.6, seat: 0.9, forward: 0, idle: "Idle", move: "Walk" },
  chicken: { height: 0.6, seat: 0.9, forward: 0, idle: "Idle", move: "Walk" },
  penguin: { height: 0.6, seat: 0.9, forward: 0, idle: "Idle", move: "Walk" },
  panda: { height: 0.6, seat: 0.9, forward: 0, idle: "Idle", move: "Walk" },
  crab: { height: 0.6, seat: 0.9, forward: 0, idle: "Idle", move: "Walk" },
  cat: { height: 0.6, seat: 0.9, forward: 0, idle: "Idle", move: "Walk" },
  dog: { height: 0.6, seat: 0.9, forward: 0, idle: "Idle", move: "Walk" },
  pigeon: { height: 0.6, seat: 0.9, forward: 0, idle: "Idle", move: "Walk" },
  armabee: { height: 0.75, seat: 0.8, forward: 0, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.35 },
  glub: { height: 0.9, seat: 0.75, forward: 0, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.35 },
  squidle: { height: 0.75, seat: 0.8, forward: 0, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.35 },
  hywirl: { height: 0.8, seat: 0.72, forward: 0, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.35 },
  alpaking: { height: 0.8, seat: 0.82, forward: 0, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.4 },
  queen_armabee: { height: 0.85, seat: 0.8, forward: 0, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.4 },
  elder_glub: { height: 1.3, seat: 0.72, forward: 0, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.45 },
  alpaking_emperor: { height: 0.95, seat: 0.86, forward: 0, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.45 },
  yeti: { height: 0.66, seat: 0.9, forward: 0, idle: "Idle", move: "Walk" },
  drake: { height: 0.75, seat: 0.97, forward: -0.2, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.4 },
  dragon: { height: 0.95, seat: 0.92, forward: -0.25, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.5 },
  golden_dragon: { height: 0.95, seat: 0.92, forward: -0.25, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.5 },
  celestial_dragon: { height: 1.0, seat: 0.92, forward: -0.25, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.55 },
  void_emperor: { height: 0.95, seat: 0.86, forward: 0, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.45 },
};

// How much of a dyed mount's own colour gives way to its dye.
const DYE_MIX = 0.6;

// A mount's model, ready to place: its library copy, and for a dyed one (the mythics) its own
// materials in the dye's colours, glowing with it.
export function mountObject(library: ModelLibrary, id: MountId): THREE.Object3D {
  const object = library.instance(MOUNTS[id].model);
  const dye = MOUNTS[id].dye;
  if (!dye) return object;
  const tint = new THREE.Color(dye.tint);
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const recolour = (m: THREE.Material) => {
      // Its own copy: the library's materials are shared with the undyed mount.
      const own = m.clone() as THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number };
      own.color?.lerp(tint, DYE_MIX);
      if (own.emissive) {
        own.emissive.copy(tint);
        own.emissiveIntensity = dye.glow;
      }
      return own;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(recolour) : recolour(mesh.material);
  });
  return object;
}
