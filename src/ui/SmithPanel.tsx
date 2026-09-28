import { useState } from "react";
import { gearName, itemBlurb, itemName } from "./names";
import { BREAK_FROM, RECIPES, enhanceCost, hasMaterials, type EnhanceOutcome } from "../game/account/forge";
import { MAX_PLUS, type BagView, type Slot } from "../game/account/items";
import { iconFor } from "../game/render/icons";
import type { WorldClient } from "../net/worldClient";
import { problemText, slotLabel } from "./BagPanel";
import { locale, t } from "./lang";
import type { Key } from "./strings/ko";
import { playCue } from "../game/audio/sfx";

const OUTCOME: Record<EnhanceOutcome, Key> = {
  success: "forge.success",
  fail: "forge.fail",
  broken: "forge.broken",
};

const percent = (n: number) => `${Math.round(n * 100)}%`;

// The forge, from the menu anywhere (or from the village smith): enhance what you wear (+1 to +10,
// riskier the higher it goes) and make gear and potions from what monsters drop.
export function SmithPanel({ client, bag, onClose }: { client: WorldClient; bag: BagView | null; onClose: () => void }) {
  const [tab, setTab] = useState<"enhance" | "craft">("enhance");
  const [note, setNote] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const [busy, setBusy] = useState(false);
  const stones = bag?.bag.stone ?? 0;

  const enhance = (slot: Slot) => {
    setBusy(true);
    setNote(null);
    void client.enhance(slot).then((r) => {
      setBusy(false);
      if ("outcome" in r) {
        setNote({ text: t(OUTCOME[r.outcome]), tone: r.outcome === "success" ? "good" : "bad" });
        playCue(r.outcome === "success" ? "enhance_ok" : r.outcome === "broken" ? "enhance_break" : "enhance_fail");
      }
      else setNote({ text: problemText(r.problem)!, tone: "bad" });
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
              const cost = enhanceCost(worn, bag.plus[worn] ?? 0);
              return (
                <div key={slot} className="bag-row smith-row">
                  <span className="bag-slot">{slotLabel(slot)}</span>
                  <img className="bag-icon" src={iconFor(worn) ?? undefined} alt="" />
                  <b>{gearName(worn, bag.plus)}</b>
                  {cost ? (
                    <>
                      <button
                        type="button" className="text-button" disabled={busy || stones < cost.stones || bag.gold < cost.gold}
                        onClick={() => enhance(slot)}
                      >
                        {t("forge.enhance")}
                      </button>
                      <span className="bag-blurb">
                        {t("forge.chance", { to: cost.to, pct: percent(cost.success) })}
                        {cost.breaks > 0 && <em className="smith-risk"> · {t("forge.breakRisk", { pct: percent(cost.breaks) })}</em>}
                        {" "}· {t("common.gold", { n: cost.gold.toLocaleString(locale()) })} · {t("forge.stones", { n: cost.stones })}
                      </span>
                    </>
                  ) : (
                    <span className="bag-blurb">{t("forge.maxed", { n: MAX_PLUS })}</span>
                  )}
                </div>
              );
            })}
            <p className="note">{t("forge.note", { n: BREAK_FROM })}</p>
          </div>
        )}

        {tab === "craft" && bag && (
          <div className="bag-list">
            {RECIPES.map((recipe) => {
              const ready = hasMaterials(bag.bag, recipe) && bag.gold >= recipe.gold;
              const name = itemName(recipe.makes);
              return (
                <div key={recipe.id} className="bag-row smith-row">
                  <img className="bag-icon" src={iconFor(recipe.makes) ?? undefined} alt="" />
                  <b>{name}{recipe.n > 1 ? ` ×${recipe.n}` : ""}</b>
                  <button type="button" className="text-button" disabled={busy || !ready} onClick={() => craft(recipe.id, name)}>{t("forge.craft")}</button>
                  <span className="bag-blurb">
                    {itemBlurb(recipe.makes)} · {recipe.needs.map((need) => {
                      const have = bag.bag[need.item] ?? 0;
                      return <span key={need.item} className={have >= need.n ? "" : "smith-short"}>{itemName(need.item)} {have}/{need.n} · </span>;
                    })}
                    {t("common.gold", { n: recipe.gold.toLocaleString(locale()) })}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {note && <p className={`smith-note ${note.tone}`}>{note.text}</p>}
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}
