import {
  GUILD_CHAT_KEEP, GUILD_MAX, MAX_APPLICANTS, MAX_APPLIED, MAX_VICES, canAnswer, canKick, canLead, readGuild, roleOf,
  type Guild, type GuildRole,
} from "../../src/game/account/guild";
import type { Character } from "../../src/game/account/characters";
import { RuleViolation } from "../../src/game/world/types";
import type { ChatMessage } from "../../src/game/world/chat";
import { updateCharacter } from "./store";

// One row per guild, and one per line of guild chat. A guild's row is only ever changed under its
// own lock; a character's copy of its guild is changed inside that too (guild lock, then the
// character's profile lock: never the other way round), so the two agree.
export const GUILDS_COLLECTION = "guilds";
export const GUILD_CHAT_COLLECTION = "guildChat";
// Guilds read at most, to list the open ones.
const GUILDS_READ = 200;

export function withGuildLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`guild:${id}`, fn);
}

// Founding is one at a time per name, so two cannot take the same one.
export function withGuildNameLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`guildname:${key}`, fn);
}

export async function readGuildById(id: string): Promise<Guild | null> {
  return readGuild(await $global.getCollectionItem(GUILDS_COLLECTION, id).catch(() => null));
}

export async function findGuildByKey(key: string): Promise<Guild | null> {
  const [row] = await $global.getCollectionItems(GUILDS_COLLECTION, { filters: [{ field: "key", operator: "==", value: key }], limit: 1 });
  return readGuild(row ?? null);
}

// Guilds with room, fewest members first (the ones most likely to take someone), at most `n`.
export async function openGuilds(n: number): Promise<Guild[]> {
  const rows = await $global.getCollectionItems(GUILDS_COLLECTION, { limit: GUILDS_READ });
  return rows
    .map((row: unknown) => readGuild(row))
    .filter((g: Guild | null): g is Guild => g !== null && g.members.length < GUILD_MAX)
    .sort((a: Guild, b: Guild) => a.members.length - b.members.length || b.made - a.made)
    .slice(0, n);
}

export async function writeGuild(guild: Guild): Promise<void> {
  const { id, ...row } = guild;
  await $global.updateCollectionItem(GUILDS_COLLECTION, { __id: id, ...row });
}

export async function addGuild(guild: Omit<Guild, "id">): Promise<string> {
  return ((await $global.addCollectionItem(GUILDS_COLLECTION, guild)) as { __id: string }).__id;
}

// The character's guild as the guild's row has it: its copy may be stale (put out while away, the
// guild gone), in which case it is cleared.
export async function guildOf(account: string, character: Character): Promise<Guild | null> {
  if (!character.guild) return null;
  const guild = await readGuildById(character.guild.id);
  if (guild && roleOf(guild, character.id)) return guild;
  await updateCharacter(account, character.id, (c) => (c.guild?.id === character.guild!.id ? { ...c, guild: null } : c));
  return null;
}

// The caller's guild and role, or no_guild.
export async function myGuild(account: string, character: Character): Promise<{ guild: Guild; role: GuildRole }> {
  const guild = await guildOf(account, character);
  const role = guild ? roleOf(guild, character.id) : null;
  if (!guild || !role) throw new RuleViolation("no_guild");
  return { guild, role };
}

// Applying: the guild keeps the application, the character a note of where it applied. Call with
// the character already checked (no guild, not waiting).
export async function apply(guildId: string, account: string, character: Character, now: number): Promise<void> {
  if (character.applied.includes(guildId)) return;
  if (character.applied.length >= MAX_APPLIED) throw new RuleViolation("applied_limit");
  await withGuildLock(guildId, async () => {
    const guild = await readGuildById(guildId);
    if (!guild) throw new RuleViolation("no_guild");
    if (guild.members.length >= GUILD_MAX) throw new RuleViolation("guild_full");
    if (!guild.applicants.some((a) => a.characterId === character.id)) {
      if (guild.applicants.length >= MAX_APPLICANTS) throw new RuleViolation("applicants_full");
      await writeGuild({ ...guild, applicants: [...guild.applicants, { characterId: character.id, account, name: character.name, at: now }] });
    }
    await updateCharacter(account, character.id, (c) => ({ ...c, applied: [...c.applied.filter((id) => id !== guildId), guildId] }));
  });
}

