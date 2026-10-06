import { useState } from "react";
import { problemText } from "./BagPanel";
import { locale, t } from "./lang";
import { DEATH_XP_SHARE, REVIVE_HP_SHARE, reviveCost } from "../game/account/level";
import { iconFor } from "../game/render/icons";
import type { WorldClient } from "../net/worldClient";
import { freeRevive } from "../game/account/premium";

// Fallen: the screen dims to a deep red, the words drop in, what it cost sits in a small badge, and
// the two ways up stand side by side as cards: here for gold (or free from VIP 4), or back in the
// village for nothing.
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
      <div className="death-screen" role="dialog">
        <h2 className="death-title">{t("death.fallen")}</h2>
        <i className="death-rule" />
        <p className="death-loss">
          <b>{lostXp > 0 ? t("death.lostXp", { n: lostXp.toLocaleString(locale()) }) : t("death.lostNone")}</b>
          <small>{t("death.lossNote", { n: Math.round(DEATH_XP_SHARE * 100) })}</small>
        </p>
        <div className="death-choices">
          <button
            type="button" className="death-choice here" disabled={busy || travelling || short}
            onClick={() => {
              setBusy(true);
              setProblem(null);
              void client.reviveHere().then((code) => {
                setBusy(false);
                if (code) setProblem(problemText(code));
              });
            }}
          >
            <img src={iconFor("potion_small") ?? undefined} alt="" draggable={false} />
            <b>{t("death.hereTitle")}</b>
            <span className="death-price">
              {cost === 0
                ? t("death.free")
                : <><img src={iconFor("ui_gold") ?? undefined} alt="" draggable={false} />{cost.toLocaleString(locale())}</>}
            </span>
            <small>{t("death.hereNote", { n: Math.round(REVIVE_HP_SHARE * 100) })}</small>
            {short && <em className="death-short">{t("death.shortGold")}</em>}
          </button>
          <button type="button" className="death-choice village" disabled={busy || travelling} onClick={() => void client.respawn()}>
            <img src={iconFor("ui_map") ?? undefined} alt="" draggable={false} />
            <b>{t("death.villageTitle")}</b>
            <span className="death-price">{t("death.free")}</span>
            <small>{t("death.villageNote")}</small>
          </button>
        </div>
        {problem && <p className="bag-problem">{problem}</p>}
      </div>
    </div>
  );
}
