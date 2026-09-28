import type { Point2 } from "../rules/levelLayout";
import { NPCS, npcSpot, type NpcId } from "./npcs";
import { START_ZONE, portalsOf, zoneLayout, type ZoneId } from "./zones";

// The map of a zone, flattened to what a minimap needs: a grid to paint and the few places worth a
// mark on it. Monsters and other players are left off on purpose — the map is for finding your way,
// not for hunting.
export type MinimapCell = "forest" | "house" | "ground";
export type MinimapMarkKind = "portal" | "npc";
export interface MinimapMark extends Point2 {
  kind: MinimapMarkKind;
  // What stands here, as an id: the zone a portal leads to, or the villager waiting at this door.
  // The words are the screen's business (see ui/names.ts), not the map's.
  to?: ZoneId;
  npc?: NpcId;
}

export interface MinimapModel {
  zone: ZoneId;
  cols: number;
  rows: number;
  tileSize: number;
  // The zone in metres, which is what a pose is measured in.
  width: number;
  depth: number;
  cells: MinimapCell[][];
  marks: MinimapMark[];
}

const models = new Map<ZoneId, MinimapModel>();

export function minimapModel(zone: ZoneId): MinimapModel {
  let model = models.get(zone);
  if (model) return model;
  const layout = zoneLayout(zone);
  const cells = layout.solid.map((row, r) => row.map((solid, c): MinimapCell => {
    if (!solid) return "ground";
    return layout.forest[r][c] ? "forest" : "house";
  }));
  const marks: MinimapMark[] = portalsOf(zone).map((p) => ({ kind: "portal", x: p.x, z: p.z, to: p.to }));
  // The NPCs all stand in the village, each at their own door.
  if (zone === START_ZONE) {
    for (const npc of NPCS) {
      const spot = npcSpot(npc.id);
      marks.push({ kind: "npc", x: spot.x, z: spot.z, npc: npc.id });
    }
  }
  model = {
    zone, cols: layout.cols, rows: layout.rows, tileSize: layout.tileSize,
    width: layout.cols * layout.tileSize, depth: layout.rows * layout.tileSize, cells, marks,
  };
  models.set(zone, model);
  return model;
}

// The zone drawn as large as it goes inside a box, keeping its shape, and where that leaves it.
export interface MinimapFit {
  // Pixels per metre.
  scale: number;
  // The drawn map's size and its top-left corner inside the box.
  width: number;
  height: number;
  left: number;
  top: number;
}

export function minimapFit(model: MinimapModel, boxWidth: number, boxHeight: number): MinimapFit {
  const scale = Math.min(boxWidth / model.width, boxHeight / model.depth);
  const width = model.width * scale;
  const height = model.depth * scale;
  return { scale, width, height, left: (boxWidth - width) / 2, top: (boxHeight - height) / 2 };
}

// Where a place in the world lands in the box. North (z = 0) is up, always: the map never turns
// with the camera, so a glance at it means the same thing every time.
export function minimapPoint(fit: MinimapFit, p: Point2): { x: number; y: number } {
  return { x: fit.left + p.x * fit.scale, y: fit.top + p.z * fit.scale };
}

// Which way you face on the map, as a unit step in drawn pixels (x right, y down). Yaw 0 looks
// toward -z, which is up the map; walking forward moves the arrow the way it points.
export function minimapHeading(yaw: number): { x: number; y: number } {
  return { x: -Math.sin(yaw), y: -Math.cos(yaw) };
}

// The place in the world under a point on the drawn map; null when the point is off the map.
export function minimapWorld(fit: MinimapFit, at: { x: number; y: number }): Point2 | null {
  const x = (at.x - fit.left) / fit.scale;
  const z = (at.y - fit.top) / fit.scale;
  if (x < 0 || z < 0 || at.x > fit.left + fit.width || at.y > fit.top + fit.height) return null;
  return { x, z };
}

export interface MinimapPick extends Point2 {
  // The villager whose mark was tapped, if the tap landed on one.
  npc: NpcId | null;
  // Whether the place can be walked on at all (the forest and the houses cannot).
  open: boolean;
}

// What a tap on the map means: the villager it landed on, or the place it landed on. A mark is
// grabbed from a few pixels away, so a fingertip does not have to be exact.
export function minimapPick(
  model: MinimapModel, fit: MinimapFit, at: { x: number; y: number }, grab: number,
): MinimapPick | null {
  const world = minimapWorld(fit, at);
  if (!world) return null;
  let best: { mark: MinimapMark; d: number } | null = null;
  for (const mark of model.marks) {
    if (!mark.npc) continue;
    const spot = minimapPoint(fit, mark);
    const d = Math.hypot(spot.x - at.x, spot.y - at.y);
    if (d <= grab && (!best || d < best.d)) best = { mark, d };
  }
  if (best) return { x: best.mark.x, z: best.mark.z, npc: best.mark.npc!, open: true };
  const c = Math.floor(world.x / model.tileSize);
  const r = Math.floor(world.z / model.tileSize);
  const cell = model.cells[r]?.[c];
  return { ...world, npc: null, open: cell === "ground" };
}
