import { LinkWatch } from "./linkWatch";
import { readSlot } from "../game/combat/skills";
import type { GroveView } from "../game/world/grove";
import type { TutorialStep } from "../game/account/tutorial";
import { readJumpY } from "../game/rules/movement";
import { PROTOCOL_VERSION, isPose, readSwing, type Pose } from "../game/world/types";
import type { BagView, ItemId, Slot } from "../game/account/items";
import type { JobId } from "../game/combat/jobs";
import type { RankDetail, RankingView } from "../game/account/ranking";
import { readMonsterType, type MonsterState } from "../game/world/monsters";
import type { ZoneEntry, ZoneId, ZoneLook } from "../game/world/zones";
import { errorCode } from "./errors";
import type { EnhanceOutcome } from "../game/account/forge";
import { readChat, type ChatMessage } from "../game/world/chat";
import { readMountId, type MountId } from "../game/account/mounts";
import { NEWS } from "../game/news";
import { readTelegraphs, type Telegraph } from "../game/world/telegraphs";
import type { GuildBossType } from "../game/world/guildBoss";
import type { Announcement } from "../game/world/announce";
import type { PremiumView } from "../game/account/premium";
import type { LeagueView } from "../game/world/guildBoss";
import type { Mail } from "../game/account/mail";
import type { AttendanceView } from "../game/account/attendance";
import type { AchievementsView } from "../game/account/achievements";
import type { PartyCandidate, PartyState } from "../game/account/party";
import { readRun, type DungeonRun, type DungeonView } from "../game/world/dungeon";
import { readMercs, type Merc } from "../game/world/mercenary";
import type { ListingView, MarketFilter } from "../game/account/market";
import type { GuildListing, GuildView } from "../game/account/guild";
import type { MatchTransport } from "./transport";

// The guild changes the guild screen makes; each answers the screen after it.
export type GuildCall =
  | "createGuild" | "applyGuild" | "cancelApplication" | "answerApplication" | "leaveGuild" | "kickMember"
  | "setGuildRole" | "passGuildMaster" | "setGuildNotice" | "disbandGuild";

// The guild boss tab (see server guildBoss): the week's boss and progress, the rooms' head counts,
// and when the week ends.
export interface GuildBossView {
  week: number;
  boss: GuildBossType;
  max: number;
  damage: number;
  stage: number;
  enteredToday: boolean;
  ranking: { name: string; damage: number; mine: boolean }[];
  myDamage: number;
  rooms: number[];
  endsAt: number;
}

// One page of the market, and your gems.
export interface MarketPage { listings: ListingView[]; page: number; pages: number; gems: number }

export type WorldPhase = "idle" | "entering" | "in" | "travelling" | "error";

// Someone else in your zone and channel.
export interface OtherPlayer {
  account: string;
  pose: Pose;
  look: ZoneLook;
  // The mount they are on, if any.
  riding: MountId | null;
  // Their health as the room has it (a party member's bar), when it says.
  hp: number | null;
  maxHp: number | null;
  // A Trial Dungeon mercenary (see mercenary.ts), and whether it has fallen.
  merc?: boolean;
  dead?: boolean;
}

// Your gems and mounts, as the server keeps them (see mounts.ts).
export interface MountsView {
  gems: number;
  // Mount tickets (소환권): a hatch each, without gems.
  tickets: number;
  owned: MountId[];
  selected: MountId | null;
  // Each mount's stars (★0 not listed; see mounts.ts).
  stars: Partial<Record<MountId, number>>;
  // VIP, first purchases and the monthly pass (see premium.ts).
  premium: PremiumView;
  // Draws left until a legendary, and a mythic, is certain (천장).
  pity: { legendary: number; mythic: number };
}

// One draw's outcome: the mount, whether it was owned already, the star it reached, gems back.
export interface MountPull { mount: MountId; repeat: boolean; star: number | null; refund: number }

// You in a fight, as the server keeps it.
export interface Vitals {
  hp: number;
  maxHp: number;
  dead: boolean;
  xp: number;
  // XP lost to the last fall (0 when none).
  lostXp: number;
  // The mount you are on, as the server has it (a blow or a strike takes you off).
  riding: MountId | null;
  // In a guild boss room: when your three minutes end (server ms), and whether they have.
  arenaUntil: number | null;
  timeUp: boolean;
}

export interface WorldState {
  phase: WorldPhase;
  entry: ZoneEntry | null;
  others: OtherPlayer[];
  // The monsters of your channel, by id.
  monsters: Record<string, MonsterState>;
  // The marks of the room's telegraphed attacks (see telegraphs.ts).
  telegraphs: Telegraph[];
  // In a guild boss room: the boss's full health for the week (its hp is what is left of it).
  arenaMax: number | null;
  // In a Trial Dungeon room: how its run stands (see dungeon.ts), and its mercenaries.
  dungeon: DungeonRun | null;
  mercs: Record<string, Merc>;
  me: Vitals | null;
  // Your gold, bag and gear; null until the server has said.
  bag: BagView | null;
  error: string | null;
  // The lines said in the channels you have been in this session, oldest first (at most CHAT_KEEP).
  chat: ChatLine[];
  // Your guild's lines heard this session, and whether you are in a guild (as last asked).
  guildChat: ChatLine[];
  // The line to the server has stopped answering for a while (see linkWatch.ts).
  shaky: boolean;
  // The announcements to every server heard this session (the chat shows them), oldest first.
  announced: (Announcement & { heardAt: number })[];
  inGuild: boolean;
}

