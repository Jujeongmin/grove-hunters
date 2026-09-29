// The first tutorial, for new characters: the elder teaches the first skill and hands over potions,
// then the player puts the skill on the bar, lets auto-battle use it and the potion, and turns
// auto-battle on. A character keeps its step on the server; one without a step (every character
// from before the tutorial, and one that finished or skipped it) is done.
export const TUTORIAL = { talk: 0, register: 1, auto: 2, battle: 3 } as const;
export type TutorialStep = (typeof TUTORIAL)[keyof typeof TUTORIAL];

// What the elder hands over, and what finishing pays.
export const TUTORIAL_POTIONS = 5;
export const TUTORIAL_GOLD = 100;

export function readTutorial(raw: unknown): TutorialStep | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= TUTORIAL.talk && raw <= TUTORIAL.battle
    ? (raw as TutorialStep)
    : null;
}

// The first skill waits for the elder; the others are held back by level and advancement as ever.
export function skillLearned(step: TutorialStep | null, index: number): boolean {
  return index !== 0 || step === null || step >= TUTORIAL.register;
}

// What the screen has seen the player do.
export interface TutorialSeen {
  // Dropped a skill onto the bar from the skill panel, during the step that asks for it; or opened
  // the panel while the bar already held it (a new character's bar starts with it).
  placedSkill: boolean;
  sawSkillOnBar: boolean;
  // Auto-battle may use the slot holding the first skill, and the potion.
  autoSkill: boolean;
  autoPotion: boolean;
  autoBattle: boolean;
}

export function tutorialStepDone(step: TutorialStep, seen: TutorialSeen): boolean {
  switch (step) {
    // Talking to the elder is checked (and paid) by the server, which moves this step on itself.
    case TUTORIAL.talk: return false;
    case TUTORIAL.register: return seen.placedSkill || seen.sawSkillOnBar;
    case TUTORIAL.auto: return seen.autoSkill && seen.autoPotion;
    case TUTORIAL.battle: return seen.autoBattle;
  }
}

// What the tracker asks for: the drag only while the bar lacks the first skill; with it there
// already, a look at the skill panel.
export function tutorialStepText(step: TutorialStep, skillOnBar: boolean): string {
  return step === TUTORIAL.register && skillOnBar ? "tutorial.step1Placed" : `tutorial.step${step}`;
}

// What lights up for the step: the tracker (tapping it walks to the elder), the folded menu, the
// skills button in it, the bar's first slot, the whole bar, or the auto-battle button.
export type TutorialGlow = "tracker" | "fold" | "skills" | "slot0" | "bar" | "auto" | null;

export function tutorialGlow(step: TutorialStep | null, ui: { menuOpen: boolean; skillsOpen: boolean }): TutorialGlow {
  if (step === null) return null;
  if (step === TUTORIAL.talk) return "tracker";
  if (step === TUTORIAL.register) return ui.skillsOpen ? "slot0" : ui.menuOpen ? "skills" : "fold";
  if (step === TUTORIAL.auto) return "bar";
  return "auto";
}
