import {
  PARTY_MAX, PARTY_OFFLINE_MS, inviteLive, readInvite, readParty, without, type Party, type PartyCandidate, type PartyState,
} from "../../src/game/account/party";
import type { Character } from "../../src/game/account/characters";
import { isOnline } from "../../src/game/account/friends";
import { levelOf } from "../../src/game/account/level";
import { CHANNEL_CAPACITY, readWhereabouts } from "../../src/game/world/zones";
import { RuleViolation } from "../../src/game/world/types";
import { channelPlayers, markSeen, readProfile } from "./store";

// One row per party and one per invitation (see party.ts). A party's row changes only under its own
// lock; joining or making one also holds the joiner's lock, so no account ends up in two.
export const PARTIES_COLLECTION = "parties";
export const INVITES_COLLECTION = "partyInvites";
// Invitations read at most for one account.
const INVITES_READ = 20;

function withPartyLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`party:${id}`, fn);
}

function withMemberLock<T>(account: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`partyof:${account}`, fn);
}

async function readPartyById(id: string): Promise<Party | null> {
  return readParty(await $global.getCollectionItem(PARTIES_COLLECTION, id).catch(() => null));
}

async function writeParty(party: Party): Promise<void> {
  const { id, ...row } = party;
  await $global.updateCollectionItem(PARTIES_COLLECTION, { __id: id, ...row });
}

// The party id kept on the account (it may be stale: the party gone, or the account let go).
export async function partyIdOf(account: string): Promise<string | null> {
  const id = (await $global.getUserState(account)).party;
  return typeof id === "string" && id.length > 0 ? id : null;
}

async function setPartyOf(account: string, id: string | null): Promise<void> {
  await $global.updateUserState(account, { party: id });
}

// The party after a change under its lock: written back, or (one member left) taken down with every
// remaining member let go.
async function settle(before: Party, after: Party | null): Promise<void> {
  if (after) {
    await writeParty(after);
    return;
  }
  await $global.deleteCollectionItem(PARTIES_COLLECTION, before.id).catch(() => undefined);
  for (const m of before.members) if ((await partyIdOf(m.account)) === before.id) await setPartyOf(m.account, null);
}

// Takes `account` out of its party, if it is in one.
async function leave(account: string, id: string): Promise<void> {
  await withPartyLock(id, async () => {
    const party = await readPartyById(id);
    if (party && party.members.some((m) => m.account === account)) await settle(party, without(party, account));
  });
  if ((await partyIdOf(account)) === id) await setPartyOf(account, null);
}

// The account's party, as its row has it, with the character it plays now: none when the row is gone
// or no longer has it with this character (the note on the account is cleared then).
async function currentParty(account: string, character: Character): Promise<Party | null> {
  const id = await partyIdOf(account);
  if (!id) return null;
  const party = await readPartyById(id);
  const me = party?.members.find((m) => m.account === account);
  if (party && me?.characterId === character.id) return party;
  await leave(account, id);
  return null;
}

// Members who play another character now, or have been away too long, go.
async function pruned(party: Party, now: number): Promise<Party | null> {
  const gone: string[] = [];
  for (const m of party.members) {
    const state = await $global.getUserState(m.account);
    const { active } = await readProfile(m.account);
    const seen = typeof state.lastSeenAt === "number" ? state.lastSeenAt : 0;
    if (active?.id !== m.characterId || now - seen > PARTY_OFFLINE_MS) gone.push(m.account);
  }
  if (gone.length === 0) return party;
  return withPartyLock(party.id, async () => {
    let next = await readPartyById(party.id);
    if (!next) return null;
    const before = next;
    for (const account of gone) next = next ? without(next, account) : null;
    await settle(before, next);
    for (const account of gone) if ((await partyIdOf(account)) === party.id) await setPartyOf(account, null);
    return next;
  });
}

// What the screen polls: your party (members with level, class and where they are) and the
// invitations waiting for you. Marks you as about.
export async function partyStateOf(account: string, character: Character, now: number): Promise<PartyState & { partyId: string | null }> {
  await markSeen(account, now);
  const found = await currentParty(account, character);
  const party = found ? await pruned(found, now) : null;
  const members = party ? await Promise.all(party.members.map(async (m) => {
    const state = await $global.getUserState(m.account);
    const { characters } = await readProfile(m.account);
    const c = characters.find((x) => x.id === m.characterId);
    const online = isOnline(state.lastSeenAt, now);
    return {
      account: m.account, name: c?.name ?? m.name, playerClass: c?.playerClass ?? null, job: c?.job ?? null,
      level: c ? levelOf(c.xp).level : 1, online, where: online ? readWhereabouts(state.where) : null,
    };
  })) : [];
  const invites = [];
  const rows = await $global.getCollectionItems(INVITES_COLLECTION, {
    filters: [{ field: "to", operator: "==", value: account }], limit: INVITES_READ,
  });
  for (const row of rows) {
    const invite = readInvite(row);
    if (!invite || !inviteLive(invite, now) || invite.world !== character.world) {
      await $global.deleteCollectionItem(INVITES_COLLECTION, (row as { __id: string }).__id).catch(() => undefined);
    } else invites.push({ id: invite.id, fromName: invite.fromName, at: invite.at });
  }
  return { party: party ? { id: party.id, leader: party.leader, members } : null, invites, partyId: party?.id ?? null };
}

// Whoever plays on your channel of your server and is in no party: the ones you might invite.
export async function candidatesOf(account: string, world: string, channel: number): Promise<PartyCandidate[]> {
  const out: PartyCandidate[] = [];
  for (const other of await channelPlayers(world, channel)) {
    if (other === account || out.some((c) => c.account === other) || (await partyIdOf(other))) continue;
    const { active } = await readProfile(other);
    if (!active || active.world !== world) continue;
    out.push({ account: other, name: active.name, level: levelOf(active.xp).level, playerClass: active.playerClass });
  }
  return out;
}

