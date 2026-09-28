import { CLASSES, WEAPONS, isFreeClass, type PlayerClass } from "../game/combat/classes";
import { t } from "./lang";
import { classBlurb, className, skillBlurb, skillName, weaponName } from "./names";
import { SKILLS } from "../game/combat/skills";

interface ClassPanelProps {
  picked: PlayerClass | null;
  onPick: (c: PlayerClass) => void;
  onConfirm: (c: PlayerClass) => void;
  onBack: () => void;
  // Whether the full game is bought: without it only the free classes can be made.
  owned: boolean;
  // Opens the purchase, when it can be made from here.
  onBuy: (() => void) | null;
}

// Picking a class for a new character: the six heroes stand in a row behind this panel; clicking
// one (or its name here) shows what it does.
export function ClassPanel({ picked, onPick, onConfirm, onBack, owned, onBuy }: ClassPanelProps) {
  const info = picked ? { weapon: WEAPONS[picked], skills: SKILLS[picked] } : null;
  const locked = (c: PlayerClass) => !owned && !isFreeClass(c);
  return (
    <div className="class-screen">
      <div className="class-tabs">
        {CLASSES.map((c) => (
          <button
            key={c} type="button"
            className={`class-tab${c === picked ? " picked" : ""}${locked(c) ? " locked" : ""}`}
            onClick={() => onPick(c)}
          >
            {locked(c) && <span className="class-lock" aria-label={t("buy.title")}>🔒</span>}
            {className(c)}
          </button>
        ))}
      </div>
      <aside className="solid-panel class-info">
        <header className="wardrobe-head">
          <h2>{t("class.pick")}</h2>
          <button type="button" className="text-button" onClick={onBack}>{t("common.back")}</button>
        </header>
        {picked && info ? (
          <>
            <h3 className="class-name">{className(picked)}</h3>
            <p>{classBlurb(picked)}</p>
            <dl className="class-stats">
              <div><dt>{t("class.weapon")}</dt><dd>{weaponName(picked)} ({info.weapon.ranged ? t("class.ranged") : t("class.melee")})</dd></div>
              <div><dt>{t("class.damage")}</dt><dd>{info.weapon.damage}</dd></div>
              <div><dt>{t("class.speed")}</dt><dd>{t("class.perSecond", { n: (1000 / info.weapon.intervalMs).toFixed(1) })}</dd></div>
              <div><dt>{t("class.reach")}</dt><dd>{info.weapon.reach} m</dd></div>
              <div><dt>{t("class.block")}</dt><dd>{Math.round(info.weapon.block * 100)}%</dd></div>
            </dl>
            {info.skills.map((skill, i) => (
              <p key={i} className="class-skill">
                <b>{t("class.skillLine", { n: i + 1, name: skillName(picked, i) })}</b> ({t("class.skillNote", { from: skill.level > 1 ? t("class.fromLevel", { n: skill.level }) : "", cooldown: skill.cooldownMs / 1000 })})
                <br />
                {skillBlurb(picked, i)}
              </p>
            ))}
            {locked(picked) ? (
              <>
                <p className="class-locked-note">{t("class.lockedNote")}</p>
                {onBuy && <button type="button" className="brush-button wardrobe-start" onClick={onBuy}>{t("buy.short")}</button>}
              </>
            ) : (
              <button type="button" className="brush-button wardrobe-start" onClick={() => onConfirm(picked)}>{t("class.confirm")}</button>
            )}
            <p className="note">{t("class.onceNote")}</p>
          </>
        ) : (
          <p className="note">{t("class.pickHint")}</p>
        )}
      </aside>
    </div>
  );
}
