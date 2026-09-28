import { useState } from "react";
import { gearName, itemBlurb, itemName } from "./names";
import { ITEMS, ITEM_IDS, SHOP_ITEMS, sellPrice, type BagView, type ItemId, type Slot } from "../game/account/items";
import { ADVANCE_LEVEL, jobsOf } from "../game/combat/jobs";
import type { PlayerClass } from "../game/combat/classes";
import { jobBlurb, jobName, pathSkillName } from "./names";
import { combatPowerAt } from "../game/combat/power";
import { iconFor } from "../game/render/icons";
import { locale, t } from "./lang";
import type { Key } from "./strings/ko";
import type { WorldClient } from "../net/worldClient";

// What the server said went wrong, in the reader's language. Anything it does not know about is
// still said, in the plainest way there is.
export function problemText(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === "too_low") return t("problem.too_low_advance", { n: ADVANCE_LEVEL });
  const key = `problem.${code}` as Key;
  const said = t(key);
  return said === key ? t("problem.unavailable") : said;
}

export function slotLabel(slot: Slot): string {
  return t(slot === "weapon" ? "slot.weapon" : "slot.armor");
}

interface PanelProps {
  client: WorldClient;
  bag: BagView | null;
  onClose: () => void;
}

// Runs a bag or shop call and keeps the reason if it was refused.
function useAction(): [string | null, (run: () => Promise<string | null>) => void] {
  const [problem, setProblem] = useState<string | null>(null);
  return [problem, (run) => {
    setProblem(null);
    void run().then((code) => setProblem(problemText(code)));
  }];
}

