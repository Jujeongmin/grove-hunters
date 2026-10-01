import { ZONE_BOSS, ZONE_MONSTERS, type MonsterType } from "./monsters";
import { ZONES, ZONE_IDS, type ZoneId } from "./zones";

// Going after a quest from wherever you are: which fields its monsters live in, and which portal
// leads toward the nearest of them. The way is worked out over the zones' portals, one field at a
// time, so a trip can carry on after each portal.

// A trip after a quest that may cross zones: to its monsters, or back to the elder to report it.
// The screen keeps it from one zone's view to the next.
export type QuestTrip = { kind: "hunt"; types: MonsterType[] } | { kind: "elder" };

// Whether you may walk into a zone: open, or shut until a level.
export type Entry = "open" | "level";

export type QuestWay =
  // The monsters live in this zone: hunt here.
  | { kind: "here" }
  // Through the portal to `next`, on the way to `goal`.
  | { kind: "go"; next: ZoneId; goal: ZoneId }
  // The nearest field with them is shut to you, and why.
  | { kind: "locked"; zone: ZoneId; why: "level" }
  | { kind: "nowhere" };

export function zonesWith(types: readonly MonsterType[]): ZoneId[] {
  return ZONE_IDS.filter((z) => ZONE_MONSTERS[z].some((t) => types.includes(t)) || types.includes(ZONE_BOSS[z]!));
}

// The zones after `from` on the shortest way to the nearest of `goals`, crossing only zones `ok`
// lets in (the last is the goal); null when none can be reached so.
function shortestWay(from: ZoneId, goals: readonly ZoneId[], ok: (zone: ZoneId) => boolean): ZoneId[] | null {
  const cameFrom = new Map<ZoneId, ZoneId>([[from, from]]);
  const queue: ZoneId[] = [from];
  while (queue.length > 0) {
    const zone = queue.shift()!;
    if (zone !== from && goals.includes(zone)) {
      const way = [zone];
      while (cameFrom.get(way[0]) !== from) way.unshift(cameFrom.get(way[0])!);
      return way;
    }
    for (const { to } of ZONES[zone].portals) {
      if (cameFrom.has(to) || !ok(to)) continue;
      cameFrom.set(to, zone);
      queue.push(to);
    }
  }
  return null;
}

export function questWay(from: ZoneId, goals: readonly ZoneId[], entry: (zone: ZoneId) => Entry): QuestWay {
  if (goals.includes(from)) return { kind: "here" };
  const open = shortestWay(from, goals, (zone) => entry(zone) === "open");
  if (open) return { kind: "go", next: open[0], goal: open[open.length - 1] };
  // Shut out: name the first shut zone on the shortest way regardless.
  const shut = shortestWay(from, goals, () => true)?.find((zone) => entry(zone) !== "open");
  if (!shut) return { kind: "nowhere" };
  return { kind: "locked", zone: shut, why: "level" };
}
