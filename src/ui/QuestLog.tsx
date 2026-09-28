import { useState } from "react";
import { t } from "./lang";
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
      <h3>{t("quests.daily")}</h3>
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

// The quest tab: the quest you are on in full (what to hunt, how far along, the reward, what to do
// next), the ones already done, and how many are still to come.
export function QuestLog({ bag, inVillage, onSeek, onReport, onClaimDaily, onClose }: QuestLogProps) {
  const index = bag?.quest.index ?? 0;
  const quest = QUESTS[index];
  const done = bag ? questDone(bag.quest) : false;
  return (
    <div className="side-panel quest-log">
      <h2>{t("quests.title")}</h2>
      {!bag ? (
        <p className="note">{t("common.loading")}</p>
      ) : quest ? (
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
      {bag && <DailyList bag={bag} onClaimDaily={onClaimDaily} />}
      {index > 0 && (
        <>
          <h3>{t("quests.past")}</h3>
          {QUESTS.slice(0, index).map((_, i) => index - 1 - i).map((past) => (
            <div key={past} className="quest-entry past">
              <b>{questName(past)} ✔</b>
              <span>{questGoal(past)}</span>
            </div>
          ))}
        </>
      )}
      {quest && index + 1 < QUESTS.length && <p className="note">{t("quests.more", { n: QUESTS.length - index - 1 })}</p>}
      <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
    </div>
  );
}

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
