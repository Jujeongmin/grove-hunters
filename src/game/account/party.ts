import type { PlayerClass } from "../combat/classes";
import type { JobId } from "../combat/jobs";
import type { Whereabouts } from "../world/zones";

// Parties (see docs/superpowers/specs/2026-10-02-party-design.md): two to PARTY_MAX players of one
// server who share what they fell while in the same room. Everything live stays inside a room; only
// the roster, which seldom changes, is kept between rooms.

export const PARTY_MAX = 4;
// Each member beyond the first who shares a kill adds this much to what the kill pays in all.
export const PARTY_BONUS = 0.1;
// An invitation holds this long.
export const INVITE_MS = 60_000;
// The screen asks for the party this often.
export const PARTY_POLL_MS = 10_000;
// A member away this long is let go when the party is next read.
export const PARTY_OFFLINE_MS = 10 * 60_000;

export interface PartyMember { account: string; characterId: string; name: string }

export interface Party {
  id: string;
  world: string;
  // The leader's account.
  leader: string;
  members: PartyMember[];
  made: number;
}

export interface PartyInvite {
  id: string;
  // The accounts invited and inviting, and the name the inviter plays under.
  to: string;
  from: string;
  fromName: string;
  // The inviter's party, or null: the party is made when the invitation is taken.
  party: string | null;
  world: string;
  at: number;
}

const text = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export function readParty(row: unknown): Party | null {
  const r = row as Record<string, unknown> | null;
  if (!r || !text(r.__id) || !text(r.world) || !text(r.leader) || !Array.isArray(r.members)) return null;
  const members: PartyMember[] = [];
  for (const m of r.members as Record<string, unknown>[]) {
    if (m && text(m.account) && text(m.characterId) && typeof m.name === "string" && !members.some((x) => x.account === m.account)) {
      members.push({ account: m.account, characterId: m.characterId, name: m.name });
    }
  }
  if (members.length === 0) return null;
  const leader = members.some((m) => m.account === r.leader) ? r.leader : members[0].account;
  return { id: r.__id, world: r.world, leader, members: members.slice(0, PARTY_MAX), made: typeof r.made === "number" ? r.made : 0 };
}

export function readInvite(row: unknown): PartyInvite | null {
  const r = row as Record<string, unknown> | null;
  if (!r || !text(r.__id) || !text(r.to) || !text(r.from) || !text(r.world) || typeof r.at !== "number") return null;
  return {
    id: r.__id, to: r.to, from: r.from, fromName: typeof r.fromName === "string" ? r.fromName : "", party: text(r.party) ? r.party : null,
    world: r.world, at: r.at,
  };
}

export function inviteLive(invite: Pick<PartyInvite, "at">, now: number): boolean {
  return now - invite.at < INVITE_MS;
}

// What each of `n` members sharing a kill gets, as a share of what it pays one hunter alone.
export function shareOf(n: number): number {
  const k = Math.max(1, Math.floor(n));
  return (1 + PARTY_BONUS * (k - 1)) / k;
}

// The party after `account` leaves it: the next member leads if the leader went, and with one left
// there is no party (null).
export function without(party: Party, account: string): Party | null {
  const members = party.members.filter((m) => m.account !== account);
  if (members.length < 2) return null;
  return { ...party, members, leader: party.leader === account ? members[0].account : party.leader };
}

// One member as the screen shows them.
export interface PartyMemberView {
  account: string;
  name: string;
  playerClass: PlayerClass | null;
  job: JobId | null;
  level: number;
  online: boolean;
  where: Whereabouts | null;
}

export interface PartyView { id: string; leader: string; members: PartyMemberView[] }

export interface PartyState {
  party: PartyView | null;
  invites: { id: string; fromName: string; at: number }[];
}

// Someone on your channel you could invite.
export interface PartyCandidate { account: string; name: string; level: number; playerClass: PlayerClass | null }