// An invitation from you to `target`: you lead your party (or have none) and it has room; they play on
// your server now and are in no party. A second one to the same person only renews the first.
export async function invite(account: string, character: Character, target: string, now: number): Promise<void> {
  if (target === account) throw new RuleViolation("unavailable");
  await markSeen(account, now);
  const party = await currentParty(account, character);
  if (party && party.leader !== account) throw new RuleViolation("not_allowed");
  if (party && party.members.length >= PARTY_MAX) throw new RuleViolation("party_full");
  const { active } = await readProfile(target);
  const state = await $global.getUserState(target);
  // In the world on this server (whereabouts are cleared on going back to the menu).
  if (!active || active.world !== character.world || readWhereabouts(state.where)?.world !== character.world) throw new RuleViolation("unavailable");
  if (await partyIdOf(target)) throw new RuleViolation("in_party");
  const rows = await $global.getCollectionItems(INVITES_COLLECTION, {
    filters: [{ field: "to", operator: "==", value: target }], limit: INVITES_READ,
  });
  const mine = rows.map(readInvite).find((i: ReturnType<typeof readInvite>) => i?.from === account);
  const row = { to: target, from: account, fromName: character.name, party: party?.id ?? null, world: character.world, at: now };
  if (mine) await $global.updateCollectionItem(INVITES_COLLECTION, { __id: mine.id, ...row });
  else await $global.addCollectionItem(INVITES_COLLECTION, row);
}

// Taking (or turning down) an invitation. Taken, you join the inviter's party, or make one with them,
// and are told the leader's channel when it is not yours (the screen moves you there); a full channel
// there refuses it before anything changes.
export async function answer(
  account: string, character: Character, inviteId: string, accept: boolean, myChannel: number | null, now: number,
): Promise<{ partyId: string | null; channel: number | null }> {
  const invite = readInvite(await $global.getCollectionItem(INVITES_COLLECTION, inviteId).catch(() => null));
  if (!invite || invite.to !== account) throw new RuleViolation("no_invite");
  await $global.deleteCollectionItem(INVITES_COLLECTION, invite.id).catch(() => undefined);
  if (!accept) return { partyId: null, channel: null };
  await markSeen(account, now);
  if (!inviteLive(invite, now) || invite.world !== character.world) throw new RuleViolation("no_invite");
  return withMemberLock(account, async () => {
    if (await currentParty(account, character)) throw new RuleViolation("in_party");
    // Where the leader plays: the channel you will be moved to.
    const leaderState = await $global.getUserState(invite.from);
    const where = readWhereabouts(leaderState.where);
    if (!where || where.world !== character.world) throw new RuleViolation("no_invite");
    const channel = where.channel !== myChannel ? where.channel : null;
    if (channel !== null) {
      const players = await channelPlayers(character.world, channel);
      if (!players.includes(account) && players.length >= CHANNEL_CAPACITY) throw new RuleViolation("channel_full");
    }
    const me = { account, characterId: character.id, name: character.name };
    const join = async (id: string): Promise<string> => withPartyLock(id, async () => {
      const party = await readPartyById(id);
      if (!party || party.leader !== invite.from) throw new RuleViolation("no_invite");
      if (party.members.length >= PARTY_MAX) throw new RuleViolation("party_full");
      await writeParty({ ...party, members: [...party.members, me] });
      return id;
    });
    const leaderParty = await partyIdOf(invite.from);
    let id: string;
    if (leaderParty) id = await join(leaderParty);
    else {
      // The inviter had no party: one is made of the two, the inviter leading.
      id = await withMemberLock(invite.from, async () => {
        if (await partyIdOf(invite.from)) throw new RuleViolation("no_invite");
        const { active } = await readProfile(invite.from);
        if (!active || active.world !== character.world) throw new RuleViolation("no_invite");
        const row = {
          world: character.world, leader: invite.from, made: now,
          members: [{ account: invite.from, characterId: active.id, name: active.name }, me],
        };
        const made = ((await $global.addCollectionItem(PARTIES_COLLECTION, row)) as { __id: string }).__id;
        await setPartyOf(invite.from, made);
        return made;
      });
    }
    await setPartyOf(account, id);
    return { partyId: id, channel };
  });
}

export async function leaveParty(account: string, character: Character): Promise<void> {
  const party = await currentParty(account, character);
  if (!party) throw new RuleViolation("no_party");
  await leave(account, party.id);
}

// The leader's: letting a member go, or handing the lead to one.
export async function kick(account: string, character: Character, target: string): Promise<void> {
  const party = await currentParty(account, character);
  if (!party) throw new RuleViolation("no_party");
  await withPartyLock(party.id, async () => {
    const now = await readPartyById(party.id);
    if (!now || now.leader !== account || target === account) throw new RuleViolation("not_allowed");
    if (!now.members.some((m) => m.account === target)) throw new RuleViolation("unavailable");
    await settle(now, without(now, target));
  });
  if ((await partyIdOf(target)) === party.id) await setPartyOf(target, null);
}

export async function passLead(account: string, character: Character, target: string): Promise<void> {
  const party = await currentParty(account, character);
  if (!party) throw new RuleViolation("no_party");
  await withPartyLock(party.id, async () => {
    const now = await readPartyById(party.id);
    if (!now || now.leader !== account) throw new RuleViolation("not_allowed");
    if (!now.members.some((m) => m.account === target)) throw new RuleViolation("unavailable");
    await writeParty({ ...now, leader: target });
  });
}
