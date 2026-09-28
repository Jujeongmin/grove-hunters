import { t, type Key } from "./lang";
import type { TutorialGlow, TutorialStep } from "../game/account/tutorial";

interface TutorialTrackerProps {
  step: TutorialStep;
  glow: TutorialGlow;
  // J does what tapping it does (none on a touch screen).
  keyLabel: string | null;
  // Tapping the elder's step walks there; on the way, how far is left in metres.
  onWalk: () => void;
  way: number | null;
}

// The first tutorial's next thing to do, where the quest usually sits. It never stands in the way:
// the rest of the game works meanwhile.
export function TutorialTracker({ step, glow, keyLabel, onWalk, way }: TutorialTrackerProps) {
  const walks = step === 0;
  return (
    <div
      className={`hud-quest tutorial${walks ? " clickable" : ""}${glow === "tracker" ? " tutorial-glow" : ""}`}
      role={walks ? "button" : undefined}
      onClick={walks ? onWalk : undefined}
    >
      <b>{t("tutorial.title")}</b>
      <span>{t(`tutorial.step${step}` as Key)}{walks && way !== null && <b className="way"> {Math.max(1, Math.round(way))}m</b>}</span>
      {walks && keyLabel && <kbd className="hud-key">{keyLabel}</kbd>}
    </div>
  );
}

export function TutorialDoneBanner({ onClose }: { onClose: () => void }) {
  return (
    <div className="quest-complete" role="status" onClick={onClose}>
      <span className="quest-complete-title">{t("tutorial.doneTitle")}</span>
      <span className="hint">{t("tutorial.doneHint")}</span>
    </div>
  );
}
