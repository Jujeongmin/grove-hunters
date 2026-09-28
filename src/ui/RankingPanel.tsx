import { useEffect, useRef, useState } from "react";
import { t } from "./lang";
import { slotLabel } from "./BagPanel";

import type { RankDetail, RankRow, RankingView } from "../game/account/ranking";
import type { PlayerClass } from "../game/combat/classes";
import { className, itemName, jobName, serverName } from "./names";
import type { JobId } from "../game/combat/jobs";

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

// Your level and 전투력, and the top of the board by experience: name, level and class on each line.
// Tapping a line shows that character in full.
export function RankingPanel({ onClose, account, load, loadDetail }: RankingPanelProps) {
  const [view, setView] = useState<RankingView | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<RankRow | null>(null);
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

  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel stats-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("rank.title")}</h2>
        {!load && <p className="note">{t("rank.needServer")}</p>}
        {load && failed && <p className="note">{t("rank.failed")}</p>}
        {load && !failed && !view && <p className="note">{t("common.loading")}</p>}

        {view && !picked && (
          <>
            <div className="stats-mine">
              <span className="stats-level">Lv {view.level.level}</span>
              <span className="note">{t("rank.power")} {view.power.toLocaleString()}</span>
              <span className="note">{view.rank === null ? t("rank.unranked") : t("rank.place", { n: view.rank })}</span>
            </div>
            {view.board.length === 0 ? (
              <p className="note">{t("rank.none")}</p>
            ) : (
              <ol className="stats-board">
                <li className="head">
                  <span className="rank">#</span>
                  <span>{t("rank.nickname")}</span>
                  <span>{t("rank.class")}</span>
                  <span>{t("rank.level")}</span>
                </li>
                {view.board.map((row, i) => (
                  <li
                    key={row.id} role="button" tabIndex={0}
                    className={`pick${row.account === account ? " me" : ""}`}
                    onClick={() => setPicked(row)}
                    onKeyDown={(e) => e.key === "Enter" && setPicked(row)}
                  >
                    <span className="rank">{i + 1}</span>
                    <span className="who">{row.nickname ?? t("common.noName")}</span>
                    <span className="note">{classText(row.playerClass, row.job)}</span>
                    <span className="note">Lv {row.level}</span>
                  </li>
                ))}
              </ol>
            )}
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
                  <dt>{slotLabel("weapon")}</dt><dd>{detail.gear.weapon ? itemName(detail.gear.weapon) : t("common.nothing")}</dd>
                  <dt>{slotLabel("armor")}</dt><dd>{detail.gear.armor ? itemName(detail.gear.armor) : t("common.nothing")}</dd>
                </dl>
              </>
            )}
            <button type="button" className="text-button" onClick={() => setPicked(null)}>{t("rank.toList")}</button>
          </div>
        )}
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}