// Takes a character's application back from one guild (quietly, if it is not there).
export async function withdraw(guildId: string, account: string, characterId: string): Promise<void> {
  await withGuildLock(guildId, async () => {
    const guild = await readGuildById(guildId);
    if (guild && guild.applicants.some((a) => a.characterId === characterId)) {
      await writeGuild({ ...guild, applicants: guild.applicants.filter((a) => a.characterId !== characterId) });
    }
    await updateCharacter(account, characterId, (c) => ({ ...c, applied: c.applied.filter((id) => id !== guildId) }));
  });
}

// Answers an application. Accepted, the character joins, unless it has joined another guild
// meanwhile (then the application just goes, no_applicant).
export async function answer(guildId: string, actorId: string, applicantId: string, accept: boolean, now: number): Promise<void> {
  const joined = await withGuildLock(guildId, async () => {
    const guild = await readGuildById(guildId);
    if (!guild) throw new RuleViolation("no_guild");
    if (!canAnswer(roleOf(guild, actorId))) throw new RuleViolation("not_allowed");
    const applicant = guild.applicants.find((a) => a.characterId === applicantId);
    if (!applicant) throw new RuleViolation("no_applicant");
    const rest = guild.applicants.filter((a) => a.characterId !== applicantId);
    if (!accept) {
      await writeGuild({ ...guild, applicants: rest });
      await updateCharacter(applicant.account, applicantId, (c) => ({ ...c, applied: c.applied.filter((id) => id !== guildId) }));
      return null;
    }
    if (guild.members.length >= GUILD_MAX) throw new RuleViolation("guild_full");
    let took = false;
    const character = await updateCharacter(applicant.account, applicantId, (c) => {
      if (c.guild) return c;
      took = true;
      return { ...c, guild: { id: guild.id, name: guild.name }, applied: c.applied.filter((id) => id !== guildId) };
    });
    if (!character || !took) {
      await writeGuild({ ...guild, applicants: rest });
      throw new RuleViolation("no_applicant");
    }
    await writeGuild({
      ...guild, applicants: rest,
      members: [...guild.members, { characterId: applicantId, account: applicant.account, name: character.name, role: "member", joined: now }],
    });
    return { account: applicant.account, others: character.applied };
  });
  // Its other applications go now that it has a guild.
  if (joined) for (const other of joined.others) await withdraw(other, joined.account, applicantId);
}

// Takes a member out of the guild: leaving, or put out by `actorId`. The character waits before
// joining again.
export async function remove(guildId: string, actorId: string | null, targetId: string, now: number): Promise<void> {
  await withGuildLock(guildId, async () => {
    const guild = await readGuildById(guildId);
    if (!guild) throw new RuleViolation("no_guild");
    const target = guild.members.find((m) => m.characterId === targetId);
    if (!target) throw new RuleViolation("no_guild");
    if (actorId === null) {
      if (target.role === "master") throw new RuleViolation("master_must_pass");
    } else if (!canKick(roleOf(guild, actorId), target.role)) throw new RuleViolation("not_allowed");
    await writeGuild({ ...guild, members: guild.members.filter((m) => m.characterId !== targetId) });
    await updateCharacter(target.account, targetId, (c) => (c.guild?.id === guildId ? { ...c, guild: null, guildLeftAt: now } : c));
  });
}

