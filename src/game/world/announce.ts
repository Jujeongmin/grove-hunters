// Announcements to every server: the big moments (a legendary mount, a mount at ★5, gear enhanced to
// +8 and past, a guild boss slain), told at the top of everyone's screen and in their chat. The
// server writes one where it happens; clients ask for the new ones every ANNOUNCE_POLL_MS.

export type AnnounceKind = "mount_legendary" | "mount_mythic" | "mount_star5" | "enhance" | "guild_boss" | "vip" | "power_top" | "guild_week";

export interface Announcement {
  id: string;
  kind: AnnounceKind;
  at: number;
  // The holes in its words: a character's name and server, a mount, an item and its +, a guild and
  // its boss.
  params: Record<string, string | number>;
}

// Kept this many (the oldest go).
export const ANNOUNCE_KEEP = 20;
export const ANNOUNCE_POLL_MS = 30_000;
// Enhancing to this + or past it is told to everyone.
export const ANNOUNCE_PLUS = 8;
// How long each shows at the top of the screen.
export const ANNOUNCE_SHOW_MS = 6_000;

const KINDS: readonly AnnounceKind[] = ["mount_legendary", "mount_mythic", "mount_star5", "enhance", "guild_boss", "vip", "power_top", "guild_week"];

export function readAnnouncement(row: unknown): Announcement | null {
  const r = row as Record<string, unknown> | null;
  if (!r || typeof r.__id !== "string" || !KINDS.includes(r.kind as AnnounceKind) || typeof r.at !== "number") return null;
  const params: Record<string, string | number> = {};
  if (r.params && typeof r.params === "object") {
    for (const [k, v] of Object.entries(r.params as Record<string, unknown>)) if (typeof v === "string" || typeof v === "number") params[k] = v;
  }
  return { id: r.__id, kind: r.kind as AnnounceKind, at: r.at, params };
}
