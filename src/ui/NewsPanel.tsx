import { useState } from "react";
import { NEWS } from "../game/news";
import { lang, t } from "./lang";

// What each update brought, newest first: the newest open, the rest a tap away.
export function NewsPanel({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(NEWS[0]?.id ?? null);
  const here = lang();
  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel news-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("news.title")}</h2>
        <ul className="news-list">
          {NEWS.map((entry) => {
            const text = entry.text[here];
            const shown = open === entry.id;
            return (
              <li key={entry.id} className={shown ? "open" : ""}>
                <button type="button" className="news-head" onClick={() => setOpen(shown ? null : entry.id)}>
                  <span className="news-date">{entry.date}</span>
                  <b>{text.title}</b>
                </button>
                {shown && (
                  <ul className="news-lines">
                    {text.lines.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}
