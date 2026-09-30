import { useEffect, useState } from "react";
import { STAGES } from "../game/world/guildBoss";
import type { WorldClient } from "../net/worldClient";
import { t, type Key } from "./lang";

// How often the bar and the clock look again.
const REFRESH_MS = 250;

interface Fight { boss: string | null; hp: number; max: number; alive: boolean; until: number | null; dead: boolean; timeUp: boolean }

function read(client: WorldClient): Fight {
  const s = client.state;
  const boss = s.monsters.boss;
  return {
    boss: boss?.type ?? null, hp: boss?.hp ?? 0, max: s.arenaMax ?? boss?.maxHp ?? 1, alive: boss?.alive ?? true,
    until: s.me?.arenaUntil ?? null, dead: s.me?.dead ?? false, timeUp: s.me?.timeUp ?? false,
  };
}

function clock(ms: number): string {
  const left = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

// In a guild boss room: the guild's shared health bar for the boss (with the stage marks), the three
// minutes counting down, a way out, and once it is over (time, a fall or the boss down) what happened
// and the way back.
export function ArenaHud({ client }: { client: WorldClient }) {
  const [fight, setFight] = useState(() => read(client));
  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => {
      setFight(read(client));
      setNow(Date.now());
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [client]);
  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    void client.leaveArena().then((code) => {
      if (code) setLeaving(false);
    });
  };
  const outOfTime = fight.timeUp || (fight.until !== null && now >= fight.until);
  const over = outOfTime || fight.dead || !fight.alive;
  const share = Math.max(0, Math.min(1, fight.hp / fight.max));
  return (
    <>
      <div className="arena-hud">
        <div className="arena-top">
          <b>{fight.boss ? t(`boss.${fight.boss}` as Key) : ""}</b>
          <span className="arena-clock">{fight.until === null || over ? "" : clock(fight.until - now)}</span>
        </div>
        <div className="arena-bar">
          <i style={{ width: `${share * 100}%` }} />
          {STAGES.slice(0, -1).map((s) => <b key={s} style={{ left: `${(1 - s) * 100}%` }} />)}
          <span>{Math.ceil(share * 100)}%</span>
        </div>
        <p className="arena-hint">{t("boss.hint")}</p>
        {!over && <button type="button" className="text-button arena-leave" disabled={leaving} onClick={leave}>{t("boss.leave")}</button>}
      </div>
      {over && (
        <div className="menu-modal">
          <div className="solid-panel arena-end">
            <h2>{!fight.alive ? t("boss.slain") : fight.dead ? t("boss.fallen") : t("boss.timeUp")}</h2>
            <p className="note">{t("boss.endNote")}</p>
            <button type="button" className="brush-button small" disabled={leaving} onClick={leave}>{t("boss.leave")}</button>
          </div>
        </div>
      )}
    </>
  );
}
