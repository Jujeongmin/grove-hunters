import { useState } from "react";
import { ADVANCE_LEVEL, jobsOf, type JobId } from "../game/combat/jobs";
import type { PlayerClass } from "../game/combat/classes";
import type { BagView } from "../game/account/items";
import type { WorldClient } from "../net/worldClient";
import { problemText } from "./BagPanel";
import { FullScreen } from "./FullScreen";
import { t } from "./lang";
import { className, jobBlurb, jobName, pathSkillName } from "./names";

// Advancement (전직) on a screen of its own: the two paths of your class, each with its three skills,
// and a yes before the choice is made for good. It opens by itself the first time a character comes to
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
      <div className="bag-job">
        {job ? (
          <>
            <span>{className(playerClass)} → <b>{jobName(job)}</b></span>
            <span className="note">{jobBlurb(job)}</span>
            <span className="note">{pathSkillName(job, 0)} · {pathSkillName(job, 1)} · {pathSkillName(job, 2)}</span>
          </>
        ) : level < ADVANCE_LEVEL ? (
          <span>{t("bag.advanceAt", { at: ADVANCE_LEVEL, level })}</span>
        ) : (
          <>
            <span>{t("bag.pickPath")}</span>
            {path && (
              <div className="bag-job-confirm">
                <span>{t("bag.confirmPath", { name: jobName(path) })}</span>
                <button type="button" className="brush-button small" disabled={busy} onClick={() => advance(path)}>
                  {t("bag.advanceGo")}
                </button>
                <button type="button" className="text-button" disabled={busy} onClick={() => setPath(null)}>{t("common.cancel")}</button>
              </div>
            )}
            <div className="bag-job-paths">
              {jobsOf(playerClass).map((id) => (
                <button key={id} type="button" className={`world-card${path === id ? " picked" : ""}`} onClick={() => setPath(id)}>
                  <b>{jobName(id)}</b>
                  <span>{pathSkillName(id, 0)} · {pathSkillName(id, 1)} · {pathSkillName(id, 2)}</span>
                  <span>{jobBlurb(id)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {problem && <p className="forge-note bad">{problem}</p>}
      </div>
    </FullScreen>
  );
}
