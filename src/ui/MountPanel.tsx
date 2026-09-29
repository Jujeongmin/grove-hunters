import { useCallback, useEffect, useRef, useState } from "react";
import {
  BASE_MOUNT, DUPLICATE_REFUND, GACHA_ODDS, GEM_PRODUCTS, MOUNTS, MOUNT_IDS, PULL_COST, mountBonus, mountsOfTier,
  type MountId, type MountTier,
} from "../game/account/mounts";
import type { ModelLibrary } from "../game/assets/ModelLibrary";
import type { PlayerClass } from "../game/combat/classes";
import { publicUrl } from "../game/assets/publicUrl";
import { iconFor } from "../game/render/icons";
import type { Costume } from "../game/render/costumes";
import { MountStage, tierKey } from "../game/render/MountStage";
import { playCue } from "../game/audio/sfx";
import { buyProduct, onAnyShopClosed, productPrice } from "../net/shop";
import type { MountsView, WorldClient } from "../net/worldClient";
import { problemText } from "./BagPanel";
import { locale, t } from "./lang";
import type { Key } from "./strings/ko";

const VERSE = import.meta.env.VITE_AGENT8_VERSE as string | undefined;
// After a gem pack's dialog closes, the gems arrive on the server on their own: ask this often, this long.
const CONFIRM_EVERY_MS = 1500;
const CONFIRM_FOR_MS = 30_000;
// The egg's shaking and bursting take about this long (see MountStage).
const HATCH_WAIT_MS = 2500;
// Gems per VX at the smallest pack: a bigger pack's bonus is measured against it.
const BASE_RATE = 1;

type Tab = "stable" | "hatch" | "shop";

const pct = (n: number) => `${(Math.round(n * 1000) / 10).toLocaleString(locale())}%`;
export const mountName = (id: MountId) => t(`mount.name.${id}` as Key);
const tierName = (tier: MountTier | "base") => t(`mount.tier.${tier}` as Key);

interface MountPanelProps {
  client: WorldClient;
  owned: boolean;
  library: ModelLibrary | null;
  playerClass: PlayerClass;
  costume: Costume;
  onClose: () => void;
}

