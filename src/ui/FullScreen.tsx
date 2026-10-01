import type { ReactNode } from "react";
import { t } from "./lang";

// A screen that covers the whole stage, like the stable: a bar with the title, whatever the screen
// keeps up there (its tabs, its gold or gems) and a close button, and under it one column where only
// the body scrolls. `className` is the screen's own, set on that column.
export function FullScreen({ title, bar, className, onClose, children }: {
  title: ReactNode;
  bar?: ReactNode;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="full-screen" role="dialog">
      <header className="full-bar">
        <h2>{title}</h2>
        {bar}
        <button type="button" className="full-close" onClick={onClose} aria-label={t("common.close")}>✕</button>
      </header>
      <div className={`full-body${className ? ` ${className}` : ""}`}>{children}</div>
    </div>
  );
}
