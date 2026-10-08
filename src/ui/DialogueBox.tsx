import { useEffect, useState } from "react";
import { t, type Key } from "./lang";
import { npcName, npcRole, questGoal, questName } from "./names";
import { objectParticle } from "./korean";
import type { BagView } from "../game/account/items";
import { QUESTS, questDone, questTaken } from "../game/account/quests";
import { dialogueChoices, type DialogueChoice } from "../game/world/dialogue";
import { roleOf, type NpcId } from "../game/world/npcs";

// How fast the words come out, in characters a second.
const TYPE_RATE = 40;

const PROBLEM: Record<string, Key> = {
  not_near: "problem.not_near_elder",
  quest_unfinished: "problem.quest_unfinished",
};

const CHOICE_LABEL: Record<DialogueChoice, Key> = {
  accept: "quests.accept", claim: "quests.claim", seek: "quests.goFind", donate: "dialogue.donate", shop: "dialogue.shop", forge: "dialogue.forge",
  close: "common.close",
};

// What the NPC says, by who they are and where you stand with the elder.
function lineFor(id: NpcId, bag: BagView | null): string {
  if (roleOf(id) === "merchant") return t(`npc.${id}.hello` as Key);
  if (roleOf(id) === "smith") return t(`npc.${id}.hello` as Key);
  if (!bag) return "…";
  if (bag.tutorial !== null) return t("npc.elder.tutorial");
  const quest = QUESTS[bag.quest.index];
  if (!quest) return t("npc.elder.done");
  const index = bag.quest.index;
  if (!questTaken(bag.quest)) return t("npc.elder.offer", { goal: questGoal(index), p: objectParticle(questGoal(index)) });
  return questDone(bag.quest)
    ? t("npc.elder.claim", { quest: questName(index) })
    : t("npc.elder.ask", { goal: questGoal(index), p: objectParticle(questGoal(index)) });
}

interface DialogueBoxProps {
  id: NpcId;
  bag: BagView | null;
  // A village building is under way: the elder takes gifts for it.
  building: boolean;
  // Hands the finished quest in; answers null when done, or why it was refused.
  onClaim: () => Promise<string | null>;
  // Takes the quest on; answers null when done, or why it was refused.
  onAccept: () => Promise<string | null>;
  // Picks a way on: go after the quest, the shop, the forge, or just leave.
  onChoice: (choice: Exclude<DialogueChoice, "claim" | "accept">) => void;
}

// A talk with someone in the village, across the bottom of the screen while the camera is at their
// face: their name, their words coming out a letter at a time, and the ways on once they are said.
// A tap anywhere moves the talk on: the rest of the words at once, then (when leaving is the only way
// on) the end of the talk.
export function DialogueBox({ id, bag, building, onClaim, onAccept, onChoice }: DialogueBoxProps) {
  const line = lineFor(id, bag);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => setShown(0), [line]);
  useEffect(() => {
    if (shown >= line.length) return;
    const timer = setTimeout(() => setShown((n) => n + 1), 1000 / TYPE_RATE);
    return () => clearTimeout(timer);
  }, [shown, line]);
  const said = shown >= line.length;
  const state = bag ? { quest: bag.quest, tutorial: bag.tutorial } : null;
  const choices = dialogueChoices(id, state, building);
  const quest = bag ? QUESTS[bag.quest.index] : undefined;

  const moveOn = () => {
    if (!said) setShown(line.length);
    else if (choices.length === 1 && choices[0] === "close") onChoice("close");
  };

  const choose = (choice: DialogueChoice) => {
    if (choice !== "claim" && choice !== "accept") {
      onChoice(choice);
      return;
    }
    setBusy(true);
    setProblem(null);
    void (choice === "claim" ? onClaim() : onAccept()).then((code) => {
      setBusy(false);
      if (code) setProblem(t(PROBLEM[code] ?? "problem.cannotClaim"));
    });
  };

  return (
    <div className="dialogue-layer" onClick={moveOn}>
      <div className="dialogue">
        <div className="dialogue-body">
          <p className="dialogue-name">{npcName(id)} <span>{npcRole(id)}</span></p>
          <p className="dialogue-text">{line.slice(0, shown)}</p>
          {said && id === "elder" && quest && bag?.tutorial === null && questTaken(bag.quest) && (
            <p className="dialogue-quest">
              <b>{questName(bag.quest.index)}</b> {questGoal(bag.quest.index)} · {bag.quest.count}/{quest.count}
            </p>
          )}
          {problem && <p className="bag-problem">{problem}</p>}
        </div>
        {said && (
          <div className="dialogue-choices" onClick={(e) => e.stopPropagation()}>
            {choices.map((choice) => (
              <button
                key={choice} type="button" disabled={busy}
                className={choice === "close" ? "text-button" : "brush-button small"}
                onClick={() => choose(choice)}
              >
                {t(CHOICE_LABEL[choice])}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
