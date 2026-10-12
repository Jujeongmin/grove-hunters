import { useState } from "react";
import { itemBlurb, itemName } from "./names";
import { ITEMS, ITEM_IDS, SHOP_ITEMS, slotOf, type BagView, type GearPiece, type ItemId, type Slot } from "../game/account/items";
import { ADVANCE_LEVEL } from "../game/combat/jobs";
import type { PlayerClass } from "../game/combat/classes";
import { jobBlurb, jobName } from "./names";
import { combatPowerAt } from "../game/combat/power";
import { iconFor } from "../game/render/icons";
import { locale, t } from "./lang";
import type { Key } from "./strings/ko";
import type { WorldClient } from "../net/worldClient";
import { MAX_LISTINGS } from "../game/account/market";
import { FullScreen } from "./FullScreen";
import { EnhanceStage, Icon, Purse, SideSheet, useEnhance, type Target } from "./Anvil";

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

// Your gold, what you wear and what you carry, laid out like the forge: what you carry is a grid of
// squares in the column on the right (what you wear above it), and the one picked stands on the left
// with what can be done with it. A piece of gear goes on the anvil there, to enhance it, wear it, take
// it off or sell it; a potion or material can be drunk or sold. With nothing picked the left side
// shows your class and its path, or the way to the advancement screen once it may advance.
export function BagPanel({ client, bag, onClose, onAdvance, playerClass, level }: PanelProps & {
  // Opens the advancement screen (전직), where the paths are chosen.
  onAdvance: () => void;
  playerClass: PlayerClass;
  level: number;
}) {
  const [problem, act] = useAction();
  const [picked, setPicked] = useState<Picked | null>(null);
  const cells = bag ? bagCells(bag) : [];
  const job = bag?.job ?? null;
  const shown = bag && picked ? showing(bag, picked) : null;
  // The piece of gear on the anvil, if what is picked is one.
  const target: Target | null = picked?.kind === "worn" ? picked.slot : picked?.kind === "piece" ? picked.piece.uid : null;
  const run = useEnhance(client, bag, target);
  // Throwing away waits for a second tap: what is thrown away is gone.
  const [discarding, setDiscarding] = useState(false);
  const pick = (next: Picked) => {
    if (run.busy) return;
    setDiscarding(false);
    // Tapping the one picked again goes back to your class.
    setPicked(picked && samePick(picked, next) ? null : next);
  };
  const discard = () => {
    if (!shown) return;
    setDiscarding(false);
    setPicked(null);
    act(() => (shown.piece ? client.discardPiece(shown.piece.uid) : client.discard(shown.id, shown.n ?? 1, shown.trade === true)));
  };
  const power = bag ? combatPowerAt(level, playerClass, bag.gear, bag.job, bag.mount, bag.mountStars, bag.vip, bag.herd) : null;

  // What can be done with the thing picked, under it.
  const actions = shown && (
    <div className="bag-actions forge-actions">
      {shown.worn && (
        <button
          type="button" className="text-button"
          onClick={() => {
            const piece = shown.piece!;
            act(() => client.unequip(shown.worn!));
            setPicked({ kind: "piece", id: piece.id, trade: piece.trade, piece });
          }}
        >
          {t("bag.unequip")}
        </button>
      )}
      {!shown.worn && ITEMS[shown.id].kind === "potion" && (
        <button type="button" className="text-button" onClick={() => act(() => client.drink(shown.id))}>{t("bag.drink")}</button>
      )}
      {!shown.worn && shown.piece && (
        <button
          type="button" className="text-button"
          onClick={() => {
            act(() => client.equip(shown.piece!.uid));
            const slot = slotOf(shown.id);
            if (slot) setPicked({ kind: "worn", slot });
          }}
        >
          {t("bag.equip")}
        </button>
      )}
      {!shown.worn && (discarding ? (
        <span className="bag-discard">
          <span>{t("bag.discardConfirm", { name: itemName(shown.id), n: shown.n ?? 1 })}</span>
          <button type="button" className="text-button bad" onClick={discard}>{t("bag.discardGo")}</button>
          <button type="button" className="text-button" onClick={() => setDiscarding(false)}>{t("common.cancel")}</button>
        </span>
      ) : (
        <button type="button" className="text-button" onClick={() => setDiscarding(true)}>{t("bag.discard")}</button>
      ))}
    </div>
  );

  const square = (key: string, next: Picked, id: ItemId, extra: { n?: number; plus?: number; trade?: boolean }) => {
    const on = !!picked && samePick(picked, next);
    return (
      <button
        key={key} type="button" className={`forge-cell${on ? " picked" : ""}${extra.trade ? " trade" : ""}`}
        onClick={() => pick(next)} title={itemName(id)}
      >
        <Icon id={id} />
        {extra.n !== undefined && <span className="forge-cell-count">{extra.n}</span>}
        {(extra.plus ?? 0) > 0 && <span className="forge-cell-plus">+{extra.plus}</span>}
      </button>
    );
  };

  return (
    <SideSheet
      title={t("bag.title")} onClose={onClose}
      side={(
        <>
          <Purse bag={bag} extra={power !== null && <span className="power">{t("bag.power", { n: power.toLocaleString(locale()) })}</span>} />
          <div className="forge-rack">
            <span className="forge-label">{t("forge.worn")}</span>
            <div className="forge-worn">
              {(["weapon", "armor"] as Slot[]).map((slot) => {
                const worn = bag?.gear[slot] ?? null;
                return (
                  <div key={slot} className="forge-worn-slot">
                    {worn ? square(slot, { kind: "worn", slot }, worn.id, { plus: worn.plus, trade: worn.trade }) : <span className="forge-cell empty" />}
                    <small>{slotLabel(slot)}</small>
                  </div>
                );
              })}
            </div>
            <span className="forge-label">{t("bag.title")}</span>
            {cells.length === 0 ? (
              <p className="note">{t("bag.empty")}</p>
            ) : (
              <div className="forge-grid">
                {cells.map((cell) => square(cellKey(cell), cell, cell.id, cell.kind === "stack"
                  ? { n: cell.n, trade: cell.trade }
                  : { plus: cell.piece.plus, trade: cell.trade }))}
              </div>
            )}
            <span className="forge-hint">{t("bag.keys")}</span>
          </div>
        </>
      )}
    >
      {!bag ? (
        <p className="note">{t("common.loading")}</p>
      ) : target !== null && (shown || run.attempt) ? (
        <EnhanceStage bag={bag} target={target} run={run}>{actions}</EnhanceStage>
      ) : shown ? (
        <div className="forge-craft ready">
          <div className="forge-hearth heat-cold"><div className="forge-piece"><Icon id={shown.id} /></div></div>
          <b className="forge-name">{itemName(shown.id)}{shown.n !== null && <span className="forge-count"> ×{shown.n}</span>}</b>
          {shown.trade !== null && (
            <span className="forge-where"><em className={shown.trade ? "trade" : ""}>{t(shown.trade ? "item.trade" : "item.bound")}</em></span>
          )}
          <p className="forge-blurb">{itemBlurb(shown.id)}</p>
          {actions}
        </div>
      ) : (
        <div className="bag-job forge-job">
          {job ? (
            <span>{t("bag.job")} · <b>{jobName(job)}</b> ({jobBlurb(job)})</span>
          ) : level < ADVANCE_LEVEL ? (
            <span>{t("bag.advanceAt", { at: ADVANCE_LEVEL, level })}</span>
          ) : (
            <div className="bag-job-confirm">
              <span>{t("bag.advanceReady")}</span>
              <button type="button" className="brush-button small" onClick={onAdvance}>{t("bag.advanceGo")}</button>
            </div>
          )}
          <p className="forge-hint">{t("bag.pickHint")}</p>
        </div>
      )}
      {problem && <p className="forge-note bad">{problem}</p>}
    </SideSheet>
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

function samePick(a: Picked, b: Picked): boolean {
  if (a.kind === "worn") return b.kind === "worn" && a.slot === b.slot;
  return b.kind !== "worn" && cellKey(a) === cellKey(b);
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
    <FullScreen title={t("shop.title")} className="bag-panel" onClose={onClose}>
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
    </FullScreen>
  );
}
