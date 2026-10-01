import { useEffect, useState } from "react";
import {
  GUILD_COST, GUILD_MAX, NOTICE_MAX, canAnswer, canKick, canLead, canWriteNotice,
  type GuildListing, type GuildMemberView, type GuildRole, type GuildView,
} from "../game/account/guild";
import { readClass } from "../game/combat/classes";
import { readZone } from "../game/world/zones";
import type { GuildBossView, GuildCall, WorldClient } from "../net/worldClient";
import { ARENA_SEATS, LEAGUE_GUILD_GEMS, LEAGUE_PLAYER_GEMS, type LeagueView } from "../game/world/guildBoss";
import { problemText } from "./BagPanel";
import { locale, t, type Key } from "./lang";
import { className, jobLabel, serverName, zoneName } from "./names";

interface GuildPanelProps {
  client: WorldClient;
  // Applications waiting, after a change (the menu's dot).
  onBadge: (n: number) => void;
  onClose: () => void;
}

// A yes asked for before something that cannot be taken back (putting out, handing over, leaving).
interface Asking { text: string; run: () => void }

// Guilds, shared by every server: with none, find one to join or found one; in one, its notice, its
// members and where they are, and what your role lets you do.
export function GuildPanel({ client, onBadge, onClose }: GuildPanelProps) {
  const [view, setView] = useState<GuildView | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [tab, setTab] = useState<"members" | "boss">("members");
  useEffect(() => {
    let live = true;
    void client.guild().then((r) => {
      if (!live) return;
      if ("problem" in r) setFailed(true);
      else setView(r);
    });
    return () => {
      live = false;
    };
  }, [client]);
  useEffect(() => {
    if (view) onBadge(view.guild?.applicants.length ?? 0);
    // onBadge is the screen's setter, the same every render.
  }, [view]);

  // Runs a guild change; the screen after it replaces this one.
  const act = async (name: GuildCall, args: unknown[] = []) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    setAsking(null);
    const r = await client.guildCall(name, args);
    setBusy(false);
    if ("problem" in r) setNote({ text: problemText(r.problem)!, tone: "bad" });
    else setView(r);
  };
  const ask = (text: string, run: () => void) => setAsking({ text, run });

  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel guild-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{view?.guild ? view.guild.name : t("guild.title")}</h2>
        {!view && <p className="note">{failed ? t("guild.failed") : t("common.loading")}</p>}
        {view && !view.guild && <NoGuild client={client} view={view} busy={busy} act={act} />}
        {view?.guild && (
          <div className="smith-tabs">
            {(["members", "boss"] as const).map((id) => (
              <button key={id} type="button" className={`text-button${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>
                {t(id === "boss" ? "guild.tab.boss" : "guild.tab.members")}
              </button>
            ))}
          </div>
        )}
        {view?.guild && tab === "members" && <InGuild view={view} busy={busy} act={act} ask={ask} />}
        {view?.guild && tab === "boss" && <BossTab client={client} onEntered={onClose} />}
        {asking && (
          <div className="market-confirm">
            <p>{asking.text}</p>
            <div>
              <button type="button" className="brush-button small" disabled={busy} onClick={asking.run}>{t("guild.yes")}</button>
              <button type="button" className="text-button" onClick={() => setAsking(null)}>{t("common.cancel")}</button>
            </div>
          </div>
        )}
        {note && <p className={`smith-note ${note.tone}`}>{note.text}</p>}
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}

type Act = (name: GuildCall, args?: unknown[]) => Promise<void>;

// A moment as the guild screen says it: the day and the hour, no seconds ("10월 5일 (월) 오전 12시").
function shortTime(ms: number): string {
  return new Date(ms).toLocaleString(locale(), { month: "short", day: "numeric", weekday: "short", hour: "numeric" });
}

function NoGuild({ client, view, busy, act }: { client: WorldClient; view: GuildView; busy: boolean; act: Act }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<GuildListing[] | null>(null);
  const [name, setName] = useState("");
  const search = async (q: string) => {
    const r = await client.findGuilds(q);
    setFound("problem" in r ? [] : r);
  };
  useEffect(() => {
    void search("");
    // Once, on opening: the list of open guilds.
  }, [client]);
  const waiting = view.waitUntil > Date.now();
  const appliedTo = new Set(view.applied.map((a) => a.id));
  return (
    <div className="guild-body">
      <p className="note">{t("guild.rules")}</p>
      {waiting && <p className="note guild-wait">{t("guild.wait", { time: shortTime(view.waitUntil) })}</p>}
      <h3>{t("guild.find")}</h3>
      <form
        className="guild-row-form"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <input value={query} maxLength={12} placeholder={t("guild.search")} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className="text-button">{t("guild.searchGo")}</button>
      </form>
      {found === null && <p className="note">{t("common.loading")}</p>}
      {found && found.length === 0 && <p className="note">{t("guild.none")}</p>}
      {found && found.length > 0 && (
        <ul className="guild-list">
          {found.map((g) => (
            <li key={g.id}>
              <span className="guild-what">
                <b>{g.name}</b>
                <span className="note">{g.notice || t("guild.noNotice")}</span>
              </span>
              <span className="note">{t("guild.count", { n: g.members, max: GUILD_MAX })}</span>
              {appliedTo.has(g.id) ? (
                <span className="note">{t("guild.applied")}</span>
              ) : (
                <button type="button" className="text-button" disabled={busy || waiting} onClick={() => void act("applyGuild", [g.id])}>{t("guild.apply")}</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {view.applied.length > 0 && (
        <>
          <h3>{t("guild.myApplications")}</h3>
          <ul className="guild-list">
            {view.applied.map((a) => (
              <li key={a.id}>
                <span className="guild-what"><b>{a.name}</b></span>
                <button type="button" className="text-button" disabled={busy} onClick={() => void act("cancelApplication", [a.id])}>{t("guild.withdraw")}</button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>{t("guild.create")}</h3>
      <form
        className="guild-row-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act("createGuild", [name]);
        }}
      >
        <input value={name} maxLength={12} placeholder={t("guild.search")} onChange={(e) => setName(e.target.value)} />
        <span className="note">{t("guild.createCost", { n: GUILD_COST.toLocaleString(locale()) })}</span>
        <button type="submit" className="brush-button small" disabled={busy || waiting || name.trim().length < 2}>{t("guild.createGo")}</button>
      </form>
    </div>
  );
}

// Where an online member is: server, channel, zone.
function whereText(m: GuildMemberView): string {
  if (!m.online || !m.where) return t("guild.offline");
  const zone = readZone(m.where.zone);
  return t("friends.where", {
    server: serverName(m.where.world), channel: t("world.channel", { n: m.where.channel }), zone: zone ? zoneName(zone) : m.where.zone,
  });
}

function InGuild({ view, busy, act, ask }: { view: GuildView; busy: boolean; act: Act; ask: (text: string, run: () => void) => void }) {
  const guild = view.guild!;
  const role = view.role;
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState(guild.notice);
  const [picked, setPicked] = useState<string | null>(null);
  const alone = guild.members.length === 1;
  return (
    <div className="guild-body">
      <div className="guild-notice">
        <b>{t("guild.notice")}</b>
        {editing ? (
          <form
            className="guild-row-form"
            onSubmit={(e) => {
              e.preventDefault();
              void act("setGuildNotice", [notice]).then(() => setEditing(false));
            }}
          >
            <input value={notice} maxLength={NOTICE_MAX} onChange={(e) => setNotice(e.target.value)} />
            <button type="submit" className="text-button" disabled={busy}>{t("guild.saveNotice")}</button>
          </form>
        ) : (
          <>
            <span>{guild.notice || t("guild.noNotice")}</span>
            {canWriteNotice(role) && <button type="button" className="text-button" onClick={() => setEditing(true)}>{t("guild.editNotice")}</button>}
          </>
        )}
      </div>
      <h3>{t("guild.members", { n: guild.members.length, max: GUILD_MAX })}</h3>
      <ul className="guild-list guild-members">
        {guild.members.map((m) => {
          const playerClass = readClass(m.playerClass);
          const open = picked === m.characterId;
          return (
            <li key={m.characterId} className={m.online ? "online" : ""}>
              <button type="button" className="guild-member" onClick={() => setPicked(open ? null : m.characterId)}>
                <i className="presence" />
                <span className="guild-what">
                  <b>{m.name} <span className={`guild-role ${m.role}`}>{t(`guild.role.${m.role}` as Key)}</span></b>
                  <span className="note">
                    Lv{m.level} {jobLabel(m.job) ?? (playerClass ? className(playerClass) : "")} · {whereText(m)}
                  </span>
                </span>
              </button>
              {open && (
                <MemberActions member={m} role={role} busy={busy} act={act} ask={ask} />
              )}
            </li>
          );
        })}
      </ul>
      {canAnswer(role) && guild.applicants.length > 0 && (
        <>
          <h3>{t("guild.applicants")}</h3>
          <ul className="guild-list">
            {guild.applicants.map((a) => (
              <li key={a.characterId}>
                <span className="guild-what"><b>{a.name}</b></span>
                <button type="button" className="text-button" disabled={busy} onClick={() => void act("answerApplication", [a.characterId, true])}>{t("guild.accept")}</button>
                <button type="button" className="text-button" disabled={busy} onClick={() => void act("answerApplication", [a.characterId, false])}>{t("guild.decline")}</button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="guild-foot">
        {role !== "master" && (
          <button type="button" className="text-button" disabled={busy} onClick={() => ask(t("guild.confirmLeave"), () => void act("leaveGuild"))}>{t("guild.leave")}</button>
        )}
        {role === "master" && alone && (
          <button type="button" className="text-button" disabled={busy} onClick={() => ask(t("guild.confirmDisband"), () => void act("disbandGuild"))}>{t("guild.disband")}</button>
        )}
      </div>
    </div>
  );
}

// What your role lets you do to another member: put them out, change their role, hand the guild over.
function MemberActions({ member, role, busy, act, ask }: {
  member: GuildMemberView; role: GuildRole | null; busy: boolean; act: Act; ask: (text: string, run: () => void) => void;
}) {
  const buttons: { label: string; run: () => void }[] = [];
  if (canLead(role) && member.role !== "master") {
    buttons.push(member.role === "vice"
      ? { label: t("guild.makeMember"), run: () => void act("setGuildRole", [member.characterId, "member"]) }
      : { label: t("guild.makeVice"), run: () => void act("setGuildRole", [member.characterId, "vice"]) });
    buttons.push({ label: t("guild.pass"), run: () => ask(t("guild.confirmPass", { name: member.name }), () => void act("passGuildMaster", [member.characterId])) });
  }
  if (canKick(role, member.role)) {
    buttons.push({ label: t("guild.kick"), run: () => ask(t("guild.confirmKick", { name: member.name }), () => void act("kickMember", [member.characterId])) });
  }
  if (buttons.length === 0) return null;
  return (
    <div className="guild-actions">
      {buttons.map((b) => <button key={b.label} type="button" className="text-button" disabled={busy} onClick={b.run}>{b.label}</button>)}
    </div>
  );
}

// The guild boss this week: how far the guild has got, whether you can go in today, the boss rooms
// and how full they are, and who has done the most.
function BossTab({ client, onEntered }: { client: WorldClient; onEntered: () => void }) {
  const [boss, setBoss] = useState<GuildBossView | null>(null);
  // Which board shows: the guild's own damage, every guild's, or every player's (this week or last).
  const [board, setBoard] = useState<"mine" | "guilds" | "players">("mine");
  const [lastWeek, setLastWeek] = useState(false);
  const [league, setLeague] = useState<{ now: LeagueView; last: LeagueView } | null>(null);
  useEffect(() => {
    if (board === "mine" || league) return;
    let live = true;
    void client.guildLeague().then((r) => {
      if (live && !("problem" in r)) setLeague(r);
    });
    return () => {
      live = false;
    };
  }, [client, board, league]);
  const shown = league ? (lastWeek ? league.last : league.now) : null;
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void client.guildBoss().then((r) => {
      if (!live) return;
      if ("problem" in r) setFailed(true);
      else setBoss(r);
    });
    return () => {
      live = false;
    };
  }, [client]);
  if (!boss) return <p className="note">{failed ? t("guild.failed") : t("common.loading")}</p>;
  const left = Math.max(0, boss.max - boss.damage);
  const down = left <= 0;
  const enter = async (n: number) => {
    setBusy(true);
    setProblem(null);
    const code = await client.enterArena(n);
    setBusy(false);
    if (code) setProblem(problemText(code));
    else onEntered();
  };
  return (
    <div className="guild-body boss-tab">
      <div className="boss-head">
        <span className="note">{t("boss.week")}</span>
        <b>{t(`boss.${boss.boss}` as Key)}</b>
        <span className="note">{t("boss.endsAt", { time: shortTime(boss.endsAt) })}</span>
      </div>
      <div className="boss-gauge">
        <i style={{ width: `${(left / boss.max) * 100}%` }} />
        {[0.25, 0.5, 0.75].map((s) => <b key={s} style={{ left: `${(1 - s) * 100}%` }} />)}
      </div>
      <p className="note">{down ? t("boss.down") : t("boss.left", { n: Math.ceil((left / boss.max) * 100) })}</p>
      {!down && <p className={`note${boss.enteredToday ? "" : " boss-ready"}`}>{boss.enteredToday ? t("boss.today") : t("boss.ready")}</p>}
      {!down && (
        <ul className="boss-rooms">
          {boss.rooms.map((n, i) => (
            <li key={i}>
              <b>{t("boss.room", { n: i + 1 })}</b>
              <span className="note">{t("boss.seats", { n, max: ARENA_SEATS })}</span>
              <button
                type="button" className="text-button" disabled={busy || boss.enteredToday || n >= ARENA_SEATS}
                onClick={() => void enter(i + 1)}
              >
                {t("boss.enter")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {problem && <p className="smith-note bad">{problem}</p>}
      <div className="smith-tabs boss-board-tabs">
        {(["mine", "guilds", "players"] as const).map((b) => (
          <button key={b} type="button" className={`text-button${board === b ? " on" : ""}`} onClick={() => setBoard(b)}>
            {t(`boss.board.${b}` as Key)}
          </button>
        ))}
        {board !== "mine" && (
          <button type="button" className="text-button boss-board-week" onClick={() => setLastWeek((v) => !v)}>
            {t(lastWeek ? "boss.lastWeek" : "boss.thisWeek")}
          </button>
        )}
      </div>
      {board === "mine" && (boss.ranking.length === 0 ? (
        <p className="note">{t("boss.noRanking")}</p>
      ) : (
        <ol className="boss-ranking">
          {boss.ranking.map((r, i) => (
            <li key={i} className={r.mine ? "mine" : ""}>
              <span>{i + 1}. {r.name}</span>
              <span>{r.damage.toLocaleString(locale())}</span>
            </li>
          ))}
        </ol>
      ))}
      {board !== "mine" && !league && <p className="note">{t("common.loading")}</p>}
      {board === "guilds" && shown && (shown.guilds.length === 0 ? (
        <p className="note">{t("boss.noRanking")}</p>
      ) : (
        <>
          <ol className="boss-ranking">
            {shown.guilds.map((g, i) => (
              <li key={i} className={g.mine ? "mine" : ""}>
                <span>{i === 0 ? "👑" : `${i + 1}.`} {g.name}</span>
                <span>{g.killed ? t("boss.killed") : `${Math.floor(g.share * 100)}%`}</span>
              </li>
            ))}
          </ol>
          {shown.myGuildRank !== null && <p className="note">{t("boss.myGuildRank", { n: shown.myGuildRank })}</p>}
        </>
      ))}
      {board === "players" && shown && (shown.players.length === 0 ? (
        <p className="note">{t("boss.noRanking")}</p>
      ) : (
        <ol className="boss-ranking">
          {shown.players.map((p, i) => (
            <li key={i} className={p.mine ? "mine" : ""}>
              <span>{i + 1}. {p.name} <em className="note">&lt;{p.guild}&gt;</em></span>
              <span>{p.damage.toLocaleString(locale())}</span>
            </li>
          ))}
        </ol>
      ))}
      {board !== "mine" && <p className="note">{t("boss.leagueNote", { g1: LEAGUE_GUILD_GEMS[0], p1: LEAGUE_PLAYER_GEMS[0] })}</p>}
      <p className="note">{t("boss.mine", { n: boss.myDamage.toLocaleString(locale()) })}</p>
      <p className="note">{t("boss.stages")}</p>
    </div>
  );
}
