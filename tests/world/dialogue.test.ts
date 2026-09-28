import { describe, expect, it } from "vitest";
import { dialogueChoices, npcMarker, type NpcState } from "../../src/game/world/dialogue";
import { QUESTS } from "../../src/game/account/quests";
import type { TutorialStep } from "../../src/game/account/tutorial";

const on = (index: number, count: number, tutorial: TutorialStep | null = null): NpcState => ({ quest: { index, count }, tutorial });

describe("talking to the village's people", () => {
  it("marks the elder with ! for something to hear and ? for a quest to hand in", () => {
    expect(npcMarker("elder", on(0, 0, 0))).toBe("quest");
    expect(npcMarker("elder", on(0, 0))).toBe("quest");
    expect(npcMarker("elder", on(0, QUESTS[0].count))).toBe("report");
    expect(npcMarker("elder", on(QUESTS.length, 0))).toBeNull();
    expect(npcMarker("elder", null)).toBeNull();
  });

  it("marks the shop and the forge by what they do", () => {
    expect(npcMarker("merchant", on(0, 0))).toBe("shop");
    expect(npcMarker("smith", null)).toBe("forge");
  });

  it("offers what the talk can lead to, and always a way out", () => {
    expect(dialogueChoices("elder", on(0, 0, 1))).toEqual(["close"]);
    expect(dialogueChoices("elder", on(0, 0))).toEqual(["seek", "close"]);
    expect(dialogueChoices("elder", on(0, QUESTS[0].count))).toEqual(["claim", "close"]);
    expect(dialogueChoices("elder", on(QUESTS.length, 0))).toEqual(["close"]);
    expect(dialogueChoices("merchant", null)).toEqual(["shop", "close"]);
    expect(dialogueChoices("smith", null)).toEqual(["forge", "close"]);
  });

  it("lets the elder take gifts while a building is under way", () => {
    expect(dialogueChoices("elder", on(0, 0), true)).toEqual(["seek", "donate", "close"]);
    expect(dialogueChoices("elder", on(QUESTS.length, 0), true)).toEqual(["donate", "close"]);
    expect(dialogueChoices("elder", on(0, 0, 1), true)).toEqual(["close"]);
    expect(dialogueChoices("merchant", null, true)).toEqual(["shop", "close"]);
  });
});
