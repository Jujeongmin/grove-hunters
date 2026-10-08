import type { TutorialStep } from "../account/tutorial";
import { QUESTS, questDone, questTaken, type QuestProgress } from "../account/quests";
import { roleOf, type NpcId } from "./npcs";

// Talking to the village's people: what hangs over each one's head, and what a talk can lead to.

// What the character has on with the elder (null before the bag has loaded).
export type NpcState = { quest: QuestProgress; tutorial: TutorialStep | null } | null;

// Over the elder, ! for something to hear (the tutorial's lesson, a quest to take) and ? for a quest
// to hand in (nothing while one is under way); over the merchant and the smith, their trade.
export type NpcMarker = "quest" | "report" | "shop" | "forge";

export function npcMarker(id: NpcId, state: NpcState): NpcMarker | null {
  if (roleOf(id) === "merchant") return "shop";
  if (roleOf(id) === "smith") return "forge";
  if (!state) return null;
  if (state.tutorial !== null) return "quest";
  if (!QUESTS[state.quest.index]) return null;
  if (!questTaken(state.quest)) return "quest";
  return questDone(state.quest) ? "report" : null;
}

// The buttons at the end of a talk: take the quest on, hand it in, go after it, give to the village's
// building under way (`building`), open the shop or the forge, or leave. In the tutorial the elder only
// teaches.
export type DialogueChoice = "accept" | "claim" | "seek" | "donate" | "shop" | "forge" | "close";

export function dialogueChoices(id: NpcId, state: NpcState, building = false): DialogueChoice[] {
  if (roleOf(id) === "merchant") return ["shop", "close"];
  if (roleOf(id) === "smith") return ["forge", "close"];
  if (!state || state.tutorial !== null) return ["close"];
  const quest: DialogueChoice[] = !QUESTS[state.quest.index] ? []
    : !questTaken(state.quest) ? ["accept"] : [questDone(state.quest) ? "claim" : "seek"];
  // Gifts to the grove's buildings go to the village's own elder only.
  return [...quest, ...(building && id === "elder" ? ["donate" as const] : []), "close"];
}
