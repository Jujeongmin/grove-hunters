import { useEffect, useState } from "react";
import { daysLeft, giftById, marketThing, type Mail } from "../game/account/mail";
import { marketFee } from "../game/account/market";
import { iconFor } from "../game/render/icons";
import { playCue } from "../game/audio/sfx";
import { problemText } from "./BagPanel";
import { lang, t, type Key } from "./lang";
import { gearName, itemName } from "./names";
import type { WorldClient } from "../net/worldClient";
import { FullScreen } from "./FullScreen";

interface MailPanelProps {
  client: WorldClient;
  // How many letters are left after a change (the menu's dot).
  onCount: (n: number) => void;
  onClose: () => void;
}

// What a letter is called and says: a gift in its own words, a market letter by what it was about.
function words(mail: Mail): { title: string; body: string | null } {
  const gift = mail.kind === "gift" ? giftById(mail.params.gift) : null;
  if (gift) return gift.text[lang()];
  if (mail.kind === "guild_boss") {
    const stage = typeof mail.params.stage === "number" ? mail.params.stage : 1;
    const boss = t(`boss.${String(mail.params.boss)}` as Key);
    return {
      title: t("mail.guildBoss", { stage }),
      body: stage >= 4 ? t("mail.guildBossSlain", { boss }) : t("mail.guildBossBody", { boss, pct: stage * 25 }),
    };
  }
  if (mail.kind === "monthly_pass") return { title: t("mail.pass"), body: t("mail.passBody") };
  if (mail.kind === "guild_league") {
    const place = Number(mail.params.place) || 1;
    return mail.params.who === "guild"
      ? { title: t("mail.leagueGuild", { n: place }), body: t("mail.leagueGuildBody", { guild: String(mail.params.guild ?? ""), n: place }) }
      : { title: t("mail.leaguePlayer", { n: place }), body: t("mail.leaguePlayerBody", { n: place }) };
  }
  if (mail.kind === "dungeon") return { title: t("mail.dungeon"), body: t("mail.dungeonBody") };
  if (mail.kind === "attendance") return { title: t("mail.attendance", { n: Number(mail.params.day) || 1 }), body: t("mail.attendanceBody") };
  if (mail.kind === "vip_daily") return { title: t("mail.vipDaily", { n: Number(mail.params.vip) || 0 }), body: t("mail.vipDailyBody") };
  const thing = marketThing(mail);
  if (mail.kind === "gift" || !thing) return { title: t("mail.gift"), body: null };
  const item = thing.n > 1 ? `${itemName(thing.id)} ×${thing.n}` : gearName({ id: thing.id, plus: thing.plus });
  const price = typeof mail.params.price === "number" ? mail.params.price : 0;
  const fee = typeof mail.params.fee === "number" ? mail.params.fee : marketFee(price);
  if (mail.kind === "market_sold") return { title: t("mail.marketSold", { item }), body: t("mail.marketSoldBody", { price, fee }) };
  if (mail.kind === "market_bought") return { title: t("mail.marketBought", { item }), body: t("mail.marketBoughtBody", { price }) };
  return { title: t("mail.marketReturned", { item }), body: t("mail.marketReturnedBody") };
}

// The account's mailbox: what the game has sent, newest first, each to take on its own or all at once.
export function MailPanel({ client, onCount, onClose }: MailPanelProps) {
  const [mail, setMail] = useState<Mail[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void client.mailbox().then((next) => {
      if (!live) return;
      if (next) setMail(next);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [client]);
  useEffect(() => {
    if (mail) onCount(mail.length);
    // onCount is a new function every render of the screen above.
  }, [mail]);

  const take = async (run: () => ReturnType<WorldClient["claimAllMail"]>) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const r = await run();
    setBusy(false);
    if ("mail" in r) setMail(r.mail);
    if (r.problem) setNote(problemText(r.problem));
    else playCue("coins");
  };
  const now = Date.now();

  return (
    <FullScreen title={t("mail.title")} className="mail-panel" onClose={onClose}>
      {!mail && <p className="note">{failed ? t("mail.failed") : t("common.loading")}</p>}
      {mail && mail.length === 0 && <p className="note">{t("mail.empty")}</p>}
      {mail && mail.length > 0 && (
        <ul className="mail-list">
          {mail.map((letter) => {
            const { title, body } = words(letter);
            return (
              <li key={letter.id}>
                <div className="mail-head">
                  <b>{title}</b>
                  <span className="note">{t("mail.daysLeft", { n: daysLeft(letter, now) })}</span>
                </div>
                {body && <p className="mail-body">{body}</p>}
                <div className="mail-row">
                  <span className="mail-things">
                    {letter.gold > 0 && <span className="mail-thing">{t("mail.gold", { n: letter.gold.toLocaleString() })}</span>}
                    {letter.gems > 0 && (
                      <span className="mail-thing">
                        <img src={iconFor("ui_gem") ?? undefined} alt="" draggable={false} />
                        {letter.gems.toLocaleString()}
                      </span>
                    )}
                    {(letter.tickets ?? 0) > 0 && (
                      <span className="mail-thing">
                        <img src={iconFor("ui_ticket") ?? undefined} alt="" draggable={false} />
                        {t("rewards.tickets", { n: letter.tickets! })}
                      </span>
                    )}
                    {letter.items.map((item, i) => (
                      <span key={i} className={`mail-thing${item.piece?.trade || item.trade ? " trade" : ""}`} title={itemName(item.id)}>
                        <img src={iconFor(item.id) ?? undefined} alt="" draggable={false} />
                        {item.piece ? gearName(item.piece) : `${itemName(item.id)} ×${item.n}`}
                      </span>
                    ))}
                  </span>
                  <button
                    type="button" className="brush-button small" disabled={busy}
                    onClick={() => void take(async () => {
                      const r = await client.claimMail(letter.id);
                      return "mail" in r ? { ...r, left: 0, problem: null } : r;
                    })}
                  >
                    {t("mail.claim")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {note && <p className="note bad">{note}</p>}
      <div className="mail-actions">
        {mail && mail.length > 1 && (
          <button type="button" className="brush-button small" disabled={busy} onClick={() => void take(() => client.claimAllMail())}>
            {t("mail.claimAll")}
          </button>
        )}
      </div>
    </FullScreen>
  );
}