// The master makes a member a vice or a vice a member.
export async function setRole(guildId: string, actorId: string, targetId: string, role: "vice" | "member"): Promise<void> {
  await withGuildLock(guildId, async () => {
    const guild = await readGuildById(guildId);
    if (!guild) throw new RuleViolation("no_guild");
    if (!canLead(roleOf(guild, actorId))) throw new RuleViolation("not_allowed");
    const target = guild.members.find((m) => m.characterId === targetId);
    if (!target || target.role === "master") throw new RuleViolation("not_allowed");
    if (role === "vice" && target.role !== "vice" && guild.members.filter((m) => m.role === "vice").length >= MAX_VICES) {
      throw new RuleViolation("vice_limit");
    }
    await writeGuild({ ...guild, members: guild.members.map((m) => (m.characterId === targetId ? { ...m, role } : m)) });
  });
}

// The master hands the guild to another member and becomes a plain member.
export async function passMaster(guildId: string, actorId: string, targetId: string): Promise<void> {
  await withGuildLock(guildId, async () => {
    const guild = await readGuildById(guildId);
    if (!guild) throw new RuleViolation("no_guild");
    if (!canLead(roleOf(guild, actorId)) || actorId === targetId || !roleOf(guild, targetId)) throw new RuleViolation("not_allowed");
    await writeGuild({
      ...guild,
      members: guild.members.map((m) => (m.characterId === targetId ? { ...m, role: "master" } : m.characterId === actorId ? { ...m, role: "member" } : m)),
    });
  });
}

export async function setNotice(guildId: string, actorId: string, notice: string): Promise<void> {
  await withGuildLock(guildId, async () => {
    const guild = await readGuildById(guildId);
    if (!guild) throw new RuleViolation("no_guild");
    if (!canAnswer(roleOf(guild, actorId))) throw new RuleViolation("not_allowed");
    await writeGuild({ ...guild, notice });
  });
}

// The master, alone in it, ends the guild: its row, its chat and its waiting applications go.
export async function disband(guildId: string, account: string, actorId: string, now: number): Promise<void> {
  await withGuildLock(guildId, async () => {
    const guild = await readGuildById(guildId);
    if (!guild) throw new RuleViolation("no_guild");
    if (!canLead(roleOf(guild, actorId))) throw new RuleViolation("not_allowed");
    if (guild.members.length > 1) throw new RuleViolation("guild_not_empty");
    await $global.deleteCollectionItem(GUILDS_COLLECTION, guildId);
    await updateCharacter(account, actorId, (c) => ({ ...c, guild: null, guildLeftAt: now }));
    for (const applicant of guild.applicants) {
      await updateCharacter(applicant.account, applicant.characterId, (c) => ({ ...c, applied: c.applied.filter((id) => id !== guildId) }));
    }
    for (const line of await chatRows(guildId)) await $global.deleteCollectionItem(GUILD_CHAT_COLLECTION, line.__id as string);
  });
}

async function chatRows(guildId: string): Promise<Record<string, unknown>[]> {
  return (await $global.getCollectionItems(GUILD_CHAT_COLLECTION, {
    filters: [{ field: "guild", operator: "==", value: guildId }],
    limit: GUILD_CHAT_KEEP * 3,
  })) as Record<string, unknown>[];
}

// A guild's lines, oldest first, those after `since` (ms).
export async function guildLines(guildId: string, since: number): Promise<ChatMessage[]> {
  return (await chatRows(guildId))
    .map((r) => ({ account: String(r.account), name: String(r.name), text: String(r.text), at: Number(r.at) }))
    .filter((l) => l.at > since)
    .sort((a, b) => a.at - b.at)
    .slice(-GUILD_CHAT_KEEP);
}

// Says a line in the guild, and lets the oldest go past GUILD_CHAT_KEEP.
export async function sayInGuild(guildId: string, line: ChatMessage): Promise<void> {
  await $global.addCollectionItem(GUILD_CHAT_COLLECTION, { guild: guildId, ...line });
  const rows = await chatRows(guildId);
  if (rows.length <= GUILD_CHAT_KEEP) return;
  const oldest = [...rows].sort((a, b) => Number(a.at) - Number(b.at)).slice(0, rows.length - GUILD_CHAT_KEEP);
  for (const row of oldest) await $global.deleteCollectionItem(GUILD_CHAT_COLLECTION, row.__id as string).catch(() => undefined);
}
