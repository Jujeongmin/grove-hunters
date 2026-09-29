// How a character is as it comes into a room: its health, whether it has fallen, when it was last hit
// (healing waits on that), and when its attack and skills are ready again (server times). Carried
// from room to room, so a portal, a channel or a reload heals nothing; only the village's respawn
// (and a new level) makes it whole.
export interface Vitals {
  hp: number;
  dead: boolean;
  hitAt: number;
  strikeReadyAt: number;
  skillReady: Record<string, number>;
}

const time = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

// From a room's user state or a saved character; null when there is no health to read.
export function readVitals(raw: unknown): Vitals | null {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!r || typeof r.hp !== "number" || !Number.isFinite(r.hp)) return null;
  const skills = r.skillReady && typeof r.skillReady === "object" ? (r.skillReady as Record<string, unknown>) : {};
  const skillReady: Record<string, number> = {};
  for (const [slot, at] of Object.entries(skills)) if (typeof at === "number" && Number.isFinite(at)) skillReady[slot] = at;
  return { hp: r.hp, dead: r.dead === true, hitAt: time(r.hitAt), strikeReadyAt: time(r.strikeReadyAt), skillReady };
}

// What a character comes into a room with: what it carried out of the last one (a portal, a channel,
// a lost connection), else what this room already holds of it (back after a reload, or a second
// arrive), else whole.
export function arrivalVitals(carried: Vitals | null, inRoom: unknown, maxHp: number): Vitals {
  const v = carried ?? readVitals(inRoom);
  if (!v) return { hp: maxHp, dead: false, hitAt: 0, strikeReadyAt: 0, skillReady: {} };
  return { ...v, hp: v.dead ? 0 : Math.max(1, Math.min(maxHp, v.hp)) };
}
