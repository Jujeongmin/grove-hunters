import { describe, expect, it } from "vitest";
import { solidAt } from "../../src/game/rules/levelLayout";
import { natureLayout } from "../../src/game/rules/nature";
import {
  START_ZONE, ZONES, ZONE_IDS, arrivalFrom, channelRoomId, portalsOf, readChannelRoom, readZone, zoneLayout,
} from "../../src/game/world/zones";
import { BUILDINGS } from "../../src/game/world/grove";
import { npcSpot } from "../../src/game/world/npcs";

describe("zones", () => {
  it("parses every map, with one portal per listed destination", () => {
    for (const id of ZONE_IDS) {
      const layout = zoneLayout(id);
      expect(layout.portals).toHaveLength(ZONES[id].portals.length);
    }
  });

  it("stands every portal on its own O cell, and leaves none over", () => {
    for (const id of ZONE_IDS) {
      const cells = zoneLayout(id).portals.map((p) => `${p.x},${p.z}`).sort();
      const stood = portalsOf(id).map((p) => `${p.x},${p.z}`).sort();
      expect(stood).toEqual(cells);
    }
  });

  it("faces joined zones at each other: a way out and the way back are on opposite edges", () => {
    const OPPOSITE = { W: "E", E: "W", N: "S", S: "N" } as const;
    for (const id of ZONE_IDS) {
      for (const p of ZONES[id].portals) {
        const back = ZONES[p.to].portals.find((q) => q.to === id);
        expect(back, `${id} -> ${p.to}`).toBeDefined();
        expect(back!.side, `${id} ${p.side} -> ${p.to}`).toBe(OPPOSITE[p.side]);
      }
    }
  });

  it("walks you across the world, not back on yourself: out of the village's east side is the field's west", () => {
    const village = zoneLayout("village");
    const field = zoneLayout("forest1");
    const out = portalsOf("village").find((p) => p.to === "forest1")!;
    expect(out.x).toBeGreaterThan(village.cols * village.tileSize * 0.9);
    const at = arrivalFrom("forest1", "village");
    expect(at.x).toBeLessThan(field.cols * field.tileSize * 0.1);
    // And on from there: the way to the second field is at the first field's far side.
    expect(portalsOf("forest1").find((p) => p.to === "forest2")!.x)
      .toBeGreaterThan(field.cols * field.tileSize * 0.9);
  });

  it("joins the zones both ways: every portal has one leading back", () =>{
    for (const id of ZONE_IDS) {
      for (const p of portalsOf(id)) expect(portalsOf(p.to).map((q) => q.to)).toContain(id);
    }
  });

  it("sets you down on open ground beside the portal you came through", () => {
    for (const id of ZONE_IDS) {
      for (const p of portalsOf(id)) {
        const at = arrivalFrom(id, p.to);
        expect(solidAt(zoneLayout(id), at.x, at.z)).toBe(false);
        expect(Math.hypot(at.x - p.x, at.z - p.z)).toBeLessThanOrEqual(zoneLayout(id).tileSize + 0.01);
      }
    }
  });

  it("reaches every portal, monster and the boss on foot from the spawn, over wide fields", () => {
    for (const id of ZONE_IDS) {
      const layout = zoneLayout(id);
      const t = layout.tileSize;
      const cell = (p: { x: number; z: number }) => `${Math.floor(p.x / t)},${Math.floor(p.z / t)}`;
      const seen = new Set([cell(layout.playerSpawn)]);
      const queue = [[Math.floor(layout.playerSpawn.x / t), Math.floor(layout.playerSpawn.z / t)]];
      while (queue.length > 0) {
        const [c, r] = queue.shift()!;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= layout.cols || nr >= layout.rows || layout.solid[nr][nc] || seen.has(`${nc},${nr}`)) continue;
          seen.add(`${nc},${nr}`);
          queue.push([nc, nr]);
        }
      }
      for (const p of [...layout.portals, ...layout.zombieSpawns, ...(layout.bossSpawn ? [layout.bossSpawn] : [])]) {
        expect(seen.has(cell(p))).toBe(true);
      }
      // The guild's arena is a small ring on purpose; the rest are wide open country.
      if (id !== "arena") expect(layout.cols * t).toBeGreaterThanOrEqual(120);
    }
    expect(zoneLayout("arena").bossSpawn).not.toBeNull();
    expect(zoneLayout("forest1").zombieSpawns.length).toBeGreaterThanOrEqual(20);
    expect(zoneLayout("boss").bossSpawn).not.toBeNull();
  });

  it("builds the village's houses: solid blocks with open ground round them and nothing growing on them", () => {
    const layout = zoneLayout("village");
    const houses = ZONES.village.houses ?? [];
    expect(houses.length).toBeGreaterThan(0);
    const pieces = natureLayout(layout);
    for (const { at: [c, r] } of houses) {
      for (let dr = 0; dr <= 1; dr++) {
        for (let dc = 0; dc <= 1; dc++) {
          expect(layout.solid[r + dr][c + dc]).toBe(true);
          expect(layout.forest[r + dr][c + dc]).toBe(false);
        }
      }
      // The ring round the block is open ground, so no house walls anything in.
      for (let dr = -1; dr <= 2; dr++) {
        for (let dc = -1; dc <= 2; dc++) {
          if (dr >= 0 && dr <= 1 && dc >= 0 && dc <= 1) continue;
          expect(layout.solid[r + dr][c + dc]).toBe(false);
        }
      }
      const onBlock = pieces.filter((p) => {
        const pc = Math.floor(p.x / layout.tileSize);
        const pr = Math.floor(p.z / layout.tileSize);
        return pc >= c && pc <= c + 1 && pr >= r && pr <= r + 1;
      });
      expect(onBlock).toEqual([]);
    }
  });

  it("starts in the village; the guild's arena has no portal", () => {
    expect(START_ZONE).toBe("village");
    expect(ZONES.arena.portals).toEqual([]);
  });

  it("names channel rooms and reads them back", () => {
    const id = channelRoomId("w2", "forest1", 3);
    expect(readChannelRoom(id)).toEqual({ world: "w2", zone: "forest1", channel: 3 });
    expect(readChannelRoom("de-w1-abc")).toBeNull();
    expect(readZone("moon")).toBeNull();
  });

  it("keeps the village's four building sites as solid ground, clear of the NPCs", () => {
    const layout = zoneLayout("village");
    for (const b of BUILDINGS) {
      for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expect(layout.solid[b.at[1] + dr][b.at[0] + dc]).toBe(true);
    }
    for (const id of ["merchant", "elder", "smith"] as const) {
      const spot = npcSpot(id);
      expect(solidAt(layout, spot.x, spot.z)).toBe(false);
    }
  });
});
