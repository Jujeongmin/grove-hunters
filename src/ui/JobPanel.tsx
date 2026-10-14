import { useState } from "react";
import { ADVANCE_LEVEL, JOBS, jobsOf, type JobId } from "../game/combat/jobs";
import { JOB_SKILLS } from "../game/combat/skills";
import type { PlayerClass } from "../game/combat/classes";
import type { BagView } from "../game/account/items";
import { iconFor, skillIconId } from "../game/render/icons";
import type { WorldClient } from "../net/worldClient";
import { problemText } from "./BagPanel";
import { FullScreen } from "./FullScreen";
import { t, type Key } from "./lang";
import { className, jobBlurb, jobName, pathSkillBlurb, pathSkillName } from "./names";
import { directionParticle } from "./korean";

// What a path leans to, read off what it gives: healing, attack and health together, health and
// guard, or attack alone.
type Bent = "support" | "balanced" | "guard" | "power";
function bentOf(id: JobId): Bent {
  const job = JOBS[id];
  if (job.heal) return "support";
  if (job.atk && job.hp) return "balanced";
  if (job.def || job.hp) return "guard";
  return "power";
}

// One path as a card: its name and bent, what it gives in large, and its three skills with their
// pictures, the level each comes at and what it does.
function PathCard({ playerClass, id, picked, current, onPick }: {
  playerClass: PlayerClass; id: JobId; picked: boolean; current: boolean; onPick: (() => void) | null;
}) {
  const bent = bentOf(id);
  const body = (
    <>
      <div className="job-card-head">
        <b>{jobName(id)}</b>
        <span className={`job-bent ${bent}`}>{t(`job.bent.${bent}` as Key)}</span>
        {current && <span className="job-current">{t("job.current")}</span>}
      </div>
      <p className="job-stat">{jobBlurb(id)}</p>
      <ul className="job-skills">
        {JOB_SKILLS[id].map((skill, i) => (
          <li key={i}>
            <img src={iconFor(skillIconId(playerClass, id, i + 1)) ?? undefined} alt="" draggable={false} />
            <div>
              <span className="job-skill-name">{pathSkillName(id, i)} <em>Lv{skill.level}</em></span>
              <span className="job-skill-blurb">{pathSkillBlurb(id, i)}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
  const cls = `job-card${picked ? " picked" : ""}${current ? " current" : ""}`;
  return onPick
    ? <button type="button" className={cls} onClick={onPick}>{body}</button>
    : <div className={cls}>{body}</div>;
}

// Advancement (전직) on a screen of its own: the two paths of your class side by side, and a yes
// before the choice is made for good. It opens by itself the first time a character comes to
// ADVANCE_LEVEL without a path (see WorldScreen), and from its menu button after.
export function JobPanel({ client, bag, playerClass, level, onClose }: {
  client: WorldClient;
  bag: BagView | null;
  playerClass: PlayerClass;
  level: number;
  onClose: () => void;
}) {
  // A path tapped, waiting for a yes: the choice is for good, so one tap never makes it.
  const [path, setPath] = useState<JobId | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const job = bag?.job ?? null;
  const canPick = !job && level >= ADVANCE_LEVEL;
  const advance = (id: JobId) => {
    setBusy(true);
    setProblem(null);
    void client.advance(id).then((code) => {
      setBusy(false);
      setPath(null);
      setProblem(problemText(code));
    });
  };
  return (
    <FullScreen title={t("job.title")} className="job-panel" onClose={onClose}>
      <p className="job-lead">
        {job
          ? t("job.done", { from: className(playerClass), to: jobName(job), ro: directionParticle(jobName(job)) })
          : canPick ? t("bag.pickPath") : t("bag.advanceAt", { at: ADVANCE_LEVEL, level })}
      </p>
      <div className="job-paths">
        {jobsOf(playerClass).map((id) => (
          <PathCard
            key={id} playerClass={playerClass} id={id} picked={path === id} current={job === id}
            onPick={canPick ? () => setPath(id) : null}
          />
        ))}
      </div>
      {canPick && (
        <div className="job-confirm">
          {path ? (
            <>
              <span>{t("bag.confirmPath", { name: jobName(path) })}</span>
              <button type="button" className="brush-button small" disabled={busy} onClick={() => advance(path)}>
                {t("job.go", { name: jobName(path), ro: directionParticle(jobName(path)) })}
              </button>
              <button type="button" className="text-button" disabled={busy} onClick={() => setPath(null)}>{t("common.cancel")}</button>
            </>
          ) : (
            <span className="note">{t("job.pickHint")}</span>
          )}
        </div>
      )}
      {problem && <p className="forge-note bad">{problem}</p>}
    </FullScreen>
  );
}
