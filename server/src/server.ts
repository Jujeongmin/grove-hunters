import {
  acceptFriend, removeFriend, requestFriend, type FriendSide, type FriendsView,
} from "../../src/game/account/friends";
import {
  REVIVE_HP_SHARE, REVIVE_SAFE_MS, deathXpLoss, levelOf, reviveCost,
} from "../../src/game/account/level";
import {
  GOLD, ITEMS, MAX_STACK, POTION_GAP_MS, addItem, readItemId, sellPrice, slotOf, type BagView, type GearPiece, type ItemId, type Slot,
} from "../../src/game/account/items";
import {
  EMPTY_INVENTORY, TRADE_CRAFT_CHANCE, allStacks, countOf, equipPiece, fits, give, loot, putPiece, spend, takePiece, takeStack, unequipSlot,
} from "../../src/game/account/inventory";
import { readControls, type Controls } from "../../src/game/account/controls";
import { NEWS, readNewsId } from "../../src/game/news";
import { mailFits, receiveMail, type Mail } from "../../src/game/account/mail";
import { openMailbox, takeMail } from "./mail";
import {
  ARENA_LEVEL, ARENA_MS, ARENA_ROOMS, ARENA_SEATS, arenaRoomId, currentWeek, readArenaRoom, type LeagueView,
} from "../../src/game/world/guildBoss";
import {
  bossView, enterWeek, findWeek, leagueView, settleLeague, type BossView,
} from "./guildBoss";
import { noteArenaDamage, tickArena } from "./arena";
import { announce, announcementsSince } from "./announce";
import { ANNOUNCE_PLUS, type Announcement } from "../../src/game/world/announce";
import { weekEndsAt } from "../../src/game/world/grove";
import {
  GUILD_COST, REJOIN_MS, canAnswer, mayJoin, parseGuildName, rankedMembers, readNotice,
  type Guild, type GuildListing, type GuildView,
} from "../../src/game/account/guild";
import {
  addGuild, answer, apply, disband, findGuildByKey, guildLines, guildOf, myGuild, openGuilds, passMaster, readGuildById, remove,
  sayInGuild, setNotice, setRole, withGuildNameLock, withdraw,
} from "./guild";
import { isOnline } from "../../src/game/account/friends";
import {
  MAX_LISTINGS, pageOf, readBundle, readFilter, readPrice, shelfOf, type Listing, type ListingView, type Shelf,
} from "../../src/game/account/market";
import {
  addListing, buyListing, cancelListing, countListings, sellerListings, shelfListings, sweepExpired, withSellerLock,
} from "./market";
import { CHAT_WINDOW_MS, chatAllowed, readChat, type ChatMessage } from "../../src/game/world/chat";
import { rankHitters, rollLoot, xpFor, type MonsterType } from "../../src/game/world/monsters";
import {
  QUESTS, QUEST_START, countDaily, countKills, dailyToday, questDone, readDaily, readDailyId,
} from "../../src/game/account/quests";
import { ADVANCE_LEVEL, JOBS, readJob } from "../../src/game/combat/jobs";
import { TALK_RANGE, TALK_SLACK, npcSpot, npcsIn, type NpcRole } from "../../src/game/world/npcs";
import { CHARACTERS_PER_WORLD, GUILDLESS, characterView, type Character } from "../../src/game/account/characters";
import { readPurchaseEvent } from "../../src/game/account/purchase";
import { readClass } from "../../src/game/combat/classes";
import { rankOf, type RankDetail, type RankingView, type RankRow } from "../../src/game/account/ranking";
import { enhanceCost, hasMaterials, readRecipe, rollEnhance, type EnhanceOutcome } from "../../src/game/account/forge";
import { parseNickname, type AccountView } from "../../src/game/account/nickname";
import { readWorld } from "../../src/game/account/worlds";
import { costumeById } from "../../src/game/render/costumes";
import { PROTOCOL_VERSION, RuleViolation, isPose } from "../../src/game/world/types";
import {
  CHANNEL_CAPACITY, MAX_CHANNELS, START_ZONE, ZONES, townOf, arrivalFrom, channelRoomId, portalsOf, readChannel, readChannelRoom,
  readWhereabouts, readZone, zoneLayout, type ZoneEntry, type ZoneId,
} from "../../src/game/world/zones";
import { arrivalVitals, readVitals } from "../../src/game/account/vitals";
import {
  BASE_MOUNT, DUPLICATE_REFUND, MAX_STARS, MOUNTS, MYTHIC_PITY, PITY, PULL10, PULL10_COST, PULL_COST, gemsFor, ownedMounts, readMountId, readPity, readStars,
  rollMounts, tierOf, vipMounts, type MountId, type Pity,
} from "../../src/game/account/mounts";
import {
  channelPlayers, claimName, deleteCharacter, updateCharacter, dropRanking, findNickname, friendChannels, friendEntry, changeGems, readGems, markSeen,
  pickChannel, readAccountWorld, readFriendSide, readNickname, readProfile, readRanking, releaseName,
  returnSpot, saveProfile, saveSpot, token, updateActive, withFriendsLock, withNicknameLock, withProfileLock,
  writeFriendSide, writeRanking, writeWhereabouts, writeZonePose, zoneLook,
} from "./store";
import { accountPremium, grantGemPack, grantPass, isPassProduct, payPassDay, payVipDay, roomOf, vipOfAccount } from "./premium";
import {
  freeRevive, huntBonus, pieceLimit, premiumView, protectCost, readPremium, vipEnhance, vipOf, type PremiumView,
} from "../../src/game/account/premium";
import { hasMonsters, strike, tickRoom, useSkill, withRoomLock, type HitResult } from "./hunt";
import { combatPower, fightStats } from "../../src/game/combat/power";
import type { GroveView } from "../../src/game/world/grove";
import {
  countGroveKills, flushRoom, giveToVillage, markHunter, settleOnArrive, takeFromBag, viewOf, villageOf,
} from "./grove";
import { deathLossFactor, huntXpFactor, potionPriceFactor } from "../../src/game/world/grove";
import {
  TUTORIAL, TUTORIAL_GOLD, TUTORIAL_POTIONS, readTutorial, type TutorialStep,
} from "../../src/game/account/tutorial";

// A new piece of gear's id.
const newUid = () => `g-${token(10)}`;

// How often a walking character's spot is saved to the account (the room keeps the live pose).
const SAVE_SPOT_MS = 5_000;

function requireText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) throw new RuleViolation("unavailable");
  return value;
}

// Loads both accounts' friend lists, applies a rule to them and saves whichever side changed.
async function betweenFriends<T>(other: string, rule: (me: FriendSide, them: FriendSide) => T): Promise<T> {
  const account = $sender.account;
  return withFriendsLock(async () => {
    const me = await readFriendSide(account);
    const them = await readFriendSide(other);
    const before = [JSON.stringify(me.lists), JSON.stringify(them.lists)];
    const value = rule(me, them);
    if (JSON.stringify(me.lists) !== before[0]) await writeFriendSide(me);
    if (JSON.stringify(them.lists) !== before[1]) await writeFriendSide(them);
    return value;
  });
}

// Your account as the menu sees it: your server, your characters there and the one you play.
async function accountView(account: string): Promise<AccountView> {
  const state = await $global.getUserState(account);
  // An account that never picked plays on the first server.
  const world = (await readAccountWorld(account)).id;
  const { characters, active } = await readProfile(account);
  const here = characters.filter((c) => c.world === world);
  const mine = active && active.world === world ? characterView(active) : null;
  return {
    account, world: readWorld(state.world)?.id ?? null,
    characters: here.map(characterView), active: mine,
    nickname: mine?.name ?? null, xp: mine?.xp ?? 0, level: mine?.level ?? levelOf(0),
    playerClass: mine?.playerClass ?? null, costume: mine?.costume ?? null,
  };
}

// The character you play, on the server you picked.
async function playing(account: string): Promise<Character> {
  const world = (await readAccountWorld(account)).id;
  const { active } = await readProfile(account);
  if (!active || active.world !== world) throw new RuleViolation("no_character");
  return active;
}

// Puts your character in `zone` of `channel` and keeps (x, z) as its spot. The client then joins
// the room and calls arrive, which puts you there.
async function enter(account: string, character: Character, zone: ZoneId, x: number, z: number, channel: number): Promise<ZoneEntry> {
  if (levelOf(character.xp).level < ZONES[zone].minLevel) throw new RuleViolation("too_low");
  await saveSpot(account, { zone, x, z });
  await writeWhereabouts(account, { world: character.world, zone, channel });
  return { roomId: channelRoomId(character.world, zone, channel), zone, channel, x, z };
}

// The channel you come into the world on: the one you last played on in this server, or else one
// your friends are on, if it has room; otherwise the first that does.
async function channelToEnter(account: string, character: Character): Promise<number> {
  const last = (await $global.getUserState(account)).lastChannel as { world?: unknown; channel?: unknown } | undefined;
  const lastHere = last?.world === character.world ? readChannel(last.channel) : null;
  const prefer = [...(lastHere ? [lastHere] : []), ...(await friendChannels(account, character.world))];
  return pickChannel(character.world, account, prefer);
}

// What one hunter is paid for a blow or skill: XP, gold, items and the kinds it counts toward its
// quest.
interface Pay {
  xp: number;
  gold: number;
  items: ItemId[];
  felled: MonsterType[];
}

// Your gems, the mounts you own and the one you ride (the first you own if none was picked, or it
// is no longer yours).
interface MountsView {
  gems: number; owned: MountId[]; selected: MountId | null; stars: Partial<Record<MountId, number>>; premium: PremiumView;
  // Draws left until a legendary, and a mythic, is certain (천장).
  pity: Pity;
}
async function mountsView(account: string): Promise<MountsView> {
  const { owned, selected, stars } = await accountMounts(account);
  const since = readPity((await $global.getUserState(account)).pity);
  const pity = { legendary: PITY - since.legendary, mythic: MYTHIC_PITY - since.mythic };
  return { gems: await readGems(account), owned, selected, stars, premium: premiumView(await accountPremium(account), Date.now()), pity };
}

