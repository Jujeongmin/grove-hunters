import { readChat } from "../world/chat";
import { RuleViolation } from "../world/types";
import { parseNickname } from "./nickname";

// Guilds, shared by every server: characters join them (each character its own), under a master,
// up to MAX_VICES vices and the members. The rules here are what the server holds everyone to and
// what the guild screen shows as possible.

export const GUILD_COST = 10_000;
export const GUILD_MAX = 30;
export const MAX_VICES = 3;
// Applications waiting on one guild, and guilds one character may have applied to at once.
export const MAX_APPLICANTS = 20;
export const MAX_APPLIED = 3;
// After leaving or being put out, a character waits this long before joining or founding another.
export const REJOIN_MS = 24 * 60 * 60 * 1000;
export const NOTICE_MAX = 60;
// Guild chat keeps this many lines per guild.
export const GUILD_CHAT_KEEP = 50;

export type GuildRole = "master" | "vice" | "member";

export interface GuildMember { characterId: string; account: string; name: string; role: GuildRole; joined: number }
export interface Applicant { characterId: string; account: string; name: string; at: number }

export interface Guild {
  // The row's id in the guilds collection.
  id: string;
  name: string;
  // The name ignoring case, so no two guilds share one.
  key: string;
  members: GuildMember[];
  applicants: Applicant[];
  notice: string;
  made: number;
}

// What a character keeps of its guild: a copy of the guild row's say (the row is what counts).
export interface GuildTag { id: string; name: string }

const ROLES: readonly GuildRole[] = ["master", "vice", "member"];

// A guild's name: the same letters and length as a character's name.
export function parseGuildName(raw: unknown): { name: string; key: string } {
  try {
    return parseNickname(raw);
  } catch {
    throw new RuleViolation("guild_name_invalid");
  }
}

// A guild's notice: one tidied line, NOTICE_MAX characters at most (empty clears it).
export function readNotice(raw: unknown): string | null {
  if (raw === "") return "";
  const text = readChat(raw);
  return text !== null && [...text].length <= NOTICE_MAX ? text : null;
}

export function readGuildTag(raw: unknown): GuildTag | null {
  const g = raw as Partial<GuildTag> | null;
  return g && typeof g.id === "string" && typeof g.name === "string" ? { id: g.id, name: g.name } : null;
}

function readPeople<T extends { characterId: string; account: string; name: string }>(raw: unknown, extra: (r: Record<string, unknown>) => Omit<T, "characterId" | "account" | "name"> | null): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const entry of raw) {
    const r = entry as Record<string, unknown> | null;
    if (!r || typeof r.characterId !== "string" || typeof r.account !== "string" || typeof r.name !== "string") continue;
    const more = extra(r);
    if (more && !out.some((p) => p.characterId === r.characterId)) out.push({ characterId: r.characterId, account: r.account, name: r.name, ...more } as T);
  }
  return out;
}

// A row of the guilds collection; null for anything that does not read back whole (no master).
export function readGuild(row: unknown): Guild | null {
  const r = row as Record<string, unknown> | null;
  if (!r || typeof r.__id !== "string" || typeof r.name !== "string" || typeof r.key !== "string") return null;
  const members = readPeople<GuildMember>(r.members, (m) => (ROLES.includes(m.role as GuildRole)
    ? { role: m.role as GuildRole, joined: typeof m.joined === "number" ? m.joined : 0 } : null));
  if (members.filter((m) => m.role === "master").length !== 1) return null;
  const applicants = readPeople<Applicant>(r.applicants, (a) => ({ at: typeof a.at === "number" ? a.at : 0 }));
  return {
    id: r.__id, name: r.name, key: r.key, members, applicants,
    notice: typeof r.notice === "string" ? r.notice : "", made: typeof r.made === "number" ? r.made : 0,
  };
}

export function roleOf(guild: Pick<Guild, "members">, characterId: string): GuildRole | null {
  return guild.members.find((m) => m.characterId === characterId)?.role ?? null;
}

// Who may do what. A master does everything; a vice answers applications, writes the notice and puts
// out plain members; roles and the guild itself are the master's alone.
export function canAnswer(role: GuildRole | null): boolean {
  return role === "master" || role === "vice";
}

export function canWriteNotice(role: GuildRole | null): boolean {
  return canAnswer(role);
}

export function canKick(actor: GuildRole | null, target: GuildRole | null): boolean {
  if (!actor || !target || target === "master") return false;
  return actor === "master" || (actor === "vice" && target === "member");
}

export function canLead(role: GuildRole | null): boolean {
  return role === "master";
}

// Whether a character that left a guild at `leftAt` may join or found one at `now`.
export function mayJoin(leftAt: number, now: number): boolean {
  return now - leftAt >= REJOIN_MS;
}

// The master first, then vices, then members, each in the order they joined.
export function rankedMembers(members: readonly GuildMember[]): GuildMember[] {
  return [...members].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.joined - b.joined);
}

// A member as the guild screen shows them: where they are when online.
export interface GuildMemberView {
  characterId: string;
  name: string;
  role: GuildRole;
  level: number;
  playerClass: string | null;
  job: string | null;
  online: boolean;
  where: { world: string; zone: string; channel: number } | null;
}

// The guild screen: your guild (applications only for those who answer them), your role, the guilds
// you have applied to, and when you may join one again.
export interface GuildView {
  guild: { id: string; name: string; notice: string; made: number; members: GuildMemberView[]; applicants: Applicant[] } | null;
  role: GuildRole | null;
  applied: { id: string; name: string }[];
  waitUntil: number;
}

// A guild in the list of guilds to join.
export interface GuildListing { id: string; name: string; members: number; notice: string }
