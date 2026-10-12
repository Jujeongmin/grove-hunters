// Bodies do not walk through each other: a step that would end inside another body is refused,
// unless it moves away from that body (so two that already overlap can always part).

import { MAX_STEP_SECONDS, WALK_SPEED, stepAround, type PlayerPose, type SolidTest } from "./movement";

export interface Body { x: number; z: number; r: number }

// A player's footprint radius in metres (monsters have theirs in world/monsters.ts).
export const PLAYER_BODY = 0.35;

// Whether stepping from `from` to (x, z) would push into one of the bodies. Each body's r is the
// distance the two centres must keep (both radii added).
export function crowdBlocks(bodies: readonly Body[], from: { x: number; z: number }, x: number, z: number): boolean {
  for (const b of bodies) {
    const next = Math.hypot(x - b.x, z - b.z);
    if (next >= b.r) continue;
    if (next < Math.hypot(from.x - b.x, from.z - b.z) - 1e-6) return true;
  }
  return false;
}

// One step of a body walking on its own (auto-battle, a walk a quest sent you on) along a heading.
// It goes round a monster in the way, but hemmed in (between two standing side by side, or in the
// crowd round the one it is after) it slips through them rather than standing there: the routes only
// know the forest, so a crowd would hold it on the same spot for good. `isSolid` is everything that
// stops it, crowd included; `walls` what stops it all the same (the forest, the platforms).
export function stepPastCrowd(
  pose: PlayerPose, heading: number, dt: number, isSolid: SolidTest, walls: SolidTest, speed: number = WALK_SPEED,
  throughCrowd = false,
): PlayerPose {
  // A player sent somewhere must not orbit a pack forever: for that walk, crowd is visual rather
  // than solid. `walls` still includes every fixed body the caller wants it to avoid.
  if (throughCrowd) return stepAround(pose, heading, dt, walls, speed);
  const want = speed * Math.min(Math.max(dt, 0), MAX_STEP_SECONDS);
  const around = stepAround(pose, heading, dt, isSolid, speed);
  if (Math.hypot(around.x - pose.x, around.z - pose.z) >= want * 0.5) return around;
  const through = stepAround(pose, heading, dt, walls, speed);
  return Math.hypot(through.x - pose.x, through.z - pose.z) > Math.hypot(around.x - pose.x, around.z - pose.z) ? through : around;
}