// One draw's outcome: the mount, whether it was owned already, the star it reached (a repeat below
// MAX_STARS), and gems back (a repeat past it).
interface Pull { mount: MountId; repeat: boolean; star: number | null; refund: number }

// `n` draws for `cost` gems, under the account's mount lock: each new mount kept, each repeat a
// star (or past MAX_STARS, gems back), the count toward the pity kept. A new legendary and a ★5 are
// told to everyone; the picked mount growing makes you stronger at once.
async function drawMounts(account: string, n: number, cost: number): Promise<{ view: MountsView; pulls: Pull[] }> {
  const pulls = await $lock(`mounts:${account}`, async () => {
    await changeGems(account, -cost);
    const state = await $global.getUserState(account);
    const rolled = rollMounts(n, readPity(state.pity), Math.random);
    const owned = ownedMounts(state.mounts);
    const stars = readStars(state.mountStars);
    const out: Pull[] = [];
    let refund = 0;
    for (const mount of rolled.mounts) {
      if (!owned.includes(mount)) {
        owned.push(mount);
        out.push({ mount, repeat: false, star: null, refund: 0 });
      } else if ((stars[mount] ?? 0) < MAX_STARS) {
        stars[mount] = (stars[mount] ?? 0) + 1;
        out.push({ mount, repeat: true, star: stars[mount]!, refund: 0 });
      } else {
        refund += DUPLICATE_REFUND;
        out.push({ mount, repeat: true, star: null, refund: DUPLICATE_REFUND });
      }
    }
    await $global.updateUserState(account, { mounts: owned.filter((id) => id !== BASE_MOUNT), mountStars: stars, pity: rolled.since });
    if (refund > 0) await changeGems(account, refund);
    return out;
  });
  const now = Date.now();
  for (const p of pulls) {
    const tier = tierOf(p.mount);
    if (!p.repeat && (tier === "legendary" || tier === "mythic")) {
      await announce(tier === "mythic" ? "mount_mythic" : "mount_legendary", { ...(await announcedAs(account)), mount: p.mount }, now);
    }
    if (p.star === MAX_STARS) await announce("mount_star5", { ...(await announcedAs(account)), mount: p.mount }, now);
  }
  const view = await mountsView(account);
  // A first mount is picked on its own, and a star on the picked one makes you stronger.
  if (pulls.some((p) => !p.repeat || (p.star !== null && view.selected === p.mount))) await refreshMounted(account);
  return { view, pulls };
}

async function accountMounts(account: string): Promise<{ owned: MountId[]; selected: MountId | null; stars: Partial<Record<MountId, number>>; vip: number }> {
  const state = await $global.getUserState(account);
  const vip = vipOf(readPremium(state).vipPoints);
  // VIP rank's own mounts come with the rank.
  const owned = [...new Set([...ownedMounts(state.mounts), ...vipMounts(vip)])];
  const picked = readMountId(state.mount);
  return { owned, selected: picked && owned.includes(picked) ? picked : owned[0] ?? null, stars: readStars(state.mountStars), vip };
}

// A character with its account's picked mount and its stars, which add to its every fight (see mounts.ts).
async function mounted<C extends Character>(account: string, character: C): Promise<C & { mount: MountId | null; mountStars: number; vip: number }> {
  const { selected, stars, vip } = await accountMounts(account);
  return { ...character, mount: selected, mountStars: selected ? stars[selected] ?? 0 : 0, vip };
}

// Who a moment happened to, as an announcement names them: the character played and its server.
async function announcedAs(account: string): Promise<{ name: string; world: string }> {
  const { active } = await readProfile(account);
  return { name: active?.name ?? (await readNickname(account)) ?? "", world: active?.world ?? (await readAccountWorld(account)).id };
}

// Lag between two potions sent a second apart can bring them closer; this much of the gap is held.
const POTION_GRACE = 0.8;

// Which character a room's user state is (arrive writes it): an account plays one character at a time
// but picks another on the menu, and what one left behind must never land on the other.
const roomCharacter = (roomState: unknown) => (roomState as { characterId?: unknown } | null)?.characterId;

// Whether the character the account has in this room is still its active one (the one updateActive
// changes). A room state from before characterId was kept counts as it.
async function stillPlaying(account: string): Promise<boolean> {
  const [state] = await $room.getUserStates([account], ["characterId"]);
  const id = roomCharacter(state);
  if (typeof id !== "string") return true;
  return (await readProfile(account)).active?.id === id;
}

// Keeps how you are (health, a fall, cooldowns) on the character that left the room, for the next
// room to take it in as it was (see vitals.ts). Nothing, if another character is active by now.
async function carryVitals(account: string, roomState: unknown): Promise<void> {
  const vitals = readVitals(roomState);
  const id = roomCharacter(roomState);
  if (!vitals || typeof id !== "string") return;
  await updateActive(account, (c) => (c.id === id ? { ...c, vitals } : c));
}

// A character has fallen: it loses a little XP (never a level), and the room shows how much.
async function fallen(account: string, roomId: string): Promise<void> {
  // The village's inn, once built, halves what a fall costs on this server.
  const here = readChannelRoom(roomId);
  const factor = here ? deathLossFactor(await villageOf(here.world)) : 1;
  if (!(await stillPlaying(account))) return;
  let lost = 0;
  const next = await updateActive(account, (c) => {
    lost = Math.round(deathXpLoss(c.xp) * factor);
    return { ...c, xp: c.xp - lost };
  });
  if (lost > 0) await writeRanking(account, next);
  await withRoomLock(roomId, async () => {
    await $room.updateUserState(account, { xp: next.xp, lostXp: lost }, { returnState: false });
  });
}

// Pays a character (gold onto its account as a Verse8 asset, the rest into the character) and shows
// it in the room: the new XP (a new level heals it to its new, larger health) and the payout itself,
// which its client shows and refreshes the bag on.
async function payHunter(account: string, roomId: string, paid: Pay): Promise<void> {
  // The village's training ground, once built, adds to every hunt's XP on this server.
  const here = readChannelRoom(roomId);
  // VIP ranks and the monthly pass add to it too.
  const premium = await accountPremium(account);
  const bonus = huntBonus(premium, Date.now());
  const vip = vipOf(premium.vipPoints);
  const village = here ? huntXpFactor(await villageOf(here.world)) : 1;
  const pay = { ...paid, xp: Math.round(paid.xp * village * bonus.xp), gold: Math.round(paid.gold * bonus.gold) };
  // Another character picked since (another tab): the hunt was not its.
  if (!(await stillPlaying(account))) return;
  // Verse8 mints only to the caller; another hunter's gold is minted here, then handed over.
  if (pay.gold > 0) {
    await $asset.mint(GOLD, pay.gold);
    if (account !== $sender.account) await $asset.transfer(account, GOLD, pay.gold);
  }
  const next = await updateActive(account, (c) => ({
    ...loot(c, pay.items, Math.random, newUid, pieceLimit(vip)), xp: c.xp + pay.xp, quest: countKills(c.quest, pay.felled),
    daily: countDaily(c.daily, pay.felled, Date.now()),
  }));
  if (pay.xp > 0) await writeRanking(account, next, vip, combatPower(await mounted(account, next)));
  const levelled = levelOf(next.xp).level > levelOf(next.xp - pay.xp).level;
  const stats = fightStats(await mounted(account, next));
  await withRoomLock(roomId, async () => {
    await $room.updateUserState(
      account,
      {
        look: zoneLook(next, vip), xp: next.xp, ...(levelled ? { maxHp: stats.maxHp, hp: stats.maxHp } : {}),
        payout: { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, xp: pay.xp, gold: pay.gold, items: pay.items },
      },
      { returnState: false },
    );
  });
}

// Pays for what a blow or skill felled. Each monster's XP, gold and drops go to whoever still here
// dealt it the most damage; everyone here who hit it at all counts it toward their quest. Answers with what the caller itself was paid.
async function reward(caller: string, roomId: string, result: HitResult): Promise<HitResult> {
  if (result.kills.length === 0) return result;
  // Every kill cleanses the server's grove (added to its record every few seconds; see grove.ts); a
  // guild's boss rooms belong to no server's grove.
  const here = readChannelRoom(roomId);
  if (here) await countGroveKills(roomId, result.kills.length);
  const present = new Set<string>((await $room.getRoomState([])).$users);
  present.add(caller);
  const pays = new Map<string, Pay>();
  const payOf = (account: string) => {
    let pay = pays.get(account);
    if (!pay) pays.set(account, (pay = { xp: 0, gold: 0, items: [], felled: [] }));
    return pay;
  };
  const levels = new Map<string, number>();
  for (const kill of result.kills) {
    const hunters = rankHitters(kill.hitters, present);
    const owner = hunters[0] ?? caller;
    if (!levels.has(owner)) {
      const [state] = await $room.getUserStates([owner], ["look"]);
      levels.set(owner, typeof state?.look?.level === "number" ? state.look.level : 1);
    }
    const loot = rollLoot(kill.type);
    const own = payOf(owner);
    own.xp += xpFor(kill.type, levels.get(owner)!);
    own.gold += loot.gold;
    own.items.push(...loot.items);
    for (const counted of new Set([owner, ...hunters])) payOf(counted).felled.push(kill.type);
  }
  if (here) for (const account of pays.keys()) await markHunter(account, here.world, Date.now());
  for (const [account, pay] of pays) await payHunter(account, roomId, pay);
  const mine = pays.get(caller);
  return { ...result, xp: mine?.xp ?? 0, gold: mine?.gold ?? 0, items: mine?.items ?? [] };
}

async function bagView(character: Character): Promise<BagView> {
  return {
    gold: await $asset.get(GOLD), gems: await readGems($sender.account),
    bag: character.bag, bagTrade: character.bagTrade, pieces: character.pieces, gear: character.gear,
    job: character.job, quest: character.quest,
    daily: dailyToday(character.daily, Date.now()), tutorial: character.tutorial,
    ...(await (async () => {
      const { selected, stars, vip } = await accountMounts($sender.account);
      return { mount: selected, mountStars: selected ? stars[selected] ?? 0 : 0, vip };
    })()),
  };
}

