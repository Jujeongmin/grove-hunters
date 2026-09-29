import { useCallback, useEffect, useState } from "react";
import {
  BASE_MOUNT, DUPLICATE_REFUND, GACHA_ODDS, GEM_PRODUCTS, MOUNTS, MOUNT_IDS, PULL_COST, mountsOfTier,
  type MountId, type MountTier,
} from "../game/account/mounts";
import { iconFor } from "../game/render/icons";
import { buyProduct, onAnyShopClosed, productPrice } from "../net/shop";
import type { MountsView, WorldClient } from "../net/worldClient";
import { problemText } from "./BagPanel";
import { locale, t } from "./lang";
import type { Key } from "./strings/ko";
import { playCue } from "../game/audio/sfx";

const VERSE = import.meta.env.VITE_AGENT8_VERSE as string | undefined;
// After a gem pack's dialog closes, the gems arrive on the server on their own: ask this often, this long.
const CONFIRM_EVERY_MS = 1500;
const CONFIRM_FOR_MS = 30_000;

const pct = (n: number) => `${(Math.round(n * 1000) / 10).toLocaleString(locale())}%`;
export const mountName = (id: MountId) => t(`mount.name.${id}` as Key);
const tierName = (tier: MountTier | null) => (tier ? t(`mount.tier.${tier}` as Key) : t("mount.tier.base"));

// Mounts: the ones you own (tap one to ride it from now on), the draw with its odds in full (as Korean
// law requires of paid draws), and gems, bought with VX.
export function MountPanel({ client, owned: ownsFullGame, onClose }: { client: WorldClient; owned: boolean; onClose: () => void }) {
  const [view, setView] = useState<MountsView | null>(null);
  const [note, setNote] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const [drawn, setDrawn] = useState<{ mount: MountId; repeat: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const refresh = useCallback(() => client.mounts().then((v) => {
    if (v) setView(v);
    return v;
  }), [client]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
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

  const draw = () => {
    setBusy(true);
    setNote(null);
    setDrawn(null);
    void client.pullMount().then((r) => {
      setBusy(false);
      if ("problem" in r) {
        setNote({ text: problemText(r.problem)!, tone: "bad" });
        return;
      }
      setView(r);
      setDrawn({ mount: r.mount, repeat: r.repeat });
      playCue(r.repeat ? "enhance_fail" : "enhance_ok");
    });
  };
  const pick = (id: MountId) => {
    void client.selectMount(id).then((r) => {
      if ("problem" in r) setNote({ text: problemText(r.problem)!, tone: "bad" });
      else setView(r);
    });
  };

  const gems = view?.gems ?? 0;
  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel mount-panel" onClick={(e) => e.stopPropagation()}>
        <header className="mount-head">
          <h2>{t("mount.title")}</h2>
          <span className="mount-gems">
            <img src={iconFor("ui_gem") ?? undefined} alt="" />
            {view ? gems.toLocaleString(locale()) : "…"}
          </span>
        </header>
        <p className="note">{t("mount.rideHint")}</p>

        <div className="mount-grid">
          {MOUNT_IDS.map((id) => {
            const mine = view?.owned.includes(id) ?? false;
            const riding = view?.selected === id;
            return (
              <button
                key={id} type="button" disabled={!mine}
                className={`mount-card tier-${MOUNTS[id].tier ?? "base"}${riding ? " picked" : ""}${mine ? "" : " locked"}`}
                onClick={() => pick(id)}
              >
                <b>{mountName(id)}</b>
                <span>{tierName(MOUNTS[id].tier)} · {t("mount.speed", { n: MOUNTS[id].speed })}</span>
                <em>{riding ? t("mount.riding") : mine ? t("mount.pick") : id === BASE_MOUNT ? t("mount.fullGame") : t("mount.notOwned")}</em>
              </button>
            );
          })}
        </div>
        {!ownsFullGame && <p className="note">{t("mount.baseNote", { name: mountName(BASE_MOUNT) })}</p>}

        <section className="mount-draw">
          <div className="mount-draw-row">
            <button type="button" className="brush-button small" disabled={busy || !view || gems < PULL_COST} onClick={draw}>
              {t("mount.draw", { n: PULL_COST })}
            </button>
            {drawn && (
              <span className={`mount-result tier-${MOUNTS[drawn.mount].tier ?? "base"}`}>
                {drawn.repeat
                  ? t("mount.repeat", { name: mountName(drawn.mount), n: DUPLICATE_REFUND })
                  : t("mount.new", { name: mountName(drawn.mount), tier: tierName(MOUNTS[drawn.mount].tier) })}
              </span>
            )}
          </div>
          {/* The odds in full: each tier, and each mount in it. */}
          <table className="mount-odds">
            <caption>{t("mount.odds")}</caption>
            <tbody>
              {GACHA_ODDS.map(({ tier, chance }) => {
                const pool = mountsOfTier(tier);
                return (
                  <tr key={tier} className={`tier-${tier}`}>
                    <th>{tierName(tier)} {pct(chance)}</th>
                    <td>{pool.map((id) => `${mountName(id)} ${pct(chance / pool.length)}`).join(" · ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="note">{t("mount.repeatNote", { n: DUPLICATE_REFUND })}</p>
        </section>

        <section className="mount-shop">
          <b>{t("mount.buyGems")}</b>
          <div className="mount-packs">
            {Object.entries(GEM_PRODUCTS).map(([productId, n]) => {
              const price = productPrice(productId);
              return (
                <button
                  key={productId} type="button" className="world-card mount-pack" disabled={!VERSE || waiting}
                  onClick={() => VERSE && buyProduct(VERSE, productId)}
                >
                  <img src={iconFor("ui_gem") ?? undefined} alt="" />
                  <b>{t("mount.pack", { n: n.toLocaleString(locale()) })}</b>
                  <span>{price !== null ? `${price.toLocaleString(locale())} VX` : "—"}</span>
                </button>
              );
            })}
          </div>
          {waiting && <p className="note">{t("mount.gemsComing")}</p>}
        </section>

        {note && <p className={`smith-note ${note.tone}`}>{note.text}</p>}
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}
