import { t, type Key } from "./lang";
import type { GroveView } from "../game/world/grove";
import { FullScreen } from "./FullScreen";

interface GrovePanelProps { view: GroveView | null; failed: boolean; onClose: () => void }

// This week's grove on the server and the village it is rebuilding: how many monsters have fallen
// against the goal, the stages and what each brings, and the four buildings with their perks and top
// givers.
export function GrovePanel({ view, failed, onClose }: GrovePanelProps) {
  return (
    <FullScreen title={t("grove.title")} className="grove-panel" onClose={onClose}>
      {!view && <p className="note">{failed ? t("grove.failed") : t("common.loading")}</p>}
      {view && (
        <>
          <div className="grove-gauge"><i style={{ width: `${Math.min(100, (view.kills / view.goal) * 100)}%` }} /></div>
          <p className="grove-count">
            <span>{t("grove.kills", { n: view.kills.toLocaleString(), goal: view.goal.toLocaleString() })}</span>
            <span className="note">{t("grove.daysLeft", { n: view.daysLeft })}</span>
          </p>
          <ol className="grove-stages">
            {([1, 2, 3] as const).map((s) => (
              <li key={s} className={view.stage >= s ? "on" : ""}>{t(`grove.stage.${s}` as Key)}</li>
            ))}
          </ol>
          <h3>{t("grove.village")}</h3>
          <ul className="grove-buildings">
            {view.buildings.map((b) => (
              <li key={b.id} className={b.state}>
                <b>{t(`grove.building.${b.id}` as Key)}</b>
                <span className="note">{t(`grove.perk.${b.id}` as Key)}</span>
                <span className="grove-state">
                  {b.state === "done" ? t("grove.done") : b.state === "building" ? t("grove.building", { n: Math.floor(b.share * 100) }) : t("grove.closed")}
                </span>
                {b.top.length > 0 && <span className="grove-top">{b.top.join(" · ")}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </FullScreen>
  );
}
