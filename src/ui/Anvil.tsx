import { useEffect, useState, type ReactNode } from "react";
import { gearName, itemBlurb, itemName } from "./names";
import { BREAK_FROM, RECIPES, enhanceCost, hasMaterials, type EnhanceOutcome, type Recipe } from "../game/account/forge";
import { protectCost, vipEnhance } from "../game/account/premium";
import {
  ITEMS, MAX_PLUS, PLUS_GUARD, PLUS_HP, PLUS_POWER, plusSteps, type BagView, type GearPiece, type ItemId, type Slot,
} from "../game/account/items";
import { TRADE_CRAFT_CHANCE } from "../game/account/inventory";
import { iconFor } from "../game/render/icons";
import type { WorldClient } from "../net/worldClient";
import { problemText, slotLabel } from "./BagPanel";
import { locale, t } from "./lang";
import type { Key } from "./strings/ko";
import { playCue } from "../game/audio/sfx";

// The pieces the bag and the forge share: a sheet with a stage on the left and a narrow column on
// the right (the world in view between them; a tap on it closes the sheet), the anvil that enhances a
// piece of gear, and the one that makes a recipe.

// How long the anvil works before the outcome shows; the server has answered well before.
const CHARGE_MS = 1800;
const OUTCOME: Record<EnhanceOutcome, Key> = { success: "forge.success", fail: "forge.fail", broken: "forge.broken" };
// Attempts the log under the anvil keeps.
const LOG_SIZE = 4;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Without motion the outcome shows at once.
const stillScreen = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export const percent = (n: number) => `${Math.round(n * 100)}%`;
export const gold = (n: number) => t("common.gold", { n: n.toLocaleString(locale()) });
export const stonesOf = (bag: BagView | null) => (bag ? (bag.bag.stone ?? 0) + (bag.bagTrade.stone ?? 0) : 0);

// A worn slot, or the uid of a piece in the bag.
export type Target = Slot | string;
export const isSlot = (target: Target): target is Slot => target === "weapon" || target === "armor";

export function pieceAt(bag: BagView, target: Target): GearPiece | null {
  return isSlot(target) ? bag.gear[target] : bag.pieces.find((p) => p.uid === target) ?? null;
}

export function Icon({ id, className }: { id: ItemId | "ui_gem"; className?: string }) {
  return <img className={className} src={iconFor(id) ?? undefined} alt="" draggable={false} />;
}

// The sheet: the stage on the left under its title (and whatever the screen puts beside it), the
// column on the right. A tap anywhere outside the two closes it, as the close button does.
export function SideSheet({ title, head, side, onClose, children }: {
  title: ReactNode; head?: ReactNode; side: ReactNode; onClose: () => void; children: ReactNode;
}) {
  return (
    <div className="forge" role="dialog" aria-label={typeof title === "string" ? title : undefined}>
      <div className="forge-backdrop" onClick={onClose} aria-hidden />
      <section className="forge-anvil">
        <header className="forge-head">
          <h2>{title}</h2>
          {head}
          <button type="button" className="forge-close" onClick={onClose}>
            <span aria-hidden>✕</span>{t("common.close")}
          </button>
        </header>
        <div className="forge-stage">{children}</div>
      </section>
      <aside className="forge-side">{side}</aside>
    </div>
  );
}

// Gold, whetstones and gems, at the top of the column.
export function Purse({ bag, extra }: { bag: BagView | null; extra?: ReactNode }) {
  return (
    <div className="forge-purse">
      <span>{bag ? gold(bag.gold) : "…"}</span>
      <span><Icon id="stone" className="forge-mini" />{stonesOf(bag).toLocaleString(locale())}</span>
      <span className="gems"><Icon id="ui_gem" className="forge-mini" />{(bag?.gems ?? 0).toLocaleString(locale())}</span>
      {extra}
    </div>
  );
}

// The attempt on the anvil: the piece as it went in, then how it came out.
export interface Attempt { item: ItemId; name: string; from: number; to: number; outcome: EnhanceOutcome | null }

