import { useState } from "react";
import { gearName, itemBlurb, itemName } from "./names";
import { ITEMS, ITEM_IDS, SHOP_ITEMS, sellPrice, type BagView, type GearPiece, type ItemId, type Slot } from "../game/account/items";
import { ADVANCE_LEVEL, jobsOf, type JobId } from "../game/combat/jobs";
import type { PlayerClass } from "../game/combat/classes";
import { jobBlurb, jobName, pathSkillName } from "./names";
import { combatPowerAt } from "../game/combat/power";
import { iconFor } from "../game/render/icons";
import { locale, t } from "./lang";
import type { Key } from "./strings/ko";
import type { WorldClient } from "../net/worldClient";
import { MAX_LISTINGS } from "../game/account/market";

// What the server said went wrong, in the reader's language. Anything it does not know about is
// still said, in the plainest way there is.
export function problemText(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === "too_low") return t("problem.too_low_advance", { n: ADVANCE_LEVEL });
  if (code === "listing_limit") return t("problem.listing_limit", { n: MAX_LISTINGS });
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
  const [picked, setPicked] = useState<Picked | null>(null);
  // A path tapped, waiting for a yes: the choice is for good, so one tap never makes it.
  const [path, setPath] = useState<JobId | null>(null);
  const cells = bag ? bagCells(bag) : [];
  const job = bag?.job ?? null;
  // What the right side tells about: the worn piece or the carried thing picked, while it is still there.
  const shown = bag && picked ? showing(bag, picked) : null;
  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel bag-panel bag-inventory" onClick={(e) => e.stopPropagation()}>
        <header className="bag-head">
          <h2>{t("bag.title")}</h2>
          <span className="bag-gold">{bag ? t("common.gold", { n: bag.gold.toLocaleString(locale()) }) : t("common.loading")}</span>
          {bag && <span className="bag-power">{t("bag.power", { n: combatPowerAt(level, playerClass, bag.gear, bag.job, bag.mount, bag.mountStars).toLocaleString(locale()) })}</span>}
        </header>
        <div className="bag-job">
          {job ? (
            <span>{t("bag.job")} · <b>{jobName(job)}</b> ({jobBlurb(job)})</span>
          ) : level < ADVANCE_LEVEL ? (
            <span>{t("bag.advanceAt", { at: ADVANCE_LEVEL, level })}</span>
          ) : (
            <>
              <span>{t("bag.pickPath")}</span>
              {path && (
                <div className="bag-job-confirm">
                  <span>{t("bag.confirmPath", { name: jobName(path) })}</span>
                  <button
                    type="button" className="brush-button small"
                    onClick={() => {
                      setPath(null);
                      act(() => client.advance(path));
                    }}
                  >
                    {t("bag.advanceGo")}
                  </button>
                  <button type="button" className="text-button" onClick={() => setPath(null)}>{t("common.cancel")}</button>
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
        </div>
        <div className="bag-body">
          <div className="bag-left">
            <div className="bag-gear">
              {(["weapon", "armor"] as Slot[]).map((slot) => {
                const worn = bag?.gear[slot] ?? null;
                const on = picked?.kind === "worn" && picked.slot === slot;
                return (
                  <button key={slot} type="button" className={`bag-worn${on ? " picked" : ""}`} disabled={!worn} onClick={() => setPicked({ kind: "worn", slot })}>
                    <span className="bag-slot">{slotLabel(slot)}</span>
                    {worn && <img className="bag-icon" src={iconFor(worn.id) ?? undefined} alt="" />}
                    <b>{worn ? gearName(worn) : t("common.nothing")}</b>
                  </button>
                );
              })}
            </div>
            {cells.length === 0 ? (
              <p className="note">{t("bag.empty")}</p>
            ) : (
              <div className="bag-grid">
                {cells.map((cell) => {
                  const on = !!picked && sameCell(picked, cell);
                  return (
                    <button
                      key={cellKey(cell)} type="button" className={`bag-cell${on ? " picked" : ""}${cell.trade ? " trade" : ""}`}
                      onClick={() => setPicked(cell)} title={itemName(cell.id)}
                    >
                      <img src={iconFor(cell.id) ?? undefined} alt={itemName(cell.id)} />
                      {cell.kind === "stack" && <span className="bag-cell-count">{cell.n}</span>}
                      {cell.kind === "piece" && cell.piece.plus > 0 && <span className="bag-cell-plus">+{cell.piece.plus}</span>}
                      {cell.trade && <i className="bag-cell-trade" title={t("item.trade")} />}
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
                  <b>{shown.piece ? gearName(shown.piece) : itemName(shown.id)}</b>
                  {shown.n !== null && <span className="bag-count">×{shown.n}</span>}
                </div>
                {shown.trade !== null && (
                  <p className={`bag-trade${shown.trade ? " on" : ""}`}>{t(shown.trade ? "item.trade" : "item.bound")}</p>
                )}
                <p className="bag-blurb">{itemBlurb(shown.id)}</p>
                <div className="bag-actions">
                  {shown.worn && (
                    <button type="button" className="text-button" onClick={() => act(() => client.unequip(shown.worn!))}>{t("bag.unequip")}</button>
                  )}
                  {!shown.worn && ITEMS[shown.id].kind === "potion" && (
                    <button type="button" className="text-button" onClick={() => act(() => client.drink(shown.id))}>{t("bag.drink")}</button>
                  )}
                  {!shown.worn && shown.piece && (
                    <button type="button" className="text-button" onClick={() => act(() => client.equip(shown.piece!.uid))}>{t("bag.equip")}</button>
                  )}
                  {!shown.worn && inVillage && (
                    <button
                      type="button" className="text-button"
                      onClick={() => act(() => (shown.piece ? client.sellPiece(shown.piece.uid) : client.sell(shown.id, 1, shown.trade === true)))}
                    >
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

// One square of the bag's grid: a stack of potions or materials (materials that may be traded
// stand apart from those that may not), or one piece of gear.
type Cell =
  | { kind: "stack"; id: ItemId; trade: boolean; n: number }
  | { kind: "piece"; id: ItemId; trade: boolean; piece: GearPiece };
type Picked = Cell | { kind: "worn"; slot: Slot };

// The grid in the item table's order, each kind's pieces together.
export function bagCells(bag: Pick<BagView, "bag" | "bagTrade" | "pieces">): Cell[] {
  const out: Cell[] = [];
  for (const id of ITEM_IDS) {
    if ((bag.bag[id] ?? 0) > 0) out.push({ kind: "stack", id, trade: false, n: bag.bag[id]! });
    if ((bag.bagTrade[id] ?? 0) > 0) out.push({ kind: "stack", id, trade: true, n: bag.bagTrade[id]! });
    for (const piece of bag.pieces) if (piece.id === id) out.push({ kind: "piece", id, trade: piece.trade, piece });
  }
  return out;
}

function cellKey(cell: Cell): string {
  return cell.kind === "piece" ? cell.piece.uid : `${cell.id}:${cell.trade}`;
}

function sameCell(picked: Picked, cell: Cell): boolean {
  return picked.kind !== "worn" && cellKey(picked) === cellKey(cell);
}

// What the detail side says about the thing picked, as it is now (null once it is gone). n: how many
// (stacks only); trade: whether it may go to the market (null for potions, which never do).
function showing(bag: BagView, picked: Picked): {
  id: ItemId; piece: GearPiece | null; n: number | null; trade: boolean | null; worn: Slot | null;
} | null {
  if (picked.kind === "worn") {
    const piece = bag.gear[picked.slot];
    return piece ? { id: piece.id, piece, n: null, trade: piece.trade, worn: picked.slot } : null;
  }
  if (picked.kind === "piece") {
    const piece = bag.pieces.find((p) => p.uid === picked.piece.uid);
    return piece ? { id: piece.id, piece, n: null, trade: piece.trade, worn: null } : null;
  }
  const n = (picked.trade ? bag.bagTrade : bag.bag)[picked.id] ?? 0;
  if (n === 0) return null;
  return { id: picked.id, piece: null, n, trade: ITEMS[picked.id].kind === "material" ? picked.trade : null, worn: null };
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
