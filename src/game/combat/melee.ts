import type { Weapon } from "./classes";
import { RANGE_SLACK } from "../world/types";
import type { Pose, Vec2 } from "../world/types";

// The client fires at a monster this much past its weapon's reach (to the monster's edge), and draws
// a bow's or a staff's shot that much longer, so a shot seen touching a monster is one that hits it.
// Well inside the server's RANGE_SLACK, so every such shot lands.
export const AIM_GRACE = 0.5;

// Poses reach the server a little late, so a swing's arc is judged this much wider there.
export const ARC_SLACK = (20 * Math.PI) / 180;

// Whether a point lies within half of arc either side of where the body faces (yaw 0 faces -z).
export function facing(pose: Pose, point: Vec2, arc: number): boolean {
  const dx = point.x - pose.x;
  const dz = point.z - pose.z;
  if (dx === 0 && dz === 0) return true;
  const toward = Math.atan2(-dx, -dz);
  let d = (toward - pose.yaw) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d) <= arc / 2;
}

// Whether a swing from pose lands on a target: close enough and inside the weapon's arc. Reach is to
// the target's edge, not its middle (`body`, its footprint radius): a bolt that touches a big
// monster's flank hits it, wherever its middle is. The server adds slack for lag; the client asks
// without it, so whatever the client fires at, the server lets land.
export function inStrikeReach(pose: Pose, target: Vec2, weapon: Weapon, slack = false, body = 0): boolean {
  const reach = weapon.reach + body + (slack ? RANGE_SLACK : 0);
  const arc = weapon.arc + (slack ? ARC_SLACK * 2 : 0);
  return Math.hypot(target.x - pose.x, target.z - pose.z) <= reach && facing(pose, target, arc);
}
