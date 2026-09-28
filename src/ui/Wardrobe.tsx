import { useEffect, useRef } from "react";
import { t } from "./lang";
import { costumeName, partLabel, partOptionName } from "./names";
import {
  COSTUMES, PART_KEYS, randomCostume, withPart, type Costume, type PartKey,
} from "../game/render/costumes";

interface WardrobeProps {
  costume: Costume;
  onPick: (costume: Costume) => void;
  // Turns the hero on screen as you drag across the left side.
  onSpin: (radians: number) => void;
  onClose: () => void;
  // The last step of making a character: saves it.
  onStart: () => void;
  // While the character is being saved.
  busy: boolean;
}


// Radians of turn per pixel dragged.
const SPIN_PER_PIXEL = 0.012;

// The last step of making a character: it stands on the left, turning as you drag, and the right
// side picks each part of its look, fixed once the character is made.
export function Wardrobe({ costume, onPick, onSpin, onClose, onStart, busy }: WardrobeProps) {
  const drag = useRef<number | null>(null);

  // Escape leaves, like the other screens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const preset = COSTUMES.find((c) => c.id === costume.id);

  return (
    <div className="wardrobe">
      <div
        className="wardrobe-stage"
        onPointerDown={(e) => {
          drag.current = e.clientX;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current === null) return;
          onSpin((e.clientX - drag.current) * SPIN_PER_PIXEL);
          drag.current = e.clientX;
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <span className="wardrobe-hint">{t("look.spin")}</span>
      </div>

      <aside className="wardrobe-panel">
        <header className="wardrobe-head">
          <h2>{t("look.title")}</h2>
          <button type="button" className="text-button" onClick={onClose}>{t("common.back")}</button>
        </header>

        <section>
          <h3>{t("look.shape")}</h3>
          <div className="wardrobe-presets">
            {COSTUMES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`wardrobe-chip${preset?.id === c.id ? " picked" : ""}`}
                onClick={() => onPick(c)}
              >
                {costumeName(c, COSTUMES)}
              </button>
            ))}
            <button type="button" className="wardrobe-chip" onClick={() => onPick(randomCostume())}>{t("look.random")}</button>
          </div>
          <PartRows keys={PART_KEYS} costume={costume} onPick={onPick} />
        </section>

        <button type="button" className="brush-button wardrobe-start" onClick={onStart} disabled={busy}>
          {busy ? t("look.making") : t("look.create")}
        </button>

        <p className="note">{t("look.onceNote")}</p>
      </aside>
    </div>
  );
}


// One row per part: its name, and arrows that step through its options.
function PartRows({ keys, costume, onPick }: { keys: PartKey[]; costume: Costume; onPick: (c: Costume) => void }) {
  return (
    <ul className="wardrobe-parts">
      {keys.map((key) => {
        return (
          <li key={key}>
            <span className="wardrobe-part-label">{partLabel(key)}</span>
            <button type="button" className="wardrobe-arrow" aria-label={t("look.previous", { part: partLabel(key) })} onClick={() => onPick(withPart(costume, key, -1))}>‹</button>
            <span className="wardrobe-part-value">{partOptionName(key, costume.parts[key])}</span>
            <button type="button" className="wardrobe-arrow" aria-label={t("look.next", { part: partLabel(key) })} onClick={() => onPick(withPart(costume, key, 1))}>›</button>
          </li>
        );
      })}
    </ul>
  );
}
