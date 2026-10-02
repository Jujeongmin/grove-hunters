import { useEffect, useState } from "react";
import { ATTEND_DAYS, ATTEND_REWARDS, type AttendReward, type AttendanceView } from "../game/account/attendance";
import { METRICS, type AchievementRow, type AchievementsView, type Metric } from "../game/account/achievements";
import { iconFor } from "../game/render/icons";
import { playCue } from "../game/audio/sfx";
import type { WorldClient } from "../net/worldClient";
import { problemText } from "./BagPanel";
import { FullScreen } from "./FullScreen";
import { t, type Key } from "./lang";
import { itemName } from "./names";

export type RewardsTab = "attendance" | "achievements";

interface RewardsPanelProps {
  client: WorldClient;
  tab: RewardsTab;
  // Achievements still to claim after a change (the menu's dot).
  onClaimable: (n: number) => void;
  onClose: () => void;
}

// The attendance sheet and the achievements, side by side under two tabs. Opening it marks today's
// sheet as looked at.
export function RewardsPanel({ client, tab: firstTab, onClaimable, onClose }: RewardsPanelProps) {
  const [tab, setTab] = useState<RewardsTab>(firstTab);
  useEffect(() => client.markAttendanceSeen(), [client]);
  return (
    <FullScreen
      title={t("rewards.title")} className="rewards-panel"
      bar={(
        <nav className="full-tabs">
          {(["attendance", "achievements"] as const).map((id) => (
            <button key={id} type="button" className={`full-tab${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>
              {t(`rewards.tab.${id}`)}
            </button>
          ))}
        </nav>
      )}
      onClose={onClose}
    >
      {tab === "attendance" ? <AttendanceTab client={client} /> : <AchievementsTab client={client} onClaimable={onClaimable} />}
    </FullScreen>
  );
}

// One reward's picture and amount.
function rewardThing(reward: AttendReward): { icon: string | null; text: string; title: string } {
  if (reward.gems > 0) return { icon: iconFor("ui_gem"), text: reward.gems.toLocaleString(), title: t("rewards.gems", { n: reward.gems }) };
  if (reward.gold > 0) return { icon: iconFor("ui_gold"), text: reward.gold.toLocaleString(), title: t("mail.gold", { n: reward.gold.toLocaleString() }) };
  const item = reward.items[0];
  return { icon: iconFor(item.id), text: `×${item.n}`, title: `${itemName(item.id)} ×${item.n}` };
}

function AttendanceTab({ client }: { client: WorldClient }) {
  const [view, setView] = useState<AttendanceView | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void client.attendance().then((next) => {
      if (!live) return;
      if (next) setView(next);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [client]);
  if (!view) return <p className="note">{failed ? t("rewards.failed") : t("common.loading")}</p>;
  return (
    <div className="attend-tab">
      <p className="attend-lead">{view.stampedToday ? t("attend.today", { n: view.stamps }) : t("attend.notYet")}</p>
      <p className="note attend-every">
        <img src={iconFor("ui_ticket") ?? undefined} alt="" draggable={false} />
        {t("attend.ticketDays", { n: ATTEND_REWARDS.filter((r) => r.tickets > 0).length })}
      </p>
      <ol className="attend-grid">
        {Array.from({ length: ATTEND_DAYS }, (_, i) => {
          const day = i + 1;
          const thing = rewardThing(ATTEND_REWARDS[i]);
          const stamped = day <= view.stamps;
          const today = view.stampedToday && day === view.stamps;
          const big = ATTEND_REWARDS[i].gems >= 50;
          return (
            <li key={day} className={`attend-cell${stamped ? " stamped" : ""}${today ? " today" : ""}${big ? " big" : ""}`} title={thing.title}>
              <span className="attend-day">{t("attend.day", { n: day })}</span>
              {thing.icon && <img src={thing.icon} alt="" draggable={false} />}
              <span className="attend-amount">{thing.text}</span>
              {ATTEND_REWARDS[i].tickets > 0 && <img className="attend-ticket" src={iconFor("ui_ticket") ?? undefined} alt="" draggable={false} />}
              {stamped && <i className="attend-stamp" aria-label={t("attend.stamped")}>✔</i>}
            </li>
          );
        })}
      </ol>
      <p className="note attend-foot">{t("attend.foot", { n: view.total })}</p>
    </div>
  );
}

// What an achievement asks, in words.
function goalText(metric: Metric, goal: number): string {
  if (metric === "mushroom_king" || metric === "grove_guardian" || metric === "frost_emperor") {
    return t("ach.boss.goal", { boss: t(`monster.${metric}` as Key), n: goal });
  }
  return t(`ach.${metric}.goal` as Key, { n: goal.toLocaleString() });
}

function AchievementsTab({ client, onClaimable }: { client: WorldClient; onClaimable: (n: number) => void }) {
  const [view, setView] = useState<AchievementsView | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void client.achievements().then((next) => {
      if (!live) return;
      if (next) setView(next);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [client]);
  useEffect(() => {
    if (view) onClaimable(view.claimable);
    // onClaimable is a new function every render of the screen above.
  }, [view]);
  if (!view) return <p className="note">{failed ? t("rewards.failed") : t("common.loading")}</p>;

  const claim = async (row: AchievementRow | null) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const r = row ? await client.claimAchievement(row.id) : await client.claimAllAchievements();
    setBusy(false);
    if ("problem" in r) setNote(problemText(r.problem));
    else {
      setView(r);
      playCue("coins");
    }
  };
  // Each metric's line shows the first goal not yet claimed (or its last, all claimed).
  const lines = METRICS.map((metric) => {
    const rows = view.list.filter((a) => a.metric === metric);
    const next = rows.find((a) => !a.claimed) ?? rows[rows.length - 1];
    return { metric, next, done: rows.filter((a) => a.claimed).length, of: rows.length, all: rows.every((a) => a.claimed) };
  });
  return (
    <>
      <div className="ach-top">
        <p className="note ach-lead">{t("ach.lead", { n: view.list.filter((a) => a.claimed).length, of: view.list.length })}</p>
        <button type="button" className="brush-button small" disabled={busy || view.claimable === 0} onClick={() => void claim(null)}>
          {t("ach.claimAll", { n: view.claimable })}
        </button>
      </div>
      {note && <p className="note bad">{note}</p>}
      <ul className="ach-list">
        {lines.map(({ metric, next, done, of, all }) => {
          const ready = !next.claimed && next.progress >= next.goal;
          return (
            <li key={metric} className={`${ready ? "ready" : ""}${all ? " done" : ""}`}>
              <div className="ach-head">
                <b>{t(`ach.${metric}` as Key)}</b>
                <span className="note">{t("ach.steps", { n: done, of })}</span>
              </div>
              <div className="ach-row">
                <div className="ach-goal">
                  <span>{goalText(metric, next.goal)}</span>
                  <div className="ach-bar" role="progressbar" aria-valuemin={0} aria-valuemax={next.goal} aria-valuenow={next.progress}>
                    <i style={{ width: `${Math.round((next.progress / next.goal) * 100)}%` }} />
                    <em>{next.progress.toLocaleString()} / {next.goal.toLocaleString()}</em>
                  </div>
                </div>
                <span className="ach-gems">
                  <img src={iconFor("ui_gem") ?? undefined} alt="" draggable={false} />
                  {next.gems}
                </span>
                {all ? (
                  <span className="ach-done">{t("ach.done")}</span>
                ) : (
                  <button type="button" className="brush-button small" disabled={busy || !ready} onClick={() => void claim(next)}>
                    {t("ach.claim")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
