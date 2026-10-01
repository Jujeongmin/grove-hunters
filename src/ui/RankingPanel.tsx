import { useEffect, useRef, useState } from "react";
import { t } from "./lang";
import { slotLabel } from "./BagPanel";

import type { Board, RankDetail, RankRow, RankingView } from "../game/account/ranking";
import type { PlayerClass } from "../game/combat/classes";
import { className, gearName, jobName, serverName } from "./names";
import type { JobId } from "../game/combat/jobs";
import { usePages } from "./Pager";
import { VIP_MIGHT } from "../game/account/premium";
import { FullScreen } from "./FullScreen";

// Lines of the board on one page.
const BOARD_PER_PAGE = 8;

interface RankingPanelProps {
  onClose: () => void;
  account: string;
  // Null while offline: levels live on the game server.
  load: (() => Promise<RankingView>) | null;
  // One character in full, for a tapped line.
  loadDetail: ((id: string) => Promise<RankDetail>) | null;
}

// A character's class as the board shows it: its advanced class once it has one.
function classText(playerClass: PlayerClass | undefined, job: JobId | null | undefined): string {
  if (job) return jobName(job);
  return playerClass ? className(playerClass) : "-";
}

// Your level and 전투력, and the top of a board, by experience or by 전투력 (its first place crowned):
// name, class and level or 전투력 on each line. Tapping a line shows that character in full.
export function RankingPanel({ onClose, account, load, loadDetail }: RankingPanelProps) {
  const [view, setView] = useState<RankingView | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<RankRow | null>(null);
  const [board, setBoard] = useState<Board>("xp");
  const [detail, setDetail] = useState<RankDetail | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);
  // Loaded once when the panel opens (the screens behind it redraw many times a second).
  const loader = useRef(load);
  const detailLoader = useRef(loadDetail);

  useEffect(() => {
    const load = loader.current;
    if (!load) return;
    let live = true;
    load().then(
      (next) => live && setView(next),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const load = detailLoader.current;
    setDetail(null);
    setDetailFailed(false);
    if (!picked || !load) return;
    let live = true;
    load(picked.id).then(
      (next) => live && setDetail(next),
      () => live && setDetailFailed(true),
    );
    return () => {
      live = false;
    };
  }, [picked]);

  // The board a page at a time, so the panel keeps to the smallest stage without a scroll.
  const rows = (board === "power" ? view?.powerBoard : view?.board) ?? [];
  const boardPage = usePages(rows, BOARD_PER_PAGE);

  return (
    <FullScreen title={t("rank.title")} className="stats-panel" onClose={onClose}>
      {!load && <p className="note">{t("rank.needServer")}</p>}
      {load && failed && <p className="note">{t("rank.failed")}</p>}
      {load && !failed && !view && <p className="note">{t("common.loading")}</p>}

      {view && !picked && (
        <>
          <div className="stats-mine">
            <span className="stats-level">Lv {view.level.level}</span>
            <span className="note">{t("rank.power")} {view.power.toLocaleString()}</span>
            <span className="note">
              {(board === "power" ? view.powerRank : view.rank) === null
                ? t("rank.unranked")
                : t("rank.place", { n: (board === "power" ? view.powerRank : view.rank)! })}
            </span>
          </div>
          <div className="smith-tabs">
            {(["xp", "power"] as Board[]).map((b) => (
              <button key={b} type="button" className={`text-button${board === b ? " on" : ""}`} onClick={() => setBoard(b)}>
                {t(b === "power" ? "rank.tabPower" : "rank.tabLevel")}
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <p className="note">{t("rank.none")}</p>
          ) : (
            <ol className="stats-board">
              <li className="head">
                <span className="rank">#</span>
                <span>{t("rank.nickname")}</span>
                <span>{t("rank.class")}</span>
                <span>{board === "power" ? t("rank.power") : t("rank.level")}</span>
              </li>
              {boardPage.shown.map((row) => (
                <li
                  key={row.id} role="button" tabIndex={0}
                  className={`pick${row.account === account ? " me" : ""}`}
                  onClick={() => setPicked(row)}
                  onKeyDown={(e) => e.key === "Enter" && setPicked(row)}
                >
                  <span className="rank">{board === "power" && rows.indexOf(row) === 0 ? "👑" : rows.indexOf(row) + 1}</span>
                  <span className={`who${(row.vip ?? 0) >= VIP_MIGHT ? " vip-gold" : ""}`}>{(row.vip ?? 0) > 0 && <b className="vip-mark">VIP {row.vip}</b>}{row.nickname ?? t("common.noName")}</span>
                  <span className="note">{classText(row.playerClass, row.job)}</span>
                  <span className="note">{board === "power" ? (row.power ?? 0).toLocaleString() : `Lv ${row.level}`}</span>
                </li>
              ))}
            </ol>
          )}
          {boardPage.pager}
        </>
      )}

      {picked && (
        <div className="rank-detail">
          {!detail && !detailFailed && <p className="note">{t("common.loading")}</p>}
          {detailFailed && <p className="note">{t("rank.detailFailed")}</p>}
          {detail && (
            <>
              <h3>{detail.nickname}</h3>
              <dl>
                <dt>{t("rank.rank")}</dt><dd>{detail.rank === null ? "-" : t("rank.place", { n: detail.rank })}</dd>
                <dt>{t("rank.server")}</dt><dd>{serverName(detail.world)}</dd>
                <dt>{t("rank.class")}</dt>
                <dd>{detail.job ? `${jobName(detail.job)} (${className(detail.playerClass)})` : className(detail.playerClass)}</dd>
                <dt>{t("rank.level")}</dt><dd>Lv {detail.level}</dd>
                <dt>{t("rank.xp")}</dt><dd>{detail.xp.toLocaleString()}</dd>
                <dt>{t("rank.power")}</dt><dd className="power">{detail.power.toLocaleString()}</dd>
                <dt>{slotLabel("weapon")}</dt><dd>{detail.gear.weapon ? gearName(detail.gear.weapon) : t("common.nothing")}</dd>
                <dt>{slotLabel("armor")}</dt><dd>{detail.gear.armor ? gearName(detail.gear.armor) : t("common.nothing")}</dd>
              </dl>
            </>
          )}
          <button type="button" className="text-button" onClick={() => setPicked(null)}>{t("rank.toList")}</button>
        </div>
      )}
    </FullScreen>
  );
}
