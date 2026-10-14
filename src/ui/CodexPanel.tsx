import { useEffect, useRef, useState } from "react";
import {
  EVERY_HITTER, SOUL_MAX, SOUL_MONSTERS, SOUL_STAGES, codexBonus, soulChance, soulGroup, soulStage, soulZones, stageBonus,
  type SoulBonus, type SoulGroup,
} from "../game/account/souls";
import { MONSTERS, type MonsterType } from "../game/world/monsters";
import type { BagView } from "../game/account/items";
import type { ModelLibrary } from "../game/assets/ModelLibrary";
import { MonsterStage } from "../game/render/MonsterStage";
import type { WorldClient } from "../net/worldClient";
import { playCue } from "../game/audio/sfx";
import { problemText } from "./BagPanel";
import { FullScreen } from "./FullScreen";
import { t, type Key } from "./lang";
import { monsterName, zoneName } from "./names";

const GROUPS: readonly SoulGroup[] = ["grove", "snow", "volcano", "boss"];
// How long a stage just opened glows.
const OPENED_MS = 1600;

const pct = (n: number) => String(Math.round(n * 1000) / 10);

// What a bonus says, its parts that are there, joined: flat numbers.
function bonusText(b: SoulBonus): string {
  const parts: string[] = [];
  if (b.atk) parts.push(t("stat.atk", { n: b.atk }));
  if (b.def) parts.push(t("stat.def", { n: b.def }));
  if (b.hp) parts.push(t("stat.hp", { n: b.hp }));
  return parts.join(" · ");
}