// A chat line as the client keeps it: numbered in the order it came, when it came (by this
// client's clock), and whether it is yours.
export interface ChatLine extends ChatMessage {
  id: number;
  heardAt: number;
  mine: boolean;
}

const CHAT_KEEP = 50;

function readChatMessage(raw: unknown): ChatMessage | null {
  const m = raw as Record<string, unknown> | null;
  if (!m || typeof m !== "object" || typeof m.account !== "string" || typeof m.name !== "string") return null;
  const text = readChat(m.text);
  const vip = typeof m.vip === "number" && Number.isInteger(m.vip) && m.vip > 0 ? m.vip : 0;
  return text === null ? null : { account: m.account, name: m.name, text, at: num(m.at), ...(vip > 0 ? { vip } : {}) };
}

// What an attack or skill did, as the server answers it: what it hit and felled, and what that paid.
export interface HitResult { hit: string[]; killed: string[]; xp: number; gold: number; items: ItemId[] }
// What the server paid you for a kill, yours or one you helped with: the XP, gold and items (all
// zero when you only counted it toward your quest).
export interface Payout { xp: number; gold: number; items: ItemId[] }

function readPayout(raw: unknown): (Payout & { id: string }) | null {
  const p = raw as Record<string, unknown> | null;
  if (!p || typeof p !== "object" || typeof p.id !== "string") return null;
  const items = Array.isArray(p.items) ? p.items.filter((i): i is ItemId => typeof i === "string") : [];
  return { id: p.id, xp: num(p.xp), gold: num(p.gold), items };
}

// Moving, your pose goes out this often; standing still, only this often (nothing changed, so the room
// needs nothing; it is a keepalive). Every pose is written to the room and sent to everyone in it, so
// five a second is the most: the others' heroes glide between them (see PlayerActor's follow).
export const POSE_THROTTLE_MS = 200;
export const IDLE_POSE_MS = 10_000;
// A player whose pose has not changed for this long is no longer drawn (two idle sends missed).
export const STALE_POSE_MS = 25_000;
// Verse8 turns away more than 10 calls a second to one function, so no two poses leave closer than
// this; a guard, attack or skill that comes sooner goes out with the next one.
export const MIN_POSE_GAP_MS = 110;
// Joining a room is tried this many times, waiting this much longer before each retry. The room
// servers are a shared fleet and can be away for a good few seconds at a time (seen in the editor
// as "[RS:connect] … terminal=false"), so the waits add up to about twenty before giving up.
const JOIN_ATTEMPTS = 7;
const JOIN_RETRY_MS = 900;
// Smaller changes than these count as standing still.
const POSE_EPSILON = 0.01;

function readLook(raw: unknown): ZoneLook | null {
  const l = raw as Partial<ZoneLook> | undefined;
  if (!l || typeof l.name !== "string" || typeof l.costume !== "string" || typeof l.playerClass !== "string") return null;
  return {
    name: l.name, costume: l.costume, playerClass: l.playerClass, level: typeof l.level === "number" ? l.level : 1,
    job: typeof l.job === "string" ? l.job : null, guild: typeof l.guild === "string" ? l.guild : null,
    vip: typeof l.vip === "number" && Number.isInteger(l.vip) && l.vip > 0 ? l.vip : 0,
  };
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function readMonsters(raw: unknown): Record<string, MonsterState> {
  const out: Record<string, MonsterState> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const m = value as Record<string, unknown> | null;
    const type = readMonsterType(m?.type);
    if (!m || !type) continue;
    out[id] = {
      type, x: num(m.x), z: num(m.z), yaw: num(m.yaw), hp: num(m.hp), alive: m.alive === true,
      stunnedUntil: num(m.stunnedUntil), attackReadyAt: num(m.attackReadyAt), respawnAt: num(m.respawnAt),
      homeX: num(m.homeX), homeZ: num(m.homeZ),
      slamming: m.slamming === true, summoned: m.summoned === true, returning: m.returning === true,
      ...(typeof m.maxHp === "number" ? { maxHp: m.maxHp } : {}),
    };
  }
  return out;
}

function readVitals(user: Record<string, unknown>): Vitals | null {
  if (typeof user.hp !== "number" || typeof user.maxHp !== "number") return null;
  return {
    hp: user.hp, maxHp: user.maxHp, dead: user.dead === true, xp: num(user.xp), lostXp: num(user.lostXp), riding: readMountId(user.riding),
    arenaUntil: typeof user.arenaUntil === "number" ? user.arenaUntil : null, timeUp: user.timeUp === true,
  };
}

