import { useEffect, useRef, useState } from "react";
import type { JobId } from "../game/combat/jobs";
import { t } from "./lang";
import type { PlayerClass } from "../game/combat/classes";
import { skillName } from "./names";
import { iconFor, skillIconId } from "../game/render/icons";
import type { WorldHud } from "../game/render/WorldView";
import { POTION_AT } from "../game/account/controls";
import { onSettings, settings, updateSettings } from "./settings";

// Dragging a slot this far down (or up) flips whether auto-battle may use it.
const DRAG_TOGGLE = 28;

interface SkillBarProps {
  hud: WorldHud;
  playerClass: PlayerClass;
  // The advanced path, whose skills sit on keys 2 to 4.
  job: JobId | null;
  onSkill: (slot: number) => void;
  onPotion: () => void;
  // The tutorial's pointer: at the first slot, or at the whole bar.
  glow: "slot0" | "bar" | null;
}

interface CellProps {
  // Which slot of the bar this is (the skill panel drops skills by it); -1 for the potion.
  slot: number;
  keyLabel: string;
  name: string;
  icon: string | null;
  // Shown in the corner: a count, or the seconds left.
  corner: string;
  // Share of the cooldown still to run (0 when ready); null for a slot not yet open.
  cooling: number | null;
  locked: boolean;
  isAuto: boolean;
  // The tutorial points here.
  glow: boolean;
  use: () => void;
  flip: () => void;
}

// How far a slot sits down while auto-battle may use it, and how far a finger can pull it.
const AUTO_DROP_PX = 8;
const DRAG_MAX_PX = 16;

// One square of the bar: the icon and its key. A tap uses it. Dragging it down settles it a little
// lower with a glowing band along its foot: auto-battle may use it. Dragging again lifts it back.
function Cell({ slot, keyLabel, name, icon, corner, cooling, locked, isAuto, glow, use, flip }: CellProps) {
  const drag = useRef<{ id: number; y: number; moved: boolean } | null>(null);
  const [pull, setPull] = useState<number | null>(null);
  const rest = isAuto ? AUTO_DROP_PX : 0;
  const offset = pull === null ? rest : Math.max(0, Math.min(DRAG_MAX_PX, rest + pull));
  return (
    <div className="hud-slot">
      <div
        className={`hud-cell${slot < 0 ? " potion" : ""}${locked ? " locked" : ""}${isAuto ? " auto" : ""}${pull !== null ? " pulling" : ""}${icon ? "" : " empty"}${glow ? " tutorial-glow" : ""}`}
        style={{ transform: `translateY(${offset}px)` }}
        data-slot={slot >= 0 ? slot : undefined}
        title={name}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { id: e.pointerId, y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const dy = e.clientY - d.y;
          if (Math.abs(dy) > 6) d.moved = true;
          setPull(dy);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          setPull(null);
          if (!d || d.id !== e.pointerId) return;
          if (Math.abs(e.clientY - d.y) >= DRAG_TOGGLE) flip();
          else if (!d.moved) use();
        }}
        onPointerCancel={() => {
          drag.current = null;
          setPull(null);
        }}
      >
        {icon && <img src={icon} alt={name} draggable={false} />}
        <span className="hud-cell-key">{keyLabel}</span>
        {corner && <span className="hud-cell-corner">{corner}</span>}
        {cooling !== null && cooling > 0 && <i className="hud-cell-cooling" style={{ height: `${Math.round(cooling * 100)}%` }} />}
        <i className="hud-cell-glow" />
      </div>
      <span className="hud-cell-name">{name}</span>
    </div>
  );
}

// Left of the potion: at what health the auto potion drinks. Tapping it opens a slider above it.
function PotionSetting({ on }: { on: boolean }) {
  const [at, setAt] = useState(() => settings().potionAt);
  const [open, setOpen] = useState(false);
  useEffect(() => onSettings((s) => setAt(s.potionAt)), []);
  return (
    <div className="potion-setting">
      <button type="button" className={`potion-setting-button${open ? " on" : ""}`} onClick={() => setOpen((o) => !o)} title={t("bar.autoPotionTitle")}>
        <span>HP</span>
        <b>{at}%</b>
      </button>
      {open && (
        <div className="potion-setting-pop solid-panel">
          <b>{t("bar.autoPotion")}</b>
          <span>{t("bar.autoPotionAt", { n: at })}{on ? "" : t("bar.autoPotionOff")}</span>
          <input
            type="range" min={POTION_AT.min} max={POTION_AT.max} step={POTION_AT.step} value={at}
            onChange={(e) => updateSettings({ potionAt: Number(e.target.value) })}
          />
          <button type="button" className="text-button" onClick={() => updateSettings({ autoPotion: !settings().autoPotion })}>
            {on ? t("bar.autoPotionTurnOff") : t("bar.autoPotionTurnOn")}
          </button>
        </div>
      )}
    </div>
  );
}

// The potion and the four skills, bottom centre, as a row of squares.
export function SkillBar({ hud, playerClass, job, onSkill, onPotion, glow }: SkillBarProps) {
  const [auto, setAuto] = useState(() => ({ potion: settings().autoPotion, skills: settings().autoSkills }));
  useEffect(() => onSettings((s) => setAuto({ potion: s.autoPotion, skills: s.autoSkills })), []);
  return (
    <div className={`hud-skills${glow === "bar" ? " tutorial-glow" : ""}`}>
      <PotionSetting on={auto.potion} />
      <Cell
        slot={-1} keyLabel="Q" name={t("bar.potion")} icon={iconFor("potion_small")} corner={String(hud.potions)} cooling={null}
        locked={hud.potions === 0} isAuto={auto.potion} glow={false} use={onPotion}
        flip={() => updateSettings({ autoPotion: !settings().autoPotion })}
      />
      {hud.skills.map((skill, i) => (
        <Cell
          key={i}
          slot={i}
          keyLabel={String(i + 1)}
          name={skill ? skillName(playerClass, job, skill.skill) : t("bar.emptySlot")}
          icon={skill ? iconFor(skillIconId(playerClass, job, skill.skill)) : null}
          corner={!skill ? "" : !skill.open ? `Lv${skill.level}` : skill.readyInMs > 0 ? `${Math.ceil(skill.readyInMs / 1000)}` : ""}
          cooling={skill?.open ? skill.readyInMs / skill.cooldownMs : null}
          locked={!skill || !skill.open}
          isAuto={auto.skills[i] === true}
          glow={glow === "slot0" && i === 0}
          use={() => onSkill(i)}
          flip={() => {
            const next = [...settings().autoSkills];
            next[i] = !next[i];
            updateSettings({ autoSkills: next });
          }}
        />
      ))}
    </div>
  );
}
