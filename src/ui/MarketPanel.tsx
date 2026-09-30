import { useEffect, useState } from "react";
import {
  MAX_LISTINGS, MIN_BUNDLE_PRICE, MIN_GEAR_PRICE, marketFee, sellerGets, shelfOf, type ListingView, type Shelf,
} from "../game/account/market";
import { ITEM_IDS, slotOf, type BagView, type GearPiece, type ItemId } from "../game/account/items";
import { iconFor } from "../game/render/icons";
import type { MarketPage, WorldClient } from "../net/worldClient";
import { problemText } from "./BagPanel";
import { locale, t } from "./lang";
import { gearName, itemName } from "./names";

type Tab = "buy" | "sell" | "mine";
const SHELVES: readonly Shelf[] = ["weapon", "armor", "material"];
const MIN_PLUS = [0, 3, 5, 7, 9];

// What a listing is called: gear with its +, a bundle with its count.
function listingName(l: Pick<ListingView, "item" | "piece" | "n">): string {
  return l.piece ? gearName(l.piece) : `${itemName(l.item)} ×${l.n}`;
}

function timeLeft(until: number, now: number): string {
  const ms = until - now;
  if (ms <= 0) return t("market.ended");
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? t("market.left", { h, m }) : t("market.leftMin", { m });
}

function Gems({ n }: { n: number }) {
  return (
    <span className="market-gems">
      <img src={iconFor("ui_gem") ?? undefined} alt="" draggable={false} />
      {n.toLocaleString(locale())}
    </span>
  );
}

