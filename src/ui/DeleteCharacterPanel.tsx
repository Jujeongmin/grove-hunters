import { useState, type FormEvent } from "react";
import { t } from "./lang";
import { deleteProblem } from "../net/account";

interface DeleteCharacterPanelProps {
  // The character to delete: its id for the server, its name for typing back.
  id: string;
  name: string;
  onDelete: (id: string, typedName: string) => Promise<void>;
  onClose: () => void;
}

// Deleting a character for good. It cannot be undone, so the character's name has to be typed back
// before the button works — the server checks it again.
export function DeleteCharacterPanel({ id, name, onDelete, onClose }: DeleteCharacterPanelProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const matches = typed.trim() === name;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!matches || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await onDelete(id, typed.trim());
      onClose();
    } catch (error) {
      setProblem(deleteProblem(error));
      setBusy(false);
    }
  };

  return (
    <div className="menu-modal" onClick={onClose}>
      <form className="solid-panel delete-panel" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <h2>{t("delete.title")}</h2>
        <p className="delete-warning">{t("delete.warning", { name })}</p>
        <input
          value={typed} autoFocus placeholder={name} maxLength={24}
          onChange={(e) => {
            setTyped(e.target.value);
            setProblem(null);
          }}
        />
        {problem && <p className="bag-problem">{problem}</p>}
        <div className="delete-actions">
          <button type="button" className="text-button" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="text-button delete-confirm" disabled={!matches || busy}>{t("delete.confirm")}</button>
        </div>
      </form>
    </div>
  );
}
