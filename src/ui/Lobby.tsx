import { useEffect, useRef, useState } from "react";
import { t } from "./lang";
import { CHARACTERS_PER_WORLD } from "../game/account/characters";
import type { FriendsView } from "../game/account/friends";
import type { AccountView } from "../game/account/nickname";
import type { RankDetail, RankingView } from "../game/account/ranking";
import { readWorld } from "../game/account/worlds";
import { playMusic } from "../game/audio/music";
import { readClass, type PlayerClass } from "../game/combat/classes";
import { className, worldName } from "./names";
import { COSTUMES, costumeById, type Costume } from "../game/render/costumes";
import { MenuScene } from "../game/render/MenuScene";
import { nicknameProblem } from "../net/account";
import { loginState } from "../net/login";
import type { FriendsClient } from "../net/friends";
import { GAME_TITLE } from "./brand";
import { ClassPanel } from "./ClassPanel";
import { DeleteCharacterPanel } from "./DeleteCharacterPanel";
import { FriendsPanel } from "./FriendsPanel";
import { NicknamePanel } from "./NicknamePanel";
import { RankingPanel } from "./RankingPanel";
import { SettingsPanel } from "./SettingsPanel";
import { Wardrobe } from "./Wardrobe";
import { WorldPicker } from "./WorldPicker";

interface LobbyProps {
  account: string;
  // Your account on the server; null while offline or loading.
  view: AccountView | null;
  accountFailed: boolean;
  // Starting needs the Verse8 server.
  online: boolean;
  onPickWorld: (world: string) => Promise<void>;
  checkName: (name: string) => Promise<boolean>;
  onCreate: (name: string, playerClass: string, costume: string) => Promise<void>;
  onSelect: (id: string) => Promise<void>;
  // Deletes a character for good, its name typed back to be sure.
  onDelete: (id: string, typedName: string) => Promise<void>;
  loadRanking: (() => Promise<RankingView>) | null;
  loadRankDetail: ((id: string) => Promise<RankDetail>) | null;
  friends: FriendsClient | null;
  friendsView: FriendsView | null;
  // Into the world with the active character.
  onStart: () => void;
  // Back from the world: straight to your characters, not the title.
  returning: boolean;
}

// title: the logo over the village, tap to go on. world: which server. characters: yours on that
// server, to play or to make another. class, name, look: making a new one.
type Step = "title" | "world" | "characters" | "class" | "name" | "look";
type Sheet = "none" | "settings" | "ranking";

