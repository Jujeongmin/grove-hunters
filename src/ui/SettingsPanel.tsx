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
  { key: "showAnnouncements", label: "settings.announcements" },
];
const QUALITY_LABEL: Record<Quality, Key> = {
  low: "settings.quality.low", mid: "settings.quality.mid", high: "settings.quality.high",
};
// The keys to look up: what to press, and the line that says what it does.
const KEYS: [string, Key][] = [
  ["WASD", "keys.move"], ["Space", "keys.jump"], ["keys.click", "keys.attackGuard"], ["1 ~ 4", "keys.skills"],
  ["Q", "keys.potion"], ["E", "keys.talk"], ["R", "keys.auto"], ["T", "keys.ride"], ["J", "keys.quest"], ["Enter", "keys.chat"],
  ["M", "keys.menu"], ["Esc", "keys.closeWindow"], ["N", "keys.map"], ["C", "keys.channel"],
  ["O / L / K / U / I / H", "keys.panels"], ["B", "keys.powerSave"], ["P", "keys.settings"],
];

// The settings, in two columns: the language, sound (music and effects apart) and controls on the
// left, the screen and what is shown over the world on the right; the keys to look up are a page of
// their own. Everything applies at once and is kept in this browser.
// `onExit` and `onTitle`, in the world: back out to your characters, or to the title.
export function SettingsPanel({ onClose, onExit, onTitle }: { onClose: () => void; onExit?: () => void; onTitle?: () => void }) {
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
        {/* Two pages, so neither needs a scroll on the smallest stage: the settings, and the keys. */}
        <div className="settings-tabs">
          <button type="button" className={`text-button${keys ? "" : " on"}`} onClick={() => setKeys(false)}>{t("settings.title")}</button>
          <button type="button" className={`text-button${keys ? " on" : ""}`} onClick={() => setKeys(true)}>{t("settings.keysTab")}</button>
        </div>
        {keys ? (
          <dl className="setting-keys">
            {KEYS.map(([k, what]) => (
              <div key={k}><dt>{k === "keys.click" ? t("keys.click") : k}</dt><dd>{t(what)}</dd></div>
            ))}
          </dl>
        ) : (
          <div className="settings-columns">
            <section>
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
            </section>
            <section>
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
            </section>
          </div>
        )}
        <div className="settings-actions">
          <button type="button" className="text-button" onClick={() => updateSettings({ ...DEFAULT_SETTINGS, ...keepBar(settings()) })}>
            {t("settings.defaults")}
          </button>
          <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
          {onExit && <button type="button" className="text-button" onClick={onExit}>{t("settings.exit")}</button>}
          {onTitle && <button type="button" className="text-button" onClick={onTitle}>{t("common.toTitle")}</button>}
        </div>
      </div>
    </div>
  );
}

// Going back to the defaults leaves the skill bar and the potion as they were set up.
function keepBar(s: Settings): Partial<Settings> {
  return { hotbars: s.hotbars, autoSkills: s.autoSkills, autoPotion: s.autoPotion, potionAt: s.potionAt };
}
