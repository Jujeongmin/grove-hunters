import type { Point2 } from "../rules/levelLayout";
import { START_ZONE, ZONES, zoneLayout, type ZoneId } from "./zones";

// The people of the towns: in each, a merchant keeps the shop, an elder (in the snow outpost, its
// captain) hands out the quests and takes your reports, and a smith keeps the forge. Each stands
// outside the door of a building of their town, the same spot for everyone.
export type NpcId = "merchant" | "elder" | "smith" | "frost_merchant" | "captain" | "frost_smith";
// What an NPC does for you: the same in every town.
export type NpcRole = "merchant" | "elder" | "smith";

export interface Npc {
  id: NpcId;
  role: NpcRole;
  // The town they stand in.
  zone: ZoneId;
  // Their own model (not a player class's hero), how tall it stands, and its clips (see NpcActor).
  model: string;
  height: number;
  idle: string;
  greet: string;
  // Colours laid over the model's materials, by material name (the pack's skin comes out black).
  colors: Record<string, number>;
  // The building they stand in front of: the top-left cell of its block (see the zone's houses).
  house: [number, number];
}

export const NPCS: readonly Npc[] = [
  // Villagers from Quaternius's Ultimate Animated Character Pack (CC0): an old gentleman in a top
  // hat keeps the shop, an old lady is the elder. Nobody can play them, so they never look like
  // another player.
  {
    id: "merchant", role: "merchant", zone: START_ZONE, model: "npc_merchant", height: 1.75, idle: "Idle", greet: "Victory",
    colors: { Skin: 0xe8b98f, Shirt: 0xeee6d6, Pants: 0x5b4a2e, Detail: 0x9a5424 },
    house: [10, 5],
  },
  {
    id: "elder", role: "elder", zone: START_ZONE, model: "npc_elder", height: 1.6, idle: "Idle", greet: "Victory",
    colors: { Skin: 0xf0c9a4, Shirt: 0x7d5a9e, Pants: 0x4e3d63, Hair: 0xd9d4cc, Hat: 0x3b2a4a },
    house: [24, 15],
  },
  // A bearded viking from the same pack keeps the forge: enhancing gear and making it from what
  // monsters drop.
  {
    id: "smith", role: "smith", zone: START_ZONE, model: "npc_smith", height: 1.85, idle: "Idle", greet: "Victory",
    colors: { Skin: 0xd9a37c, Light: 0x8a6a48, Main: 0x5a3a28, Pants: 0x3a2c22, Hair: 0x8a3a1c },
    house: [20, 3],
  },
  // The snow outpost's three, the same models dressed for the cold.
  {
    id: "frost_merchant", role: "merchant", zone: "outpost", model: "npc_merchant", height: 1.75, idle: "Idle", greet: "Victory",
    colors: { Skin: 0xe8b98f, Shirt: 0x3f6f9a, Pants: 0x2b3440, Detail: 0xd9e6f2 },
    house: [6, 10],
  },
  {
    id: "captain", role: "elder", zone: "outpost", model: "npc_smith", height: 1.9, idle: "Idle", greet: "Victory",
    colors: { Skin: 0xd9a37c, Light: 0xc9d6e2, Main: 0x3a4a5e, Pants: 0x232a33, Hair: 0xe8e4dc },
    house: [14, 4],
  },
  {
    id: "frost_smith", role: "smith", zone: "outpost", model: "npc_smith", height: 1.85, idle: "Idle", greet: "Victory",
    colors: { Skin: 0xd9a37c, Light: 0x7a8a9a, Main: 0x40505e, Pants: 0x2a2f36, Hair: 0x5a3a28 },
    house: [21, 14],
  },
];

export function npcById(id: NpcId): Npc {
  return NPCS.find((n) => n.id === id)!;
}

export function roleOf(id: NpcId): NpcRole {
  return npcById(id).role;
}

// The NPCs of one zone (none outside the towns).
export function npcsIn(zone: ZoneId): Npc[] {
  return NPCS.filter((n) => n.zone === zone);
}

// Standing this close to someone lets you talk to them (the server allows a little more for lag).
export const TALK_RANGE = 3.5;
export const NPC_MODELS = [...new Set(NPCS.map((n) => n.model))];
export const TALK_SLACK = 2.5;

const spots = new Map<NpcId, Point2>();

// How far in front of a building's middle an NPC stands: just outside its block, by the door.
const DOOR_OUT = 5;
const FACING = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] } as const;

function houseOf(npc: Npc) {
  const house = (ZONES[npc.zone].houses ?? []).find((h) => h.at[0] === npc.house[0] && h.at[1] === npc.house[1]);
  if (!house) throw new Error(`no building at ${npc.house.join(",")} for ${npc.id}`);
  return house;
}

// Where an NPC stands in their town: outside the door of their building.
export function npcSpot(id: NpcId): Point2 {
  const cached = spots.get(id);
  if (cached) return cached;
  const npc = npcById(id);
  const house = houseOf(npc);
  const t = zoneLayout(npc.zone).tileSize;
  const [dx, dz] = FACING[house.face];
  const spot = { x: (house.at[0] + 1) * t + dx * DOOR_OUT, z: (house.at[1] + 1) * t + dz * DOOR_OUT };
  spots.set(id, spot);
  return spot;
}

// Which way an NPC looks: out from their door, as a unit step in x and z.
export function npcFacing(id: NpcId): Point2 {
  const [x, z] = FACING[houseOf(npcById(id)).face];
  return { x, z };
}

// The NPC of `zone` within talking range of (x, z), nearest first; null when nobody is.
export function npcNear(zone: ZoneId, x: number, z: number, slack = 0): NpcId | null {
  let best: { id: NpcId; d: number } | null = null;
  for (const npc of npcsIn(zone)) {
    const spot = npcSpot(npc.id);
    const d = Math.hypot(spot.x - x, spot.z - z);
    if (d <= TALK_RANGE + slack && (!best || d < best.d)) best = { id: npc.id, d };
  }
  return best?.id ?? null;
}
