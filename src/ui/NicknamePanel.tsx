import { useState, type FormEvent } from "react";
import { t } from "./lang";
import { NICKNAME_MAX, parseNickname } from "../game/account/nickname";
import { nicknameProblem } from "../net/account";
import { RuleViolation } from "../game/world/types";

interface NicknamePanelProps {
  current: string;
  // Asks the server whether the name is free.
  isFree: (name: string) => Promise<boolean>;
  onNext: (name: string) => void;
  onClose: () => void;
}

// Naming a new character: the name is checked against every other character before you go on.
export function NicknamePanel({ current, isFree, onNext, onClose }: NicknamePanelProps) {
  const [value, setValue] = useState(current);
  const [problem, setProblem] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    setProblem(null);
    try {
      const { name } = parseNickname(value);
      if (!(await isFree(name))) throw new RuleViolation("nickname_taken");
      onNext(name);
    } catch (error) {
      setProblem(nicknameProblem(error));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel nickname-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("name.title")}</h2>
        <p className="note">{t("name.note")}</p>
        <form className="nickname-form" onSubmit={submit}>
          <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={NICKNAME_MAX} placeholder={t("name.placeholder")} autoFocus />
          <button type="submit" className="text-button" disabled={checking || value.trim() === ""}>
            {checking ? t("name.checking") : t("common.next")}
          </button>
        </form>
        {problem && <p className="nickname-problem">{problem}</p>}
        <button type="button" className="text-button close" onClick={onClose}>{t("common.back")}</button>
      </div>
    </div>
  );
}
