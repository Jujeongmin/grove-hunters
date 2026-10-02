import { TILE_SIZE, parseLevel, type LevelLayout, type Point2 } from "../rules/levelLayout";
import { fieldMap, portalCell, type House, type Side } from "./fieldMap";
import { BUILDINGS } from "./grove";

// The open world: a village, the forest fields, the deep forest and the boss's clearing, joined by portals (O cells).
// A server runs as channels (see CHANNEL_CAPACITY), each zone of a channel one Verse8 room. The
// whole world is free to everyone; each zone only asks for a level (minLevel).
// The arena is where a guild fights its boss (see guildBoss.ts): no portal leads there, only the guild.
// Past the deep forest lies the snow region: its outpost, three fields and the Glacier Emperor's altar.
// The dungeon is the Trial Dungeon's room (see dungeon.ts): only a match leads there.
export type ZoneId =
  | "village" | "forest1" | "forest2" | "forest3" | "boss" | "arena"
  | "outpost" | "snow1" | "snow2" | "snow3" | "snowboss" | "dungeon";

// The two regions: the grove (the village and the forest) and the snow. Falling in one sends you back
// to its own town.
export type Region = "grove" | "snow";

// One way out of a zone: the edge it stands on, how far along that edge, and the zone it leads to.
export interface ZonePortal {
  to: ZoneId;
  side: Side;
  at: number;
}

export interface Zone {
  id: ZoneId;
  region: Region;
  // The level a character needs to go in.
  minLevel: number;
  // # forest, . ground, P where you appear when nothing else says, O a portal, Z a monster's spot,
  // K the boss's spot, c B C H things to stand on (see levelLayout.ts).
  map: string[];
  // The ways out: each says which edge it is on, how far along, and where it leads. The map is drawn
  // from this same list, so a destination belongs to one O cell and cannot slide onto another's.
  portals: readonly ZonePortal[];
  // The houses standing in it (their cells are in the map as h).
  houses?: House[];
}

// The village's houses, round the square (see scripts/build-houses.mjs for the models).
const VILLAGE_HOUSES: House[] = [
  { model: "bld_house_tall", at: [10, 5], face: "S" },
  { model: "bld_house_long", at: [20, 3], face: "S" },
  { model: "bld_house_small", at: [24, 15], face: "N" },
  { model: "bld_house_tall", at: [12, 19], face: "N" },
  { model: "bld_house_small", at: [4, 9], face: "E" },
];

// The village's four building sites (see grove.ts): ruins at first, built up by the players. They block
// the map like houses from the start, so the map never changes as they go up.
const VILLAGE_SITES: House[] = BUILDINGS.map((b) => ({ model: b.model, at: b.at, face: b.face }));

// Where everyone starts: the grove's village.
const START_ZONE_ID = "village" as const;

// Each zone's ways out, named once: the map below is drawn from the very same list.
const VILLAGE_PORTALS: readonly ZonePortal[] = [{ to: "forest1", side: "E", at: 13 }];
const FOREST1_PORTALS: readonly ZonePortal[] = [
  { to: "village", side: "W", at: 18 }, { to: "forest2", side: "E", at: 17 },
];
const FOREST2_PORTALS: readonly ZonePortal[] = [
  { to: "forest1", side: "W", at: 17 }, { to: "boss", side: "N", at: 38 }, { to: "forest3", side: "E", at: 24 },
];
const FOREST3_PORTALS: readonly ZonePortal[] = [{ to: "forest2", side: "W", at: 20 }, { to: "outpost", side: "E", at: 20 }];
const OUTPOST_PORTALS: readonly ZonePortal[] = [{ to: "forest3", side: "W", at: 12 }, { to: "snow1", side: "E", at: 12 }];
const SNOW1_PORTALS: readonly ZonePortal[] = [{ to: "outpost", side: "W", at: 18 }, { to: "snow2", side: "E", at: 18 }];
const SNOW2_PORTALS: readonly ZonePortal[] = [
  { to: "snow1", side: "W", at: 18 }, { to: "snow3", side: "E", at: 18 }, { to: "snowboss", side: "N", at: 26 },
];
const SNOW3_PORTALS: readonly ZonePortal[] = [{ to: "snow2", side: "W", at: 20 }];
const SNOWBOSS_PORTALS: readonly ZonePortal[] = [{ to: "snow2", side: "S", at: 15 }];

// The outpost's buildings: the captain's watchtower, the merchant's and the smith's houses.
const OUTPOST_HOUSES: House[] = [
  { model: "bld_tower", at: [14, 4], face: "S" },
  { model: "bld_house_small", at: [6, 10], face: "E" },
  { model: "bld_house_long", at: [21, 14], face: "N" },
  { model: "bld_house_tall", at: [8, 17], face: "N" },
];
const BOSS_PORTALS: readonly ZonePortal[] = [{ to: "forest2", side: "S", at: 15 }];

