import { CLASSES, isFreeClass } from "../game/combat/classes";
import { className, monsterName, weaponName, zoneName } from "./names";
import { ADVANCE_LEVEL } from "../game/combat/jobs";
import { t } from "./lang";
import { iconFor, skillIconId } from "../game/render/icons";
import type { Offer } from "../game/account/purchase";
import { ZONES, ZONE_IDS } from "../game/world/zones";

// What buying opens, read from the game itself rather than written out here: the zones that ask for
// it, the classes it adds, and the level the free fields stop at.
export const LOCKED_ZONES = ZONE_IDS.filter((z) => ZONES[z].paid);
const LOCKED_CLASSES = CLASSES.filter((c) => !isFreeClass(c));
export const FREE_UNTIL = Math.min(...LOCKED_ZONES.map((z) => ZONES[z].minLevel));

// A class's weapon, without the class's own name in front of it: the cleric's staff is called
// after the cleric, which reads twice when it sits under the name.
function weaponOf(c: (typeof LOCKED_CLASSES)[number]): string {
  const name = weaponName(c);
  return name.replace(className(c), "").trim() || name;
}

// Why the panel opened, which decides its first line.
export type UpgradeReason =
  | { kind: "portal"; zone: string }
  | { kind: "level"; level: number }
  | { kind: "menu" };

interface UpgradePanelProps {
  reason: UpgradeReason;
  // What the shop is asking, and what it is marked down from when the product itself says so.
  offer: Offer;
  // Where the purchase stands: waiting for the platform to confirm, or taking too long.
  state: "idle" | "confirming" | "late";
  // Opens Verse8's purchase dialog; null when there is no server to buy through.
  onBuy: (() => void) | null;
  onClose: () => void;
}

function opening(reason: UpgradeReason): string {
  switch (reason.kind) {
    case "portal":
      return t("buy.reason.portal", { zone: reason.zone });
    case "level":
      return t("buy.reason.level", { n: reason.level });
    case "menu":
      return t("buy.reason.menu", { n: FREE_UNTIL });
  }
}

// The one thing on sale, and what it opens. Shown at the locked portal, once when the free fields
// run out, from the menu, and when a locked class is picked.
export function UpgradePanel({ reason, offer, state, onBuy, onClose }: UpgradePanelProps) {
  return (
    <div className="upgrade-panel" role="dialog" onClick={onClose}>
      <div className="upgrade-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{t("buy.title")}</h2>
        <p className="upgrade-lead">{opening(reason)}</p>

        <ul className="upgrade-list">
          <li className="big">
            <b>{t("buy.fields", { n: LOCKED_ZONES.length })}</b>
            <span>{LOCKED_ZONES.map((z) => `${zoneName(z)} (Lv ${ZONES[z].minLevel}~)`).join(" · ")}</span>
          </li>
          <li>
            <b>{t("buy.noCap")}</b>
            <span>{t("buy.noCapNote", { n: FREE_UNTIL, advance: ADVANCE_LEVEL })}</span>
          </li>
          <li>
            <b>{monsterName("mushroom_king")}</b>
            <span>{t("buy.bossNote")}</span>
          </li>
        </ul>

        <div className="upgrade-classes">
          <b>{t("buy.classes", { n: LOCKED_CLASSES.length })}</b>
          <div className="upgrade-class-row">
            {LOCKED_CLASSES.map((c) => {
              const icon = iconFor(skillIconId(c, 0));
              return (
                <span key={c} className="upgrade-class">
                  {icon && <img src={icon} alt="" draggable={false} />}
                  <em>{className(c)}</em>
                  <i>{weaponOf(c)}</i>
                </span>
              );
            })}
          </div>
        </div>

        {offer.off !== null && (
          <p className="upgrade-sale">
            <b>{t("buy.off", { n: offer.off })}</b>
            <s>{offer.listPrice} VX</s>
          </p>
        )}

        {onBuy
          ? (
            <button type="button" className="brush-button buy-cta" onClick={onBuy} disabled={state === "confirming"}>
              {state === "confirming" ? t("buy.checking") : t("buy.buy", { price: offer.price })}
            </button>
          )
          : <p className="note">{t("buy.noServer")}</p>}
        {state === "late" && <p className="note">{t("buy.late")}</p>}

        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}