// After a change of gear or class: the room carries your new health, what your gear and class add,
// and the look others see.
async function refreshFighter(character: Character): Promise<void> {
  // Gear or a mount changed 전투력: the boards hear of it, and of a new first place.
  const fighter = await mounted($sender.account, character);
  await writeRanking($sender.account, character, await vipOfAccount($sender.account), combatPower(fighter), true);
  const roomId = $sender.roomId;
  if (!roomId || !readChannelRoom(roomId)) return;
  const stats = fightStats(fighter);
  await withRoomLock(roomId, async () => {
    const mine = await $room.getMyState();
    const hp = Math.min(typeof mine.hp === "number" ? mine.hp : stats.maxHp, stats.maxHp);
    await $room.updateMyState(
      { maxHp: stats.maxHp, hp, gear: stats.gear, look: zoneLook(character, await vipOfAccount($sender.account)), xp: character.xp },
      { returnState: false },
    );
  });
}

// After the picked mount changed: the room carries the health and power it adds.
async function refreshMounted(account: string): Promise<void> {
  const character = await playing(account).catch(() => null);
  if (character) await refreshFighter(character);
}

// How many of something to buy or sell: a whole number from 1 to a full stack.
function readCount(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_STACK) throw new RuleViolation("unavailable");
  return value;
}

function readItem(value: unknown): ItemId {
  const id = readItemId(value);
  if (!id) throw new RuleViolation("no_item");
  return id;
}

// The shop, the forge and the quests are kept by people in the towns (the village, the snow outpost):
// you must be in a town, standing by one who does that.
async function requireNpc(role: NpcRole): Promise<void> {
  const { zone } = currentChannel();
  const here = npcsIn(zone).filter((n) => n.role === role);
  if (here.length === 0) throw new RuleViolation("not_in_village");
  const pose = (await $room.getMyState()).pose;
  const near = isPose(pose) && here.some((n) => {
    const spot = npcSpot(n.id);
    return Math.hypot(pose.x - spot.x, pose.z - spot.z) <= TALK_RANGE + TALK_SLACK;
  });
  if (!near) throw new RuleViolation("not_near");
}

// Where the caller is fighting: a channel's room, or one of its guild's boss rooms (see arena.ts).
type Place = { kind: "channel"; roomId: string; zone: ZoneId } | { kind: "arena"; roomId: string; zone: ZoneId; guildId: string; n: number };

function currentPlace(): Place {
  const roomId = $sender.roomId;
  const arena = readArenaRoom(roomId);
  if (arena && roomId) return { kind: "arena", roomId, zone: "arena", ...arena };
  return { kind: "channel", ...currentChannel() };
}

// In a boss room: whether your three minutes are still running (the room keeps when they end).
async function arenaOpen(): Promise<void> {
  const mine = await $room.getMyState();
  if (typeof mine.arenaUntil !== "number" || Date.now() >= mine.arenaUntil || mine.timeUp === true) throw new RuleViolation("arena_over");
}

// Your blow or skill in a boss room: what it took off the boss waits for the room's next sync.
async function noteBossDamage(place: Place, result: HitResult): Promise<void> {
  if (place.kind !== "arena" || !result.dealt.boss) return;
  const character = await playing($sender.account);
  await noteArenaDamage(place.roomId, character.id, $sender.account, character.name, result.dealt.boss);
}

// The caller's channel room, from inside it.
function currentChannel(): { roomId: string; zone: ZoneId } {
  const roomId = $sender.roomId;
  const here = readChannelRoom(roomId);
  if (!here || !roomId) throw new RuleViolation("unavailable");
  return { roomId, zone: here.zone };
}

// Guilds listed to join, at most.
const GUILD_LIST = 20;

// Your guild as its screen shows it: each member with level, class and (online) where they are;
// applications only for those who answer them.
async function guildView(account: string, character: Character): Promise<GuildView> {
  const guild = await guildOf(account, character);
  const role = guild ? guild.members.find((m) => m.characterId === character.id)?.role ?? null : null;
  const now = Date.now();
  const applied = [];
  for (const id of character.applied) {
    const g = await readGuildById(id);
    if (g) applied.push({ id, name: g.name });
  }
  const members = guild ? await Promise.all(rankedMembers(guild.members).map(async (m) => {
    const state = await $global.getUserState(m.account);
    const { characters, active } = await readProfile(m.account);
    const c = characters.find((x) => x.id === m.characterId);
    const online = isOnline(state.lastSeenAt, now) && active?.id === m.characterId;
    return {
      characterId: m.characterId, name: c?.name ?? m.name, role: m.role, level: c ? levelOf(c.xp).level : 1,
      playerClass: c?.playerClass ?? null, job: c?.job ?? null, online, where: online ? readWhereabouts(state.where) : null,
    };
  })) : [];
  return {
    guild: guild ? {
      id: guild.id, name: guild.name, notice: guild.notice, made: guild.made, members, applicants: canAnswer(role) ? guild.applicants : [],
    } : null,
    role, applied, waitUntil: character.guildLeftAt + REJOIN_MS,
  };
}

// Standing in a boss room, whole, for as long as your pass (enterArena) says.
async function arriveInArena(account: string): Promise<{ x: number; z: number; grove: null }> {
  const roomId = $sender.roomId;
  const pass = (await $global.getUserState(account)).arena as { roomId?: unknown; until?: unknown } | undefined;
  const now = Date.now();
  if (!pass || pass.roomId !== roomId || typeof pass.until !== "number" || now >= pass.until) throw new RuleViolation("arena_over");
  const character = await playing(account);
  const at = zoneLayout("arena").playerSpawn;
  const { maxHp, gear } = fightStats(await mounted(account, character));
  await $room.updateMyState({
    pose: { x: at.x, z: at.z, yaw: 0, y: 0, block: false, swing: 0, skill: 0, at: now },
    characterId: character.id, riding: null, look: zoneLook(character, await vipOfAccount(account)), savedAt: now,
    xp: character.xp, maxHp, gear, hp: maxHp, dead: false, arenaUntil: pass.until, timeUp: false,
  });
  return { x: at.x, z: at.z, grove: null };
}

// A listing as the market's screen shows it: whose it is by name only, and whether it is yours.
function listingView(listing: Listing, account: string): ListingView {
  const { seller, ...shown } = listing;
  return { ...shown, mine: seller === account };
}

// One letter out of the mailbox and into your hands. Items need a character to carry them (and room in its bag); gold and
// gems go to the account.
async function claimLetter(account: string, id: string): Promise<void> {
  const room = await roomOf(account);
  await takeMail(
    account, id, Date.now(),
    async (mail) => {
      if (mail.items.length > 0 && !mailFits(await playing(account), mail, room)) throw new RuleViolation("bag_full");
    },
    async (mail) => {
      if (mail.items.length > 0) {
        await updateActive(account, (c) => {
          return receiveMail(c, mail.items, newUid, room);
        });
      }
      if (mail.gems > 0) await changeGems(account, mail.gems);
      if (mail.gold > 0) await $asset.mint(GOLD, mail.gold);
    },
  );
}

export class Server {
  // An empty-looking room (nobody calling in) still ticks once a second, so monsters keep moving.
  static $roomTickIdleMs = 1_000;

  async getServerVersion(): Promise<{ protocol: number }> {
    return { protocol: PROTOCOL_VERSION };
  }

  async getAccount(): Promise<AccountView> {
    return accountView($sender.account);
  }

  // The newest update notice this account has read (see news.ts); null before the first.
  async getNewsSeen(): Promise<{ seen: string | null }> {
    return { seen: readNewsId((await $global.getUserState($sender.account)).newsSeen) };
  }

  // Marks the news read up to `id`. An older one than the id kept (a late call) changes nothing.
  async markNewsSeen(raw: unknown): Promise<{ seen: string }> {
    const id = readNewsId(raw);
    if (!id) throw new RuleViolation("unavailable");
    const account = $sender.account;
    const kept = readNewsId((await $global.getUserState(account)).newsSeen);
    if (kept && NEWS.findIndex((n) => n.id === kept) <= NEWS.findIndex((n) => n.id === id)) return { seen: kept };
    await $global.updateUserState(account, { newsSeen: id });
    return { seen: id };
  }

  // Your mailbox, newest first (gifts due are delivered on reading it).
  async getMail(): Promise<{ mail: Mail[] }> {
    return { mail: await openMailbox($sender.account, Date.now()) };
  }

  // How many letters wait (the menu's dot).
  async mailCount(): Promise<{ count: number }> {
    return { count: (await openMailbox($sender.account, Date.now())).length };
  }

  // Takes one letter: its gold and gems onto the account, its items into the character you play.
  async claimMail(rawId: unknown): Promise<{ mail: Mail[] }> {
    const account = $sender.account;
    await claimLetter(account, requireText(rawId));
    return { mail: await openMailbox(account, Date.now()) };
  }

  // Takes every letter that can be taken, oldest first; says how many were left and why.
  async claimAllMail(): Promise<{ mail: Mail[]; claimed: number; left: number; problem: string | null }> {
    const account = $sender.account;
    let claimed = 0;
    let left = 0;
    let problem: string | null = null;
    for (const mail of [...(await openMailbox(account, Date.now()))].reverse()) {
      try {
        await claimLetter(account, mail.id);
        claimed++;
      } catch (error) {
        if (!(error instanceof RuleViolation)) throw error;
        left++;
        problem ??= error.message;
      }
    }
    return { mail: await openMailbox(account, Date.now()), claimed, left, problem };
  }

  // The market: one page of a shelf, cheapest first, and your gems. Listings past their time go back
  // to their sellers first.
  async market(rawFilter: unknown): Promise<{ listings: ListingView[]; page: number; pages: number; gems: number }> {
    const account = $sender.account;
    const now = Date.now();
    await sweepExpired(now);
    const filter = readFilter(rawFilter);
    const found = pageOf(await shelfListings(filter.shelf, filter.item), filter, now);
    return { ...found, listings: found.listings.map((l) => listingView(l, account)), gems: await readGems(account) };
  }

