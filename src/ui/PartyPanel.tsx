import { useEffect, useState } from "react";
import { PARTY_MAX, type PartyCandidate, type PartyMemberView, type PartyState } from "../game/account/party";
import { readZone } from "../game/world/zones";
import type { OtherPlayer, WorldClient } from "../net/worldClient";
import { problemText } from "./BagPanel";
import { FullScreen } from "./FullScreen";
import { t } from "./lang";
import { className, jobLabel, zoneName } from "./names";

// Where a member is, from where you stand: in this room (their bar shows instead), elsewhere on your
// channel, on another channel, or away.
function placeText(m: PartyMemberView, here: { zone: string; channel: number }): string {
  if (!m.online || !m.where) return t("party.away");
  if (m.where.channel !== here.channel) return t("party.otherChannel", { n: m.where.channel });
  const zone = readZone(m.where.zone);
  return zone ? zoneName(zone) : m.where.zone;
}

function whatText(m: Pick<PartyMemberView, "level" | "job" | "playerClass">): string {
  return `Lv${m.level} ${jobLabel(m.job) ?? (m.playerClass ? className(m.playerClass) : "")}`;
}

// Under the corner map: the other members, with their health when they are in this room (live, from
// the room) and otherwise where they are.
export function PartyFrame({ state, me, others, here, onOpen }: {
  state: PartyState | null;
  me: string;
  others: readonly OtherPlayer[];
  here: { zone: string; channel: number };
  onOpen: () => void;
}) {
  const party = state?.party;
  if (!party) return null;
  return (
    <button type="button" className="party-frame" onClick={onOpen} title={t("party.title")}>
      {party.members.filter((m) => m.account !== me).map((m) => {
        const near = others.find((o) => o.account === m.account);
        const hp = near && near.hp !== null && near.maxHp ? Math.max(0, Math.min(1, near.hp / near.maxHp)) : null;
        return (
          <span key={m.account} className={`party-member${near ? " near" : ""}${m.online ? "" : " away"}`}>
            <span className="party-name">
              {party.leader === m.account && <i className="party-crown" aria-label={t("party.leader")}>♛</i>}
              <b>{m.name}</b>
              <small>Lv{m.level}</small>
            </span>
            {hp !== null ? (
              <span className="hud-bar hp party-hp"><i style={{ width: `${Math.round(hp * 100)}%` }} /></span>
            ) : (
              <small className="party-place">{placeText(m, here)}</small>
            )}
          </span>
        );
      })}
    </button>
  );
}

// An invitation waiting: who sends it, and taking or turning it down.
export function PartyInviteBanner({ invite, busy, onAnswer }: {
  invite: { id: string; fromName: string };
  busy: boolean;
  onAnswer: (accept: boolean) => void;
}) {
  return (
    <div className="party-invite band" role="alertdialog">
      <span>{t("party.invited", { name: invite.fromName })}</span>
      <button type="button" className="brush-button small" disabled={busy} onClick={() => onAnswer(true)}>{t("party.accept")}</button>
      <button type="button" className="text-button" disabled={busy} onClick={() => onAnswer(false)}>{t("party.decline")}</button>
    </div>
  );
}

interface PartyPanelProps {
  client: WorldClient;
  state: PartyState | null;
  me: string;
  here: { zone: string; channel: number };
  // Asks the server again after a change.
  onChanged: () => void;
  onClose: () => void;
}

// The party: its members (the leader may let one go or hand over the lead), leaving it, and the
// players on your channel you could invite.
export function PartyPanel({ client, state, me, here, onChanged, onClose }: PartyPanelProps) {
  const [candidates, setCandidates] = useState<PartyCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const [invited, setInvited] = useState<string[]>([]);
  const party = state?.party ?? null;
  const leading = !party || party.leader === me;
  const full = party !== null && party.members.length >= PARTY_MAX;
  const memberKey = party?.members.map((m) => m.account).join(",") ?? "";
  useEffect(() => {
    let live = true;
    void client.partyCandidates().then((list) => {
      if (live) setCandidates(list ?? []);
    });
    return () => {
      live = false;
    };
  }, [client, memberKey]);

  const run = async (act: () => Promise<string | null>, done?: string) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const problem = await act();
    setBusy(false);
    if (problem) setNote({ text: problemText(problem)!, tone: "bad" });
    else {
      if (done) setNote({ text: done, tone: "good" });
      onChanged();
    }
  };

  return (
    <FullScreen title={t("party.title")} className="party-panel" onClose={onClose}>
      <p className="note party-lead">{t("party.lead", { n: PARTY_MAX })}</p>
      {note && <p className={`note ${note.tone}`}>{note.text}</p>}
      {party ? (
        <>
          <h3 className="party-head">{t("party.members", { n: party.members.length, of: PARTY_MAX })}</h3>
          <ul className="party-list">
            {party.members.map((m) => (
              <li key={m.account}>
                <span className="party-who">
                  {party.leader === m.account && <i className="party-crown">♛</i>}
                  <b>{m.name}</b>
                  {m.account === me && <small className="party-you">{t("party.you")}</small>}
                </span>
                <span className="note">{whatText(m)} · {m.account === me ? t("party.here") : placeText(m, here)}</span>
                {leading && m.account !== me && (
                  <span className="party-actions">
                    <button type="button" className="text-button" disabled={busy} onClick={() => void run(() => client.passPartyLeader(m.account))}>
                      {t("party.pass")}
                    </button>
                    <button type="button" className="text-button bad" disabled={busy} onClick={() => void run(() => client.kickFromParty(m.account))}>
                      {t("party.kick")}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="party-leave">
            <button type="button" className="brush-button small" disabled={busy} onClick={() => void run(() => client.leaveParty(), t("party.left"))}>
              {t("party.leave")}
            </button>
          </div>
        </>
      ) : (
        <p className="note">{t("party.none")}</p>
      )}

      <h3 className="party-head">{t("party.nearby", { n: here.channel })}</h3>
      {!leading && <p className="note">{t("party.onlyLeader")}</p>}
      {candidates === null && <p className="note">{t("common.loading")}</p>}
      {candidates && candidates.length === 0 && <p className="note">{t("party.noOne")}</p>}
      {candidates && candidates.length > 0 && (
        <ul className="party-list">
          {candidates.map((c) => (
            <li key={c.account}>
              <span className="party-who"><b>{c.name}</b></span>
              <span className="note">{whatText({ level: c.level, job: null, playerClass: c.playerClass })}</span>
              <span className="party-actions">
                <button
                  type="button" className="brush-button small" disabled={busy || !leading || full || invited.includes(c.account)}
                  onClick={() => void run(async () => {
                    const problem = await client.inviteToParty(c.account);
                    if (!problem) setInvited((list) => [...list, c.account]);
                    return problem;
                  }, t("party.inviteSent", { name: c.name }))}
                >
                  {invited.includes(c.account) ? t("party.invitedBadge") : t("party.invite")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </FullScreen>
  );
}
