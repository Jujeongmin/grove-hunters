import { useCallback, useEffect, useRef, useState } from "react";
import {
  BASE_MOUNT, DUPLICATE_REFUND, GACHA_ODDS, GEM_PRODUCTS, MAX_STARS, MOUNTS, MOUNT_IDS, MYTHIC_PITY, PITY, PULL10, PULL10_COST, PULL_COST,
  herdBonus, mountBonus, mountsOfTier, ownedBonus,
  type MountId, type MountTier,
} from "../game/account/mounts";
import {
  PASS_DAYS, PASS_GEMS_DAILY, PASS_GEMS_NOW, PASS_PRODUCT, PASS_XP, VIP_ANNOUNCE, VIP_BONUS, VIP_PERK_AT, VIP_POINTS,
} from "../game/account/premium";
import type { ModelLibrary } from "../game/assets/ModelLibrary";
import type { PlayerClass } from "../game/combat/classes";
import { publicUrl } from "../game/assets/publicUrl";
import { iconFor } from "../game/render/icons";
import type { Costume } from "../game/render/costumes";
import { MountStage, tierKey } from "../game/render/MountStage";
import { playCue } from "../game/audio/sfx";
import { buyProduct, onAnyShopClosed, productPrice } from "../net/shop";
import type { MountPull, MountsView, WorldClient } from "../net/worldClient";
import { problemText } from "./BagPanel";
import { settings, updateSettings } from "./settings";
import { locale, t } from "./lang";
import type { Key } from "./strings/ko";

const VERSE = import.meta.env.VITE_AGENT8_VERSE as string | undefined;
// After a gem pack's dialog closes, the gems arrive on the server on their own: ask this often, this long.
const CONFIRM_EVERY_MS = 1500;
const CONFIRM_FOR_MS = 30_000;
// The egg's shaking and bursting take about this long (see MountStage).
const HATCH_WAIT_MS = 3500;
// Gems per VX at the smallest pack: a bigger pack's bonus is measured against it.
const BASE_RATE = 1;

// The shop's pictures are kept a day by the host's cache: a new set of pictures bumps this, so nobody
// is shown yesterday's.
const SHOP_ART_VERSION = "2026-10-06b";
const shopArt = (productId: string) => publicUrl(`assets/ui/shop/${productId}.png?v=${SHOP_ART_VERSION}`);

type Tab = "stable" | "hatch" | "shop";

// A chance as a percent, with as many decimals as it takes to be exact (two mythics sharing 0.1% are
// 0.05% each), trailing zeros dropped.
const pct = (n: number) => `${(n * 100).toLocaleString(locale(), { maximumFractionDigits: 3 })}%`;
export const mountName = (id: MountId) => t(`mount.name.${id}` as Key);
const tierName = (tier: MountTier | "base") => t(`mount.tier.${tier}` as Key);

// The tier odds of a draw no lower than `least`, as rollMount gives them: every tier below it lands on
// it instead (a ten-draw's promised rare, a pity draw). Written out as "rare 90% · epic 9% · …".
function oddsFrom(least: MountTier): string {
  const at = GACHA_ODDS.findIndex((o) => o.tier === least);
  const below = GACHA_ODDS.slice(0, at).reduce((sum, o) => sum + o.chance, 0);
  return GACHA_ODDS.slice(at).map((o, i) => `${tierName(o.tier)} ${pct(o.chance + (i === 0 ? below : 0))}`).join(" · ");
}

interface MountPanelProps {
  client: WorldClient;
  library: ModelLibrary | null;
  playerClass: PlayerClass;
  costume: Costume;
  onClose: () => void;
}

