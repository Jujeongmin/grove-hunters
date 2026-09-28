import { useEffect, useState, type CSSProperties } from "react";
import { DEFAULT_SETTINGS, QUALITY, onSettings, settings, updateSettings, type Quality, type Settings } from "./settings";
import { LANGS, lang, setLang, t } from "./lang";
import type { Key } from "./strings/ko";

type NumberKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];
type FlagKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

interface Slider {
  key: NumberKey;
  label: Key;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const percent = (v: number) => (v === 0 ? t("common.none") : `${Math.round(v * 100)}%`);

const SOUND: Slider[] = [
  { key: "music", label: "settings.music", min: 0, max: 1, step: 0.05, format: percent },
  { key: "volume", label: "settings.effects", min: 0, max: 1, step: 0.05, format: percent },
];
const CONTROL: Slider[] = [
  { key: "sensitivity", label: "settings.sensitivity", min: 0.3, max: 2.5, step: 0.05, format: (v) => t("settings.times", { n: v.toFixed(2) }) },
];
const SCREEN: Slider[] = [
  { key: "brightness", label: "settings.brightness", min: 0.6, max: 1.6, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
];
const SHOWN: { key: FlagKey; label: Key }[] = [
  { key: "showNames", label: "settings.showNames" },
  { key: "damageNumbers", label: "settings.damageNumbers" },
];
const QUALITY_LABEL: Record<Quality, Key> = {
  low: "settings.quality.low", mid: "settings.quality.mid", high: "settings.quality.high",
};
// The keys to look up: what to press, and the line that says what it does.
const KEYS: [string, Key][] = [
  ["WASD", "keys.move"], ["Space", "keys.jump"], ["keys.click", "keys.attackGuard"], ["1 ~ 3", "keys.skills"],
  ["Q", "keys.potion"], ["E", "keys.talk"], ["R", "keys.auto"], ["J", "keys.quest"], ["Enter", "keys.chat"],
  ["M", "keys.menu"], ["Esc", "keys.closeWindow"], ["N", "keys.map"],
  ["O / L / K / U / I", "keys.panels"], ["B", "keys.powerSave"], ["P", "keys.settings"],
];

// The settings, in sections: sound (music and effects apart), controls, screen and what is shown over
// the world, with the keys to look up. Everything applies at once and is kept in this browser.
// `onExit`, in the world: back out to the menus.
export function SettingsPanel({ onClose, onExit }: { onClose: () => void; onExit?: () => void }) {
  const [values, setValues] = useState(settings());
  const [keys, setKeys] = useState(false);
  useEffect(() => onSettings(setValues), []);
  const slider = (s: Slider) => (
    <label key={s.key} className="setting-row">
      <span>{t(s.label)}</span>
      <input
        type="range" min={s.min} max={s.max} step={s.step} value={values[s.key]}
        // The fill has to be drawn by us: only Firefox has a pseudo-element for it.
        style={{ "--fill": `${((values[s.key] - s.min) / (s.max - s.min)) * 100}%` } as CSSProperties}
        onChange={(e) => updateSettings({ [s.key]: Number(e.target.value) })}
      />
      <span className="setting-value">{s.format(values[s.key])}</span>
    </label>
  );
  const flag = (key: FlagKey, label: Key) => (
    <label key={key} className="setting-row setting-flag">
      <span>{t(label)}</span>
      <input type="checkbox" checked={values[key]} onChange={(e) => updateSettings({ [key]: e.target.checked })} />
      <span className="setting-value">{values[key] ? t("common.on") : t("common.off")}</span>
    </label>
  );
  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="dark-panel settings-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("settings.title")}</h2>
        <h3>{t("settings.language")}</h3>
        <div className="setting-row setting-langs">
          <div className="setting-choice">
            {LANGS.map((l) => (
              <button
                key={l.id} type="button" className={`text-button${lang() === l.id ? " on" : ""}`}
                onClick={() => setLang(l.id)} lang={l.id}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
        <h3>{t("settings.sound")}</h3>
        {SOUND.map(slider)}
        <h3>{t("settings.controls")}</h3>
        {CONTROL.map(slider)}
        <h3>{t("settings.screen")}</h3>
        {SCREEN.map(slider)}
        <div className="setting-row">
          <span>{t("settings.quality")}</span>
          <div className="setting-choice">
            {(Object.keys(QUALITY) as Quality[]).map((q) => (
              <button
                key={q} type="button" className={`text-button${values.quality === q ? " on" : ""}`}
                onClick={() => updateSettings({ quality: q })}
              >
                {t(QUALITY_LABEL[q])}
              </button>
            ))}
          </div>
          <span className="setting-value" />
        </div>
        <p className="setting-note">{t("settings.quality.note")}</p>
        <h3>{t("settings.shown")}</h3>
        {SHOWN.map((s) => flag(s.key, s.label))}
        <button type="button" className="text-button" onClick={() => setKeys((k) => !k)}>{keys ? t("settings.keys.hide") : t("settings.keys.show")}</button>
        {keys && (
          <dl className="setting-keys">
            {KEYS.map(([k, what]) => (
              <div key={k}><dt>{k === "keys.click" ? t("keys.click") : k}</dt><dd>{t(what)}</dd></div>
            ))}
          </dl>
        )}
        <div className="settings-actions">
          <button type="button" className="text-button" onClick={() => updateSettings({ ...DEFAULT_SETTINGS, ...keepBar(settings()) })}>
            {t("settings.defaults")}
          </button>
          <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
          {onExit && <button type="button" className="text-button" onClick={onExit}>{t("settings.exit")}</button>}
        </div>
      </div>
    </div>
  );
}

// Going back to the defaults leaves the skill bar and the potion as they were set up.
function keepBar(s: Settings): Partial<Settings> {
  return { hotbars: s.hotbars, autoSkills: s.autoSkills, autoPotion: s.autoPotion, potionAt: s.potionAt };
}