  // Your listings, newest first, and your gems.
  async myListings(): Promise<{ listings: ListingView[]; gems: number }> {
    const account = $sender.account;
    await sweepExpired(Date.now());
    return { listings: (await sellerListings(account)).map((l) => listingView(l, account)), gems: await readGems(account) };
  }

  // Puts a tradable piece ({ uid }) or bundle of tradable material ({ item, n }) up for `price` gems.
  // It leaves the bag at once and comes back by mail if it is taken down or runs out of time.
  async sellOnMarket(rawWhat: unknown, rawPrice: unknown): Promise<{ bag: BagView; listings: ListingView[] }> {
    const account = $sender.account;
    const current = await playing(account);
    const what = (rawWhat ?? {}) as { uid?: unknown; item?: unknown; n?: unknown };
    let offer: { piece: GearPiece } | { item: ItemId; n: number };
    let shelf: Shelf;
    if (typeof what.uid === "string") {
      const piece = current.pieces.find((p) => p.uid === what.uid);
      if (!piece) throw new RuleViolation("no_item");
      if (!piece.trade) throw new RuleViolation("not_tradable");
      offer = { piece };
      shelf = slotOf(piece.id)!;
    } else {
      const item = readItem(what.item);
      const n = readBundle(what.n);
      if (shelfOf(item) !== "material") throw new RuleViolation("not_tradable");
      if (n === null) throw new RuleViolation("unavailable");
      offer = { item, n };
      shelf = "material";
    }
    const price = readPrice(rawPrice, shelf);
    if (price === null) throw new RuleViolation("bad_price");
    const next = await withSellerLock(account, async () => {
      if ((await countListings(account)) >= MAX_LISTINGS) throw new RuleViolation("listing_limit");
      const taken = await updateActive(account, (c) => ("piece" in offer ? takePiece(c, offer.piece.uid).inv : takeStack(c, offer.item, offer.n, true)));
      try {
        await addListing(account, current.name, offer, shelf, price, Date.now());
      } catch (error) {
        await updateActive(account, (c) => ("piece" in offer ? putPiece(c, offer.piece) : give(c, [{ id: offer.item, n: offer.n }], true, newUid)));
        throw error;
      }
      return taken;
    });
    return { bag: await bagView(next), listings: (await sellerListings(account)).map((l) => listingView(l, account)) };
  }

  // Buys a listing for its price in gems; what was bought comes by mail.
  async buyFromMarket(rawId: unknown, rawCount?: unknown): Promise<{ gems: number }> {
    const account = $sender.account;
    await buyListing(account, requireText(rawId), rawCount, Date.now());
    return { gems: await readGems(account) };
  }

  // Takes one of your listings down; it comes back by mail.
  async cancelMarketListing(rawId: unknown): Promise<{ listings: ListingView[] }> {
    const account = $sender.account;
    await cancelListing(account, requireText(rawId), Date.now());
    return { listings: (await sellerListings(account)).map((l) => listingView(l, account)) };
  }

  // Your guild as its screen shows it (or none), with where you have applied.
  async getGuild(): Promise<GuildView> {
    const account = $sender.account;
    return guildView(account, await playing(account));
  }

  // What the menu's guild button needs, cheaply: applications waiting (for those who answer them).
  async guildBadge(): Promise<{ applicants: number; bossReady: boolean }> {
    const account = $sender.account;
    const character = await playing(account);
    const guild = await guildOf(account, character);
    const role = guild?.members.find((m) => m.characterId === character.id)?.role ?? null;
    let bossReady = false;
    if (guild && levelOf(character.xp).level >= ARENA_LEVEL) {
      const now = Date.now();
      const view = bossView(await findWeek(guild.id, currentWeek(now)), guild, character.id, currentWeek(now), now);
      bossReady = !view.enteredToday && view.damage < view.max;
    }
    return { applicants: guild && canAnswer(role) ? guild.applicants.length : 0, bossReady };
  }

  // The boss tab: this week's boss and the guild's progress on it, and how full each boss room is.
  // The week's league across every guild, and last week's: paid first, if it has not been yet.
  async guildLeague(): Promise<{ now: LeagueView; last: LeagueView }> {
    const account = $sender.account;
    const character = await playing(account);
    const guild = await guildOf(account, character);
    const now = Date.now();
    const week = currentWeek(now);
    await settleLeague(week - 1, now);
    return {
      now: await leagueView(week, guild?.id ?? null, character.id),
      last: await leagueView(week - 1, guild?.id ?? null, character.id),
    };
  }

  async guildBoss(): Promise<BossView & { rooms: number[]; endsAt: number }> {
    const account = $sender.account;
    const character = await playing(account);
    const { guild } = await myGuild(account, character);
    const now = Date.now();
    const week = currentWeek(now);
    const view = bossView(await findWeek(guild.id, week), guild, character.id, week, now);
    const rooms = await Promise.all(Array.from({ length: ARENA_ROOMS }, (_, i) => $global.getRoomUserAccounts(arenaRoomId(guild.id, i + 1))));
    return { ...view, rooms: rooms.map((r) => r.length), endsAt: weekEndsAt(now) };
  }

  // Into one of your guild's boss rooms (1 to ARENA_ROOMS) for your three minutes of the day, from
  // wherever you stand in the world. The client joins the room and calls arrive.
  async enterArena(rawN: unknown): Promise<ZoneEntry & { until: number }> {
    const n = typeof rawN === "number" && Number.isInteger(rawN) && rawN >= 1 && rawN <= ARENA_ROOMS ? rawN : null;
    if (n === null) throw new RuleViolation("unavailable");
    const account = $sender.account;
    const here = readChannelRoom($sender.roomId);
    if (!here) throw new RuleViolation("unavailable");
    const mine = await $room.getMyState();
    if (mine.dead === true) throw new RuleViolation("unavailable");
    const character = await playing(account);
    if (levelOf(character.xp).level < ARENA_LEVEL) throw new RuleViolation("too_low");
    const { guild } = await myGuild(account, character);
    const roomId = arenaRoomId(guild.id, n);
    if ((await $global.getRoomUserAccounts(roomId)).filter((a: string) => a !== account).length >= ARENA_SEATS) {
      throw new RuleViolation("room_full");
    }
    const now = Date.now();
    await enterWeek(guild, character.id, account, character.name, currentWeek(now), now);
    // As you are in the field is how you come back to it.
    await carryVitals(account, mine);
    const until = now + ARENA_MS;
    await $global.updateUserState(account, { arena: { roomId, until, channel: here.channel } });
    const at = zoneLayout("arena").playerSpawn;
    return { roomId, zone: "arena", channel: n, x: at.x, z: at.z, until };
  }

  // Out of the boss room, back to where you stood in the field before, on the same channel.
  async leaveArena(): Promise<ZoneEntry> {
    const account = $sender.account;
    const pass = (await $global.getUserState(account)).arena as { channel?: unknown } | undefined;
    await $global.updateUserState(account, { arena: null });
    const character = await playing(account);
    const spot = returnSpot(character.spot);
    const channel = readChannel(pass?.channel) ?? await channelToEnter(account, character);
    if (spot && spot.zone !== "arena" && levelOf(character.xp).level >= ZONES[spot.zone].minLevel) {
      return enter(account, character, spot.zone, spot.x, spot.z, channel);
    }
    const home = zoneLayout(START_ZONE).playerSpawn;
    return enter(account, character, START_ZONE, home.x, home.z, channel);
  }

  // Guilds to join: the one named `query`, or those with the fewest members.
  async findGuilds(query: unknown): Promise<GuildListing[]> {
    let found: Guild[];
    if (typeof query === "string" && query.trim() !== "") {
      let key: string;
      try {
        key = parseGuildName(query).key;
      } catch {
        return [];
      }
      const guild = await findGuildByKey(key);
      found = guild ? [guild] : [];
    } else found = await openGuilds(GUILD_LIST);
    return found.map((g) => ({ id: g.id, name: g.name, members: g.members.length, notice: g.notice }));
  }

  // Founds a guild for GUILD_COST gold, with you as its master.
  async createGuild(rawName: unknown): Promise<GuildView> {
    const account = $sender.account;
    const now = Date.now();
    const character = await playing(account);
    if (await guildOf(account, character)) throw new RuleViolation("in_guild");
    if (!mayJoin(character.guildLeftAt, now)) throw new RuleViolation("guild_wait");
    const { name, key } = parseGuildName(rawName);
    if (!(await $asset.has(GOLD, GUILD_COST))) throw new RuleViolation("not_enough_gold");
    await $asset.burn(GOLD, GUILD_COST);
    try {
      await withGuildNameLock(key, async () => {
        if (await findGuildByKey(key)) throw new RuleViolation("guild_name_taken");
        const id = await addGuild({
          name, key, notice: "", made: now, applicants: [],
          members: [{ characterId: character.id, account, name: character.name, role: "master", joined: now }],
        });
        await updateCharacter(account, character.id, (c) => ({ ...c, guild: { id, name } }));
      });
    } catch (error) {
      await $asset.mint(GOLD, GUILD_COST);
      throw error;
    }
    for (const other of character.applied) await withdraw(other, account, character.id);
    const next = await playing(account);
    await refreshFighter(next);
    return guildView(account, next);
  }

  async applyGuild(rawId: unknown): Promise<GuildView> {
    const account = $sender.account;
    const character = await playing(account);
    if (await guildOf(account, character)) throw new RuleViolation("in_guild");
    if (!mayJoin(character.guildLeftAt, Date.now())) throw new RuleViolation("guild_wait");
    await apply(requireText(rawId), account, character, Date.now());
    return guildView(account, await playing(account));
  }

  async cancelApplication(rawId: unknown): Promise<GuildView> {
    const account = $sender.account;
    const character = await playing(account);
    await withdraw(requireText(rawId), account, character.id);
    return guildView(account, await playing(account));
  }

  // A master or vice lets an applicant in, or turns them away.
  async answerApplication(rawCharacter: unknown, accept: unknown): Promise<GuildView> {
    const account = $sender.account;
    const character = await playing(account);
    const { guild } = await myGuild(account, character);
    await answer(guild.id, character.id, requireText(rawCharacter), accept === true, Date.now());
    return guildView(account, character);
  }