// The stable, over the whole screen: a stage where your hero rides the mount you look at, and three
// tabs beside it: your mounts (pick the one to ride), the egg hatchery (the draw, with its odds in
// full, as Korean law requires of paid draws) and the gem shop.
export function MountPanel({ client, library, playerClass, costume, onClose }: MountPanelProps) {
  const [tab, setTab] = useState<Tab>("stable");
  const [view, setView] = useState<MountsView | null>(null);
  const [looking, setLooking] = useState<MountId>(BASE_MOUNT);
  const [note, setNote] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const [hatched, setHatched] = useState<{ mount: MountId; repeat: boolean; star: number | null } | null>(null);
  const [hatchCount, setHatchCount] = useState(0);
  const [busy, setBusy] = useState(false);
  // Skipping the hatch: always (the toggle, kept in the settings), or this once (a tap on the stage
  // while the egg plays out).
  const [skip, setSkip] = useState(settings().skipHatch);
  const skipNow = useRef<(() => void) | null>(null);
  // A tap that came before the egg began (while the server was still answering) counts too.
  const skipAsked = useRef(false);
  const tapStage = () => {
    skipAsked.current = true;
    skipNow.current?.();
  };
  const [waiting, setWaiting] = useState(false);
  const [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<MountStage | null>(null);
  const [portraits, setPortraits] = useState<Partial<Record<MountId, string>>>({});
  // A ten-draw's ten, listed under the egg; and whether the VIP ranks are spread out in the shop.
  const [pulls, setPulls] = useState<MountPull[]>([]);
  const [vipTable, setVipTable] = useState(false);

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
      s.releasePainter();
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

  // A gem pack or the pass bought: poll until the gems are in.
  useEffect(() => onAnyShopClosed((productId, purchased) => {
    if (!purchased || !(productId in GEM_PRODUCTS || productId === PASS_PRODUCT)) return;
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

  // One draw or ten: the egg hatches into the best of them, and a ten-draw lists all ten.
  const hatch = (ten: boolean, ticket = false) => {
    setBusy(true);
    skipAsked.current = false;
    setNote(null);
    setHatched(null);
    setPulls([]);
    stage.current?.showEgg();
    void client.pullMount(ten, ticket).then(async (r) => {
      if ("problem" in r) {
        setBusy(false);
        setNote({ text: problemText(r.problem)!, tone: "bad" });
        return;
      }
      const best = bestPull(r.pulls);
      // The egg hatches on the stage's frames; a hidden page draws none, so the answer never waits long.
      // Skipped, it bursts at once.
      if (stage.current) {
        const playing = stage.current.hatchInto(best.mount, (moment) => playCue(moment === "knock" ? "click" : "skill"));
        if (!skip && !skipAsked.current) {
          await Promise.race([playing, new Promise((done) => setTimeout(done, HATCH_WAIT_MS)), new Promise<void>((done) => { skipNow.current = done; })]);
        }
        skipNow.current = null;
        stage.current?.finishHatch();
      }
      setBusy(false);
      setView(r);
      setLooking(best.mount);
      setHatched({ mount: best.mount, repeat: best.repeat, star: best.star });
      setPulls(ten ? r.pulls : []);
      setHatchCount((n) => n + 1);
      playCue(best.repeat && best.star === null ? "gold" : "levelup");
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
  const starsOf = (id: MountId) => view?.stars[id] ?? 0;
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
        <section className={`stable-stage tier-${shown ? tierKey(shown) : "base"}`} onClick={tapStage}>
          <canvas ref={canvas} />
          {tab === "hatch" && (
            <button
              type="button" className={`stable-skip${skip ? " on" : ""}`} aria-pressed={skip}
              onClick={(e) => {
                e.stopPropagation();
                updateSettings({ skipHatch: !skip });
                setSkip(!skip);
              }}
            >
              {t("mount.skip")} <b>{t(skip ? "common.on" : "common.off")}</b>
            </button>
          )}
          {tab === "hatch" && busy && !skip && <p className="stable-skip-hint">{t("mount.skipHint")}</p>}
          {!ready && <p className="stable-loading">{t("common.loading")}</p>}
          {/* The burst on screen: a flash, and for a new mount its tier and name thrown up big, with
              turning rays behind for the rare and better. Keyed so each hatch plays it afresh. */}
          {tab === "hatch" && hatched && (
            <div key={hatchCount} className={`stable-burst tier-${tierKey(hatched.mount)}${hatched.repeat && hatched.star === null ? " repeat" : ""}`}>
              <i className="stable-flash" />
              {(!hatched.repeat || hatched.star !== null) && tierKey(hatched.mount) !== "common" && <i className="stable-rays" />}
              <span className="stable-banner">
                <small>{t(hatched.star !== null ? "mount.starBadge" : hatched.repeat ? "mount.repeatBadge" : "mount.newBadge")}</small>
                <b>{hatched.star !== null ? `★${hatched.star}` : tierName(tierKey(hatched.mount))}</b>
              </span>
            </div>
          )}
          {shown && (
            <div className="stable-plate">
              <span className="stable-tier">{tierName(tierKey(shown))}</span>
              <b className="stable-name">{mountName(shown)}</b>
              <span className="stable-speed">
                {t("mount.speed", { n: MOUNTS[shown].speed })}
                <i className="stable-pips" style={{ ["--pips" as string]: Math.round((MOUNTS[shown].speed - 1) * 10) }} />
              </span>
              {mine(shown) && shown !== BASE_MOUNT && <span className="stable-stars">{starMarks(starsOf(shown))}</span>}
              <span className="stable-stats">
                <span>{t("mount.stats", { p: Math.round(mountBonus(shown, starsOf(shown)).power * 100), h: mountBonus(shown, starsOf(shown)).hp })}</span>
                {shown !== BASE_MOUNT && (
                  <span className={mine(shown) ? "" : "unowned"}>
                    {t("mount.ownStats", { p: Math.round(ownedBonus(shown, starsOf(shown)).power * 100), h: ownedBonus(shown, starsOf(shown)).hp })}
                  </span>
                )}
              </span>
              {mine(shown) && shown !== BASE_MOUNT && starsOf(shown) < MAX_STARS && (
                <span className="stable-next">
                  {t("mount.nextStar", {
                    n: starsOf(shown) + 1,
                    p: Math.round(mountBonus(shown, starsOf(shown) + 1).power * 100), h: mountBonus(shown, starsOf(shown) + 1).hp,
                  })}
                </span>
              )}
              {tab === "stable" && (mine(shown)
                ? view?.selected === shown
                  ? <span className="stable-riding">{t("mount.riding")}</span>
                  : <button type="button" className="brush-button small" onClick={() => ride(shown)}>{t("mount.pick")}</button>
                : <span className="stable-locked">{MOUNTS[shown].vipOnly ? t("mount.vipOnly", { n: MOUNTS[shown].vipOnly! }) : t("mount.notOwned")}</span>)}
            </div>
          )}
        </section>

        <section className="stable-side">
          {tab === "stable" && (
            <>
              {view && (() => {
                const herd = herdBonus(view.owned, view.stars);
                const counted = view.owned.filter((id) => id !== BASE_MOUNT).length;
                return (
                  <div className="stable-herd">
                    <small>{t("mount.herd", { n: counted })}</small>
                    <b>{t("mount.herdStats", { p: Math.round(herd.power * 100), h: herd.hp })}</b>
                  </div>
                );
              })()}
              <div className="stable-grid">
                {MOUNT_IDS.map((id) => (
                  <button
                    key={id} type="button"
                    className={`stable-card tier-${tierKey(id)}${looking === id ? " looking" : ""}${mine(id) ? "" : " locked"}${view?.selected === id ? " riding" : ""}`}
                    onClick={() => setLooking(id)}
                  >
                    {portraits[id] ? <img src={portraits[id]} alt="" /> : <span className="stable-card-blank" />}
                    <b>{mountName(id)}</b>
                    {mine(id) && starsOf(id) > 0 && <span className="stable-card-stars">★{starsOf(id)}</span>}
                    {!mine(id) && <img className="stable-lock" src={iconFor("ui_lock") ?? undefined} alt="" />}
                  </button>
                ))}
              </div>
              <p className="stable-hint">{t("mount.statsNote")}</p>
              <p className="stable-hint">{t("mount.rideHint")}</p>
            </>
          )}

          {tab === "hatch" && (
            <>
              <p className="stable-lede">{t("mount.hatchLede")}</p>
              <div className="stable-hatches">
                {(view?.tickets ?? 0) > 0 && (
                  <button type="button" className="stable-hatch ticket" disabled={busy} onClick={() => hatch(false, true)}>
                    <span>{t("mount.hatchTicket")}</span>
                    <small><img src={iconFor("ui_ticket") ?? undefined} alt="" />{t("mount.tickets", { n: view!.tickets })}</small>
                  </button>
                )}
                <button type="button" className="stable-hatch" disabled={busy || !view || gems < PULL_COST} onClick={() => hatch(false)}>
                  <span>{t("mount.hatch")}</span>
                  <small><img src={iconFor("ui_gem") ?? undefined} alt="" />{PULL_COST}</small>
                </button>
                <button type="button" className="stable-hatch ten" disabled={busy || !view || gems < PULL10_COST} onClick={() => hatch(true)}>
                  <span>{t("mount.hatch10", { n: PULL10 })}</span>
                  <small><img src={iconFor("ui_gem") ?? undefined} alt="" />{PULL10_COST}</small>
                  <em>{t("mount.hatch10Note")}</em>
                </button>
              </div>
              {view && (
                <p className="stable-pity">
                  {t("mount.pity", { legendary: view.pity.legendary, mythic: view.pity.mythic })}
                </p>
              )}
              {pulls.length > 0 && (
                <ul className="stable-pulls">
                  {pulls.map((p, i) => (
                    <li key={i} className={`tier-${tierKey(p.mount)}${p.repeat && p.star === null ? " repeat" : ""}`}>
                      <b>{mountName(p.mount)}</b>
                      <small>{p.star !== null ? `★${p.star}` : p.repeat ? `+${p.refund}` : t("mount.newBadge")}</small>
                    </li>
                  ))}
                </ul>
              )}
              {hatched && (
                <p className={`stable-result tier-${tierKey(hatched.mount)}`}>
                  {hatched.star !== null
                    ? t("mount.star", { name: mountName(hatched.mount), n: hatched.star })
                    : hatched.repeat
                      ? t("mount.repeat", { name: mountName(hatched.mount), n: DUPLICATE_REFUND })
                      : t("mount.new", { name: mountName(hatched.mount), tier: tierName(tierKey(hatched.mount)) })}
                </p>
              )}
              {!busy && view && gems < PULL_COST && view.tickets === 0 && (
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
                {/* The draws whose odds differ: a ten-draw's last after nine commons, and the pity draws. */}
                <small>{t("mount.oddsFloor", { n: PULL10, m: PULL10 - 1, odds: oddsFrom("rare") })}</small>
                <small>{t("mount.oddsPity", { n: PITY, odds: oddsFrom("legendary") })}</small>
                <small>{t("mount.oddsMythicPity", { n: MYTHIC_PITY, odds: oddsFrom("mythic") })}</small>
                <small>{t("mount.repeatNote", { n: DUPLICATE_REFUND, max: MAX_STARS })}</small>
              </div>
            </>
          )}

          {tab === "shop" && (
            <>
              {view && (
                // VIP: the rank, what it adds, and how far the next one is; tapped, every rank and what it gives.
                <div className="stable-vip" role="button" tabIndex={0} onClick={() => setVipTable((v) => !v)}>
                  <b className="vip-mark">VIP {view.premium.vip}</b>
                  <span>{t("mount.vipBonus", { n: Math.round(view.premium.vip * VIP_BONUS * 100) })}</span>
                  {view.premium.nextVipAt !== null && (
                    <span className="stable-vip-next">
                      <i style={{ width: `${Math.round((view.premium.vipPoints / view.premium.nextVipAt) * 100)}%` }} />
                      <em>{t("mount.vipNext", { have: view.premium.vipPoints.toLocaleString(locale()), need: view.premium.nextVipAt.toLocaleString(locale()) })}</em>
                    </span>
                  )}
                  <small className="stable-vip-more">{t(vipTable ? "mount.vipHide" : "mount.vipShow")}</small>
                </div>
              )}
              {view && vipTable && (
                <table className="stable-vip-table">
                  <thead>
                    <tr><th>VIP</th><th>{t("mount.vipNeed")}</th><th>{t("mount.vipPerks")}</th></tr>
                  </thead>
                  <tbody>
                    {VIP_POINTS.map((need, i) => {
                      const rank = i + 1;
                      return (
                        <tr key={rank} className={rank === view.premium.vip ? "mine" : rank < view.premium.vip ? "past" : undefined}>
                          <td><b className="vip-mark">VIP {rank}</b></td>
                          <td>{need.toLocaleString(locale())}</td>
                          <td>
                            <b className="stable-vip-perk">{t(`mount.vipPerk.${VIP_PERK_AT[rank]}` as Key)}</b>
                            {MOUNT_IDS.filter((id) => MOUNTS[id].vipOnly === rank).map((id) => (
                              <b key={id} className="stable-vip-gift"> {mountName(id)}</b>
                            ))}
                            <br />
                            <small>{t("mount.vipBonus", { n: Math.round(rank * VIP_BONUS * 100) })}{rank === VIP_ANNOUNCE && <> · {t("mount.vipAnnounced")}</>}</small>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
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
                      <img src={shopArt(productId)} alt="" />
                      <b>{t("mount.pack", { n: n.toLocaleString(locale()) })}</b>
                      <span className="stable-price">{price !== null ? `${price.toLocaleString(locale())} VX` : "—"}</span>
                    </button>
                  );
                })}
                {(() => {
                  const price = productPrice(PASS_PRODUCT);
                  const left = view?.premium.passDaysLeft ?? 0;
                  const total = PASS_GEMS_NOW + PASS_GEMS_DAILY * PASS_DAYS;
                  // Gems a VX against the smallest pack's, from the live prices (to the nearest ten).
                  const packPrice = productPrice("gems-100");
                  const value = price && packPrice ? Math.round(((total / price) / (GEM_PRODUCTS["gems-100"] / packPrice)) * 10) * 10 : null;
                  return (
                    <button
                      type="button" className="stable-pack pass" disabled={!VERSE || waiting}
                      onClick={() => VERSE && buyProduct(VERSE, PASS_PRODUCT)}
                    >
                      <img src={shopArt(PASS_PRODUCT)} alt="" />
                      <span className="stable-pass-name">
                        <b>{t("mount.pass")}</b>
                        {value !== null && value > 100 && <strong className="stable-pass-value">{t("mount.passValue", { n: value })}</strong>}
                      </span>
                      <ul className="stable-pass-what">
                        <li><span>{t("mount.passNow")}</span><em><img src={iconFor("ui_gem") ?? undefined} alt="" />{PASS_GEMS_NOW}</em></li>
                        <li><span>{t("mount.passDaily", { days: PASS_DAYS })}</span><em><img src={iconFor("ui_gem") ?? undefined} alt="" />{PASS_GEMS_DAILY}</em></li>
                        <li><span>{t("mount.passXp")}</span><em>+{Math.round(PASS_XP * 100)}%</em></li>
                        <li className="total"><span>{t("mount.passTotal")}</span><em><img src={iconFor("ui_gem") ?? undefined} alt="" />{total.toLocaleString(locale())}</em></li>
                      </ul>
                      {left > 0 && <small className="stable-pass-left">{t("mount.passLeft", { n: left })}</small>}
                      <span className="stable-price">{price !== null ? `${price.toLocaleString(locale())} VX` : "—"}</span>
                    </button>
                  );
                })()}
              </div>
              {waiting && <p className="stable-hint">{t("mount.gemsComing")}</p>}
              <p className="stable-hint">{t("mount.shopNote")}</p>
              <p className="stable-hint stable-refund">{t("mount.refundNote")}</p>
            </>
          )}
          {note && <p className={`smith-note ${note.tone}`}>{note.text}</p>}
        </section>
      </div>
    </div>
  );
}

// The pull a ten-draw shows on the egg: a new mount before a repeat, the rarer the better.
const TIER_ORDER = ["common", "rare", "epic", "legendary", "mythic"];
function bestPull(pulls: readonly MountPull[]): MountPull {
  const score = (p: MountPull) => TIER_ORDER.indexOf(tierKey(p.mount)) * 2 + (p.repeat ? 0 : 1);
  return pulls.reduce((best, p) => (score(p) > score(best) ? p : best));
}

// A mount's stars as five marks, the earned ones filled.
function starMarks(n: number): string {
  return "★".repeat(n) + "☆".repeat(Math.max(0, MAX_STARS - n));
}