// Enhancing a piece: the attempt under way or just over, the last few, whether gems guard against a
// break, and the hammer. `target` is the piece on the anvil (null for none).
export function useEnhance(client: WorldClient, bag: BagView | null, target: Target | null) {
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [log, setLog] = useState<Attempt[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  // Attempts that could break the gear are protected with gems while this is on.
  const [protect, setProtect] = useState(false);
  // Another piece on the anvil starts clean.
  useEffect(() => {
    setAttempt(null);
    setProblem(null);
  }, [target]);

  const enhance = () => {
    const piece = bag && target !== null ? pieceAt(bag, target) : null;
    const cost = piece ? enhanceCost(piece.id, piece.plus) : null;
    if (!piece || !cost || target === null || busy) return;
    const shielded = protect && protectCost(cost.to) !== null;
    const going: Attempt = { item: piece.id, name: itemName(piece.id), from: piece.plus, to: cost.to, outcome: null };
    setBusy(true);
    setProblem(null);
    setAttempt(going);
    void Promise.all([client.enhance(target, shielded), wait(stillScreen() ? 0 : CHARGE_MS)]).then(([r]) => {
      setBusy(false);
      if ("outcome" in r) {
        const done = { ...going, outcome: r.outcome };
        setAttempt(done);
        setLog((l) => [done, ...l].slice(0, LOG_SIZE));
        playCue(r.outcome === "success" ? "enhance_ok" : r.outcome === "broken" ? "enhance_break" : "enhance_fail");
      } else {
        setAttempt(null);
        setProblem(problemText(r.problem));
      }
    });
  };
  return { busy, attempt, log, problem, protect, setProtect, enhance };
}

// The heat under the anvil follows the odds: white-gold when an attempt is all but sure, ember orange,
// then a deep red as they fall. Read by the hearth's glow.
function heatOf(chance: number): string {
  if (chance >= 0.85) return "sure";
  if (chance >= 0.5) return "warm";
  if (chance >= 0.2) return "hot";
  return "fierce";
}

// What a piece adds at a +, line by line: a weapon its attack, armour its health and the share of each
// blow it stops.
function statLines(id: ItemId, plus: number): { key: Key; value: string }[] {
  const item = ITEMS[id];
  const n = plusSteps(plus);
  if (item.kind === "weapon") return [{ key: "forge.statPower", value: `+${Math.round((item.power + n * PLUS_POWER) * 100)}%` }];
  return [
    { key: "forge.statHp", value: `+${item.hp + n * PLUS_HP}` },
    { key: "forge.statGuard", value: `-${Math.round((item.guard + n * PLUS_GUARD) * 1000) / 10}%` },
  ];
}

// The anvil while enhancing: the piece in the hearth's glow, the track of its +, what the next one
// gives, the odds and the price, and the hammer. `children` go under the hammer (the bag's own
// buttons for the piece).
export function EnhanceStage({ bag, target, run, children }: {
  bag: BagView; target: Target; run: ReturnType<typeof useEnhance>; children?: ReactNode;
}) {
  const { attempt, busy, protect, setProtect, enhance } = run;
  const stones = stonesOf(bag);
  const piece = pieceAt(bag, target);
  // What is on the anvil: the attempt under way (or just over, the broken piece included), else the
  // piece picked as it stands now.
  const shownId = attempt?.item ?? piece?.id ?? null;
  if (!shownId) return null;
  const plus = attempt ? (attempt.outcome === "success" ? attempt.to : attempt.from) : piece!.plus;
  const cost = piece ? enhanceCost(piece.id, piece.plus) : null;
  const chance = cost ? Math.min(1, cost.success + vipEnhance(bag.vip)) : 1;
  const shield = cost && protect ? protectCost(cost.to) : null;
  const state = attempt ? (attempt.outcome ?? "working") : "idle";
  const broken = attempt?.outcome === "broken";
  const short = cost ? { gold: bag.gold < cost.gold, stones: stones < cost.stones, gems: shield !== null && bag.gems < shield } : null;
  const now = statLines(shownId, plus);
  const next = cost && !broken ? statLines(shownId, cost.to) : null;

  return (
    <div className={`forge-enhance ${state}`}>
      <div className={`forge-hearth heat-${heatOf(chance)}`}>
        <div className="forge-piece"><Icon id={shownId} /></div>
        <div className="forge-gauge"><i /></div>
      </div>
      <b className="forge-name">{broken ? itemName(shownId) : gearName({ id: shownId, plus })}</b>
      <span className="forge-where">
        {isSlot(target) ? `${t("forge.worn")} · ${slotLabel(target)}` : t("forge.inBag")}
        {piece && <> · <em className={piece.trade ? "trade" : ""}>{t(piece.trade ? "item.trade" : "item.bound")}</em></>}
      </span>
      <div className="forge-track" aria-hidden>
        {Array.from({ length: MAX_PLUS }, (_, i) => i + 1).map((n) => (
          <i key={n} className={`${n <= plus ? "lit" : ""}${n === plus + 1 && !broken ? " next" : ""}${n >= BREAK_FROM ? " risky" : ""}`} />
        ))}
      </div>
      {attempt?.outcome ? (
        <p className={`forge-outcome ${attempt.outcome}`}>{t(OUTCOME[attempt.outcome])}</p>
      ) : attempt ? (
        <p className="forge-outcome working">{t("forge.working")}</p>
      ) : null}
      {state !== "working" && (
        <div className="forge-gain">
          {now.map((line, i) => (
            <span key={line.key}>
              {t(line.key)} {line.value}{next && <> <em>→</em> <b>{next[i].value}</b></>}
            </span>
          ))}
        </div>
      )}
      {state !== "working" && piece && !cost && <p className="forge-maxed">{t("forge.maxed", { n: MAX_PLUS })}</p>}
      {state !== "working" && cost && short && (
        <>
          <div className="forge-odds">
            <span className="forge-odd good"><small>{t("forge.successLabel")}</small><b>{percent(chance)}</b></span>
            {cost.breaks > 0 ? (
              <span className={`forge-odd ${shield !== null ? "safe" : "bad"}`}>
                <small>{t("forge.breakLabel")}</small>
                <b>{shield !== null ? t("forge.safe") : percent(cost.breaks)}</b>
              </span>
            ) : (
              <span className="forge-odd safe"><small>{t("forge.breakLabel")}</small><b>{t("forge.safe")}</b></span>
            )}
          </div>
          <div className="forge-cost">
            <span className={short.gold ? "short" : ""}>{gold(cost.gold)}</span>
            <span className={short.stones ? "short" : ""}><Icon id="stone" className="forge-mini" />{stones}/{cost.stones}</span>
            {shield !== null && <span className={short.gems ? "short" : ""}><Icon id="ui_gem" className="forge-mini" />{shield}</span>}
          </div>
          {cost.to >= BREAK_FROM && (
            <label className="forge-protect">
              <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
              <span>{t("forge.protect", { n: BREAK_FROM })}</span>
            </label>
          )}
          <button
            type="button" className="brush-button forge-hammer"
            disabled={busy || short.gold || short.stones || short.gems} onClick={enhance}
          >
            {t("forge.go", { to: cost.to })}
          </button>
        </>
      )}
      {state !== "working" && children}
      {run.problem && <p className="forge-note bad">{run.problem}</p>}
      {run.log.length > 0 && (
        <div className="forge-log">
          <span className="forge-label">{t("forge.log")}</span>
          {run.log.map((a, i) => (
            <span key={i} className={`forge-log-row ${a.outcome}`}>
              <Icon id={a.item} />
              {a.name} +{a.from} → +{a.to}
              <b>{a.outcome ? t(OUTCOME[a.outcome]) : ""}</b>
            </span>
          ))}
        </div>
      )}
      {!attempt && <p className="forge-hint">{t("forge.note", { n: BREAK_FROM })}</p>}
    </div>
  );
}

// The anvil while crafting: what the picked recipe makes, and each thing it takes against what you have.
export function CraftStage({ recipe, bag, stacks, busy, onCraft }: {
  recipe: Recipe; bag: BagView; stacks: Partial<Record<ItemId, number>>; busy: boolean; onCraft: () => void;
}) {
  const ready = hasMaterials(stacks, recipe) && bag.gold >= recipe.gold;
  const gear = ITEMS[recipe.makes].kind === "weapon" || ITEMS[recipe.makes].kind === "armor";
  return (
    <div className={`forge-craft${ready ? " ready" : ""}`}>
      <div className={`forge-hearth ${ready ? "heat-warm" : "heat-cold"}`}>
        <div className="forge-piece"><Icon id={recipe.makes} /></div>
      </div>
      <b className="forge-name">{itemName(recipe.makes)}{recipe.n > 1 ? ` ×${recipe.n}` : ""}</b>
      <span className="forge-where">{itemBlurb(recipe.makes)}</span>
      <span className="forge-label">{t("forge.need")}</span>
      <div className="forge-needs">
        {recipe.needs.map((need) => {
          const have = stacks[need.item] ?? 0;
          return (
            <div key={need.item} className={`forge-need${have >= need.n ? " met" : ""}`}>
              <Icon id={need.item} />
              <span className="forge-need-name">{itemName(need.item)}</span>
              <span className="forge-need-count">{Math.min(have, 9999)}/{need.n}</span>
              <i style={{ width: `${Math.min(1, have / need.n) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="forge-cost">
        <span className={bag.gold < recipe.gold ? "short" : ""}>{gold(recipe.gold)}</span>
      </div>
      <button type="button" className="brush-button forge-hammer" disabled={busy || !ready} onClick={onCraft}>
        {t("forge.makeGo")}
      </button>
      {gear && <p className="forge-hint">{t("forge.tradeChance", { pct: percent(TRADE_CRAFT_CHANCE) })}</p>}
    </div>
  );
}

// The recipes, by tier (potions first), each with a mark when everything it takes is at hand.
export function RecipeRack({ stacks, gold: purse, picked, onPick }: {
  stacks: Partial<Record<ItemId, number>>; gold: number; picked: string; onPick: (id: string) => void;
}) {
  const groups = new Map<number, Recipe[]>();
  for (const r of RECIPES) {
    const tier = ITEMS[r.makes].tier ?? 0;
    groups.set(tier, [...(groups.get(tier) ?? []), r]);
  }
  return (
    <div className="forge-rack">
      <span className="forge-label">{t("forge.recipes")}</span>
      {[...groups.entries()].sort(([a], [b]) => a - b).map(([tier, list]) => (
        <div key={tier} className="forge-group">
          <small className="forge-tier">{tier === 0 ? t("forge.potions") : t("forge.tier", { n: tier })}</small>
          {list.map((r) => {
            const ready = hasMaterials(stacks, r) && purse >= r.gold;
            return (
              <button
                key={r.id} type="button" className={`forge-recipe${picked === r.id ? " picked" : ""}${ready ? " ready" : ""}`}
                onClick={() => onPick(r.id)}
              >
                <Icon id={r.makes} />
                <span>{itemName(r.makes)}{r.n > 1 ? ` ×${r.n}` : ""}</span>
                {ready && <i className="forge-ready" aria-label={t("forge.ready")} />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
