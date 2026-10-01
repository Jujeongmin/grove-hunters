import { useState } from "react";
import { problemText } from "./BagPanel";
import { locale, t } from "./lang";
import { DEATH_XP_SHARE, REVIVE_HP_SHARE, reviveCost } from "../game/account/level";
import type { WorldClient } from "../net/worldClient";
import { freeRevive } from "../game/account/premium";



// Fallen: what it cost, and the two ways up: back in the village for nothing, or here for gold.
export function DeathPanel({ client, level, lostXp, gold, vip, travelling }: {
  client: WorldClient;
  level: number;
  lostXp: number;
  // Null until the bag has loaded.
  gold: number | null;
  // The account's VIP rank: from VIP 4 rising here costs nothing.
  vip: number;
  travelling: boolean;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cost = freeRevive(vip) ? 0 : reviveCost(level);
  const short = gold !== null && gold < cost;
  return (
    <div className="pain fallen">
      <div className="solid-panel world-panel death-panel">
        <p className="band">{t("death.fallen")}</p>
        <p className="death-loss">
          {lostXp > 0 ? t("death.lostXp", { n: lostXp.toLocaleString(locale()) }) : t("death.lostNone")}
          <span className="note">{t("death.lossNote", { n: Math.round(DEATH_XP_SHARE * 100) })}</span>
        </p>
        <button
          type="button" className="brush-button" disabled={busy || travelling || short}
          onClick={() => {
            setBusy(true);
            setProblem(null);
            void client.reviveHere().then((code) => {
              setBusy(false);
              if (code) setProblem(problemText(code));
            });
          }}
        >
          {t("death.here", { gold: t("common.gold", { n: cost.toLocaleString(locale()) }) })}
        </button>
        <span className="note">{t("death.hereNote", { n: Math.round(REVIVE_HP_SHARE * 100) })}{short ? t("death.short") : ""}</span>
        <button type="button" className="brush-button" disabled={busy || travelling} onClick={() => void client.respawn()}>
          {t("death.village")}
        </button>
        {problem && <p className="bag-problem">{problem}</p>}
      </div>
    </div>
  );
}