// The market, shared by every server: buy tradable gear and materials for gems, put your own up, and
// see what you have up. Bought things, and what you sold's gems, come by mail.
export function MarketPanel({ client, bag, onClose }: { client: WorldClient; bag: BagView | null; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("buy");
  const [gems, setGems] = useState<number | null>(null);
  const [note, setNote] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const say = (text: string, tone: "good" | "bad") => setNote({ text, tone });
  const problem = (code: string) => say(problemText(code)!, "bad");
  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel market-panel" onClick={(e) => e.stopPropagation()}>
        <header className="market-head">
          <h2>{t("market.title")}</h2>
          {gems !== null && <Gems n={gems} />}
        </header>
        <div className="smith-tabs">
          {(["buy", "sell", "mine"] as Tab[]).map((id) => (
            <button
              key={id} type="button" className={`text-button${tab === id ? " on" : ""}`}
              onClick={() => {
                setTab(id);
                setNote(null);
              }}
            >
              {t(`market.${id}`)}
            </button>
          ))}
        </div>
        {tab === "buy" && <BuyTab client={client} onGems={setGems} say={say} problem={problem} />}
        {tab === "sell" && <SellTab client={client} bag={bag} say={say} problem={problem} />}
        {tab === "mine" && <MineTab client={client} onGems={setGems} say={say} problem={problem} />}
        {note && <p className={`smith-note ${note.tone}`}>{note.text}</p>}
        <p className="note market-note">{t("market.note")}</p>
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}

interface TabProps {
  client: WorldClient;
  say: (text: string, tone: "good" | "bad") => void;
  problem: (code: string) => void;
}

function BuyTab({ client, onGems, say, problem }: TabProps & { onGems: (n: number) => void }) {
  const [shelf, setShelf] = useState<Shelf>("weapon");
  const [item, setItem] = useState<ItemId | null>(null);
  const [minPlus, setMinPlus] = useState(0);
  const [page, setPage] = useState(0);
  const [found, setFound] = useState<MarketPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState<ListingView | null>(null);
  const [busy, setBusy] = useState(false);
  const [again, setAgain] = useState(0);
  useEffect(() => {
    let live = true;
    setFailed(false);
    void client.market({ shelf, item, minPlus, page }).then((r) => {
      if (!live) return;
      if ("problem" in r) setFailed(true);
      else {
        setFound(r);
        onGems(r.gems);
      }
    });
    return () => {
      live = false;
    };
    // onGems is the panel's setter, the same every render.
  }, [client, shelf, item, minPlus, page, again]);
  const kinds = ITEM_IDS.filter((id) => shelfOf(id) === shelf);
  const now = Date.now();

  const buy = async (listing: ListingView) => {
    setBusy(true);
    const r = await client.buyListing(listing.id);
    setBusy(false);
    setAsking(null);
    if ("problem" in r) problem(r.problem);
    else {
      onGems(r.gems);
      say(t("market.bought"), "good");
    }
    setAgain((n) => n + 1);
  };

  return (
    <div className="market-tab">
      <div className="market-filters">
        {SHELVES.map((s) => (
          <button
            key={s} type="button" className={`market-chip${shelf === s ? " on" : ""}`}
            onClick={() => {
              setShelf(s);
              setItem(null);
              setMinPlus(0);
              setPage(0);
            }}
          >
            {t(`market.${s}`)}
          </button>
        ))}
        <select
          value={item ?? ""}
          onChange={(e) => {
            setItem((e.target.value || null) as ItemId | null);
            setPage(0);
          }}
        >
          <option value="">{t("market.all")}</option>
          {kinds.map((id) => <option key={id} value={id}>{itemName(id)}</option>)}
        </select>
        {shelf !== "material" && (
          <select
            value={minPlus}
            onChange={(e) => {
              setMinPlus(Number(e.target.value));
              setPage(0);
            }}
          >
            {MIN_PLUS.map((n) => <option key={n} value={n}>{n === 0 ? t("market.all") : t("market.minPlus", { n })}</option>)}
          </select>
        )}
      </div>
      {!found && <p className="note">{failed ? t("market.failed") : t("common.loading")}</p>}
      {found && found.listings.length === 0 && <p className="note">{t("market.empty")}</p>}
      {found && found.listings.length > 0 && (
        <ul className="market-list">
          {found.listings.map((l) => (
            <li key={l.id}>
              <img className="bag-icon" src={iconFor(l.item) ?? undefined} alt="" />
              <span className="market-what">
                <b>{listingName(l)}</b>
                <span className="note">{l.sellerName} · {timeLeft(l.until, now)}</span>
              </span>
              <span className="market-price">
                <Gems n={l.price} />
                {l.n > 1 && <span className="note">{t("market.perOne", { n: (l.price / l.n).toLocaleString(locale(), { maximumFractionDigits: 2 }) })}</span>}
              </span>
              {l.mine ? (
                <span className="note">{t("market.mineTag")}</span>
              ) : (
                <button type="button" className="brush-button small" disabled={busy} onClick={() => setAsking(l)}>{t("market.buyGo")}</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {found && found.pages > 1 && (
        <div className="market-pager">
          <button type="button" className="text-button" disabled={found.page === 0} onClick={() => setPage(found.page - 1)}>‹</button>
          <span>{t("market.page", { n: found.page + 1, of: found.pages })}</span>
          <button type="button" className="text-button" disabled={found.page + 1 >= found.pages} onClick={() => setPage(found.page + 1)}>›</button>
        </div>
      )}
      {asking && (
        <div className="market-confirm">
          <p>{t("market.confirm", { name: listingName(asking), price: asking.price.toLocaleString(locale()) })}</p>
          <div>
            <button type="button" className="brush-button small" disabled={busy} onClick={() => void buy(asking)}>{t("market.buyGo")}</button>
            <button type="button" className="text-button" onClick={() => setAsking(null)}>{t("common.cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Something that may go up: a tradable piece, or a stack of tradable material.
type Offer = { kind: "piece"; piece: GearPiece } | { kind: "stack"; id: ItemId; have: number };

function offers(bag: BagView): Offer[] {
  const out: Offer[] = [];
  for (const id of ITEM_IDS) {
    for (const piece of bag.pieces) if (piece.id === id && piece.trade) out.push({ kind: "piece", piece });
    if ((bag.bagTrade[id] ?? 0) > 0) out.push({ kind: "stack", id, have: bag.bagTrade[id]! });
  }
  return out;
}

const offerKey = (o: Offer) => (o.kind === "piece" ? o.piece.uid : o.id);

function SellTab({ client, bag, say, problem }: TabProps & { bag: BagView | null }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [listed, setListed] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void client.myListings().then((r) => {
      if (live && !("problem" in r)) setListed(r.listings.length);
    });
    return () => {
      live = false;
    };
  }, [client]);
  if (!bag) return <p className="note">{t("common.loading")}</p>;
  const all = offers(bag);
  const offer = all.find((o) => offerKey(o) === picked) ?? null;
  const shelf: Shelf | null = offer ? (offer.kind === "piece" ? slotOf(offer.piece.id)! : "material") : null;
  const min = shelf === "material" ? MIN_BUNDLE_PRICE : MIN_GEAR_PRICE;
  const asked = Number(price);
  const n = offer?.kind === "stack" ? Math.max(1, Math.min(offer.have, Math.floor(Number(count)) || 1)) : 1;
  const priced = Number.isInteger(asked) && asked >= min;

  const list = async () => {
    if (!offer || !priced) return;
    setBusy(true);
    const r = await client.sellOnMarket(offer.kind === "piece" ? { uid: offer.piece.uid } : { item: offer.id, n }, asked);
    setBusy(false);
    if ("problem" in r) problem(r.problem);
    else {
      setListed(r.listings.length);
      setPicked(null);
      setPrice("");
      setCount("1");
      say(t("market.listed"), "good");
    }
  };

  return (
    <div className="market-tab">
      {listed !== null && <p className="note">{t("market.limit", { n: listed, max: MAX_LISTINGS })}</p>}
      {all.length === 0 ? (
        <p className="note">{t("market.nothingToSell")}</p>
      ) : (
        <div className="bag-grid market-offers">
          {all.map((o) => {
            const id = o.kind === "piece" ? o.piece.id : o.id;
            return (
              <button
                key={offerKey(o)} type="button" className={`bag-cell trade${picked === offerKey(o) ? " picked" : ""}`}
                onClick={() => setPicked(offerKey(o))} title={o.kind === "piece" ? gearName(o.piece) : itemName(o.id)}
              >
                <img src={iconFor(id) ?? undefined} alt="" />
                {o.kind === "stack" && <span className="bag-cell-count">{o.have}</span>}
                {o.kind === "piece" && o.piece.plus > 0 && <span className="bag-cell-plus">+{o.piece.plus}</span>}
              </button>
            );
          })}
        </div>
      )}
      {!offer ? (
        all.length > 0 && <p className="note">{t("market.pick")}</p>
      ) : (
        <div className="market-form">
          <b>{offer.kind === "piece" ? gearName(offer.piece) : itemName(offer.id)}</b>
          {offer.kind === "stack" && (
            <label>
              {t("market.count")}
              <input type="number" min={1} max={offer.have} value={count} onChange={(e) => setCount(e.target.value)} />
            </label>
          )}
          <label>
            {t("market.price")}
            <input type="number" min={min} value={price} placeholder={t("market.minPrice", { n: min })} onChange={(e) => setPrice(e.target.value)} />
          </label>
          {priced && <span className="note">{t("market.fee", { fee: marketFee(asked), gets: sellerGets(asked) })}</span>}
          <button type="button" className="brush-button small" disabled={busy || !priced} onClick={() => void list()}>{t("market.list")}</button>
        </div>
      )}
    </div>
  );
}

function MineTab({ client, onGems, say, problem }: TabProps & { onGems: (n: number) => void }) {
  const [listings, setListings] = useState<ListingView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void client.myListings().then((r) => {
      if (!live) return;
      if ("problem" in r) setFailed(true);
      else {
        setListings(r.listings);
        onGems(r.gems);
      }
    });
    return () => {
      live = false;
    };
    // onGems is the panel's setter, the same every render.
  }, [client]);
  const now = Date.now();
  const cancel = async (id: string) => {
    setBusy(true);
    const r = await client.cancelListing(id);
    setBusy(false);
    if ("problem" in r) problem(r.problem);
    else {
      setListings(r.listings);
      say(t("market.canceled"), "good");
    }
  };
  if (!listings) return <p className="note">{failed ? t("market.failed") : t("common.loading")}</p>;
  if (listings.length === 0) return <p className="note">{t("market.none")}</p>;
  return (
    <ul className="market-list">
      {listings.map((l) => (
        <li key={l.id}>
          <img className="bag-icon" src={iconFor(l.item) ?? undefined} alt="" />
          <span className="market-what">
            <b>{listingName(l)}</b>
            <span className="note">{timeLeft(l.until, now)}</span>
          </span>
          <span className="market-price"><Gems n={l.price} /></span>
          <button type="button" className="text-button" disabled={busy} onClick={() => void cancel(l.id)}>{t("market.cancel")}</button>
        </li>
      ))}
    </ul>
  );
}
