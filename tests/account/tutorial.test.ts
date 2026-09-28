import { describe, expect, it } from "vitest";
import {
  TUTORIAL, readTutorial, skillLearned, tutorialGlow, tutorialStepDone, type TutorialSeen,
} from "../../src/game/account/tutorial";

const NOTHING: TutorialSeen = { placedSkill: false, autoSkill: false, autoPotion: false, autoBattle: false };

describe("the first tutorial", () => {
  it("reads a saved step, and anything else as finished", () => {
    expect(readTutorial(0)).toBe(0);
    expect(readTutorial(3)).toBe(3);
    expect(readTutorial(undefined)).toBeNull();
    expect(readTutorial(null)).toBeNull();
    expect(readTutorial(4)).toBeNull();
    expect(readTutorial(1.5)).toBeNull();
    expect(readTutorial("1")).toBeNull();
  });

  it("keeps the first skill until the elder teaches it; the others are never held back", () => {
    expect(skillLearned(TUTORIAL.talk, 0)).toBe(false);
    expect(skillLearned(TUTORIAL.talk, 1)).toBe(true);
    expect(skillLearned(TUTORIAL.register, 0)).toBe(true);
    expect(skillLearned(null, 0)).toBe(true);
  });

  it("moves each step on by what the player did", () => {
    // The elder's step is the server's to move on.
    expect(tutorialStepDone(TUTORIAL.talk, { placedSkill: true, autoSkill: true, autoPotion: true, autoBattle: true })).toBe(false);
    expect(tutorialStepDone(TUTORIAL.register, NOTHING)).toBe(false);
    expect(tutorialStepDone(TUTORIAL.register, { ...NOTHING, placedSkill: true })).toBe(true);
    expect(tutorialStepDone(TUTORIAL.auto, { ...NOTHING, autoSkill: true })).toBe(false);
    expect(tutorialStepDone(TUTORIAL.auto, { ...NOTHING, autoPotion: true })).toBe(false);
    expect(tutorialStepDone(TUTORIAL.auto, { ...NOTHING, autoSkill: true, autoPotion: true })).toBe(true);
    expect(tutorialStepDone(TUTORIAL.battle, NOTHING)).toBe(false);
    expect(tutorialStepDone(TUTORIAL.battle, { ...NOTHING, autoBattle: true })).toBe(true);
  });

  it("lights what to press next", () => {
    const closed = { menuOpen: false, skillsOpen: false };
    expect(tutorialGlow(null, closed)).toBeNull();
    expect(tutorialGlow(TUTORIAL.talk, closed)).toBe("tracker");
    expect(tutorialGlow(TUTORIAL.register, closed)).toBe("fold");
    expect(tutorialGlow(TUTORIAL.register, { menuOpen: true, skillsOpen: false })).toBe("skills");
    expect(tutorialGlow(TUTORIAL.register, { menuOpen: true, skillsOpen: true })).toBe("slot0");
    expect(tutorialGlow(TUTORIAL.auto, closed)).toBe("bar");
    expect(tutorialGlow(TUTORIAL.battle, closed)).toBe("auto");
  });
});