export function Lobby({
  account, view, accountFailed, online, onPickWorld, checkName, onCreate, onSelect, onDelete, loadRanking, loadRankDetail,
  friends, friendsView, onStart, returning,
}: LobbyProps) {
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<MenuScene | null>(null);
  const [loading, setLoading] = useState(0);
  const [step, setStep] = useState<Step>(returning ? "characters" : "title");
  const [sheet, setSheet] = useState<Sheet>("none");
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  // Asking to delete the picked character.
  const [deleting, setDeleting] = useState(false);
  // The character being made: its class, name and look until it is saved.
  const [draftClass, setDraftClass] = useState<PlayerClass | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftCostume, setDraftCostume] = useState<Costume>(COSTUMES[0]);
  const [creating, setCreating] = useState(false);
  // A guest's characters live on an address made for this visit only.
  const [guest] = useState(() => loginState() === "guest");

  const active = view?.active ?? null;
  const characters = view?.characters ?? [];
  const making = step === "class" || step === "name" || step === "look";
  // Who stands in the square: the character being made, else the one you play.
  const shownClass: PlayerClass = (making ? draftClass : readClass(active?.playerClass)) ?? "warrior";
  const shownCostume = making ? draftCostume : costumeById(active?.costume) ?? COSTUMES[0];

  useEffect(() => playMusic("menu"), []);

  useEffect(() => {
    const container = stage.current;
    if (!container) return;
    const next = new MenuScene(container);
    scene.current = next;
    void next.start((done, total) => setLoading(done / total)).then(() => setLoading(1));
    return () => {
      scene.current = null;
      next.dispose();
    };
  }, []);

  // The row of classes while picking one (and behind the title for a newcomer); otherwise the
  // character in the square.
  useEffect(() => {
    scene.current?.setMode(step === "class" || (step === "title" && !active) ? "lineup" : "hero");
    scene.current?.setPicked(step === "class" ? draftClass : null);
  }, [step, draftClass, active, loading]);
  useEffect(() => {
    scene.current?.setWardrobe(step === "look");
  }, [step]);
  useEffect(() => {
    const me = { account, name: making ? draftName || t("lobby.newCharacter") : active?.name ?? "", costume: shownCostume, playerClass: shownClass };
    scene.current?.setHeroes(step === "characters" && !active ? [] : [{ name: me.name, costume: me.costume, playerClass: me.playerClass, isYou: true }]);
  }, [account, making, draftName, active, shownCostume, shownClass, step, loading]);

  // Tap anywhere on the title to go on: the server comes first.
  const tapTitle = () => {
    if (loading < 1) return;
    if (!online) {
      setNotice(t("lobby.needServer"));
      return;
    }
    if (accountFailed) {
      setNotice(t("lobby.accountFailed"));
      return;
    }
    if (!view) {
      setNotice(t("lobby.accountLoading"));
      return;
    }
    setNotice(null);
    setStep("world");
  };

  const startMaking = () => {
    setDraftClass(null);
    setDraftName("");
    setDraftCostume(COSTUMES[0]);
    setNotice(null);
    setStep("class");
  };

  const finishMaking = async () => {
    if (!draftClass || creating) return;
    setCreating(true);
    setNotice(null);
    try {
      await onCreate(draftName, draftClass, draftCostume.id);
      setStep("characters");
    } catch (error) {
      setNotice(nicknameProblem(error));
      // A name taken while you dressed goes back to the name step.
      setStep("name");
    } finally {
      setCreating(false);
    }
  };

  const start = () => {
    if (leaving || !active) return;
    setLeaving(true);
    if (scene.current) scene.current.enter(onStart);
    else onStart();
  };

  const server = readWorld(view?.world) ?? readWorld("w1");
  const shownWorld = server ? worldName(server.number) : "";

  return (
    <div className="main-menu">
      <div
        className="menu-stage"
        ref={stage}
        onClick={(e) => {
          if (step === "title") tapTitle();
          if (step === "class") {
            const c = scene.current?.classAt(e.clientX, e.clientY) ?? null;
            if (c) setDraftClass(c);
          }
        }}
      />
      <div className="ui">
        {loading < 1 && <div className="menu-loading band">{t("lobby.loading", { n: Math.round(loading * 100) })}</div>}

        {step === "title" && (
          <div className="title-screen" onClick={tapTitle}>
            <h1 className="game-title">{GAME_TITLE}</h1>
            {loading >= 1 && <p className="tap-to-start">{t("lobby.tapToStart")}</p>}
            {notice && <p className="title-notice band">{notice}</p>}
          </div>
        )}

        {step === "characters" && (
          <div className="menu-corner">
            <button type="button" className="brush-button small" onClick={() => setFriendsOpen((v) => !v)}>
              {t("lobby.friends")}{(friendsView?.incoming.length ?? 0) > 0 && <span className="badge">{friendsView?.incoming.length}</span>}
            </button>
            <button type="button" className="brush-button small" onClick={() => setSheet("settings")}>{t("menu.settings")}</button>
          </div>
        )}

        {step === "world" && (
          <WorldPicker
            current={view?.world ?? null}
            onPick={async (id) => {
              await onPickWorld(id);
              setStep("characters");
            }}
            onClose={() => setStep("title")}
          />
        )}

        {step === "characters" && (
          <nav className="menu-left character-select">
            <h1 className="game-title small">{GAME_TITLE}</h1>
            <p className="note">{t("lobby.characters", { world: shownWorld, n: characters.length, max: CHARACTERS_PER_WORLD })}</p>
            <ul className="character-list">
              {characters.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`character-card${c.id === active?.id ? " picked" : ""}`}
                    onClick={() => void onSelect(c.id)}
                  >
                    <b>{c.name}</b>
                    <span>Lv {c.level.level} · {className(c.playerClass)}</span>
                  </button>
                </li>
              ))}
              {characters.length < CHARACTERS_PER_WORLD && (
                <li>
                  <button type="button" className="character-card new" onClick={startMaking}>{t("lobby.createCharacter")}</button>
                </li>
              )}
            </ul>
            {active && (
              <button type="button" className="text-button character-delete" onClick={() => setDeleting(true)}>
                {t("lobby.deleteCharacter", { name: active.name })}
              </button>
            )}
            <button type="button" className="brush-button" onClick={start} disabled={leaving || !active}>{t("lobby.start")}</button>
            <button type="button" className="brush-button" onClick={() => setSheet("ranking")}>{t("menu.ranking")}</button>
            <button type="button" className="brush-button" onClick={() => setStep("world")}>{t("lobby.changeServer")}</button>
            {guest && <p className="note guest-note">{t("lobby.guestNote")}</p>}
            {!active && <p className="note">{t("lobby.noCharacter")}</p>}
          </nav>
        )}

        {step === "class" && (
          <ClassPanel
            picked={draftClass}
            onPick={setDraftClass}
            onBack={() => setStep("characters")}
            onConfirm={(c) => {
              setDraftClass(c);
              setStep("name");
            }}
          />
        )}

        {step === "name" && (
          <NicknamePanel
            current={draftName}
            isFree={checkName}
            onNext={(name) => {
              setDraftName(name);
              setStep("look");
            }}
            onClose={() => setStep("class")}
          />
        )}
        {step === "name" && notice && <div className="hud-error band">{notice}</div>}

        {step === "look" && (
          <Wardrobe
            costume={draftCostume}
            onPick={setDraftCostume}
            onSpin={(r) => scene.current?.spin(r)}
            onClose={() => setStep("name")}
            onStart={() => void finishMaking()}
            busy={creating}
          />
        )}

        {friendsOpen && (
          <FriendsPanel
            onClose={() => setFriendsOpen(false)}
            client={friends}
            view={friendsView}
            hasCharacter={!!active}
          />
        )}
        {deleting && active && (
          <DeleteCharacterPanel id={active.id} name={active.name} onDelete={onDelete} onClose={() => setDeleting(false)} />
        )}
        {sheet === "settings" && <SettingsPanel onClose={() => setSheet("none")} />}
        {sheet === "ranking" && <RankingPanel account={account} load={loadRanking} loadDetail={loadRankDetail} onClose={() => setSheet("none")} />}
      </div>
    </div>
  );
}