// The stable, over the whole screen: a stage where your hero rides the mount you look at, and three
// tabs beside it: your mounts (pick the one to ride), the egg hatchery (the draw, with its odds in
// full, as Korean law requires of paid draws) and the gem shop.
export function MountPanel({ client, owned: ownsFullGame, library, playerClass, costume, onClose }: MountPanelProps) {
  const [tab, setTab] = useState<Tab>("stable");
  const [view, setView] = useState<MountsView | null>(null);
  const [looking, setLooking] = useState<MountId>(BASE_MOUNT);
  const [note, setNote] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const [hatched, setHatched] = useState<{ mount: MountId; repeat: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<MountStage | null>(null);
  const [portraits, setPortraits] = useState<Partial<Record<MountId, string>>>({});

  const refresh = useCallback(() => client.mounts().then((v) => {
    if (v) setView(v);
    return v;
  }), [client]);
  useEffect(() => {
    void refresh().then((v) => {
      if (v?.selected) setLooking(v.selected);
    });
  }, [refresh]);

  // The stage, once every mount's model has come.
  useEffect(() => {
    if (!library) return;
    let live = true;
    void library.preload(MOUNT_IDS.map((id) => MOUNTS[id].model)).then(() => {
      if (!live || !canvas.current) return;
      const s = new MountStage(canvas.current, library, { playerClass, costume });
      stage.current = s;
      setPortraits(Object.fromEntries(MOUNT_IDS.map((id) => [id, s.portrait(id)])));
      setReady(true);
    });
    return () => {
      live = false;
      stage.current?.dispose();
      stage.current = null;
    };
  }, [library, playerClass, costume]);

  const mine = (id: MountId) => view?.owned.includes(id) ?? false;
  // What stands on the pedestal: the egg in the hatchery (until it hatches), else the mount looked at.
  useEffect(() => {
    const s = stage.current;
    if (!s || !ready) return;
    if (tab === "hatch" && !hatched) s.showEgg();
    else if (tab !== "hatch") {
      if (mine(looking)) s.showRiding(looking);
      else s.showAlone(looking, true);
    }
  }, [tab, looking, ready, view, hatched]);

  // A gem pack bought: poll until the gems are in.
  useEffect(() => onAnyShopClosed((productId, purchased) => {
    if (!purchased || !(productId in GEM_PRODUCTS)) return;
    const before = view?.gems ?? 0;
    const started = Date.now();
    setWaiting(true);
    const poll = async () => {
      const next = await refresh();
      if ((next?.gems ?? 0) > before || Date.now() - started >= CONFIRM_FOR_MS) {
        setWaiting(false);
        return;
      }
      setTimeout(() => void poll(), CONFIRM_EVERY_MS);
    };
    void poll();
  }), [refresh, view?.gems]);

  const hatch = () => {
    setBusy(true);
    setNote(null);
    setHatched(null);
    stage.current?.showEgg();
    void client.pullMount().then(async (r) => {
      if ("problem" in r) {
        setBusy(false);
        setNote({ text: problemText(r.problem)!, tone: "bad" });
        return;
      }
      // The egg hatches on the stage's frames; a hidden page draws none, so the answer never waits long.
      if (stage.current) {
        await Promise.race([stage.current.hatchInto(r.mount), new Promise((done) => setTimeout(done, HATCH_WAIT_MS))]);
        stage.current?.finishHatch();
      }
      setBusy(false);
      setView(r);
      setLooking(r.mount);
      setHatched({ mount: r.mount, repeat: r.repeat });
      playCue(r.repeat ? "enhance_fail" : "enhance_ok");
    });
  };
  const ride = (id: MountId) => {
    void client.selectMount(id).then((r) => {
      if ("problem" in r) setNote({ text: problemText(r.problem)!, tone: "bad" });
      else setView(r);
    });
  };
  const switchTab = (next: Tab) => {
    setTab(next);
    setNote(null);
    if (next !== "hatch") setHatched(null);
  };

  const gems = view?.gems ?? 0;
  const shown = tab === "hatch" && !hatched ? null : looking;
  return (
    <div className="stable" role="dialog">
      <header className="stable-bar">
        <h2 className="stable-title">{t("mount.stable")}</h2>
        <nav className="stable-tabs">
          {(["stable", "hatch", "shop"] as Tab[]).map((id) => (
            <button key={id} type="button" className={`stable-tab${tab === id ? " on" : ""}`} onClick={() => switchTab(id)}>
              {t(`mount.tab.${id}` as Key)}
            </button>
          ))}
        </nav>
        <span className="stable-gems" title={t("mount.gemsTitle")}>
          <img src={iconFor("ui_gem") ?? undefined} alt="" />
          {view ? gems.toLocaleString(locale()) : "…"}
        </span>
        <button type="button" className="stable-close" onClick={onClose} aria-label={t("common.close")}>✕</button>
      </header>

      <div className="stable-body">
        <section className={`stable-stage tier-${shown ? tierKey(shown) : "base"}`}>
          <canvas ref={canvas} />
          {!ready && <p className="stable-loading">{t("common.loading")}</p>}
          {shown && (
            <div className="stable-plate">
              <span className="stable-tier">{tierName(tierKey(shown))}</span>
              <b className="stable-name">{mountName(shown)}</b>
              <span className="stable-speed">
                {t("mount.speed", { n: MOUNTS[shown].speed })}
                <i className="stable-pips" style={{ ["--pips" as string]: Math.round((MOUNTS[shown].speed - 1) * 10) }} />
              </span>
              <span className="stable-stats">
                {t("mount.stats", { p: Math.round(mountBonus(shown).power * 100), h: mountBonus(shown).hp })}
              </span>
              {tab === "stable" && (mine(shown)
                ? view?.selected === shown
                  ? <span className="stable-riding">{t("mount.riding")}</span>
                  : <button type="button" className="brush-button small" onClick={() => ride(shown)}>{t("mount.pick")}</button>
                : <span className="stable-locked">{shown === BASE_MOUNT ? t("mount.fullGame") : t("mount.notOwned")}</span>)}
            </div>
          )}
        </section>

        <section className="stable-side">
          {tab === "stable" && (
            <>
              <div className="stable-grid">
                {MOUNT_IDS.map((id) => (
                  <button
                    key={id} type="button"
                    className={`stable-card tier-${tierKey(id)}${looking === id ? " looking" : ""}${mine(id) ? "" : " locked"}${view?.selected === id ? " riding" : ""}`}
                    onClick={() => setLooking(id)}
                  >
                    {portraits[id] ? <img src={portraits[id]} alt="" /> : <span className="stable-card-blank" />}
                    <b>{mountName(id)}</b>
                    {!mine(id) && <img className="stable-lock" src={iconFor("ui_lock") ?? undefined} alt="" />}
                  </button>
                ))}
              </div>
              <p className="stable-hint">{t("mount.statsNote")}</p>
              <p className="stable-hint">{t("mount.rideHint")}</p>
              {!ownsFullGame && <p className="stable-hint">{t("mount.baseNote", { name: mountName(BASE_MOUNT) })}</p>}
            </>
          )}

          {tab === "hatch" && (
            <>
              <p className="stable-lede">{t("mount.hatchLede")}</p>
              <button type="button" className="stable-hatch" disabled={busy || !view || gems < PULL_COST} onClick={hatch}>
                <span>{t("mount.hatch")}</span>
                <small><img src={iconFor("ui_gem") ?? undefined} alt="" />{PULL_COST}</small>
              </button>
              {hatched && (
                <p className={`stable-result tier-${tierKey(hatched.mount)}`}>
                  {hatched.repeat
                    ? t("mount.repeat", { name: mountName(hatched.mount), n: DUPLICATE_REFUND })
                    : t("mount.new", { name: mountName(hatched.mount), tier: tierName(tierKey(hatched.mount)) })}
                </p>
              )}
              {!busy && view && gems < PULL_COST && (
                <button type="button" className="text-button stable-more" onClick={() => switchTab("shop")}>{t("mount.needGems")}</button>
              )}
              {/* The odds in full: each tier, and each mount in it. */}
              <div className="stable-odds">
                <b>{t("mount.odds")}</b>
                {GACHA_ODDS.map(({ tier, chance }) => {
                  const pool = mountsOfTier(tier);
                  return (
                    <div key={tier} className={`stable-odd tier-${tier}`}>
                      <span className="stable-odd-head">{tierName(tier)} <em>{pct(chance)}</em></span>
                      <i style={{ width: `${Math.max(2, chance * 100)}%` }} />
                      <span className="stable-odd-list">{pool.map((id) => `${mountName(id)} ${pct(chance / pool.length)}`).join(" · ")}</span>
                    </div>
                  );
                })}
                <small>{t("mount.repeatNote", { n: DUPLICATE_REFUND })}</small>
              </div>
            </>
          )}

          {tab === "shop" && (
            <>
              <p className="stable-lede">{t("mount.shopLede")}</p>
              <div className="stable-packs">
                {Object.entries(GEM_PRODUCTS).map(([productId, n]) => {
                  const price = productPrice(productId);
                  const bonus = price ? Math.round((n / price / BASE_RATE - 1) * 100) : 0;
                  return (
                    <button
                      key={productId} type="button" className="stable-pack" disabled={!VERSE || waiting}
                      onClick={() => VERSE && buyProduct(VERSE, productId)}
                    >
                      {bonus > 0 && <span className="stable-bonus">{t("mount.bonus", { n: bonus })}</span>}
                      <img src={publicUrl(`assets/ui/shop/${productId}.png`)} alt="" />
                      <b>{t("mount.pack", { n: n.toLocaleString(locale()) })}</b>
                      <span className="stable-price">{price !== null ? `${price.toLocaleString(locale())} VX` : "—"}</span>
                    </button>
                  );
                })}
              </div>
              {waiting && <p className="stable-hint">{t("mount.gemsComing")}</p>}
              <p className="stable-hint">{t("mount.shopNote")}</p>
            </>
          )}
          {note && <p className={`smith-note ${note.tone}`}>{note.text}</p>}
        </section>
      </div>
    </div>
  );
}
