import { useEffect, useState, type ReactNode } from "react";
import { t } from "./lang";

// A long list shown a page at a time, so a panel keeps its size on the smallest stage instead of
// growing a scroll. The page comes back in range when the list shrinks under it.
export function usePages<T>(items: readonly T[], size: number, start = 0): { shown: T[]; pager: ReactNode } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const [page, setPage] = useState(start);
  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [page, pages]);
  const at = Math.min(page, pages - 1);
  const shown = items.slice(at * size, at * size + size);
  const pager = pages > 1 ? (
    <div className="pager">
      <button type="button" className="text-button" disabled={at === 0} onClick={() => setPage(at - 1)} aria-label={t("common.prevPage")}>‹</button>
      <span>{at + 1} / {pages}</span>
      <button type="button" className="text-button" disabled={at >= pages - 1} onClick={() => setPage(at + 1)} aria-label={t("common.nextPage")}>›</button>
    </div>
  ) : null;
  return { shown, pager };
}