  async leaveGuild(): Promise<GuildView> {
    const account = $sender.account;
    const character = await playing(account);
    const { guild } = await myGuild(account, character);
    await remove(guild.id, null, character.id, Date.now());
    const next = await playing(account);
    await refreshFighter(next);
    return guildView(account, next);
  }

  async kickMember(rawCharacter: unknown): Promise<GuildView> {
    const account = $sender.account;
    const character = await playing(account);
    const { guild } = await myGuild(account, character);
    await remove(guild.id, character.id, requireText(rawCharacter), Date.now());
    return guildView(account, character);
  }

  async setGuildRole(rawCharacter: unknown, role: unknown): Promise<GuildView> {
    if (role !== "vice" && role !== "member") throw new RuleViolation("unavailable");
    const account = $sender.account;
    const character = await playing(account);
    const { guild } = await myGuild(account, character);
    await setRole(guild.id, character.id, requireText(rawCharacter), role);
    return guildView(account, character);
  }

  async passGuildMaster(rawCharacter: unknown): Promise<GuildView> {
    const account = $sender.account;
    const character = await playing(account);
    const { guild } = await myGuild(account, character);
    await passMaster(guild.id, character.id, requireText(rawCharacter));
    return guildView(account, character);
  }

  async setGuildNotice(raw: unknown): Promise<GuildView> {
    const notice = readNotice(raw);
    if (notice === null) throw new RuleViolation("unavailable");
    const account = $sender.account;
    const character = await playing(account);
    const { guild } = await myGuild(account, character);
    await setNotice(guild.id, character.id, notice);
    return guildView(account, character);
  }

  async disbandGuild(): Promise<GuildView> {
    const account = $sender.account;
    const character = await playing(account);
    const { guild } = await myGuild(account, character);
    await disband(guild.id, account, character.id, Date.now());
    const next = await playing(account);
    await refreshFighter(next);
    return guildView(account, next);
  }

  // A line in your guild's chat, held to the chat's pace. Answers the line as it went out.
  async guildSay(raw: unknown): Promise<ChatMessage> {
    const text = readChat(raw);
    if (text === null) throw new RuleViolation("unavailable");
    const account = $sender.account;
    const character = await playing(account);
    const { guild } = await myGuild(account, character);
    const now = Date.now();
    const kept = (await $global.getUserState(account)).guildChatAt;
    const said: number[] = Array.isArray(kept) ? kept.filter((t: unknown): t is number => typeof t === "number") : [];
    if (!chatAllowed(said, now)) throw new RuleViolation("too_fast");
    await $global.updateUserState(account, { guildChatAt: [...said.filter((t) => now - t < CHAT_WINDOW_MS), now] });
    const line: ChatMessage = { account, name: character.name, text, at: now };
    await sayInGuild(guild.id, line);
    return line;
  }

  // Your guild's lines after `since` (ms), oldest first; none, and inGuild false, without a guild.
  async guildChat(since: unknown): Promise<{ lines: ChatMessage[]; inGuild: boolean }> {
    const account = $sender.account;
    const character = await playing(account);
    const guild = await guildOf(account, character);
    if (!guild) return { lines: [], inGuild: false };
    return { lines: await guildLines(guild.id, typeof since === "number" && Number.isFinite(since) ? since : 0), inGuild: true };
  }

  // How you set up the bar (skills in slots, what auto-battle may use), kept on the account so it
  // follows you to any device; null until first saved.
  async getControls(): Promise<Controls | null> {
    return readControls((await $global.getUserState($sender.account)).controls);
  }

  async saveControls(raw: unknown): Promise<void> {
    const controls = readControls(raw);
    if (!controls) throw new RuleViolation("unavailable");
    await $global.updateUserState($sender.account, { controls });
  }

  // Whether a name is free for a new character (asked while typing it, before the rest is picked).
  async checkName(requested: unknown): Promise<{ free: boolean }> {
    const { key } = parseNickname(requested);
    return { free: !(await findNickname(key)) };
  }

  // A new character on the server you picked, with its class and look fixed for good. It becomes
  // the one you play.
  async createCharacter(requested: unknown, playerClass: unknown, costume: unknown): Promise<AccountView> {
    const account = $sender.account;
    const { name, key } = parseNickname(requested);
    const picked = readClass(playerClass);
    const look = costumeById(costume);
    if (!picked || !look) throw new RuleViolation("unavailable");
    const world = (await readAccountWorld(account)).id;
    await withProfileLock(account, async () => {
      const { characters } = await readProfile(account);
      if (characters.filter((c) => c.world === world).length >= CHARACTERS_PER_WORLD) throw new RuleViolation("character_limit");
      const character: Character = {
        id: `c-${token(10)}`, world, name, playerClass: picked, costume: look.id, xp: 0, spot: null, made: Date.now(),
        // Nothing to start with: the elder hands out the first skill and potions (the tutorial).
        ...EMPTY_INVENTORY, ...GUILDLESS, daily: readDaily(null), job: null, quest: QUEST_START, tutorial: TUTORIAL.talk,
      };
      await withNicknameLock(() => claimName(account, character.id, key, name));
      await saveProfile(account, [...characters, character], character.id);
    });
    return accountView(account);
  }

  // Plays another of your characters on this server.
  async selectCharacter(id: unknown): Promise<AccountView> {
    const account = $sender.account;
    const world = (await readAccountWorld(account)).id;
    await withProfileLock(account, async () => {
      const { characters } = await readProfile(account);
      const picked = characters.find((c) => c.id === id && c.world === world);
      if (!picked) throw new RuleViolation("no_character");
      await saveProfile(account, characters, picked.id);
    });
    return accountView(account);
  }

  // Deletes one of your characters for good, once you have typed its name to be sure: its name is
  // free for anyone again and its line leaves the board. Only from the menus, never while playing.
  async deleteCharacter(id: unknown, typedName: unknown): Promise<AccountView> {
    const account = $sender.account;
    if (readChannelRoom($sender.roomId)) throw new RuleViolation("unavailable");
    await withProfileLock(account, async () => {
      const { characters, active } = await readProfile(account);
      const doomed = characters.find((c) => c.id === id);
      if (!doomed) throw new RuleViolation("no_character");
      if (typeof typedName !== "string" || typedName.trim() !== doomed.name) throw new RuleViolation("name_mismatch");
      await deleteCharacter(account, doomed, characters, active?.id ?? null);
      const key = (() => {
        try {
          return parseNickname(doomed.name).key;
        } catch {
          return null;
        }
      })();
      if (key) await withNicknameLock(() => releaseName(account, key));
      await dropRanking(doomed.id);
    });
    return accountView(account);
  }

  // Your character's level and 전투력, where it sits on the board, and the board itself (each line
  // with its class; lines from before classes were kept on the board get theirs from the character).
  async getRanking(): Promise<RankingView> {
    const account = $sender.account;
    const { active } = await readProfile(account);
    const xp = active?.xp ?? 0;
    const filled = (rows: RankRow[]) => Promise.all(rows.map(async (row) => {
      if (row.playerClass) return row;
      const character = (await readProfile(row.account)).characters.find((c) => c.id === row.id);
      return character ? { ...row, playerClass: character.playerClass, job: character.job } : row;
    }));
    const board = await filled(await readRanking("xp"));
    const powerBoard = await filled(await readRanking("power"));
    return {
      xp, level: levelOf(xp), rank: active ? rankOf(board, active.id) : null, board, power: active ? combatPower(await mounted(account, active)) : 0,
      powerBoard, powerRank: active ? rankOf(powerBoard, active.id) : null,
    };
  }

  // One character on the board in full: class, 전투력, gear and server. Only characters that are on
  // the board can be looked up.
  async getRankDetail(rawId: unknown): Promise<RankDetail> {
    const id = requireText(rawId);
    const board = await readRanking("xp");
    const row = board.find((r) => r.id === id) ?? (await readRanking("power")).find((r) => r.id === id);
    if (!row) throw new RuleViolation("unavailable");
    const character = (await readProfile(row.account)).characters.find((c) => c.id === id);
    if (!character) throw new RuleViolation("unavailable");
    return {
      id, nickname: character.name, level: levelOf(character.xp).level, xp: character.xp,
      playerClass: character.playerClass, job: character.job, power: combatPower(await mounted(row.account, character)), gear: character.gear,
      world: readWorld(character.world)?.id ?? character.world, rank: rankOf(board, id),
    };
  }

  // Marks you online (the menu calls it every HEARTBEAT_MS) and returns your lists with names and presence.
  async syncFriends(): Promise<FriendsView> {
    const account = $sender.account;
    const now = Date.now();
    await markSeen(account, now);
    const { lists } = await readFriendSide(account);
    const entries = (accounts: string[]) => Promise.all(accounts.map((a) => friendEntry(a, now)));
    return { friends: await entries(lists.friends), incoming: await entries(lists.incoming), outgoing: await entries(lists.outgoing) };
  }

  async requestFriend(nickname: unknown): Promise<{ status: "requested" | "accepted" }> {
    if (!(await readNickname($sender.account))) throw new RuleViolation("unavailable");
    let key: string;
    try {
      key = parseNickname(nickname).key;
    } catch {
      throw new RuleViolation("friend_not_found");
    }
    const target = await findNickname(key);
    if (!target) throw new RuleViolation("friend_not_found");
    return { status: await betweenFriends(target.account, requestFriend) };
  }

  async acceptFriend(account: unknown): Promise<void> {
    await betweenFriends(requireText(account), acceptFriend);
  }

  async removeFriend(account: unknown): Promise<void> {
    await betweenFriends(requireText(account), removeFriend);
  }

