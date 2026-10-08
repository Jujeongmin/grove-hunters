import type { BagView } from "../game/account/items";
import { t } from "./lang";
import { questGoal, questName } from "./names";
import { questHint } from "./questHint";
import { QUESTS, questDone, questTaken } from "../game/account/quests";
import type { MonsterType } from "../game/world/monsters";

interface QuestTrackerProps {
  bag: BagView | null;
  // Auto-battle is already heading for this quest's monsters (or you are on the way to the elder);
  // of that, whether it is the elder, and whether a monster of the hunt is being fought now.
  seeking: boolean;
  toElder: boolean;
  fighting: boolean;
  // How far is left to walk, in metres.
  way: number | null;
  // Tapping an unfinished quest sends you hunting for its monsters.
  onSeek: (types: readonly MonsterType[]) => void;
  // Tapping a finished one walks you to the elder to report it, through the portals if need be.
  onReport: () => void;
  // The key that does what tapping it does, shown in its corner (none on a touch screen).
  keyLabel: string | null;
}

// The quest you are on, at the right, kept short: its name, what to hunt and how far along (the
// reward is in the quest tab). Tapping it goes after its monsters; once done, it is reported to the
// elder in the village.
export function QuestTracker({ bag, seeking, toElder, fighting, way, onSeek, onReport, keyLabel }: QuestTrackerProps) {
  if (!bag) return null;
  const index = bag.quest.index;
  const quest = QUESTS[index];
  if (!quest) {
    return (
      <div className="hud-quest">
        <b>{t("quest.allDone")}</b>
      </div>
    );
  }
  // Not yet taken: it waits at the elder, and a tap walks you there to take it.
  if (!questTaken(bag.quest)) {
    return (
      <div className={`hud-quest clickable${toElder ? " seeking" : ""}`} role="button" onClick={onReport}>
        <b>{questName(index)}</b>
        <span>{t("quest.notTaken")}</span>
        <span className="hint">{toElder ? t("quest.goingToTake") : t("quest.goTake")}</span>
        {keyLabel && <kbd className="hud-key">{keyLabel}</kbd>}
      </div>
    );
  }
  const done = questDone(bag.quest);
  const { key, going, showWay } = questHint(done, { seeking, toElder, fighting });
  const hint = t(key);
  // On the way: how far is left.
  const left = showWay && way !== null ? `${Math.max(1, Math.round(way))}m` : null;
  return (
    <div
      className={`hud-quest clickable${going ? " seeking" : ""}${done ? " done" : ""}`}
      role="button"
      onClick={() => {
        if (!done) onSeek(quest.targets);
        else onReport();
      }}
    >
      <b>{questName(index)}{done ? " ✔" : ""}</b>
      <span>{questGoal(index)} <span className="count">{bag.quest.count}/{quest.count}</span></span>
      <span className="hint">{hint}{left && <b className="way"> {left}</b>}</span>
      {keyLabel && <kbd className="hud-key">{keyLabel}</kbd>}
    </div>
  );
}
