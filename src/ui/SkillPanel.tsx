import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { t } from "./lang";
import type { PlayerClass } from "../game/combat/classes";
import { SKILL_SLOTS, skillAt } from "../game/combat/skills";
import { ADVANCE_LEVEL, type JobId } from "../game/combat/jobs";
import { skillBlurb, skillName } from "./names";
import { iconFor, skillIconId } from "../game/render/icons";
import { equipSkill, hotbarFor, onSettings, setHotbarSlot } from "./settings";

// A press that moves this far (px) is a drag; less, a tap. Two taps this close (ms) put the skill on.
const DRAG_START = 6;
const DOUBLE_TAP_MS = 350;
// A skill let go this near a slot of the bar (px, from its middle) goes in it: on a phone the bar sits
// at the screen's foot, where a finger cannot get right onto it.
const SNAP_PX = 110;

// The slot of the bar a skill let go at (x, y) goes into: the one under the finger, or else the
// nearest within SNAP_PX; null for none.
function slotAt(x: number, y: number): HTMLElement | null {
  // Looks through the panel itself, in case it hangs over the bar on a small screen.
  const under = document.elementsFromPoint(x, y).map((el) => el.closest<HTMLElement>("[data-slot]")).find((el) => el);
  if (under) return under;
  let best: { el: HTMLElement; d: number } | null = null;
  for (const el of document.querySelectorAll<HTMLElement>("[data-slot]")) {
    const r = el.getBoundingClientRect();
    const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    if (d <= SNAP_PX && (!best || d < best.d)) best = { el, d };
  }
  return best?.el ?? null;
}

// Lights the slot a drag would go into (one at a time); null puts the light out.
let lit: HTMLElement | null = null;
function light(el: HTMLElement | null): void {
  if (lit === el) return;
  lit?.classList.remove("drop-target");
  el?.classList.add("drop-target");
  lit = el;
}
import { skillLearned, type TutorialStep } from "../game/account/tutorial";

interface SkillPanelProps {
  playerClass: PlayerClass;
  // The advanced path, which the second and third skills come from; null before advancing.
  job: JobId | null;
  level: number;
  // The first tutorial's step: until the elder has taught it, the first skill is held back.
  tutorial: TutorialStep | null;
  // A skill was dropped on the bar (the tutorial waits for this).
  onPlaced: () => void;
  onClose: () => void;
}

// Your four skills, top right: the class's own, and the three your advanced path brings (shown as
// waiting until you advance). A learned one is dragged by its row onto a slot of the bar at the bottom
// (the hotbar's cells carry data-slot), or double-clicked (double-tapped) into the first empty slot.
// The panel leaves the bar in view.
export function SkillPanel({ playerClass, job, level, tutorial, onPlaced, onClose }: SkillPanelProps) {
  const [bar, setBar] = useState(() => hotbarFor(playerClass));
  useEffect(() => onSettings(() => setBar(hotbarFor(playerClass))), [playerClass]);
  // Closed mid-drag, the lit slot goes dark.
  useEffect(() => () => light(null), []);
  const [drag, setDrag] = useState<{ skill: number; x: number; y: number } | null>(null);
  // The press under way: which pointer, where it went down, whether it has become a drag.
  const press = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const lastTap = useRef<{ skill: number; at: number } | null>(null);

  const equip = (skill: number) => {
    equipSkill(playerClass, skill);
    onPlaced();
  };

  const drop = (skill: number, x: number, y: number) => {
    light(null);
    const cell = slotAt(x, y);
    if (!cell) return;
    setHotbarSlot(playerClass, Number(cell.dataset.slot), skill);
    onPlaced();
  };

  return (
    <>
      <div className="side-panel skill-panel">
        <h2>{t("skills.title")}</h2>
        <p className="note">{t("skills.dragNote")}</p>
        <div className="skill-rows">
        {Array.from({ length: SKILL_SLOTS }, (_, i) => {
          const skill = skillAt(playerClass, job, i);
          const taught = skillLearned(tutorial, i);
          const learned = skill !== null && taught && level >= skill.level;
          const slot = bar.indexOf(i);
          return (
            <div
              key={i}
              className={`skill-row${learned ? " learned" : " unlearned"}`}
              onPointerDown={(e) => {
                // The remove button keeps its own click.
                if (!learned || press.current !== null || (e.target as HTMLElement).closest("button")) return;
                press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const p = press.current;
                if (!p || p.id !== e.pointerId) return;
                if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START) return;
                p.dragging = true;
                setDrag({ skill: i, x: e.clientX, y: e.clientY });
                light(slotAt(e.clientX, e.clientY));
              }}
              onPointerUp={(e) => {
                const p = press.current;
                if (!p || p.id !== e.pointerId) return;
                press.current = null;
                setDrag(null);
                if (p.dragging) {
                  drop(i, e.clientX, e.clientY);
                  return;
                }
                const now = performance.now();
                if (lastTap.current?.skill === i && now - lastTap.current.at < DOUBLE_TAP_MS) {
                  lastTap.current = null;
                  equip(i);
                } else {
                  lastTap.current = { skill: i, at: now };
                }
              }}
              onPointerCancel={() => {
                press.current = null;
                setDrag(null);
                light(null);
              }}
            >
              <div className="skill-row-icon">
                <img src={iconFor(skillIconId(playerClass, job, i)) ?? undefined} alt="" draggable={false} />
              </div>
              <div className="skill-row-text">
                <b>{skill ? skillName(playerClass, job, i) : t("skills.pathSlot", { n: i })}</b>
                {skill && <span>{skillBlurb(playerClass, job, i)}</span>}
                <span className="skill-row-note">
                  {!skill
                    ? t("skills.afterAdvance", { n: ADVANCE_LEVEL })
                    : !taught ? t("skills.fromElder")
                    : !learned ? t("skills.learnAt", { n: skill.level }) : slot >= 0 ? t("skills.inSlot", { n: slot + 1 }) : t("skills.dragIn")}
                  {skill && <>{" · "}{t("skills.cooldown", { n: skill.cooldownMs / 1000 })}</>}
                </span>
              </div>
              {slot >= 0 && taught && (
                <button type="button" className="text-button" onClick={() => setHotbarSlot(playerClass, slot, null)}>{t("skills.remove")}</button>
              )}
            </div>
          );
        })}
        </div>
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
      {/* Drawn on the page itself, not inside the scaled overlay: there a fixed position is measured in
          the overlay's own shrunken pixels, and on a big screen the icon trailed below the pointer. */}
      {drag && createPortal(
        <img
          className="skill-drag-ghost"
          src={iconFor(skillIconId(playerClass, job, drag.skill)) ?? undefined}
          alt=""
          style={{ left: drag.x, top: drag.y }}
        />,
        document.body,
      )}
    </>
  );
}