// The fields are wide open country (drawn by fieldMap from a few numbers): about 200 by 140 metres
// of meadow and groves between walls of forest, the village a little smaller.
export const ZONES: Record<ZoneId, Zone> = {
  village: {
    id: "village", region: "grove", minLevel: 1, portals: VILLAGE_PORTALS, houses: VILLAGE_HOUSES,
    map: fieldMap({
      cols: 34, rows: 26, seed: 3, spawn: [14, 13], portals: VILLAGE_PORTALS,
      monsters: 0, groves: 5, edge: 2, props: "cBHcBc", houses: [...VILLAGE_HOUSES, ...VILLAGE_SITES],
    }),
  },
  forest1: {
    id: "forest1", region: "grove", minLevel: 1, portals: FOREST1_PORTALS,
    map: fieldMap({
      cols: 50, rows: 36, seed: 11, spawn: [5, 18], portals: FOREST1_PORTALS,
      monsters: 24, groves: 16, edge: 3, props: "cBccB",
    }),
  },
  forest2: {
    id: "forest2", region: "grove", minLevel: 10, portals: FOREST2_PORTALS,
    map: fieldMap({
      cols: 50, rows: 36, seed: 29, spawn: [5, 17], portals: FOREST2_PORTALS,
      monsters: 26, groves: 20, edge: 3, props: "cBcH",
    }),
  },
  forest3: {
    id: "forest3", region: "grove", minLevel: 25, portals: FOREST3_PORTALS,
    map: fieldMap({
      cols: 54, rows: 40, seed: 61, spawn: [5, 20], portals: FOREST3_PORTALS,
      monsters: 28, groves: 26, edge: 4, props: "cBcHc",
    }),
  },
  boss: {
    id: "boss", region: "grove", minLevel: 25, portals: BOSS_PORTALS,
    map: fieldMap({
      cols: 30, rows: 30, seed: 47, spawn: [15, 25], portals: BOSS_PORTALS,
      monsters: 0, boss: [15, 11], groves: 4, edge: 3, props: "cc",
    }),
  },
  arena: {
    id: "arena", region: "grove", minLevel: 10, portals: [],
    map: fieldMap({
      cols: 18, rows: 18, seed: 83, spawn: [9, 14], portals: [],
      monsters: 0, boss: [9, 7], groves: 0, edge: 3, props: "",
    }),
  },
  dungeon: {
    id: "dungeon", region: "grove", minLevel: 10, portals: [],
    map: fieldMap({
      cols: 22, rows: 22, seed: 131, spawn: [11, 17], portals: [],
      monsters: 0, boss: [11, 8], groves: 0, edge: 3, props: "",
    }),
  },
  outpost: {
    id: "outpost", region: "snow", minLevel: 38, portals: OUTPOST_PORTALS, houses: OUTPOST_HOUSES,
    map: fieldMap({
      cols: 30, rows: 24, seed: 101, spawn: [14, 12], portals: OUTPOST_PORTALS,
      monsters: 0, groves: 4, edge: 2, props: "cBc", houses: OUTPOST_HOUSES,
    }),
  },
  snow1: {
    id: "snow1", region: "snow", minLevel: 40, portals: SNOW1_PORTALS,
    map: fieldMap({
      cols: 50, rows: 36, seed: 113, spawn: [5, 18], portals: SNOW1_PORTALS,
      monsters: 26, groves: 18, edge: 3, props: "cBcc",
    }),
  },
  snow2: {
    id: "snow2", region: "snow", minLevel: 47, portals: SNOW2_PORTALS,
    map: fieldMap({
      cols: 52, rows: 38, seed: 127, spawn: [5, 18], portals: SNOW2_PORTALS,
      monsters: 28, groves: 22, edge: 3, props: "cBH",
    }),
  },
  snow3: {
    id: "snow3", region: "snow", minLevel: 54, portals: SNOW3_PORTALS,
    map: fieldMap({
      cols: 54, rows: 40, seed: 131, spawn: [5, 20], portals: SNOW3_PORTALS,
      monsters: 28, groves: 26, edge: 4, props: "cBc",
    }),
  },
  snowboss: {
    id: "snowboss", region: "snow", minLevel: 55, portals: SNOWBOSS_PORTALS,
    map: fieldMap({
      cols: 30, rows: 30, seed: 139, spawn: [15, 25], portals: SNOWBOSS_PORTALS,
      monsters: 0, boss: [15, 11], groves: 4, edge: 3, props: "cc",
    }),
  },
};

// The town of each region: where the fallen of that region go back to.
export const REGION_TOWN: Record<Region, ZoneId> = { grove: START_ZONE_ID, snow: "outpost" };

export function townOf(zone: ZoneId): ZoneId {
  return REGION_TOWN[ZONES[zone].region];
}