// Your gold, what you wear and what you carry. The things carried are a grid of pictures; the one
// picked (or a worn piece) is told about on the right with what can be done with it — wear it,
// drink it, take it off, sell it in the village — so a full bag never needs a scroll.
export function BagPanel({ client, bag, onClose, inVillage, playerClass, level }: PanelProps & {
  inVillage: boolean;
  playerClass: PlayerClass;
  level: number;
}) {
  const [problem, act] = useAction();
  const [picked, setPicked] = useState<{ gear: Slot } | { item: ItemId } | null>(null);
  const items = ITEM_IDS.filter((id) => (bag?.bag[id] ?? 0) > 0);
  const job = bag?.job ?? null;
  // What the right side tells about: the worn piece or the carried item picked, while it is still there.
  const shown = (() => {
    if (!bag || !picked) return null;
    if ("gear" in picked) {
      const id = bag.gear[picked.gear];
      return id ? { id, worn: picked.gear } : null;
    }
    return (bag.bag[picked.item] ?? 0) > 0 ? { id: picked.item, worn: null } : null;
  })();
  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel bag-panel bag-inventory" onClick={(e) => e.stopPropagation()}>
        <header className="bag-head">
          <h2>{t("bag.title")}</h2>
          <span className="bag-gold">{bag ? t("common.gold", { n: bag.gold.toLocaleString(locale()) }) : t("common.loading")}</span>
          {bag && <span className="bag-power">{t("bag.power", { n: combatPowerAt(level, playerClass, bag.gear, bag.job, bag.plus).toLocaleString(locale()) })}</span>}
        </header>
        <div className="bag-job">
          {job ? (
            <span>{t("bag.job")} · <b>{jobName(job)}</b> ({jobBlurb(job)})</span>
          ) : level < ADVANCE_LEVEL ? (
            <span>{t("bag.advanceAt", { at: ADVANCE_LEVEL, level })}</span>
          ) : (
            <>
              <span>{t("bag.pickPath")}</span>
              <div className="bag-job-paths">
                {jobsOf(playerClass).map((id) => (
                  <button key={id} type="button" className="world-card" onClick={() => act(() => client.advance(id))}>
                    <b>{jobName(id)}</b>
                    <span>{pathSkillName(id, 0)} · {pathSkillName(id, 1)}</span>
                    <span>{jobBlurb(id)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="bag-body">
          <div className="bag-left">
            <div className="bag-gear">
              {(["weapon", "armor"] as Slot[]).map((slot) => {
                const worn = bag?.gear[slot] ?? null;
                const on = !!picked && "gear" in picked && picked.gear === slot;
                return (
                  <button key={slot} type="button" className={`bag-worn${on ? " picked" : ""}`} disabled={!worn} onClick={() => setPicked({ gear: slot })}>
                    <span className="bag-slot">{slotLabel(slot)}</span>
                    {worn && <img className="bag-icon" src={iconFor(worn) ?? undefined} alt="" />}
                    <b>{worn ? gearName(worn, bag?.plus) : t("common.nothing")}</b>
                  </button>
                );
              })}
            </div>
            {items.length === 0 ? (
              <p className="note">{t("bag.empty")}</p>
            ) : (
              <div className="bag-grid">
                {items.map((id) => {
                  const on = !!picked && "item" in picked && picked.item === id;
                  return (
                    <button key={id} type="button" className={`bag-cell${on ? " picked" : ""}`} onClick={() => setPicked({ item: id })} title={itemName(id)}>
                      <img src={iconFor(id) ?? undefined} alt={itemName(id)} />
                      <span className="bag-cell-count">{bag!.bag[id]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="bag-detail">
            {!shown ? (
              <p className="note">{t("bag.pickHint")}</p>
            ) : (
              <>
                <div className="bag-detail-head">
                  <img className="bag-icon" src={iconFor(shown.id) ?? undefined} alt="" />
                  <b>{ITEMS[shown.id].kind === "material" ? itemName(shown.id) : gearName(shown.id, bag!.plus)}</b>
                  {!shown.worn && <span className="bag-count">×{bag!.bag[shown.id]}</span>}
                </div>
                <p className="bag-blurb">{itemBlurb(shown.id)}</p>
                <div className="bag-actions">
                  {shown.worn && (
                    <button type="button" className="text-button" onClick={() => act(() => client.unequip(shown.worn!))}>{t("bag.unequip")}</button>
                  )}
                  {!shown.worn && ITEMS[shown.id].kind === "potion" && (
                    <button type="button" className="text-button" onClick={() => act(() => client.drink(shown.id))}>{t("bag.drink")}</button>
                  )}
                  {!shown.worn && (ITEMS[shown.id].kind === "weapon" || ITEMS[shown.id].kind === "armor") && (
                    <button type="button" className="text-button" onClick={() => act(() => client.equip(shown.id))}>{t("bag.equip")}</button>
                  )}
                  {!shown.worn && inVillage && (
                    <button type="button" className="text-button" onClick={() => act(() => client.sell(shown.id))}>
                      {t("bag.sell", { n: sellPrice(shown.id) })}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {problem && <p className="bag-problem">{problem}</p>}
        <footer className="bag-foot">
          <span className="note">{t("bag.keys")}</span>
          <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
        </footer>
      </div>
    </div>
  );
}

// The village shop: potions and the gear sold for gold.
export function ShopPanel({ client, bag, onClose }: PanelProps) {
  const [problem, act] = useAction();
  const buy = (id: ItemId, n: number) => act(() => client.buy(id, n));
  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel bag-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("shop.title")}</h2>
        <p className="bag-gold">{bag ? t("common.gold", { n: bag.gold.toLocaleString(locale()) }) : t("common.loading")}</p>
        <div className="bag-list">
          {SHOP_ITEMS.map((id) => (
            <div key={id} className="bag-row">
              <img className="bag-icon" src={iconFor(id) ?? undefined} alt="" />
              <b>{itemName(id)}</b>
              <span className="bag-count">{t("common.gold", { n: ITEMS[id].price! })}</span>
              <span className="bag-blurb">{itemBlurb(id)}</span>
              <button type="button" className="text-button" onClick={() => buy(id, 1)}>{t("shop.buy")}</button>
              {ITEMS[id].kind === "potion" && (
                <button type="button" className="text-button" onClick={() => buy(id, 10)}>{t("shop.buyTen")}</button>
              )}
            </div>
          ))}
        </div>
        {problem && <p className="bag-problem">{problem}</p>}
        <p className="note">{t("shop.note")}</p>
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}
