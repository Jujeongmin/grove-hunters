import type { EnhanceOutcome } from "../game/account/forge";
import type { ItemId } from "../game/account/items";
import { iconFor } from "../game/render/icons";
import { t } from "./lang";
import type { Key } from "./strings/ko";

// How long the gauge takes to fill before the outcome shows; the server has answered well before.
export const CHARGE_MS = 1800;

export const OUTCOME: Record<EnhanceOutcome, Key> = {
  success: "forge.success",
  fail: "forge.fail",
  broken: "forge.broken",
};

export interface Enhancing {
  item: ItemId;
  name: string;
  from: number;
  to: number;
  // Null while the gauge fills.
  outcome: EnhanceOutcome | null;
}

// An enhancement played out over the forge: the piece humming, a gauge filling all the way, then a
// golden flash (success), a grey shudder (failure) or a red flash and the piece coming apart (broken).
// A tap closes it once the outcome is in.
export function EnhanceShow({ show, onClose }: { show: Enhancing; onClose: () => void }) {
  const done = show.outcome !== null;
  return (
    <div
      className={`enhance-show${done ? ` ${show.outcome}` : ""}`} role="dialog"
      onClick={(e) => {
        e.stopPropagation();
        if (done) onClose();
      }}
    >
      <div className="enhance-piece"><img src={iconFor(show.item) ?? undefined} alt="" /></div>
      <b className="enhance-name">{show.name}</b>
      <span className="enhance-plus">+{show.from} → +{show.to}</span>
      <div className="enhance-gauge"><i /></div>
      <p className="enhance-result">{show.outcome ? t(OUTCOME[show.outcome]) : t("forge.working")}</p>
      <span className="enhance-close">{done ? t("common.close") : " "}</span>
    </div>
  );
}
