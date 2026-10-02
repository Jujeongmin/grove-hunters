import { CLASSES, WEAPONS, type PlayerClass } from "../game/combat/classes";
import { t } from "./lang";
import { classBlurb, className, jobBlurb, jobName, pathSkillBlurb, pathSkillName, skillBlurb, skillName, weaponName } from "./names";
import { CLASS_SKILLS, JOB_SKILLS } from "../game/combat/skills";
import { ADVANCE_LEVEL, jobsOf } from "../game/combat/jobs";

interface ClassPanelProps {
  picked: PlayerClass | null;
  onPick: (c: PlayerClass) => void;
  onConfirm: (c: PlayerClass) => void;
  onBack: () => void;
}

// Picking a class for a new character: the six heroes stand in a row behind this panel; clicking
// one (or its name here) shows what it does: its own skill, and the two paths it can advance along
// with the two skills each brings.
export function ClassPanel({ picked, onPick, onConfirm, onBack }: ClassPanelProps) {
  const info = picked ? { weapon: WEAPONS[picked], skill: CLASS_SKILLS[picked] } : null;
  return (
    <div className="class-screen">
      <div className="class-tabs">
        {CLASSES.map((c) => (
          <button
            key={c} type="button"
            className={`class-tab${c === picked ? " picked" : ""}`}
            onClick={() => onPick(c)}
          >
            {className(c)}
          </button>
        ))}
      </div>
      <aside className="solid-panel class-info">
        <header className="wardrobe-head">
          <h2 className={picked ? "class-name" : undefined}>{picked ? className(picked) : t("class.pick")}</h2>
          <button type="button" className="text-button" onClick={onBack}>{t("common.back")}</button>
        </header>
        {picked && info ? (
          <>
            <p>{classBlurb(picked)}</p>
            <dl className="class-stats">
              <div><dt>{t("class.weapon")}</dt><dd>{weaponName(picked)} ({info.weapon.ranged ? t("class.ranged") : t("class.melee")})</dd></div>
              <div><dt>{t("class.damage")}</dt><dd>{info.weapon.damage}</dd></div>
              <div><dt>{t("class.speed")}</dt><dd>{t("class.perSecond", { n: (1000 / info.weapon.intervalMs).toFixed(1) })}</dd></div>
              <div><dt>{t("class.reach")}</dt><dd>{info.weapon.reach} m</dd></div>
            </dl>
            <p className="class-skill">
              <b>{t("class.skillLine", { n: 1, name: skillName(picked, null, 0) })}</b>
              <span className="class-skill-meta">{t("skills.cooldown", { n: info.skill.cooldownMs / 1000 })}</span>
              <br />
              {skillBlurb(picked, null, 0)}
            </p>
            <h4 className="class-paths-title">{t("class.paths", { n: ADVANCE_LEVEL })}</h4>
            <div className="class-paths">
              {jobsOf(picked).map((job) => (
                <div key={job} className="class-path">
                  <p className="class-path-name"><b>{jobName(job)}</b><span>{jobBlurb(job)}</span></p>
                  {JOB_SKILLS[job].map((skill, i) => (
                    <p key={i} className="class-skill">
                      <b>
                        {t("class.skillLine", { n: i + 2, name: pathSkillName(job, i) })}
                        {/* The second comes with advancing; the third waits for its own level. */}
                        {skill.level > ADVANCE_LEVEL && <span className="class-skill-meta">Lv{skill.level}</span>}
                      </b>
                      {pathSkillBlurb(job, i)}
                    </p>
                  ))}
                </div>
              ))}
            </div>
            <button type="button" className="brush-button wardrobe-start" onClick={() => onConfirm(picked)}>{t("class.confirm")}</button>
            <p className="note">{t("class.onceNote")}</p>
          </>
        ) : (
          <p className="note">{t("class.pickHint")}</p>
        )}
      </aside>
    </div>
  );
}
