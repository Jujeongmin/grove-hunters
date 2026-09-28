import { useEffect, useRef, useState } from "react";
import { t } from "./lang";
import type { PlayerClass } from "../game/combat/classes";
import { SKILL_SLOTS, skillAt } from "../game/combat/skills";
import { ADVANCE_LEVEL, type JobId } from "../game/combat/jobs";
import { skillBlurb, skillName } from "./names";
import { iconFor, skillIconId } from "../game/render/icons";
import { hotbarFor, onSettings, setHotbarSlot } from "./settings";

interface SkillPanelProps {
  playerClass: PlayerClass;
  // The advanced path, which the second and third skills come from; null before advancing.
  job: JobId | null;
  level: number;
  onClose: () => void;
}

// Your three skills, top right: the class's own, and the two your advanced path brings (shown as
// waiting until you advance). The ones learned can be dragged onto a slot of the bar at the bottom
// (the hotbar's cells carry data-slot). The panel leaves the bar in view.
export function SkillPanel({ playerClass, job, level, onClose }: SkillPanelProps) {
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
        {Array.from({ length: SKILL_SLOTS }, (_, i) => {
          const skill = skillAt(playerClass, job, i);
          const learned = skill !== null && level >= skill.level;
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
                <b>{skill ? skillName(playerClass, job, i) : t("skills.pathSlot", { n: i })}</b>
                {skill && <span>{skillBlurb(playerClass, job, i)}</span>}
                <span className="skill-row-note">
                  {!skill
                    ? t("skills.afterAdvance", { n: ADVANCE_LEVEL })
                    : !learned ? t("skills.learnAt", { n: skill.level }) : slot >= 0 ? t("skills.inSlot", { n: slot + 1 }) : t("skills.dragIn")}
                  {skill && <>{" · "}{t("skills.cooldown", { n: skill.cooldownMs / 1000 })}</>}
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
