import { useEffect, useState } from "react";
import type { ItemId } from "../game/account/items";
import { iconFor } from "../game/render/icons";
import { locale, t } from "./lang";
import { itemName } from "./names";

// What a claimed quest gave, thrown up at the top middle of the screen for a few seconds, so the
// reward is seen and not just counted into the bag.

export interface Reward {
  // Bumped for each claim, so the same reward twice shows twice.
  key: number;
  daily: boolean;
  xp: number;
  gold: number;
  items: readonly { id: ItemId; n: number }[];
}

const SHOW_MS = 3500;

export function RewardToast({ reward }: { reward: Reward | null }) {
  const [shown, setShown] = useState<Reward | null>(null);
  useEffect(() => {
    if (!reward) return;
    setShown(reward);
    const timer = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [reward]);
  if (!shown) return null;
  const n = (v: number) => v.toLocaleString(locale());
  return (
    <div key={shown.key} className="reward-toast" role="status">
      <b>{t(shown.daily ? "reward.daily" : "reward.quest")}</b>
      <ul>
        {shown.xp > 0 && <li><span className="reward-xp">EXP</span>{t("reward.xp", { n: n(shown.xp) })}</li>}
        {shown.gold > 0 && <li><img src={iconFor("ui_gold") ?? undefined} alt="" />{t("reward.gold", { n: n(shown.gold) })}</li>}
        {shown.items.map((item) => (
          <li key={item.id}><img src={iconFor(item.id) ?? undefined} alt="" />{itemName(item.id)}{item.n > 1 ? ` ×${item.n}` : ""}</li>
        ))}
      </ul>
    </div>
  );
}
