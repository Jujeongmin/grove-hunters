import { useState } from "react";
import { t } from "./lang";
import { usePages } from "./Pager";
import { dailyGoal, dailyName, itemName, questGoal, questName } from "./names";
import { type BagView } from "../game/account/items";
import { DAILY_QUESTS, QUESTS, dailyToday, questDone, type Quest } from "../game/account/quests";
import type { MonsterType } from "../game/world/monsters";

// A quest's reward as one line: XP, gold and any items.
export function rewardText(quest: { xp?: number; gold: number; items: Quest["items"] }): string {
  return [
    ...(quest.xp ? [t("common.xp", { n: quest.xp.toLocaleString() })] : []),
    t("common.gold", { n: quest.gold.toLocaleString() }),
    ...quest.items.map((i) => `${itemName(i.id)}${i.n > 1 ? ` ×${i.n}` : ""}`),
  ].join(t("list.join"));
}

// The day's quests, one per hunting field: how far along, the reward, and claiming it.
function DailyList({ bag, onClaimDaily }: { bag: BagView; onClaimDaily: (id: string) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const today = dailyToday(bag.daily, Date.now());
  return (
    <>
      <p className="note">{t("quests.daily")}</p>
      {DAILY_QUESTS.map((q) => {
        const count = today.counts[q.id] ?? 0;
        const claimed = today.claimed.includes(q.id);
        const done = count >= q.count;
        return (
          <div key={q.id} className={`quest-entry daily${done ? " done" : ""}${claimed ? " past" : ""}`}>
            <b>{dailyName(q)}{claimed ? " ✔" : ""}</b>
            <span>{dailyGoal(q)}</span>
            <div className="hud-bar xp"><i style={{ width: `${Math.round((count / q.count) * 100)}%` }} /></div>
            <span className="quest-count">{count} / {q.count}</span>
            <span className="quest-reward">{t("common.reward", { what: rewardText(q) })}</span>
            {done && !claimed && (
              <button
                type="button" className="brush-button small" disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setProblem(null);
                  void onClaimDaily(q.id).then((code) => {
                    setBusy(false);
                    if (code) setProblem(t("problem.cannotClaim"));
                  });
                }}
              >
                {t("quests.claim")}
              </button>
            )}
            {claimed && <span className="hint">{t("quests.claimedToday")}</span>}
          </div>
        );
      })}
      {problem && <p className="note">{problem}</p>}
    </>
  );
}

interface QuestLogProps {
  bag: BagView | null;
  inVillage: boolean;
  onSeek: (types: readonly MonsterType[]) => void;
  onReport: () => void;
  onClaimDaily: (id: string) => Promise<string | null>;
  onClose: () => void;
}

// The quest tab, in three pages so it never needs a scroll: the quest you are on in full (what to
// hunt, how far along, the reward, what to do next) with how many are still to come; the day's
// quests; and the ones already done, a page at a time.
export function QuestLog({ bag, inVillage, onSeek, onReport, onClaimDaily, onClose }: QuestLogProps) {
  const [tab, setTab] = useState<"now" | "daily" | "past">("now");
  const index = bag?.quest.index ?? 0;
  const quest = QUESTS[index];
  const done = bag ? questDone(bag.quest) : false;
  const past = QUESTS.slice(0, index).map((_, i) => index - 1 - i);
  const pastPage = usePages(past, PAST_PER_PAGE);
  return (
    <div className="side-panel quest-log">
      <h2>{t("quests.title")}</h2>
      <div className="quest-tabs">
        <button type="button" className={`text-button${tab === "now" ? " on" : ""}`} onClick={() => setTab("now")}>{t("quests.tabNow")}</button>
        <button type="button" className={`text-button${tab === "daily" ? " on" : ""}`} onClick={() => setTab("daily")}>{t("quests.tabDaily")}</button>
        <button type="button" className={`text-button${tab === "past" ? " on" : ""}`} onClick={() => setTab("past")}>{t("quests.tabPast")} {index}</button>
      </div>
      {!bag ? (
        <p className="note">{t("common.loading")}</p>
      ) : tab === "now" ? (
        <>
          {quest ? (
            <div className={`quest-entry current${done ? " done" : ""}`}>
              <b>{questName(index)}{done ? " ✔" : ""}</b>
              <span>{questGoal(index)}</span>
              <div className="hud-bar xp"><i style={{ width: `${Math.round((bag.quest.count / quest.count) * 100)}%` }} /></div>
              <span className="quest-count">{bag.quest.count} / {quest.count}</span>
              <span className="quest-reward">{t("common.reward", { what: rewardText(quest) })}</span>
              {done ? (
                inVillage
                  ? <button type="button" className="brush-button small" onClick={() => { onReport(); onClose(); }}>{t("quests.goReport")}</button>
                  : <span className="hint">{t("quests.reportHint")}</span>
              ) : (
                <button type="button" className="brush-button small" onClick={() => { onSeek(quest.targets); onClose(); }}>{t("quests.goFind")}</button>
              )}
            </div>
          ) : (
            <p className="note">{t("quests.allDone")}</p>
          )}
          {quest && index + 1 < QUESTS.length && <p className="note">{t("quests.more", { n: QUESTS.length - index - 1 })}</p>}
        </>
      ) : tab === "daily" ? (
        <DailyList bag={bag} onClaimDaily={onClaimDaily} />
      ) : (
        <>
          {past.length === 0 && <p className="note">{t("quests.noPast")}</p>}
          {pastPage.shown.map((i) => (
            <div key={i} className="quest-entry past">
              <b>{questName(i)} ✔</b>
              <span>{questGoal(i)}</span>
            </div>
          ))}
          {pastPage.pager}
        </>
      )}
      <button type="button" className="text-button quest-log-close" onClick={onClose}>{t("common.close")}</button>
    </div>
  );
}

// Finished quests on one page of their tab.
const PAST_PER_PAGE = 5;

// The moment a quest is done: a panel in the middle of the screen, shown once, that fades by itself.
export function QuestCompleteBanner({ index, inVillage, onClose }: { index: number; inVillage: boolean; onClose: () => void }) {
  return (
    <div className="quest-complete" role="status" onClick={onClose}>
      <span className="quest-complete-title">{t("quests.complete")}</span>
      <b>{questName(index)}</b>
      <span>{t("common.reward", { what: rewardText(QUESTS[index]) })}</span>
      <span className="hint">{t(inVillage ? "quests.reportHere" : "quests.reportInVillage")}</span>
    </div>
  );
}