// Your place in the open world: which zone and channel you are in, who else is there and where,
// and your own pose going out to them.
export class WorldClient {
  private current: WorldState = {
    phase: "idle", entry: null, others: [], monsters: {}, telegraphs: [], arenaMax: null, dungeon: null, mercs: {}, me: null, bag: null, error: null, chat: [], guildChat: [], inGuild: false, announced: [], shaky: false,
  };
  // While in the world, a ping now and then: the screen says when the line has gone quiet.
  // The room's own connection down counts as quiet too: calls still go out then, but nothing comes in.
  private readonly link = new LinkWatch(
    () => this.roomDown ? Promise.reject(new Error("room link down")) : this.transport.call("getServerVersion"),
    (shaky) => this.set({ shaky }),
  );
  // Whether the room's connection is down just now, and the watch on it while in a room.
  private roomDown = false;
  private roomLinkOff: (() => void) | null = null;
  // When each other player's pose last changed (this clock): one silent for STALE_POSE_MS is gone
  // (a closed tab, a crash) though the room still lists them.
  private poseSeen = new Map<string, { key: string; at: number }>();
  // The client that last went into the world: one left behind by a dropped connection must not take
  // the room away from it on its way out (the SDK's room is shared).
  private static lastEntered: WorldClient | null = null;
  private readonly listeners = new Set<(s: WorldState) => void>();
  private unsubscribers: (() => void)[] = [];
  private members: string[] = [];
  private users: Record<string, unknown>[] = [];
  private lastPose: (Pose & { at: number }) | null = null;
  // The last payout seen in your room user state (undefined until the room first shows you), and
  // the ones not yet taken by the view.
  private payoutSeen: string | null | undefined = undefined;
  private payouts: Payout[] = [];
  private chatCount = 0;
  private seenNews: string | null | undefined = undefined;
  // The newest guild line heard (its time), so each poll asks only for what is new.
  private guildHeardAt = 0;
  // The newest announcement heard (server ms); only those after it are asked for. Starts now: what
  // was told before this visit is not told again.
  private announcedAt = Date.now();
  // Whether the news, and today's attendance sheet, have opened by themselves yet this visit (once,
  // not once per zone).
  newsShown = false;
  attendanceShown = false;
  // Bumped by every enter and leave: one overtaken by a newer one (React's development double run
  // enters, leaves and enters again at once; a double tap on retry) lets the newer one decide.
  private generation = 0;