  // Verse8 calls this when a VX Shop purchase completes. It may call again with the same receipt, so
  // each purchaseId unlocks once; a replay still answers success so the platform stops retrying.
  async $onItemPurchased(raw: unknown): Promise<{ success: boolean; code: string }> {
    const event = readPurchaseEvent(raw);
    if (!event) return { success: false, code: "invalid_event" };
    const now = Date.now();
    let grant: () => Promise<boolean>;
    if (isPassProduct(event.productId)) grant = () => grantPass(event, now);
    else if (gemsFor(event.productId, event.quantity) !== null) grant = () => grantGemPack(event, now);
    else return { success: false, code: "unknown_product" };
    const granted = await $lock(`purchase:${event.purchaseId}`, grant);
    return { success: true, code: granted ? "granted" : "already_granted" };
  }

  // Your gems and mounts: what you own (drawn, and the full game's own), and the one you ride.
  async getMounts(): Promise<MountsView> {
    return mountsView($sender.account);
  }

  // One draw for PULL_COST gems: a mount to keep, or, if already owned, DUPLICATE_REFUND gems back.
  // A repeat of one owned already breaks through: a star more (see mounts.ts), and only past MAX_STARS
  // gems back. `star` is the star it reached (null for a new mount or gems back).
  async pullMount(): Promise<MountsView & Pull & { pulls: Pull[] }> {
    const { view, pulls } = await drawMounts($sender.account, 1, PULL_COST);
    return { ...view, ...pulls[0], pulls };
  }

  // Ten draws at once for PULL10_COST, one of them rare or better (see rollMounts).
  async pullMount10(): Promise<MountsView & { pulls: Pull[] }> {
    const { view, pulls } = await drawMounts($sender.account, PULL10, PULL10_COST);
    return { ...view, pulls };
  }

  // The announcements to every server after `since` (ms), oldest first.
  async announcements(since: unknown): Promise<Announcement[]> {
    return announcementsSince(typeof since === "number" && Number.isFinite(since) ? since : Date.now());
  }

  // The mount you ride from now on (any you own).
  async selectMount(id: unknown): Promise<MountsView> {
    const account = $sender.account;
    const mount = readMountId(id);
    const view = await mountsView(account);
    if (!mount || !view.owned.includes(mount)) throw new RuleViolation("no_mount");
    await $global.updateUserState(account, { mount });
    await refreshMounted(account);
    return { ...view, selected: mount };
  }

  // On your mount, or off it. Striking, a skill or a blow takes you off (see hunt.ts).
  async ride(on: unknown): Promise<{ riding: MountId | null }> {
    const { roomId } = currentChannel();
    const account = $sender.account;
    if (on !== true) {
      await $room.updateMyState({ riding: null }, { returnState: false });
      return { riding: null };
    }
    const view = await mountsView(account);
    const mount = view.selected;
    if (!mount) throw new RuleViolation("no_mount");
    return withRoomLock(roomId, async () => {
      const mine = await $room.getMyState();
      if (mine.dead === true || !isPose(mine.pose)) throw new RuleViolation("unavailable");
      await $room.updateMyState({ riding: mount }, { returnState: false });
      return { riding: mount };
    });
  }

  // The server you play on, picked each time you start.
  async setWorld(id: unknown): Promise<AccountView> {
    const world = readWorld(id);
    if (!world) throw new RuleViolation("unavailable");
    const account = $sender.account;
    await $global.updateUserState(account, { world: world.id });
    // The characters there stay as they were; the last one played there comes back active.
    await withProfileLock(account, async () => {
      const { characters, active } = await readProfile(account);
      if (active?.world !== world.id) {
        await saveProfile(account, characters, characters.find((c) => c.world === world.id)?.id ?? null);
      }
    });
    return accountView(account);
  }

  // Into the world: back where you last stood, or in the village the first time (and when the
  // zone you were in has since locked).
  async enterWorld(): Promise<ZoneEntry> {
    const account = $sender.account;
    const character = await playing(account);
    await payPassDay(account, Date.now());
    await payVipDay(account, Date.now());
    const spot = returnSpot(character.spot);
    const level = levelOf(character.xp).level;
    const channel = await channelToEnter(account, character);
    if (spot && level >= ZONES[spot.zone].minLevel) {
      return enter(account, character, spot.zone, spot.x, spot.z, channel);
    }
    const home = zoneLayout(START_ZONE).playerSpawn;
    return enter(account, character, START_ZONE, home.x, home.z, channel);
  }

  // Through a portal: only to a zone next to the one you are in, and only while standing at that
  // zone's portal.
  async travel(to: unknown): Promise<ZoneEntry> {
    const account = $sender.account;
    const target = readZone(to);
    const here = readChannelRoom($sender.roomId);
    if (!target || !here) throw new RuleViolation("no_zone");
    const portal = portalsOf(here.zone).find((p) => p.to === target);
    if (!portal) throw new RuleViolation("no_zone");
    const mine = await $room.getMyState();
    if (mine.dead === true) throw new RuleViolation("unavailable");
    const pose = mine.pose;
    if (!isPose(pose) || Math.hypot(pose.x - portal.x, pose.z - portal.z) > zoneLayout(here.zone).tileSize) {
      throw new RuleViolation("not_near");
    }
    const at = arrivalFrom(target, here.zone);
    await carryVitals(account, mine);
    // You keep your channel: whoever you walked with is on the other side too.
    return enter(account, await playing(account), target, at.x, at.z, here.channel);
  }

  // After the client has joined the room enterWorld or travel picked: stands your character at
  // its spot for everyone in the room to see.
  async arrive(): Promise<{ x: number; z: number; grove: { gold: number; xp: number } | null }> {
    const account = $sender.account;
    if (currentPlace().kind === "arena") return arriveInArena(account);
    const { roomId, zone } = currentChannel();
    const character = await playing(account);
    // Only into the room enter sent you to (it checked the zone's price, its level and the channel's
    // room): a client can join any room, but arriving in another one takes you nowhere.
    const here = readChannelRoom(roomId)!;
    const where = readWhereabouts((await $global.getUserState(account)).where);
    if (!where || where.world !== here.world || where.zone !== here.zone || where.channel !== here.channel) {
      throw new RuleViolation("unavailable");
    }
    // The spot enter kept (the zone's spawn, should it be of another zone).
    const spot = character.spot?.zone === zone ? character.spot : { zone, ...zoneLayout(zone).playerSpawn };
    const now = Date.now();
    // As you left your last room (a portal, a channel, a lost connection), or as this room already has
    // you (a reload, a second arrive): only the village's respawn makes you whole.
    const { maxHp, gear } = fightStats(await mounted(account, character));
    const mine = await $room.getMyState();
    const vitals = arrivalVitals(character.vitals ?? null, roomCharacter(mine) === character.id ? mine : null, maxHp);
    await $room.updateMyState({
      pose: { x: spot.x, z: spot.z, yaw: 0, y: 0, block: false, swing: 0, skill: 0, at: now },
      characterId: character.id,
      // Every room is come into on foot.
      riding: null,
      look: zoneLook(character, await vipOfAccount(account)),
      savedAt: now,
      xp: character.xp, maxHp, gear, ...vitals,
    });
    if (character.vitals) await updateActive(account, (c) => ({ ...c, vitals: null }));
    // What the grove owes: this week's and last week's stages, and finished buildings' thanks.
    const owed = await settleOnArrive(account, (await readAccountWorld(account)).id);
    if (owed.gold > 0) await $asset.mint(GOLD, owed.gold);
    if (owed.xp > 0) {
      const next = await updateActive(account, (c) => ({ ...c, xp: c.xp + owed.xp }));
      await writeRanking(account, next);
      await refreshFighter(next);
    }
    return { x: spot.x, z: spot.z, grove: owed.gold > 0 || owed.xp > 0 ? owed : null };
  }

  // Back to the menu: keeps where you stood. The client leaves the room itself.
  async leaveWorld(): Promise<void> {
    const account = $sender.account;
    const here = readChannelRoom($sender.roomId);
    if (here) {
      const mine = await $room.getMyState();
      if (isPose(mine.pose)) await saveSpot(account, { zone: here.zone, x: mine.pose.x, z: mine.pose.z });
      await carryVitals(account, mine);
    }
    // Back on the menu your friends no longer see you in the world (the channel is still kept for
    // coming back; see channelToEnter).
    await writeWhereabouts(account, null);
  }

  // Where you are in your zone. The room carries it to everyone there; the account keeps a copy
  // every SAVE_SPOT_MS so you come back to the same spot.
  async reportPose(raw: unknown): Promise<void> {
    if (!isPose(raw)) throw new RuleViolation("unavailable");
    const place = currentPlace();
    const { zone } = place;
    const now = Date.now();
    const mine = await $room.getMyState();
    // Not arrived here (see arrive): nowhere to walk from.
    if (!isPose(mine.pose)) throw new RuleViolation("unavailable");
    // The fallen stay where they fell.
    if (mine.dead === true) return;
    const at: unknown = (mine.pose as { at?: unknown }).at;
    const last = typeof at === "number" ? { x: mine.pose.x, z: mine.pose.z, at } : null;
    // A rider may go as fast as the mount runs.
    const mount = readMountId(mine.riding);
    const saved = await writeZonePose(zone, raw, now, last, mount ? MOUNTS[mount].speed : 1);
    const savedAt = mine.savedAt;
    // A boss room is never where you come back to.
    if (place.kind === "channel" && now - (typeof savedAt === "number" ? savedAt : 0) >= SAVE_SPOT_MS) {
      await saveSpot($sender.account, { zone, x: saved.x, z: saved.z });
      await $room.updateMyState({ savedAt: now }, { returnState: false });
    }
  }

  // A line said in your channel: tidied, held to the chat's pace, and sent to everyone in the room
  // (you too) with the name the room shows for you. Answers with the line as it went out.
  async say(raw: unknown): Promise<ChatMessage> {
    const text = readChat(raw);
    if (text === null) throw new RuleViolation("unavailable");
    currentChannel();
    const now = Date.now();
    const mine = await $room.getMyState();
    const said: number[] = Array.isArray(mine.chatAt) ? mine.chatAt.filter((t: unknown): t is number => typeof t === "number") : [];
    if (!chatAllowed(said, now)) throw new RuleViolation("too_fast");
    await $room.updateMyState({ chatAt: [...said.filter((t) => now - t < CHAT_WINDOW_MS), now] }, { returnState: false });
    const name = typeof mine.look?.name === "string" ? mine.look.name : "";
    const vip = typeof mine.look?.vip === "number" ? mine.look.vip : 0;
    const message: ChatMessage = { account: $sender.account, name, text, at: now, ...(vip > 0 ? { vip } : {}) };
    await $room.broadcastToRoom("chat", message);
    return message;
  }

