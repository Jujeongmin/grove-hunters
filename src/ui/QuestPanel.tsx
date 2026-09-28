import { useState } from "react";
import { itemName, npcName, questGoal, questName } from "./names";
import { t, type Key } from "./lang";
import { type BagView } from "../game/account/items";
import { QUESTS, questDone } from "../game/account/quests";
import type { MonsterType } from "../game/world/monsters";
import type { WorldClient } from "../net/worldClient";
import { objectParticle } from "./korean";

interface QuestPanelProps {
  client: WorldClient;
  bag: BagView | null;
  onSeek: (types: readonly MonsterType[]) => void;
  onClose: () => void;
}

const PROBLEM: Record<string, Key> = {
  not_near: "problem.not_near_elder",
  quest_unfinished: "problem.quest_unfinished",
};

// Talking to the elder: the quest you are on, how far along it is, and the reward; hand it in when
// done, or set off after its monsters.
export function QuestPanel({ client, bag, onSeek, onClose }: QuestPanelProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const index = bag?.quest.index ?? -1;
  const quest = bag ? QUESTS[index] : undefined;
  const done = bag ? questDone(bag.quest) : false;
  const reward = quest
    ? [
      t("common.xp", { n: quest.xp.toLocaleString() }), t("common.gold", { n: quest.gold.toLocaleString() }),
      ...quest.items.map((i) => `${itemName(i.id)}${i.n > 1 ? ` ×${i.n}` : ""}`),
    ]
    : [];
  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel npc-panel" onClick={(e) => e.stopPropagation()}>
        <p className="npc-name">{npcName("elder")}</p>
        {!bag ? (
          <p className="note">{t("common.loading")}</p>
        ) : bag.tutorial !== null ? (
          // In the first tutorial the elder teaches, rather than asks.
          <p className="npc-line">{t("npc.elder.tutorial")}</p>
        ) : !quest ? (
          <p className="npc-line">{t("npc.elder.done")}</p>
        ) : (
          <>
            <p className="npc-line">
              {done
                ? t("npc.elder.claim", { quest: questName(index) })
                : t("npc.elder.ask", { goal: questGoal(index), p: objectParticle(questGoal(index)) })}
            </p>
            <div className="npc-quest">
              <b>{questName(index)}</b>
              <span>{questGoal(index)} · {bag.quest.count}/{quest.count}</span>
              <span>{t("common.reward", { what: reward.join(t("list.join")) })}</span>
            </div>
            {done ? (
              <button
                type="button" className="brush-button" disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setProblem(null);
                  void client.claimQuest().then((code) => {
                    setBusy(false);
                    if (code) setProblem(t(PROBLEM[code] ?? "problem.cannotClaim"));
                  });
                }}
              >
                {t("quests.claim")}
              </button>
            ) : (
              <button type="button" className="brush-button" onClick={() => { onSeek(quest.targets); onClose(); }}>
                {t("quests.goFind")}
              </button>
            )}
          </>
        )}
        {problem && <p className="bag-problem">{problem}</p>}
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}
