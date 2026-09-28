import { useState } from "react";
import { t } from "./lang";
import { worldName } from "./names";
import { WORLDS } from "../game/account/worlds";

interface WorldPickerProps {
  // The server you played on last time, marked so you can go back to your friends.
  current: string | null;
  onPick: (id: string) => Promise<void>;
  onClose: () => void;
}

// The first step of starting: which server to play on. Picking one saves it and moves on.
export function WorldPicker({ current, onPick, onClose }: WorldPickerProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const pick = async (id: string) => {
    if (saving) return;
    setSaving(id);
    setFailed(false);
    try {
      await onPick(id);
    } catch {
      setFailed(true);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel world-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("server.pick")}</h2>
        <p className="note">{t("server.note")}</p>
        <ul className="world-list">
          {WORLDS.map((w) => (
            <li key={w.id}>
              <button type="button" className={`world-card${w.id === current ? " picked" : ""}`} onClick={() => void pick(w.id)} disabled={!!saving}>
                <b>{worldName(w.number)}</b>
                <span>{saving === w.id ? t("server.entering") : w.id === current ? t("server.recent") : ""}</span>
              </button>
            </li>
          ))}
        </ul>
        {failed && <p className="nickname-problem">{t("server.failed")}</p>}
        <button type="button" className="text-button close" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}
