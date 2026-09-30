import { useState } from "react";
import { t, type Key } from "./lang";
import { itemName } from "./names";
import { iconFor } from "../game/render/icons";
import { BUILDINGS, type GroveView } from "../game/world/grove";
import type { BagView, ItemId } from "../game/account/items";
import { countOf } from "../game/account/inventory";

const PROBLEM: Record<string, Key> = {
  not_near: "problem.not_near_elder", nothing: "problem.nothing", no_building: "problem.no_building",
  not_enough_gold: "problem.not_enough_gold", no_item: "problem.no_item",
};

interface DonatePanelProps {
  view: GroveView;
  bag: BagView | null;
  onDonate: (items: Partial<Record<ItemId, number>>, gold: number) => Promise<string | null>;
  onClose: () => void;
}

// Giving to the building under way, from beside the elder: each thing it needs, how much has come
// in, what you hold, and how much of it to give; and gold.
export function DonatePanel({ view, bag, onDonate, onClose }: DonatePanelProps) {
  const going = view.buildings.find((b) => b.state === "building");
  const building = BUILDINGS.find((b) => b.id === going?.id);
  const [items, setItems] = useState<Partial<Record<ItemId, number>>>({});
  const [gold, setGold] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!going || !building) {
    return (
      <div className="menu-modal" onClick={onClose}>
        <div className="solid-panel donate-panel" onClick={(e) => e.stopPropagation()}>
          <p className="note">{t("problem.no_building")}</p>
          <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    );
  }
  const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.floor(Number.isFinite(n) ? n : 0)));
  const give = async () => {
    setBusy(true);
    setNote(null);
    const code = await onDonate(items, gold);
    setBusy(false);
    setNote(code ? t(PROBLEM[code] ?? "problem.retryLater") : t("donate.done"));
    if (!code) {
      setItems({});
      setGold(0);
    }
  };
  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel donate-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("donate.title", { building: t(`grove.building.${building.id}` as Key) })}</h2>
        <ul className="donate-needs">
          {(Object.entries(building.needs) as [ItemId, number][]).map(([id, need]) => {
            const have = bag ? countOf(bag, id) : 0;
            const room = need - (going.given.items[id] ?? 0);
            return (
              <li key={id}>
                <img src={iconFor(id) ?? undefined} alt="" />
                <b>{itemName(id)}</b>
                <span className="note">{going.given.items[id] ?? 0} / {need}</span>
                <span className="note">{t("donate.have", { n: have })}</span>
                <input
                  type="number" min={0} max={Math.min(have, room)} value={items[id] ?? 0}
                  onChange={(e) => setItems({ ...items, [id]: clamp(Number(e.target.value), Math.min(have, room)) })}
                />
              </li>
            );
          })}
          <li>
            <b>{t("donate.gold")}</b>
            <span className="note">{going.given.gold.toLocaleString()} / {building.gold.toLocaleString()}</span>
            <span className="note">{t("donate.have", { n: (bag?.gold ?? 0).toLocaleString() })}</span>
            <input
              type="number" min={0} step={100} value={gold}
              onChange={(e) => setGold(clamp(Number(e.target.value), Math.min(bag?.gold ?? 0, building.gold - going.given.gold)))}
            />
          </li>
        </ul>
        {note && <p className="bag-problem">{note}</p>}
        <div className="delete-actions">
          <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
          <button type="button" className="brush-button small" disabled={busy} onClick={() => void give()}>{t("dialogue.donate")}</button>
        </div>
      </div>
    </div>
  );
}
