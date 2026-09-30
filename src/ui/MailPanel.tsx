import { useEffect, useState } from "react";
import { daysLeft, giftById, type Mail } from "../game/account/mail";
import { iconFor } from "../game/render/icons";
import { problemText } from "./BagPanel";
import { lang, t } from "./lang";
import { itemName } from "./names";
import type { WorldClient } from "../net/worldClient";

interface MailPanelProps {
  client: WorldClient;
  // How many letters are left after a change (the menu's dot).
  onCount: (n: number) => void;
  onClose: () => void;
}

// What a letter is called and says: a gift in its own words, anything else by its kind.
function words(mail: Mail): { title: string; body: string | null } {
  const gift = mail.kind === "gift" ? giftById(mail.params.gift) : null;
  if (gift) return gift.text[lang()];
  return { title: t("mail.gift"), body: null };
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
  };
  const now = Date.now();

  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel mail-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("mail.title")}</h2>
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
                      {letter.items.map((item, i) => (
                        <span key={i} className="mail-thing" title={itemName(item.id)}>
                          <img src={iconFor(item.id) ?? undefined} alt="" draggable={false} />
                          {itemName(item.id)} ×{item.n}
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
          <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </div>
  );
}
