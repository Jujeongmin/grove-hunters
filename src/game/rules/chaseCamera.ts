import { wallDistance } from "./combat";
import type { SolidTest } from "./movement";

// The over-the-shoulder camera: this far behind, this far to the right, pivoting at this height.
export const CHASE = { distance: 3.4, shoulder: 0.7, height: 1.55, minDistance: 0.6, wallGap: 0.3 };

export interface ChaseCamera {
  x: number;
  y: number;
  z: number;
  // How far behind the pivot the camera ended up; shots start that far along the aim, at the player.
  distance: number;
}

// Where the camera goes for a body at pose, looking along yaw and pitch (camera convention: yaw 0
// looks down -z, positive pitch looks up). A wall behind the player pulls the camera in.
export function chaseCamera(
  pose: { x: number; z: number; y?: number }, yaw: number, pitch: number, isSolid: SolidTest, ceilingY: number,
  shoulder = CHASE.shoulder,
): ChaseCamera {
  const cosPitch = Math.cos(pitch);
  const forward = { x: -Math.sin(yaw) * cosPitch, y: Math.sin(pitch), z: -Math.cos(yaw) * cosPitch };
  const pivot = {
    x: pose.x + Math.cos(yaw) * shoulder,
    y: CHASE.height + (pose.y ?? 0),
    z: pose.z - Math.sin(yaw) * shoulder,
  };
  const back = { ox: pivot.x, oy: pivot.y, oz: pivot.z, dx: -forward.x, dy: -forward.y, dz: -forward.z };
  const clear = wallDistance(back, isSolid, CHASE.distance + CHASE.wallGap, ceilingY) - CHASE.wallGap;
  const distance = Math.max(CHASE.minDistance, Math.min(CHASE.distance, clear));
  return {
    x: pivot.x - forward.x * distance,
    y: pivot.y - forward.y * distance,
    z: pivot.z - forward.z * distance,
    distance,
  };
}

// How far to the side the camera looks over: the right shoulder, unless a wall crowds that side (a
// house beside you then fills half the screen) and the left is clear; with both crowded, straight behind.
export function shoulderFor(pose: { x: number; z: number }, yaw: number, isSolid: SolidTest): number {
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const crowded = (side: number) => [0.6, 1.2, 1.8].some((d) => isSolid(pose.x + right.x * side * d, pose.z + right.z * side * d));
  if (!crowded(1)) return CHASE.shoulder;
  if (!crowded(-1)) return -CHASE.shoulder;
  return 0;
}
