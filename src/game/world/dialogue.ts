import type { TutorialStep } from "../account/tutorial";
import { QUESTS, questDone, type QuestProgress } from "../account/quests";
import type { NpcId } from "./npcs";

// Talking to the village's people: what hangs over each one's head, and what a talk can lead to.

// What the character has on with the elder (null before the bag has loaded).
export type NpcState = { quest: QuestProgress; tutorial: TutorialStep | null } | null;

// Over the elder, ! for something to hear (the tutorial's lesson, the quest on) and ? for a quest to
// hand in; over the merchant and the smith, their trade.
export type NpcMarker = "quest" | "report" | "shop" | "forge";

export function npcMarker(id: NpcId, state: NpcState): NpcMarker | null {
  if (id === "merchant") return "shop";
  if (id === "smith") return "forge";
  if (!state) return null;
  if (state.tutorial !== null) return "quest";
  if (!QUESTS[state.quest.index]) return null;
  return questDone(state.quest) ? "report" : "quest";
}

// The buttons at the end of a talk: hand the quest in, go after it, open the shop or the forge, or
// leave. In the tutorial the elder only teaches.
export type DialogueChoice = "claim" | "seek" | "shop" | "forge" | "close";

export function dialogueChoices(id: NpcId, state: NpcState): DialogueChoice[] {
  if (id === "merchant") return ["shop", "close"];
  if (id === "smith") return ["forge", "close"];
  if (!state || state.tutorial !== null || !QUESTS[state.quest.index]) return ["close"];
  return [questDone(state.quest) ? "claim" : "seek", "close"];
}
