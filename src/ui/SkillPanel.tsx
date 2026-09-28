import { useEffect, useRef, useState } from "react";
import { t } from "./lang";
import type { PlayerClass } from "../game/combat/classes";
import { SKILLS } from "../game/combat/skills";
import { skillBlurb, skillName } from "./names";
import { iconFor, skillIconId } from "../game/render/icons";
import { hotbarFor, onSettings, setHotbarSlot } from "./settings";

interface SkillPanelProps {
  playerClass: PlayerClass;
  level: number;
  onClose: () => void;
}

// The class's skills, top right: the ones your level has taught you can be dragged onto a slot of
// the bar at the bottom (the hotbar's cells carry data-slot). The panel leaves the bar in view.
export function SkillPanel({ playerClass, level, onClose }: SkillPanelProps) {
  const [bar, setBar] = useState(() => hotbarFor(playerClass));
  useEffect(() => onSettings(() => setBar(hotbarFor(playerClass))), [playerClass]);
  const [drag, setDrag] = useState<{ skill: number; x: number; y: number } | null>(null);
  const pointer = useRef<number | null>(null);

  const drop = (skill: number, x: number, y: number) => {
    // Looks through the panel itself, in case it hangs over the bar on a small screen.
    const cell = document.elementsFromPoint(x, y).map((el) => el.closest<HTMLElement>("[data-slot]")).find((el) => el);
    if (cell) setHotbarSlot(playerClass, Number(cell.dataset.slot), skill);
  };

  return (
    <>
      <div className="side-panel skill-panel">
        <h2>{t("skills.title")}</h2>
        <p className="note">{t("skills.dragNote")}</p>
        {SKILLS[playerClass].map((skill, i) => {
          const learned = level >= skill.level;
          const slot = bar.indexOf(i);
          return (
            <div key={i} className={`skill-row${learned ? "" : " unlearned"}`}>
              <div
                className="skill-row-icon"
                onPointerDown={(e) => {
                  if (!learned || pointer.current !== null) return;
                  pointer.current = e.pointerId;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag({ skill: i, x: e.clientX, y: e.clientY });
                }}
                onPointerMove={(e) => {
                  if (pointer.current === e.pointerId) setDrag({ skill: i, x: e.clientX, y: e.clientY });
                }}
                onPointerUp={(e) => {
                  if (pointer.current !== e.pointerId) return;
                  pointer.current = null;
                  setDrag(null);
                  drop(i, e.clientX, e.clientY);
                }}
                onPointerCancel={() => {
                  pointer.current = null;
                  setDrag(null);
                }}
              >
                <img src={iconFor(skillIconId(playerClass, i)) ?? undefined} alt="" draggable={false} />
              </div>
              <div className="skill-row-text">
                <b>{skillName(playerClass, i)}</b>
                <span>{skillBlurb(playerClass, i)}</span>
                <span className="skill-row-note">
                  {!learned ? t("skills.learnAt", { n: skill.level }) : slot >= 0 ? t("skills.inSlot", { n: slot + 1 }) : t("skills.dragIn")}
                  {" · "}{t("skills.cooldown", { n: skill.cooldownMs / 1000 })}
                </span>
              </div>
              {slot >= 0 && (
                <button type="button" className="text-button" onClick={() => setHotbarSlot(playerClass, slot, null)}>{t("skills.remove")}</button>
              )}
            </div>
          );
        })}
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
      {drag && (
        <img
          className="skill-drag-ghost"
          src={iconFor(skillIconId(playerClass, drag.skill)) ?? undefined}
          alt=""
          style={{ left: drag.x, top: drag.y }}
        />
      )}
    </>
  );
}
