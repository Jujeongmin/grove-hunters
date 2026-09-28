import { useCallback, useEffect, useRef, useState } from "react";
import type { BagView } from "../game/account/items";
import type { PlayerClass } from "../game/combat/classes";
import { TUTORIAL, tutorialStepDone, type TutorialStep } from "../game/account/tutorial";
import type { WorldClient } from "../net/worldClient";
import { hotbarFor, onSettings, setHotbarSlot, settings, updateSettings } from "./settings";

// Whether auto-battle may use the slot holding the first skill, and the potion.
function autoFlags(playerClass: PlayerClass): { skill: boolean; potion: boolean } {
  const s = settings();
  const at = hotbarFor(playerClass).indexOf(0);
  return { skill: at >= 0 && s.autoSkills[at] === true, potion: s.autoPotion };
}

// The first tutorial on the screen: watches the bar, the auto-use settings and auto-battle, and tells
// the server when a step is done (the elder's step the server moves on itself).
export function useTutorial(client: WorldClient, bag: BagView | null, playerClass: PlayerClass, autoBattle: boolean) {
  const step = bag ? bag.tutorial : null;
  const [placedSkill, setPlacedSkill] = useState(false);
  const [auto, setAuto] = useState(() => autoFlags(playerClass));
  const [finished, setFinished] = useState(false);
  useEffect(() => onSettings(() => setAuto(autoFlags(playerClass))), [playerClass]);

  // Coming into the auto-use step, the bar's auto-use starts off (the first skill starts on by
  // default), so that dragging a slot down turns it on rather than off. Only on the step's start,
  // not on coming back to a step already begun.
  const last = useRef<TutorialStep | null>(step);
  useEffect(() => {
    if (last.current === TUTORIAL.register && step === TUTORIAL.auto) {
      const at = hotbarFor(playerClass).indexOf(0);
      const autoSkills = settings().autoSkills.map((on, i) => (i === at ? false : on));
      updateSettings({ autoSkills, autoPotion: false });
    }
    last.current = step;
  }, [step, playerClass]);

  // One call per step: the answer brings the next step with the bag.
  const sent = useRef<TutorialStep | null>(null);
  useEffect(() => {
    if (step === null || step === TUTORIAL.talk || sent.current === step) return;
    // Read afresh, not from the state: coming into the auto-use step, the effect above has just
    // turned auto-use off, and the state still holds what it was a moment ago.
    const now = autoFlags(playerClass);
    const seen = { placedSkill, autoSkill: now.skill, autoPotion: now.potion, autoBattle };
    if (!tutorialStepDone(step, seen)) return;
    sent.current = step;
    const call = step === TUTORIAL.battle ? client.tutorialFinish() : client.tutorialStep(step);
    void call.then((code) => {
      if (code) sent.current = null;
      else if (step === TUTORIAL.battle) setFinished(true);
    });
  }, [step, placedSkill, auto, autoBattle, client, playerClass]);

  const placed = useCallback(() => {
    if (step === TUTORIAL.register) setPlacedSkill(true);
  }, [step]);

  // Skipped: the first skill goes on the bar if it is not there, so nothing is left to set up.
  const skip = useCallback(() => {
    void client.tutorialSkip().then((code) => {
      if (!code && !hotbarFor(playerClass).includes(0)) setHotbarSlot(playerClass, 0, 0);
    });
  }, [client, playerClass]);

  return { step, placed, skip, finished, clearFinished: () => setFinished(false) };
}