// The soul codex (영혼 도감): every monster with a soul by region, how far its stages are open, the
// souls waiting to be collected and the button that collects them, and where it is met.
export function CodexPanel({ client, bag, library, onSeek, onClose }: {
  client: WorldClient;
  bag: BagView | null;
  library: ModelLibrary | null;
  onSeek: (type: MonsterType) => void;
  onClose: () => void;
}) {
  const codex = bag?.codex ?? {};
  const souls = bag?.souls ?? {};
  const waiting = (type: MonsterType) => souls[type] ?? 0;
  const firstWaiting = SOUL_MONSTERS.find((m) => waiting(m) > 0);
  const [group, setGroup] = useState<SoulGroup>(firstWaiting ? soulGroup(firstWaiting) : "grove");
  const [picked, setPicked] = useState<MonsterType>(firstWaiting ?? SOUL_MONSTERS.find((m) => soulGroup(m) === "grove")!);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ type: MonsterType; stages: number[]; at: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<MonsterStage | null>(null);

  useEffect(() => {
    if (!library || !canvas.current) return;
    const s = new MonsterStage(canvas.current, library);
    stage.current = s;
    return () => {
      s.dispose();
      stage.current = null;
    };
  }, [library]);
  const collected = codex[picked] ?? 0;
  const known = collected > 0 || waiting(picked) > 0;
  useEffect(() => {
    void stage.current?.show(picked, known);
  }, [picked, known, library]);
  useEffect(() => {
    if (!opened) return;
    const timer = setTimeout(() => setOpened(null), OPENED_MS);
    return () => clearTimeout(timer);
  }, [opened]);

  const list = SOUL_MONSTERS.filter((m) => soulGroup(m) === group);
  const total = codexBonus(codex);
  const done = SOUL_MONSTERS.filter((m) => (codex[m] ?? 0) >= SOUL_MAX).length;
  const spec = MONSTERS[picked];
  const chance = soulChance(picked);
  const glowing = opened?.type === picked;

  const collect = () => {
    setBusy(true);
    setProblem(null);
    void client.collectSouls(picked).then((r) => {
      setBusy(false);
      if ("problem" in r) {
        setProblem(problemText(r.problem));
        return;
      }
      playCue(r.opened.length > 0 ? "levelup" : "quest");
      setOpened({ type: picked, stages: r.opened, at: Date.now() });
    });
  };

  return (
    <FullScreen
      title={t("codex.title")} className="codex-panel" onClose={onClose}
      bar={<span className="codex-total">{bonusText(total) || t("codex.noBonus")} <em>{t("codex.done", { n: done, of: SOUL_MONSTERS.length })}</em></span>}
    >
      <div className="codex-tabs">
        {GROUPS.map((g) => (
          <button
            key={g} type="button" className={`text-button${g === group ? " on" : ""}`}
            onClick={() => {
              setGroup(g);
              setPicked(SOUL_MONSTERS.find((m) => soulGroup(m) === g)!);
            }}
          >
            {t(`codex.tab.${g}` as Key)}
            {SOUL_MONSTERS.some((m) => soulGroup(m) === g && waiting(m) > 0) && <i className="hud-dot" />}
          </button>
        ))}
      </div>
      <div className="codex-body">
        <div className="codex-grid">
          {list.map((m) => {
            const n = codex[m] ?? 0;
            const st = soulStage(n);
            const seen = n > 0 || waiting(m) > 0;
            return (
              <button
                key={m} type="button"
                className={`codex-tile${m === picked ? " picked" : ""}${!seen ? " unseen" : ""}${n >= SOUL_MAX ? " full" : ""}${opened?.type === m ? " opened" : ""}`}
                onClick={() => setPicked(m)}
              >
                <b>{monsterName(m)}</b>
                <span className="codex-lv">Lv{MONSTERS[m].level}</span>
                <span className="codex-pips">{SOUL_STAGES.map((_, i) => <i key={i} className={i < st ? "on" : ""} />)}</span>
                {waiting(m) > 0 && <span className="codex-badge">+{waiting(m)}</span>}
              </button>
            );
          })}
        </div>
        <div className={`codex-detail${glowing ? " opened" : ""}`}>
          <div className="codex-stage">
            <canvas ref={canvas} />
            {!known && <span className="codex-unknown">???</span>}
          </div>
          <div className="codex-head">
            <b>{monsterName(picked)}</b>
            <span>Lv{spec.level}</span>
            {collected >= SOUL_MAX && <span className="codex-full">{t("codex.full")}</span>}
          </div>
          <dl className="codex-facts">
            <dt>{t("codex.where")}</dt>
            <dd>{soulZones(picked).map(zoneName).join(", ")}{picked === EVERY_HITTER ? ` · ${t("codex.guardianNote")}` : ""}</dd>
            <dt>{t("codex.temper")}</dt>
            <dd>{t(spec.aggressive ? "codex.aggressive" : "codex.passive")}</dd>
            <dt>{t("codex.chance")}</dt>
            <dd>{chance >= 1 ? t("codex.chanceAll") : t("codex.chanceRate", { n: pct(chance) })}</dd>
            <dt>{t("codex.collected")}</dt>
            <dd>
              <span className="codex-count">{collected} / {SOUL_MAX}</span>
              <span className="hud-bar xp codex-bar"><i style={{ width: `${Math.round((collected / SOUL_MAX) * 100)}%` }} /></span>
            </dd>
          </dl>
          <ul className="codex-stages">
            {SOUL_STAGES.map((at, i) => (
              <li key={at} className={`${collected >= at ? "on" : ""}${glowing && opened!.stages.includes(i + 1) ? " just" : ""}`}>
                <span>{t("codex.stageAt", { n: at })}</span>
                <b>{bonusText(stageBonus(picked, i))}</b>
              </li>
            ))}
          </ul>
          {glowing && opened!.stages.length > 0 && (
            <p className="codex-news">{t("codex.opened", { name: monsterName(picked), n: opened!.stages[opened!.stages.length - 1] })}</p>
          )}
          <div className="codex-actions">
            <button type="button" className="brush-button small codex-collect" disabled={busy || waiting(picked) === 0} onClick={collect}>
              {waiting(picked) > 0 ? t("codex.collect", { n: waiting(picked) }) : t("codex.nothing")}
            </button>
            {picked !== EVERY_HITTER && (
              <button type="button" className="text-button" onClick={() => onSeek(picked)}>{t("codex.seek")}</button>
            )}
          </div>
          {problem && <p className="forge-note bad">{problem}</p>}
        </div>
      </div>
    </FullScreen>
  );
}
