import type { MountId } from "../account/mounts";

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
  yeti: { height: 0.66, seat: 0.9, forward: 0, idle: "Idle", move: "Walk" },
  drake: { height: 0.75, seat: 0.97, forward: -0.2, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.4 },
  dragon: { height: 0.95, seat: 0.92, forward: -0.25, idle: "Flying_Idle", move: "Fast_Flying", hover: 0.5 },
};