  // Your attack on a monster, facing yaw; the server checks reach, facing and your weapon's pace.
  async strike(monsterId: unknown, yaw?: unknown): Promise<HitResult> {
    const place = currentPlace();
    if (place.kind === "arena") await arenaOpen();
    const result = await withRoomLock(place.roomId, () => strike(place.zone, $sender.account, monsterId, yaw, Date.now()));
    await noteBossDamage(place, result);
    return reward($sender.account, place.roomId, result);
  }

  // Your class's skill, no sooner than its cooldown allows.
  async useSkill(slot?: unknown, yaw?: unknown): Promise<HitResult> {
    const place = currentPlace();
    if (place.kind === "arena") await arenaOpen();
    const result = await withRoomLock(place.roomId, () => useSkill(place.zone, $sender.account, slot, yaw, Date.now()));
    await noteBossDamage(place, result);
    return reward($sender.account, place.roomId, result);
  }

  // The server's grove this week and its village (the grove panel, and how the world looks).
  async grove(): Promise<GroveView> {
    return viewOf((await readAccountWorld($sender.account)).id, Date.now());
  }

  // A gift of materials and gold to the village's building under way, from beside the elder.
  async donate(rawItems: unknown, rawGold: unknown): Promise<GroveView> {
    // The grove's buildings are the village's: its own elder takes the gifts.
    if (currentChannel().zone !== START_ZONE) throw new RuleViolation("not_in_village");
    await requireNpc("elder");
    const account = $sender.account;
    const world = (await readAccountWorld(account)).id;
    await playing(account);
    const items: Partial<Record<ItemId, number>> = {};
    if (rawItems && typeof rawItems === "object") {
      for (const [id, n] of Object.entries(rawItems as Record<string, unknown>)) {
        const item = readItemId(id);
        if (item && typeof n === "number" && Number.isInteger(n) && n > 0) items[item] = n;
      }
    }
    const offered = typeof rawGold === "number" && Number.isInteger(rawGold) && rawGold > 0 ? rawGold : 0;
    await giveToVillage(
      account, world, { items, gold: offered },
      async () => ({ character: await playing(account), gold: await $asset.get(GOLD) }),
      async (take) => {
        if (take.gold > 0) await $asset.burn(GOLD, take.gold);
        try {
          await updateActive(account, (c) => takeFromBag(c, take));
        } catch (error) {
          if (take.gold > 0) await $asset.mint(GOLD, take.gold);
          throw error;
        }
      },
    );
    return viewOf(world, Date.now());
  }

  // Your gold, and your active character's bag and gear.
  async getBag(): Promise<BagView> {
    return bagView(await playing($sender.account));
  }

  // Wears a piece of gear from the bag (what was in its slot goes back in the bag).
  async equipItem(rawUid: unknown): Promise<BagView> {
    const uid = requireText(rawUid);
    const account = $sender.account;
    await playing(account);
    const next = await updateActive(account, (c) => equipPiece(c, uid));
    await refreshFighter(next);
    return bagView(next);
  }

  async unequipItem(slot: unknown): Promise<BagView> {
    if (slot !== "weapon" && slot !== "armor") throw new RuleViolation("unavailable");
    const account = $sender.account;
    await playing(account);
    const room = await roomOf(account);
    const next = await updateActive(account, (c) => unequipSlot(c, slot as Slot, room));
    await refreshFighter(next);
    return bagView(next);
  }

  // Drinks a potion from the bag, in the world and standing.
  async drinkPotion(id: unknown): Promise<BagView> {
    const item = readItem(id);
    if (ITEMS[item].kind !== "potion") throw new RuleViolation("unavailable");
    const account = $sender.account;
    const { roomId } = currentPlace();
    const now = Date.now();
    // One at a time, as the client drinks them: under the room's lock, so a burst sent at once is
    // held to the pace too.
    const ready = await withRoomLock(roomId, async () => {
      const mine = await $room.getMyState();
      if (mine.dead === true) throw new RuleViolation("unavailable");
      if (typeof mine.potionReadyAt === "number" && now < mine.potionReadyAt) return false;
      await $room.updateMyState({ potionReadyAt: now + POTION_GAP_MS * POTION_GRACE }, { returnState: false });
      return true;
    });
    if (!ready) throw new RuleViolation("too_fast");
    const next = await updateActive(account, (c) => ({ ...c, bag: addItem(c.bag, item, -1) }));
    await withRoomLock(roomId, async () => {
      const mine = await $room.getMyState();
      if (mine.dead === true || typeof mine.hp !== "number" || typeof mine.maxHp !== "number") return;
      await $room.updateMyState({ hp: Math.min(mine.maxHp, mine.hp + ITEMS[item].heal) }, { returnState: false });
    });
    return bagView(next);
  }

  // The village shop: gold for items, at the listed price. Gear bought here may never be traded.
  async buyItem(id: unknown, count?: unknown): Promise<BagView> {
    const item = readItem(id);
    const n = readCount(count);
    await requireNpc("merchant");
    const listed = ITEMS[item].price;
    if (listed === null) throw new RuleViolation("unavailable");
    const account = $sender.account;
    const bought = [{ id: item, n }];
    const room = await roomOf(account);
    if (!fits(await playing(account), bought, false, room)) throw new RuleViolation("bag_full");
    // The village's herbalist, once built, sells potions cheaper on this server.
    const price = ITEMS[item].kind === "potion"
      ? Math.round(listed * potionPriceFactor(await villageOf((await readAccountWorld(account)).id)))
      : listed;
    const cost = price * n;
    if (!(await $asset.has(GOLD, cost))) throw new RuleViolation("not_enough_gold");
    await $asset.burn(GOLD, cost);
    try {
      return bagView(await updateActive(account, (c) => give(c, bought, false, newUid, room)));
    } catch (error) {
      await $asset.mint(GOLD, cost);
      throw error;
    }
  }

  // Sells potions or materials back to the shop: from the stack that may be traded when `trade`.
  async sellItem(id: unknown, count?: unknown, trade?: unknown): Promise<BagView> {
    const item = readItem(id);
    if (slotOf(item)) throw new RuleViolation("unavailable");
    const n = readCount(count);
    await requireNpc("merchant");
    const account = $sender.account;
    await playing(account);
    const next = await updateActive(account, (c) => takeStack(c, item, n, trade === true));
    await $asset.mint(GOLD, sellPrice(item) * n);
    return bagView(next);
  }

  // Sells a piece of gear from the bag back to the shop, its + and all.
  async sellPiece(rawUid: unknown): Promise<BagView> {
    const uid = requireText(rawUid);
    await requireNpc("merchant");
    const account = $sender.account;
    await playing(account);
    let sold: ItemId | null = null;
    const next = await updateActive(account, (c) => {
      const taken = takePiece(c, uid);
      sold = taken.piece.id;
      return taken.inv;
    });
    await $asset.mint(GOLD, sellPrice(sold!));
    return bagView(next);
  }

  // Enhances what you wear in a slot by one + (from the forge in the menu, anywhere): the gold and 강화석 are spent whatever
  // happens; a failure on the way to +6 and above may break the piece (see forge.ts).
  // With `protect`, an attempt at +6 or above also costs protectCost gems, and a failure never breaks
  // the gear.
  async enhanceGear(rawSlot: unknown, protect?: unknown): Promise<{ outcome: EnhanceOutcome; bag: BagView }> {
    if (rawSlot !== "weapon" && rawSlot !== "armor") throw new RuleViolation("unavailable");
    const slot: Slot = rawSlot;
    const account = $sender.account;
    const current = await playing(account);
    const piece = current.gear[slot];
    if (!piece) throw new RuleViolation("unavailable");
    const cost = enhanceCost(piece.id, piece.plus);
    if (!cost) throw new RuleViolation("max_plus");
    if (countOf(current, "stone") < cost.stones) throw new RuleViolation("no_item");
    if (!(await $asset.has(GOLD, cost.gold))) throw new RuleViolation("not_enough_gold");
    const vip = await vipOfAccount(account);
    const shield = protect === true ? protectCost(cost.to) : null;
    if (protect === true && shield === null) throw new RuleViolation("unavailable");
    if (shield !== null) await changeGems(account, -shield);
    try {
      await $asset.burn(GOLD, cost.gold);
    } catch (error) {
      if (shield !== null) await changeGems(account, shield);
      throw error;
    }
    let outcome: EnhanceOutcome = "fail";
    try {
      const next = await updateActive(account, (c) => {
        // Changed since it was priced (another tab): nothing happens and the gold comes back.
        const worn = c.gear[slot];
        if (worn?.uid !== piece.uid || worn.plus !== cost.to - 1) throw new RuleViolation("unavailable");
        const paid = spend(c, [{ id: "stone", n: cost.stones }]);
        outcome = rollEnhance({ ...cost, success: Math.min(1, cost.success + vipEnhance(vip)) }, Math.random(), Math.random());
        if (outcome === "broken" && shield !== null) outcome = "fail";
        if (outcome === "success") return { ...paid, gear: { ...c.gear, [slot]: { ...worn, plus: cost.to } } };
        if (outcome === "fail") return paid;
        return { ...paid, gear: { ...c.gear, [slot]: null } };
      });
      await refreshFighter(next);
      // A big one is told to everyone.
      if ((outcome as EnhanceOutcome) === "success" && cost.to >= ANNOUNCE_PLUS) {
        await announce("enhance", { name: next.name, world: next.world, item: piece.id, plus: cost.to }, Date.now());
      }
      return { outcome, bag: await bagView(next) };
    } catch (error) {
      await $asset.mint(GOLD, cost.gold);
      if (shield !== null) await changeGems(account, shield);
      throw error;
    }
  }