  constructor(
    private readonly transport: MatchTransport,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get account(): string {
    return this.transport.account;
  }

  get state(): WorldState {
    return this.current;
  }

  onChange(cb: (s: WorldState) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  // Into the world where you left it.
  async enter(): Promise<void> {
    const mine = ++this.generation;
    WorldClient.lastEntered = this;
    this.set({ phase: "entering", error: null });
    try {
      const version = await this.transport.call<{ protocol: number }>("getServerVersion");
      if (mine !== this.generation) return;
      if (version?.protocol !== PROTOCOL_VERSION) {
        throw new Error(`server protocol ${version?.protocol}, client protocol ${PROTOCOL_VERSION}`);
      }
      await this.moveTo(await this.transport.call<ZoneEntry>("enterWorld"));
    } catch (error) {
      if (mine === this.generation) this.fail(error);
    }
  }

  // Through a portal to the zone next door. A refusal (a locked zone) leaves you where you were.
  async travel(to: ZoneId): Promise<string | null> {
    if (this.current.phase !== "in") return "unavailable";
    this.set({ phase: "travelling" });
    try {
      await this.moveTo(await this.transport.call<ZoneEntry>("travel", [to]));
      return null;
    } catch (error) {
      this.set({ phase: "in" });
      return errorCode(error);
    }
  }

  // The channels of your server and how many play on each; null when it cannot be read.
  async channels(): Promise<{ current: number; players: number[] } | null> {
    if (this.current.phase !== "in") return null;
    return this.transport.call<{ current: number; players: number[] }>("channels").catch(() => null);
  }

  // To another channel of your server, where you stand. Null once there, or why it was refused.
  async changeChannel(channel: number): Promise<string | null> {
    if (this.current.phase !== "in") return "unavailable";
    this.set({ phase: "travelling" });
    try {
      await this.moveTo(await this.transport.call<ZoneEntry>("changeChannel", [channel]));
      return null;
    } catch (error) {
      this.set({ phase: "in" });
      return errorCode(error);
    }
  }

  async leave(): Promise<void> {
    const mine = ++this.generation;
    this.unlisten();
    this.watchRoomLink(null);
    this.link.stop();
    this.set({ phase: "idle", entry: null, others: [], monsters: {}, telegraphs: [], me: null });
    // Entered again at once (React's development double run): there is nothing to leave.
    await Promise.resolve();
    if (mine !== this.generation) return;
    // Keeps your spot from inside the room, then leaves it (unless you have come back meanwhile).
    await this.transport.call("leaveWorld").catch(() => undefined);
    if (mine === this.generation && WorldClient.lastEntered === this) this.transport.leaveRoom();
  }

  // Says a line in your channel. Answers null once it went out, or why it was refused.
  async say(text: string): Promise<string | null> {
    if (this.current.phase !== "in") return "unavailable";
    const line = readChat(text);
    if (line === null) return "unavailable";
    try {
      await this.transport.call("say", [line]);
      return null;
    } catch (error) {
      return errorCode(error);
    }
  }

  private heard(raw: unknown): void {
    const message = readChatMessage(raw);
    if (!message) return;
    this.chatCount += 1;
    const line: ChatLine = { ...message, id: this.chatCount, heardAt: this.now(), mine: message.account === this.account };
    this.set({ chat: [...this.current.chat, line].slice(-CHAT_KEEP) });
  }

  // Every POSE_THROTTLE_MS while moving, every IDLE_POSE_MS while standing still; a dodge roll, an attack
  // or a skill as soon as MIN_POSE_GAP_MS allows. Called every frame, so nothing held back is lost.
  reportPose(pose: Pose): void {
    if (this.current.phase !== "in") return;
    if (this.lastPose && this.now() - this.lastPose.at < MIN_POSE_GAP_MS) return;
    const sent = {
      x: pose.x, z: pose.z, yaw: pose.yaw, y: readJumpY(pose.y), roll: readSwing(pose.roll),
      swing: readSwing(pose.swing), skill: readSwing(pose.skill), slot: readSlot(pose.slot) ?? 0,
    };
    const now = this.now();
    const last = this.lastPose;
    const moved = !last || Math.abs(sent.x - last.x) > POSE_EPSILON || Math.abs(sent.z - last.z) > POSE_EPSILON
      || Math.abs(sent.yaw - last.yaw) > POSE_EPSILON || Math.abs(sent.y - (last.y ?? 0)) > POSE_EPSILON;
    const acted = !!last && (sent.roll !== (last.roll ?? 0) || sent.swing !== (last.swing ?? 0) || sent.skill !== (last.skill ?? 0));
    if (last && !acted && now - last.at < (moved ? POSE_THROTTLE_MS : IDLE_POSE_MS)) return;
    this.lastPose = { ...sent, at: now };
    void this.transport.call("reportPose", [sent], { needResponse: false });
  }

  // An attack on one monster; the server says whether it landed. Null when refused or not in the world.
  // Facing yaw: turning is instant, so it goes with the attack rather than waiting for the next pose.
  async strike(monsterId: string, yaw: number): Promise<HitResult | null> {
    if (this.current.phase !== "in") return null;
    return await this.transport.call<HitResult>("strike", [monsterId, yaw]).catch(() => null);
  }

  async useSkill(slot: number, yaw: number): Promise<HitResult | null> {
    if (this.current.phase !== "in") return null;
    return await this.transport.call<HitResult>("useSkill", [slot, yaw]).catch(() => null);
  }

  // 전직, and claiming a finished quest.
  advance(job: JobId): Promise<string | null> {
    return this.bagCall("advance", [job]);
  }

  takeQuest(): Promise<string | null> {
    return this.bagCall("takeQuest", []);
  }

  claimQuest(): Promise<string | null> {
    return this.bagCall("claimQuest", []);
  }

  claimDaily(id: string): Promise<string | null> {
    return this.bagCall("claimDaily", [id]);
  }

  // The first tutorial (see tutorial.ts): the elder's lesson, a step done on the screen, and the end.
  tutorialTalk(): Promise<string | null> {
    return this.bagCall("tutorialTalk", []);
  }

  tutorialStep(from: TutorialStep): Promise<string | null> {
    return this.bagCall("tutorialStep", [from]);
  }

  tutorialFinish(): Promise<string | null> {
    return this.bagCall("tutorialFinish", []);
  }

  // The newest update notice this account has read (see news.ts): asked once, then kept here.
  async newsSeen(): Promise<string | null> {
    if (this.seenNews === undefined) {
      this.seenNews = (await this.transport.call<{ seen: string | null }>("getNewsSeen").catch(() => null))?.seen ?? null;
    }
    return this.seenNews;
  }

  // All the news read: kept at once, and told to the server without waiting (should that fail, the
  // news only opens again next time).
  markNewsRead(): void {
    this.seenNews = NEWS[0].id;
    void this.transport.call("markNewsSeen", [NEWS[0].id], { needResponse: false });
  }

  // The server's grove and village (null when it could not be read).
  async grove(): Promise<GroveView | null> {
    return await this.transport.call<GroveView>("grove").catch(() => null);
  }

  // A gift to the village's building under way: the grove after it, or why it was refused.
  async donate(items: Partial<Record<ItemId, number>>, gold: number): Promise<GroveView | string> {
    try {
      const view = await this.transport.call<GroveView>("donate", [items, gold]);
      void this.refreshBag();
      return view;
    } catch (error) {
      return errorCode(error) ?? "unavailable";
    }
  }

  // Payouts that came in since the last call, oldest first.
  takePayouts(): Payout[] {
    const out = this.payouts;
    this.payouts = [];
    return out;
  }

  private notePayout(raw: unknown): void {
    const payout = readPayout(raw);
    const id = payout?.id ?? null;
    if (id === this.payoutSeen) return;
    const first = this.payoutSeen === undefined;
    this.payoutSeen = id;
    if (first || !payout) return;
    this.payouts.push({ xp: payout.xp, gold: payout.gold, items: payout.items });
    // Gold, drops and quest kills all live with the bag.
    void this.refreshBag();
  }

  async refreshBag(): Promise<void> {
    const bag = await this.transport.call<BagView>("getBag").catch(() => null);
    if (bag) this.set({ bag });
  }

  // Gems the server just told of (the stable, the market) go on the HUD's wallet at once.
  private noteGems<T>(answer: T): T {
    const gems = (answer as { gems?: unknown } | null)?.gems;
    const bag = this.current.bag;
    if (typeof gems === "number" && bag && bag.gems !== gems) this.set({ bag: { ...bag, gems } });
    return answer;
  }

  // The bag and the shop. Each answers null when done, or why it was refused.
  equip(uid: string): Promise<string | null> {
    return this.bagCall("equipItem", [uid]);
  }

  unequip(slot: Slot): Promise<string | null> {
    return this.bagCall("unequipItem", [slot]);
  }

  drink(id: ItemId): Promise<string | null> {
    return this.bagCall("drinkPotion", [id]);
  }

  buy(id: ItemId, count = 1): Promise<string | null> {
    return this.bagCall("buyItem", [id, count]);
  }

  // Potions or materials: `trade` sells from the stack that may be traded.
  sell(id: ItemId, count = 1, trade = false): Promise<string | null> {
    return this.bagCall("sellItem", [id, count, trade]);
  }

  sellPiece(uid: string): Promise<string | null> {
    return this.bagCall("sellPiece", [uid]);
  }

  private async bagCall(name: string, args: unknown[]): Promise<string | null> {
    if (this.current.phase !== "in") return "unavailable";
    try {
      this.set({ bag: await this.transport.call<BagView>(name, args) });
      return null;
    } catch (error) {
      return errorCode(error);
    }
  }

  // Parties (see party.ts): your party and invitations (null when it cannot be read), the players you
  // could invite, and every change, each answering null when done or why it was refused.
  // Calls back whenever the server says your party or your invitations changed (see nudge in party.ts).
  onPartyNudge(cb: () => void): () => void {
    let last: string | undefined;
    return this.transport.subscribeMyState((state) => {
      const key = `${String(state.party ?? "")}|${String(state.partyRev ?? "")}`;
      if (last !== undefined && key !== last) cb();
      last = key;
    });
  }

  async partyState(): Promise<PartyState | null> {
    if (this.current.phase !== "in") return null;
    return await this.transport.call<PartyState>("partyState").catch(() => null);
  }

  async partyCandidates(): Promise<PartyCandidate[] | null> {
    return await this.transport.call<PartyCandidate[]>("partyCandidates").catch(() => null);
  }

  inviteToParty(account: string): Promise<string | null> {
    return this.doneOrProblem("inviteToParty", [account]);
  }

  // Taken, you move to the leader's channel when it is not yours.
  async answerPartyInvite(id: string, accept: boolean): Promise<string | null> {
    try {
      const { channel } = await this.transport.call<{ channel: number | null }>("answerPartyInvite", [id, accept]);
      return channel !== null ? await this.changeChannel(channel) : null;
    } catch (error) {
      return errorCode(error);
    }
  }

  leaveParty(): Promise<string | null> {
    return this.doneOrProblem("leaveParty", []);
  }

  kickFromParty(account: string): Promise<string | null> {
    return this.doneOrProblem("kickFromParty", [account]);
  }

  passPartyLeader(account: string): Promise<string | null> {
    return this.doneOrProblem("passPartyLeader", [account]);
  }

  private async doneOrProblem(name: string, args: unknown[]): Promise<string | null> {
    try {
      await this.transport.call(name, args);
      return null;
    } catch (error) {
      return errorCode(error);
    }
  }

  // The attendance sheet (stamped by the server on coming in; null when it cannot be read) and today's
  // looked at, told without waiting.
  async attendance(): Promise<AttendanceView | null> {
    return await this.transport.call<AttendanceView>("getAttendance").catch(() => null);
  }

  markAttendanceSeen(): void {
    void this.transport.call("markAttendanceSeen", [], { needResponse: false });
  }

  // Achievements: the list (null when it cannot be read) and claiming one, whose gems go on the HUD.
  async achievements(): Promise<AchievementsView | null> {
    return await this.transport.call<AchievementsView>("getAchievements").catch(() => null);
  }

  async claimAchievement(id: string): Promise<(AchievementsView & { gems: number }) | { problem: string }> {
    return this.noteGems(await this.tryCall<AchievementsView & { gems: number }>("claimAchievement", [id]));
  }

  async claimAllAchievements(): Promise<(AchievementsView & { gems: number }) | { problem: string }> {
    return this.noteGems(await this.tryCall<AchievementsView & { gems: number }>("claimAllAchievements", []));
  }

  // The mailbox: its letters, newest first (null when it cannot be read), how many wait, and taking
  // them (what they carry lands in the bag, which is read again).
  async mailbox(): Promise<Mail[] | null> {
    return (await this.transport.call<{ mail: Mail[] }>("getMail").catch(() => null))?.mail ?? null;
  }

  async mailCount(): Promise<number> {
    return (await this.transport.call<{ count: number }>("mailCount").catch(() => null))?.count ?? 0;
  }

  async claimMail(id: string): Promise<{ mail: Mail[] } | { problem: string }> {
    try {
      const taken = await this.transport.call<{ mail: Mail[] }>("claimMail", [id]);
      void this.refreshBag();
      return taken;
    } catch (error) {
      return { problem: errorCode(error) };
    }
  }

  async claimAllMail(): Promise<{ mail: Mail[]; left: number; problem: string | null } | { problem: string }> {
    try {
      const taken = await this.transport.call<{ mail: Mail[]; left: number; problem: string | null }>("claimAllMail");
      void this.refreshBag();
      return taken;
    } catch (error) {
      return { problem: errorCode(error) };
    }
  }

  // Guilds: your guild's screen, the list to join, and every change to them (each answers the guild
  // screen after it, or the problem).
  guild(): Promise<GuildView | { problem: string }> {
    return this.tryCall("getGuild", []);
  }

  findGuilds(query: string): Promise<GuildListing[] | { problem: string }> {
    return this.tryCall("findGuilds", [query]);
  }

  // What the guild button's dot needs: applications waiting, and a boss to fight today.
  async guildBadge(): Promise<{ applicants: number; bossReady: boolean }> {
    return (await this.transport.call<{ applicants: number; bossReady: boolean }>("guildBadge").catch(() => null)) ?? { applicants: 0, bossReady: false };
  }

  // The guild boss: this week's boss and the guild's progress (the boss tab), going into one of the
  // guild's boss rooms, and back out to where you stood. Null once there, or the problem.
  guildBoss(): Promise<GuildBossView | { problem: string }> {
    return this.tryCall("guildBoss", []);
  }

  // The week's league across every guild, and last week's.
  guildLeague(): Promise<{ now: LeagueView; last: LeagueView } | { problem: string }> {
    return this.tryCall("guildLeague", []);
  }

  async enterArena(n: number): Promise<string | null> {
    if (this.current.phase !== "in") return "unavailable";
    this.set({ phase: "travelling" });
    try {
      await this.moveTo(await this.transport.call<ZoneEntry>("enterArena", [n]));
      return null;
    } catch (error) {
      this.set({ phase: "in" });
      return errorCode(error);
    }
  }

  // The Trial Dungeon (see dungeon.ts): how things stand (null when it cannot be read), the queue,
  // going in at once, saying yes, each answering how things stand after or why it was refused; and
  // the way into and out of its room.
  async dungeonState(): Promise<DungeonView | null> {
    if (this.current.phase !== "in") return null;
    return await this.transport.call<DungeonView>("dungeonState").catch(() => null);
  }

  dungeonCall(name: "queueDungeon" | "cancelDungeon" | "soloDungeon" | "readyDungeon"): Promise<DungeonView | { problem: string }> {
    return this.tryCall<DungeonView>(name, []);
  }

  async enterDungeon(): Promise<string | null> {
    if (this.current.phase !== "in") return "unavailable";
    this.set({ phase: "travelling" });
    try {
      await this.moveTo(await this.transport.call<ZoneEntry>("enterDungeon"));
      return null;
    } catch (error) {
      this.set({ phase: "in" });
      return errorCode(error);
    }
  }

  async leaveDungeon(): Promise<string | null> {
    this.set({ phase: "travelling" });
    try {
      await this.moveTo(await this.transport.call<ZoneEntry>("leaveDungeon"));
      return null;
    } catch (error) {
      this.set({ phase: "in" });
      return errorCode(error);
    }
  }

  async leaveArena(): Promise<string | null> {
    this.set({ phase: "travelling" });
    try {
      await this.moveTo(await this.transport.call<ZoneEntry>("leaveArena"));
      return null;
    } catch (error) {
      this.set({ phase: "in" });
      return errorCode(error);
    }
  }

  guildCall(name: GuildCall, args: unknown[] = []): Promise<GuildView | { problem: string }> {
    return this.tryCall(name, args);
  }

  // New announcements to every server since the last heard; they join state.announced (the chat) and
  // come back for the banner.
  async pollAnnouncements(): Promise<Announcement[]> {
    const fresh = (await this.transport.call<Announcement[]>("announcements", [this.announcedAt]).catch(() => null)) ?? [];
    const newer = fresh.filter((a) => a.at > this.announcedAt);
    if (newer.length === 0) return [];
    this.announcedAt = newer[newer.length - 1].at;
    const heardAt = this.now();
    this.set({ announced: [...this.current.announced, ...newer.map((n) => ({ ...n, heardAt }))].slice(-CHAT_KEEP) });
    return newer;
  }

  // Your guild's chat: new lines since the last one heard join state.guildChat. Asked every few
  // seconds by the chat box; `inGuild` says whether there is a guild to hear at all.
  async pollGuildChat(): Promise<void> {
    const r = await this.transport.call<{ lines: ChatMessage[]; inGuild: boolean }>("guildChat", [this.guildHeardAt]).catch(() => null);
    if (!r) return;
    if (!r.inGuild) {
      if (this.current.inGuild || this.current.guildChat.length > 0) this.set({ inGuild: false, guildChat: [] });
      return;
    }
    const fresh = r.lines.filter((l) => l.at > this.guildHeardAt);
    if (fresh.length === 0) {
      if (!this.current.inGuild) this.set({ inGuild: true });
      return;
    }
    this.guildHeardAt = fresh[fresh.length - 1].at;
    const lines = fresh.map((l): ChatLine => ({ ...l, id: ++this.chatCount, heardAt: this.now(), mine: l.account === this.account }));
    this.set({ inGuild: true, guildChat: [...this.current.guildChat, ...lines].slice(-CHAT_KEEP) });
  }

  async guildSay(text: string): Promise<string | null> {
    const line = readChat(text);
    if (line === null) return "unavailable";
    try {
      await this.transport.call("guildSay", [line]);
      await this.pollGuildChat();
      return null;
    } catch (error) {
      return errorCode(error);
    }
  }

  // The market: a page of listings, your own, putting something up (the bag is read again), buying
  // and taking down. Each answers what the server did, or the problem.
  async market(filter: Partial<MarketFilter>): Promise<MarketPage | { problem: string }> {
    return this.noteGems(await this.tryCall<MarketPage>("market", [filter]));
  }

  async myListings(): Promise<{ listings: ListingView[]; gems: number } | { problem: string }> {
    return this.noteGems(await this.tryCall<{ listings: ListingView[]; gems: number }>("myListings", []));
  }

  async sellOnMarket(what: { uid: string } | { item: ItemId; n: number }, price: number): Promise<{ listings: ListingView[] } | { problem: string }> {
    const r = await this.tryCall<{ bag: BagView; listings: ListingView[] }>("sellOnMarket", [what, price]);
    if ("bag" in r) this.set({ bag: r.bag });
    return r;
  }

  async buyListing(id: string, count: number): Promise<{ gems: number } | { problem: string }> {
    return this.noteGems(await this.tryCall<{ gems: number }>("buyFromMarket", [id, count]));
  }

  cancelListing(id: string): Promise<{ listings: ListingView[] } | { problem: string }> {
    return this.tryCall("cancelMarketListing", [id]);
  }

  // A call whose refusal the screen shows: the answer, or the problem's code.
  private async tryCall<T>(name: string, args: unknown[]): Promise<T | { problem: string }> {
    try {
      return await this.transport.call<T>(name, args);
    } catch (error) {
      return { problem: errorCode(error) };
    }
  }

  // Mounts: your gems and mounts (from the menus too), a draw, picking the one to ride, and getting
  // on or off. Null or a problem code when refused.
  async mounts(): Promise<MountsView | null> {
    return this.noteGems(await this.transport.call<MountsView>("getMounts").catch(() => null));
  }

  // One draw, or ten at once (`ten`), or one paid with a mount ticket (`ticket`).
  async pullMount(ten = false, ticket = false): Promise<(MountsView & { pulls: MountPull[] }) | { problem: string }> {
    try {
      const pulled = this.noteGems(await this.transport.call<MountsView & { pulls: MountPull[] }>(ten ? "pullMount10" : "pullMount", ten ? [] : [ticket]));
      // A new mount may be the picked one now, and the picked one adds to 전투력.
      void this.refreshBag();
      return pulled;
    } catch (error) {
      return { problem: errorCode(error) };
    }
  }

  async selectMount(id: MountId): Promise<MountsView | { problem: string }> {
    try {
      const view = await this.transport.call<MountsView>("selectMount", [id]);
      void this.refreshBag();
      return view;
    } catch (error) {
      return { problem: errorCode(error) };
    }
  }

  async ride(on: boolean): Promise<MountId | null> {
    if (this.current.phase !== "in") return null;
    const r = await this.transport.call<{ riding: MountId | null }>("ride", [on]).catch(() => null);
    return r?.riding ?? null;
  }

  // The smith: enhancing what is worn in a slot (the outcome, or why it was refused) and making things.
  // With `protect`, a failure at +6 and above never breaks the gear, for gems (see premium.ts).
  // `target`: a worn slot, or the uid of a piece in the bag.
  async enhance(target: Slot | string, protect = false): Promise<{ outcome: EnhanceOutcome } | { problem: string }> {
    if (this.current.phase !== "in") return { problem: "unavailable" };
    try {
      const { outcome, bag } = await this.transport.call<{ outcome: EnhanceOutcome; bag: BagView }>("enhanceGear", [target, protect]);
      this.set({ bag });
      // The gems it took show on the wallet at once.
      if (protect) void this.refreshBag();
      return { outcome };
    } catch (error) {
      return { problem: errorCode(error) };
    }
  }

  craft(recipe: string): Promise<string | null> {
    return this.bagCall("craftItem", [recipe]);
  }

  // The board, for the ranking panel in the world.
  ranking(): Promise<RankingView> {
    return this.transport.call<RankingView>("getRanking");
  }

  rankDetail(id: string): Promise<RankDetail> {
    return this.transport.call<RankDetail>("getRankDetail", [id]);
  }

  // Fallen: back to the village.
  // Fallen: up again where you fell, for gold. Null once up, or why it was refused.
  async reviveHere(): Promise<string | null> {
    if (this.current.phase !== "in" || !this.current.me?.dead) return "unavailable";
    try {
      await this.transport.call("reviveHere");
      void this.refreshBag();
      return null;
    } catch (error) {
      return errorCode(error);
    }
  }

  async respawn(): Promise<void> {
    if (this.current.phase !== "in" || !this.current.me?.dead) return;
    this.set({ phase: "travelling" });
    try {
      await this.moveTo(await this.transport.call<ZoneEntry>("respawn"));
    } catch (error) {
      this.set({ phase: "in" });
      this.set({ error: errorCode(error) });
    }
  }

  dispose(): void {
    this.unlisten();
    this.watchRoomLink(null);
    this.listeners.clear();
  }

  // Joins the room the server picked and stands your character in it (Verse8 2.0: the client joins).
  // Joining a room can fail for a moment (the room server busy, a network blip); the platform marks
  // such failures as not terminal, and they are tried again a few times before giving up.
  private async moveTo(entry: ZoneEntry): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.transport.joinRoom(entry.roomId);
        break;
      } catch (error) {
        const terminal = (error as { terminal?: unknown } | null)?.terminal === true;
        if (terminal || attempt >= JOIN_ATTEMPTS) throw error;
        await new Promise((resolve) => setTimeout(resolve, JOIN_RETRY_MS * attempt));
      }
    }
    const arrived = await this.transport.call<{ grove?: { gold: number; xp: number } | null }>("arrive");
    this.arrive(entry);
    // What the grove paid on coming in (stages reached, a finished building's thanks) shows like a
    // hunt's payout.
    if (arrived?.grove) {
      this.payouts.push({ xp: arrived.grove.xp, gold: arrived.grove.gold, items: [] });
      void this.refreshBag();
    }
  }

  private arrive(entry: ZoneEntry): void {
    this.unlisten();
    this.members = [];
    this.users = [];
    this.lastPose = null;
    this.payoutSeen = undefined;
    this.poseSeen.clear();
    this.set({ phase: "in", entry, others: [], monsters: {}, telegraphs: [], arenaMax: null, dungeon: null, mercs: {}, me: null, error: null });
    this.link.start();
    void this.refreshBag();
    this.listen(entry);
    this.watchRoomLink(entry);
  }

  // The room's connection, watched while in it. Remade by the platform, it has forgotten every
  // subscription (others then still saw your lines, but nothing of theirs came to you): they are made
  // again. Given up by the platform, the room is joined again.
  private watchRoomLink(entry: ZoneEntry | null): void {
    this.roomLinkOff?.();
    this.roomLinkOff = null;
    this.roomDown = false;
    if (!entry || !this.transport.onRoomLink) return;
    this.roomLinkOff = this.transport.onRoomLink((connected, roomId) => {
      if (this.current.phase !== "in" || this.current.entry?.roomId !== entry.roomId) return;
      if (!connected) {
        this.roomDown = true;
        if (roomId === null) void this.rejoin(entry);
        return;
      }
      if (roomId !== entry.roomId || !this.roomDown) return;
      this.roomDown = false;
      this.unlisten();
      this.listen(entry);
      void this.link.check();
    });
  }

  // Back into the room the platform gave up on, where you stood.
  private async rejoin(entry: ZoneEntry): Promise<void> {
    const mine = this.generation;
    this.set({ phase: "travelling" });
    try {
      await this.moveTo(entry);
    } catch (error) {
      if (mine === this.generation) this.fail(error);
    }
  }

  private listen(entry: ZoneEntry): void {
    this.unsubscribers = [
      this.transport.subscribeRoomState(entry.roomId, (state) => {
        const users = (state as { $users?: unknown }).$users;
        this.members = Array.isArray(users) ? users.filter((u): u is string => typeof u === "string") : [];
        const monsters = (state as { monsters?: unknown }).monsters;
        if (monsters !== undefined) this.set({ monsters: readMonsters(monsters) });
        const telegraphs = (state as { telegraphs?: unknown }).telegraphs;
        if (telegraphs !== undefined) this.set({ telegraphs: readTelegraphs(telegraphs) });
        const arena = (state as { arena?: { max?: unknown } }).arena;
        if (arena && typeof arena.max === "number" && arena.max !== this.current.arenaMax) this.set({ arenaMax: arena.max });
        const run = (state as { dungeon?: unknown }).dungeon;
        if (run !== undefined) this.set({ dungeon: readRun(run) });
        const mercs = (state as { mercs?: unknown }).mercs;
        if (mercs !== undefined) this.set({ mercs: readMercs(mercs) });
        this.refreshOthers();
      }),
      this.transport.onRoomMessage(entry.roomId, "chat", (message) => this.heard(message)),
      this.transport.subscribeRoomUsers(entry.roomId, (users) => {
        this.users = users as unknown as Record<string, unknown>[];
        this.refreshOthers();
      }),
    ];
  }

  // The others: whoever the room lists as present, with a pose and a look.
  private refreshOthers(): void {
    const others: OtherPlayer[] = [];
    let me: Vitals | null = this.current.me;
    for (const user of this.users) {
      const account = user.account;
      if (account === this.account) {
        me = readVitals(user) ?? me;
        this.notePayout(user.payout);
      }
      if (typeof account !== "string" || account === this.account || !this.members.includes(account)) continue;
      const look = readLook(user.look);
      if (!look || !isPose(user.pose)) continue;
      const p = user.pose;
      // Even standing still a player's pose comes again every IDLE_POSE_MS, with a new time on it.
      const poseKey = `${p.x},${p.z},${p.yaw},${(p as { at?: unknown }).at}`;
      const seen = this.poseSeen.get(account);
      const nowMs = this.now();
      if (!seen || seen.key !== poseKey) this.poseSeen.set(account, { key: poseKey, at: nowMs });
      else if (nowMs - seen.at > STALE_POSE_MS) continue;
      others.push({
        account, look, riding: readMountId(user.riding), dead: user.dead === true,
        hp: typeof user.hp === "number" ? user.hp : null, maxHp: typeof user.maxHp === "number" ? user.maxHp : null,
        pose: {
          x: p.x, z: p.z, yaw: p.yaw, y: readJumpY(p.y), swing: readSwing(p.swing), skill: readSwing(p.skill), roll: readSwing(p.roll),
          slot: readSlot(p.slot) ?? 0,
        },
      });
    }
    // A dungeon's mercenaries walk among them, as the room has them.
    for (const [id, m] of Object.entries(this.current.mercs)) {
      others.push({
        account: `merc:${id}`, merc: true, dead: m.dead, riding: null, hp: m.hp, maxHp: m.maxHp,
        look: { name: m.name, costume: m.costume, playerClass: m.playerClass, level: m.level, job: null },
        pose: { x: m.x, z: m.z, yaw: m.yaw, y: 0, swing: readSwing(m.swing), skill: readSwing(m.skill), roll: 0, slot: 0 },
      });
    }
    this.set({ others, me });
  }

  private unlisten(): void {
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
  }

  private fail(error: unknown): void {
    this.link.stop();
    this.set({ phase: "error", error: errorCode(error) });
  }

  private set(patch: Partial<WorldState>): void {
    this.current = { ...this.current, ...patch };
    for (const cb of this.listeners) cb(this.current);
  }
}