// The square the menus stand in: the first village, kept as it was, since the menu's camera and
// lineup are placed on it.
export const MENU_MAP = [
  "#############",
  "#..c.....B..#",
  "#.....#.....#",
  "#...........#",
  "#....P......O",
  "#...........#",
  "#.H.....c...#",
  "#.......#...#",
  "#############",
];

export const ZONE_IDS = Object.keys(ZONES) as ZoneId[];
export const START_ZONE: ZoneId = START_ZONE_ID;
// A channel is one copy of the whole world on a server, as in MapleStory: you keep yours from zone
// to zone, and each zone of it is one Verse8 room. This many players at most in a channel, counted
// across every zone, so no room ever holds more: everyone in a room hears everyone else's every
// move, and this is what holds the lag down.
export const CHANNEL_CAPACITY = 10;
// Channels per server, numbered from 1: a server holds CHANNEL_CAPACITY x MAX_CHANNELS at once, and
// past that says it is full rather than pile more onto the shared Verse8 servers.
export const MAX_CHANNELS = 10;
// Standing this close to a portal's centre takes you through.
export const PORTAL_RADIUS = 1.4;

export function readZone(value: unknown): ZoneId | null {
  return ZONE_IDS.find((z) => z === value) ?? null;
}

const layouts = new Map<ZoneId, LevelLayout>();

export function zoneLayout(id: ZoneId): LevelLayout {
  let layout = layouts.get(id);
  if (!layout) {
    layout = parseLevel(ZONES[id].map, TILE_SIZE);
    layouts.set(id, layout);
  }
  return layout;
}

export interface Portal extends Point2 { to: ZoneId }

// Every way out of a zone, each standing on the cell its own side and place put it on. Reading the
// map's O cells in order would only tell us where the portals are, not which is which.
export function portalsOf(id: ZoneId): Portal[] {
  const layout = zoneLayout(id);
  return ZONES[id].portals.map((p) => {
    const [c, r] = portalCell(layout.cols, layout.rows, p);
    return { x: (c + 0.5) * layout.tileSize, z: (r + 0.5) * layout.tileSize, to: p.to };
  });
}

// Where you stand after coming into `zone` from `from`: one cell inside the portal that leads back,
// so you do not step straight back through it.
export function arrivalFrom(zone: ZoneId, from: ZoneId): Point2 {
  const layout = zoneLayout(zone);
  const back = portalsOf(zone).find((p) => p.to === from);
  if (!back) return layout.playerSpawn;
  const t = layout.tileSize;
  const c = Math.floor(back.x / t);
  const r = Math.floor(back.z / t);
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nc = c + dc;
    const nr = r + dr;
    if (nc >= 0 && nr >= 0 && nc < layout.cols && nr < layout.rows && !layout.solid[nr][nc]) {
      return { x: (nc + 0.5) * t, z: (nr + 0.5) * t };
    }
  }
  return layout.playerSpawn;
}

// One Verse8 room per channel; the id says which server, zone and channel it is.
export function channelRoomId(world: string, zone: ZoneId, channel: number): string {
  return `rpg-${world}-${zone}-${channel}`;
}

export function readChannelRoom(roomId: unknown): { world: string; zone: ZoneId; channel: number } | null {
  if (typeof roomId !== "string") return null;
  const m = /^rpg-(w\d+)-([a-z0-9]+)-(\d+)$/.exec(roomId);
  const zone = m ? readZone(m[2]) : null;
  return m && zone ? { world: m[1], zone, channel: Number(m[3]) } : null;
}

export function readChannel(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_CHANNELS ? value : null;
}

// Where a player is playing: the server, the zone and the channel. Their friends see it, and they
// come back to the same channel.
export interface Whereabouts { world: string; zone: ZoneId; channel: number }

export function readWhereabouts(raw: unknown): Whereabouts | null {
  const w = raw as Record<string, unknown> | null;
  if (!w || typeof w !== "object" || typeof w.world !== "string") return null;
  const zone = readZone(w.zone);
  const channel = readChannel(w.channel);
  return zone && channel ? { world: w.world, zone, channel } : null;
}

// What entering a zone hands back: the room, and where you stand in it.
export interface ZoneEntry {
  roomId: string;
  zone: ZoneId;
  channel: number;
  x: number;
  z: number;
}

// What each player in a zone shows the others, written when they come in.
export interface ZoneLook {
  name: string;
  costume: string;
  playerClass: string;
  level: number;
  // The advanced class's name (전직), shown before the name.
  job: string | null;
  // Whether the first skill is learned yet (new characters learn it from the elder); missing counts
  // as learned.
  learned?: boolean;
  // Its guild's name, shown after its name.
  guild?: string | null;
  // The account's VIP rank (see premium.ts), 0 for none.
  vip?: number;
}
