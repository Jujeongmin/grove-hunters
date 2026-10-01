import { useState } from "react";
import { gearName, itemBlurb, itemName } from "./names";
import { BREAK_FROM, RECIPES, enhanceCost, hasMaterials } from "../game/account/forge";
import { protectCost } from "../game/account/premium";
import { MAX_PLUS, type BagView, type Slot } from "../game/account/items";
import { TRADE_CRAFT_CHANCE, allStacks } from "../game/account/inventory";
import { iconFor } from "../game/render/icons";
import type { WorldClient } from "../net/worldClient";
import { problemText, slotLabel } from "./BagPanel";
import { locale, t } from "./lang";
import { playCue } from "../game/audio/sfx";
import { CHARGE_MS, EnhanceShow, OUTCOME, type Enhancing } from "./EnhanceShow";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Without motion the outcome shows at once.
const stillScreen = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const percent = (n: number) => `${Math.round(n * 100)}%`;

// The forge, from the menu anywhere (or from the village smith): enhance what you wear (+1 to +10,
// riskier the higher it goes) and make gear and potions from what monsters drop.
export function SmithPanel({ client, bag, onClose }: { client: WorldClient; bag: BagView | null; onClose: () => void }) {
  const [tab, setTab] = useState<"enhance" | "craft">("enhance");
  const [note, setNote] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState<Enhancing | null>(null);
  // Attempts that could break the gear are protected with gems while this is on.
  const [protect, setProtect] = useState(false);
  const stones = bag ? (bag.bag.stone ?? 0) + (bag.bagTrade.stone ?? 0) : 0;
  const stacks = bag ? allStacks(bag) : {};

  // The attempt plays out (see EnhanceShow): the gauge fills while the server answers, and the
  // outcome shows once both are done.
  const enhance = (slot: Slot) => {
    const worn = bag?.gear[slot];
    const cost = worn ? enhanceCost(worn.id, worn.plus) : null;
    if (!worn || !cost) return;
    const shielded = protect && protectCost(cost.to) !== null;
    setBusy(true);
    setNote(null);
    setShow({ item: worn.id, name: itemName(worn.id), from: worn.plus, to: cost.to, outcome: null });
    void Promise.all([client.enhance(slot, shielded), wait(stillScreen() ? 0 : CHARGE_MS)]).then(([r]) => {
      setBusy(false);
      if ("outcome" in r) {
        setShow((s) => s && { ...s, outcome: r.outcome });
        setNote({ text: t(OUTCOME[r.outcome]), tone: r.outcome === "success" ? "good" : "bad" });
        playCue(r.outcome === "success" ? "enhance_ok" : r.outcome === "broken" ? "enhance_break" : "enhance_fail");
      } else {
        setShow(null);
        setNote({ text: problemText(r.problem)!, tone: "bad" });
      }
    });
  };
  const craft = (id: string, name: string) => {
    setBusy(true);
    setNote(null);
    void client.craft(id).then((code) => {
      setBusy(false);
      setNote(code ? { text: problemText(code)!, tone: "bad" } : { text: t("forge.crafted", { name }), tone: "good" });
      if (!code) playCue("enhance_ok");
    });
  };

  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel bag-panel smith-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("forge.title")}</h2>
        <p className="bag-gold">{bag ? `${t("common.gold", { n: bag.gold.toLocaleString(locale()) })} · ${t("forge.stones", { n: stones })}` : t("common.loading")}</p>
        <div className="smith-tabs">
          <button type="button" className={`text-button${tab === "enhance" ? " on" : ""}`} onClick={() => setTab("enhance")}>{t("forge.enhance")}</button>
          <button type="button" className={`text-button${tab === "craft" ? " on" : ""}`} onClick={() => setTab("craft")}>{t("forge.craft")}</button>
        </div>

        {tab === "enhance" && bag && (
          <div className="bag-list">
            {(["weapon", "armor"] as Slot[]).map((slot) => {
              const worn = bag.gear[slot];
              if (!worn) {
                return (
                  <div key={slot} className="bag-row">
                    <span className="bag-slot">{slotLabel(slot)}</span>
                    <span className="note">{t("forge.noGear")}</span>
                  </div>
                );
              }
              const cost = enhanceCost(worn.id, worn.plus);
              const shield = cost && protect ? protectCost(cost.to) : null;
              return (
                <div key={slot} className="bag-row smith-row">
                  <span className="bag-slot">{slotLabel(slot)}</span>
                  <img className="bag-icon" src={iconFor(worn.id) ?? undefined} alt="" />
                  <b>{gearName(worn)}</b>
                  {cost ? (
                    <>
                      <button
                        type="button" className="text-button"
                        disabled={busy || stones < cost.stones || bag.gold < cost.gold || (shield !== null && bag.gems < shield)}
                        onClick={() => enhance(slot)}
                      >
                        {t("forge.enhance")}
                      </button>
                      <span className="bag-blurb">
                        {t("forge.chance", { to: cost.to, pct: percent(cost.success) })}
                        {cost.breaks > 0 && (shield !== null
                          ? <em className="smith-safe"> · {t("forge.protected", { n: shield })}</em>
                          : <em className="smith-risk"> · {t("forge.breakRisk", { pct: percent(cost.breaks) })}</em>)}
                        {" "}· {t("common.gold", { n: cost.gold.toLocaleString(locale()) })} · {t("forge.stones", { n: cost.stones })}
                      </span>
                    </>
                  ) : (
                    <span className="bag-blurb">{t("forge.maxed", { n: MAX_PLUS })}</span>
                  )}
                </div>
              );
            })}
            <label className="smith-protect">
              <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
              <span>{t("forge.protect", { n: BREAK_FROM })}</span>
              <span className="smith-protect-gems">
                <img src={iconFor("ui_gem") ?? undefined} alt="" draggable={false} />
                {bag.gems.toLocaleString(locale())}
              </span>
            </label>
            <p className="note">{t("forge.note", { n: BREAK_FROM })}</p>
          </div>
        )}

        {tab === "craft" && bag && (
          <div className="bag-list">
            {RECIPES.map((recipe) => {
              const ready = hasMaterials(stacks, recipe) && bag.gold >= recipe.gold;
              const name = itemName(recipe.makes);
              return (
                <div key={recipe.id} className="bag-row smith-row">
                  <img className="bag-icon" src={iconFor(recipe.makes) ?? undefined} alt="" />
                  <b>{name}{recipe.n > 1 ? ` ×${recipe.n}` : ""}</b>
                  <button type="button" className="text-button" disabled={busy || !ready} onClick={() => craft(recipe.id, name)}>{t("forge.craft")}</button>
                  <span className="bag-blurb">
                    {itemBlurb(recipe.makes)} · {recipe.needs.map((need) => {
                      const have = stacks[need.item] ?? 0;
                      return <span key={need.item} className={have >= need.n ? "" : "smith-short"}>{itemName(need.item)} {have}/{need.n} · </span>;
                    })}
                    {t("common.gold", { n: recipe.gold.toLocaleString(locale()) })}
                  </span>
                </div>
              );
            })}
            <p className="note">{t("forge.tradeChance", { pct: percent(TRADE_CRAFT_CHANCE) })}</p>
          </div>
        )}

        {note &&<p className={`smith-note ${note.tone}`}>{note.text}</p>}
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
      {show && <EnhanceShow show={show} onClose={() => setShow(null)} />}
    </div>
  );
}
