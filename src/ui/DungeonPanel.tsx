import { useEffect, useState } from "react";
import {
  DAILY_RUNS, FAST_MS, FIRST_GEMS, GEAR_CHANCE, WAVES, bracketById, type DungeonView,
} from "../game/world/dungeon";
import type { WorldClient } from "../net/worldClient";
import { problemText } from "./BagPanel";
import { FullScreen } from "./FullScreen";
import { t, type Key } from "./lang";
import { className } from "./names";

export function clock(ms: number): string {
  const left = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

// A call that answers how things stand, or why it was refused.
type Act = () => Promise<DungeonView | { problem: string }>;

interface DungeonPanelProps {
  client: WorldClient;
  view: DungeonView | null;
  // Leading a party: going in at once takes the party.
  partyLeader: boolean;
  onView: (view: DungeonView) => void;
  onClose: () => void;
}

// The Trial Dungeon's screen: your bracket and its boss, runs left today, what a clear pays, and
// queueing (or going in at once).
export function DungeonPanel({ client, view, partyLeader, onView, onClose }: DungeonPanelProps) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const run = async (act: Act) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const r = await act();
    setBusy(false);
    if ("problem" in r) setNote(problemText(r.problem));
    else onView(r);
  };
  const bracket = bracketById(view?.bracket);
  return (
    <FullScreen title={t("dungeon.title")} className="dungeon-panel" onClose={onClose}>
      <p className="note dungeon-lead">{t("dungeon.lead", { n: WAVES })}</p>
      {!view && <p className="note">{t("common.loading")}</p>}
      {view && !bracket && <p className="note">{t("dungeon.tooLow", { n: 10 })}</p>}
      {view && bracket && (
        <>
          <div className="dungeon-card">
            <b>{t(`dungeon.bracket.${bracket.id}` as Key)}</b>
            <span>{t("dungeon.boss", { boss: t(`boss.${bracket.boss}` as Key) })}</span>
            <span className="note">{t("dungeon.runsLeft", { n: view.runsLeft, of: DAILY_RUNS })}</span>
          </div>
          <div className="dungeon-card">
            <b>{t("dungeon.rewards")}</b>
            <span>{t("dungeon.rewardLine", { gold: bracket.gold.toLocaleString(), stones: bracket.stones, pct: Math.round(GEAR_CHANCE * 100) })}</span>
            <span className="note">{t("dungeon.bonus", { time: clock(FAST_MS), n: FIRST_GEMS })}</span>
          </div>
          {note && <p className="note bad">{note}</p>}
          {view.match ? (
            <p className="note">{t("dungeon.matched", { names: view.match.names.join(", ") })}</p>
          ) : view.queued ? (
            <div className="dungeon-actions">
              <span className="dungeon-waiting">{t("dungeon.waiting", { time: clock(now - view.queued.since) })}</span>
              <button type="button" className="brush-button small" disabled={busy} onClick={() => void run(() => client.dungeonCall("cancelDungeon"))}>
                {t("dungeon.cancel")}
              </button>
            </div>
          ) : (
            <div className="dungeon-actions">
              <button type="button" className="brush-button small" disabled={busy || view.runsLeft === 0} onClick={() => void run(() => client.dungeonCall("queueDungeon"))}>
                {t("dungeon.queue")}
              </button>
              <button type="button" className="brush-button small" disabled={busy || view.runsLeft === 0} onClick={() => void run(() => client.dungeonCall("soloDungeon"))}>
                {t(partyLeader ? "dungeon.soloParty" : "dungeon.solo")}
              </button>
            </div>
          )}
          <p className="note dungeon-hint">{t("dungeon.waitingNote")}</p>
        </>
      )}
    </FullScreen>
  );
}

// A match found: who it is with, the seconds left to say yes, and saying it.
export function DungeonMatchBanner({ view, busy, onReady }: { view: DungeonView; busy: boolean; onReady: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const match = view.match!;
  return (
    <div className="dungeon-banner band" role="alertdialog">
      <span>{t("dungeon.matched", { names: match.names.join(", ") })}</span>
      {match.started ? (
        <span className="note">{t("dungeon.going")}</span>
      ) : match.ready ? (
        <span className="note">{t("dungeon.waitingOthers", { n: Math.max(0, Math.ceil((match.readyBy - now) / 1000)) })}</span>
      ) : (
        <button type="button" className="brush-button small" disabled={busy} onClick={onReady}>
          {t("dungeon.enter")} ({Math.max(0, Math.ceil((match.readyBy - now) / 1000))})
        </button>
      )}
    </div>
  );
}

// Inside: the bracket and the wave, the clock, the boss's bar once it is up, a way out, and once the
// run is over how it went and the way back.
export function DungeonHud({ client }: { client: WorldClient }) {
  const [, tick] = useState(0);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(timer);
  }, []);
  const s = client.state;
  const run = s.dungeon;
  const now = Date.now();
  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    void client.leaveDungeon().then((code) => {
      if (code) setLeaving(false);
    });
  };
  const boss = s.monsters.boss;
  const left = Object.values(s.monsters).filter((m) => m.alive).length;
  const over = run !== null && run.status !== "running";
  return (
    <>
      <div className="arena-hud dungeon-hud">
        <div className="arena-top">
          <b>{run ? t(`dungeon.bracket.${run.bracket}` as Key) : t("dungeon.title")}</b>
          <span>{run && run.wave > WAVES ? t("dungeon.bossWave") : t("dungeon.wave", { n: run?.wave ?? 1, of: WAVES })}</span>
          <span className="arena-clock">{run && !over ? clock(run.endsAt - now) : ""}</span>
        </div>
        {boss && run && run.wave > WAVES ? (
          <div className="arena-bar">
            <i style={{ width: `${Math.max(0, Math.min(1, boss.hp / (boss.maxHp ?? 1))) * 100}%` }} />
            <span>{t(`boss.${boss.type}` as Key)}</span>
          </div>
        ) : (
          <p className="arena-hint">{t("dungeon.left", { n: left })}</p>
        )}
        {Object.keys(s.mercs).length > 0 && (
          <ul className="dungeon-mercs">
            {Object.entries(s.mercs).map(([id, m]) => (
              <li key={id} className={m.dead ? "down" : undefined}>
                <span>{t("merc.tag")} {m.name} · {className(m.playerClass)}</span>
                <span className="hud-bar hp party-hp"><i style={{ width: `${Math.round(Math.max(0, Math.min(1, m.hp / m.maxHp)) * 100)}%` }} /></span>
              </li>
            ))}
          </ul>
        )}
        {!over && <button type="button" className="text-button arena-leave" disabled={leaving} onClick={leave}>{t("dungeon.leave")}</button>}
      </div>
      {over && run && (
        <div className="menu-modal">
          <div className="solid-panel arena-end">
            <h2>{run.status === "cleared" ? t("dungeon.cleared") : t("dungeon.failed")}</h2>
            <p className="note">
              {run.status === "cleared" ? t("dungeon.clearNote", { time: clock(run.clearMs ?? 0) }) : t("dungeon.failNote")}
            </p>
            <button type="button" className="brush-button small" disabled={leaving} onClick={leave}>{t("dungeon.leave")}</button>
          </div>
        </div>
      )}
    </>
  );
}