  // Makes something from materials and gold (see RECIPES in forge.ts), anywhere. Gear made here may be
  // traded one time in TRADE_CRAFT_CHANCE.
  async craftItem(rawRecipe: unknown): Promise<BagView> {
    const recipe = readRecipe(rawRecipe);
    if (!recipe) throw new RuleViolation("unavailable");
    const account = $sender.account;
    const current = await playing(account);
    const made = [{ id: recipe.makes, n: recipe.n }];
    const trade = slotOf(recipe.makes) !== null && Math.random() < TRADE_CRAFT_CHANCE;
    if (!hasMaterials(allStacks(current), recipe)) throw new RuleViolation("no_item");
    const room = await roomOf(account);
    if (!fits(current, made, trade, room)) throw new RuleViolation("bag_full");
    if (!(await $asset.has(GOLD, recipe.gold))) throw new RuleViolation("not_enough_gold");
    await $asset.burn(GOLD, recipe.gold);
    try {
      return bagView(await updateActive(account, (c) => {
        const paid = spend(c, recipe.needs.map((need) => ({ id: need.item, n: need.n })));
        return give(paid, made, trade, newUid, room);
      }));
    } catch (error) {
      await $asset.mint(GOLD, recipe.gold);
      throw error;
    }
  }

  // Advancement (전직): from ADVANCE_LEVEL, one of the two paths of your class, for good.
  async advance(id: unknown): Promise<BagView> {
    const job = readJob(id);
    const account = $sender.account;
    await playing(account);
    const next = await updateActive(account, (c) => {
      if (!job || JOBS[job].playerClass !== c.playerClass || c.job) throw new RuleViolation("unavailable");
      if (levelOf(c.xp).level < ADVANCE_LEVEL) throw new RuleViolation("too_low");
      return { ...c, job };
    });
    await writeRanking(account, next);
    await refreshFighter(next);
    return bagView(next);
  }

  // The first tutorial (see tutorial.ts). Talking to the elder teaches the first skill and hands
  // over potions, once.
  async tutorialTalk(): Promise<BagView> {
    const account = $sender.account;
    await playing(account);
    await requireNpc("elder");
    const next = await updateActive(account, (c) => (c.tutorial === TUTORIAL.talk
      ? { ...c, tutorial: TUTORIAL.register, bag: addItem(c.bag, "potion_small", TUTORIAL_POTIONS) }
      : c));
    await refreshFighter(next);
    return bagView(next);
  }

  // The steps after the elder are the player's own bar and auto-battle, which only the screen sees:
  // it says when one is done. Nothing is paid for them, and a step only ever moves on by one.
  async tutorialStep(from: unknown): Promise<BagView> {
    const step = readTutorial(from);
    if (step !== TUTORIAL.register && step !== TUTORIAL.auto) throw new RuleViolation("unavailable");
    const account = $sender.account;
    await playing(account);
    return bagView(await updateActive(account, (c) => (c.tutorial === step ? { ...c, tutorial: (step + 1) as TutorialStep } : c)));
  }

  // The last step done: the tutorial is over and pays its gold, once.
  async tutorialFinish(): Promise<BagView> {
    const account = $sender.account;
    await playing(account);
    let paid = false;
    const next = await updateActive(account, (c) => {
      if (c.tutorial !== TUTORIAL.battle) return c;
      paid = true;
      return { ...c, tutorial: null };
    });
    if (paid) await $asset.mint(GOLD, TUTORIAL_GOLD);
    return bagView(next);
  }

  // Claims the finished quest's reward (XP, gold, items) and moves on to the next one.
  async claimQuest(): Promise<BagView> {
    const account = $sender.account;
    await playing(account);
    await requireNpc("elder");
    const room = await roomOf(account);
    let paid = 0;
    const next = await updateActive(account, (c) => {
      if (!questDone(c.quest)) throw new RuleViolation("quest_unfinished");
      const quest = QUESTS[c.quest.index];
      paid = quest.gold;
      return {
        ...give(c, quest.items, false, newUid, room),
        xp: c.xp + quest.xp,
        quest: { index: c.quest.index + 1, count: 0 },
      };
    });
    if (paid > 0) await $asset.mint(GOLD, paid);
    await writeRanking(account, next);
    await refreshFighter(next);
    return bagView(next);
  }

  // Claims a finished daily quest's reward (gold and items), once a day, from anywhere.
  async claimDaily(id: unknown): Promise<BagView> {
    const quest = readDailyId(id);
    if (!quest) throw new RuleViolation("unavailable");
    const account = $sender.account;
    await playing(account);
    const room = await roomOf(account);
    const next = await updateActive(account, (c) => {
      const today = dailyToday(c.daily, Date.now());
      if ((today.counts[quest.id] ?? 0) < quest.count || today.claimed.includes(quest.id)) throw new RuleViolation("quest_unfinished");
      return {
        ...give(c, quest.items, false, newUid, room),
        daily: { ...today, claimed: [...today.claimed, quest.id] },
      };
    });
    await $asset.mint(GOLD, quest.gold);
    return bagView(next);
  }

  // Fallen: up again where you fell, for gold (see reviveCost), with half your health and a moment
  // in which the monsters leave you be.
  async reviveHere(): Promise<{ gold: number }> {
    const account = $sender.account;
    const { roomId } = currentChannel();
    const character = await playing(account);
    if ((await $room.getMyState()).dead !== true) throw new RuleViolation("unavailable");
    // VIP 4 and above rise for nothing.
    const cost = freeRevive(await vipOfAccount(account)) ? 0 : reviveCost(levelOf(character.xp).level);
    if (cost > 0 && !(await $asset.has(GOLD, cost))) throw new RuleViolation("not_enough_gold");
    if (cost > 0) await $asset.burn(GOLD, cost);
    const now = Date.now();
    const stood = await withRoomLock(roomId, async () => {
      const mine = await $room.getMyState();
      if (mine.dead !== true) return false;
      const maxHp = typeof mine.maxHp === "number" ? mine.maxHp : fightStats(character).maxHp;
      await $room.updateMyState(
        { dead: false, hp: Math.ceil(maxHp * REVIVE_HP_SHARE), hitAt: now, safeUntil: now + REVIVE_SAFE_MS, lostXp: 0 },
        { returnState: false },
      );
      return true;
    });
    // Up already (another tab): the gold comes back.
    if (!stood) {
      await $asset.mint(GOLD, cost);
      throw new RuleViolation("unavailable");
    }
    return { gold: await $asset.get(GOLD) };
  }

  // Fallen: back to the village, whole again (arrive heals).
  async respawn(): Promise<ZoneEntry> {
    const account = $sender.account;
    if ((await $room.getMyState()).dead !== true) throw new RuleViolation("unavailable");
    const here = readChannelRoom($sender.roomId);
    const character = await playing(account);
    // Whole again in the town of the region you fell in (the village, or the snow outpost).
    const town = here ? townOf(here.zone) : START_ZONE;
    const home = zoneLayout(town).playerSpawn;
    await updateActive(account, (c) => ({ ...c, vitals: null }));
    return enter(account, character, town, home.x, home.z, here?.channel ?? await channelToEnter(account, character));
  }

  // The channels of your server, with how many play on each, for choosing one to move to.
  async channels(): Promise<{ current: number; players: number[] }> {
    const here = readChannelRoom($sender.roomId);
    if (!here) throw new RuleViolation("unavailable");
    const players = await Promise.all(
      Array.from({ length: MAX_CHANNELS }, (_, i) => channelPlayers(here.world, i + 1).then((p) => p.length)),
    );
    return { current: here.channel, players };
  }

  // Moves you to another channel of your server, where you stand: the same zone, the same spot.
  async changeChannel(to: unknown): Promise<ZoneEntry> {
    const account = $sender.account;
    const here = readChannelRoom($sender.roomId);
    const channel = readChannel(to);
    if (!here || !channel || channel === here.channel) throw new RuleViolation("unavailable");
    const mine = await $room.getMyState();
    if (mine.dead === true || !isPose(mine.pose)) throw new RuleViolation("unavailable");
    const players = await channelPlayers(here.world, channel);
    if (!players.includes(account) && players.length >= CHANNEL_CAPACITY) throw new RuleViolation("channel_full");
    await carryVitals(account, mine);
    return enter(account, await playing(account), here.zone, mine.pose.x, mine.pose.z, channel);
  }

  // Every room tick (Verse8 runs it about every 200 ms): the monsters of a hunting zone move and fight.
  // Whoever falls loses a little XP (see deathXpLoss); the room shows them how much.
  async $roomTick(delta: number, roomId: string): Promise<void> {
    // A guild's boss room: its own tick, and no one loses anything for falling there.
    if (readArenaRoom(roomId)) {
      await tickArena(roomId, currentWeek(Date.now()), delta, Date.now());
      return;
    }
    const here = readChannelRoom(roomId);
    if (!here || !hasMonsters(here.zone)) return;
    const fell = await withRoomLock(roomId, () => tickRoom(here.zone, delta, Date.now()));
    for (const account of fell) await fallen(account, roomId);
    await flushRoom(here.world, here.zone, roomId, delta, Date.now());
  }

  // Verse8 calls this when someone leaves a room for good (after the reconnect grace period):
  // their last spot in a channel is kept, whatever way they left.
  async onRoomLeave(roomId: string, account: string): Promise<void> {
    const here = readChannelRoom(roomId);
    if (!here) return;
    const left = await $room.getUserState(account);
    const pose = left.pose;
    const { active } = await readProfile(account);
    // Gone on through a portal: the spot already points into the next zone, and must stay there. Another
    // character picked on the menu since: none of this is its.
    if (!active || active.world !== here.world || !isPose(pose) || active.spot?.zone !== here.zone) return;
    const id = roomCharacter(left);
    if (typeof id === "string" && id !== active.id) return;
    await saveSpot(account, { zone: here.zone, x: pose.x, z: pose.z });
    // Gone for good from where it last was (not on to another channel, which carried its own), it
    // comes back as it left.
    const where = readWhereabouts((await $global.getUserState(account)).where);
    if (!where || (where.world === here.world && where.zone === here.zone && where.channel === here.channel)) {
      await carryVitals(account, left);
    }
  }

}
