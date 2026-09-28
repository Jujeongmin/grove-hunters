import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { typing } from "../game/render/FpsInput";
import { ChatBox } from "./ChatBox";
import { SmithPanel } from "./SmithPanel";
import { playCue } from "../game/audio/sfx";
import { DeathPanel } from "./DeathPanel";
import { PowerSaveScreen } from "./PowerSaveScreen";
import { useWakeLock } from "./useWakeLock";
import { playMusic } from "../game/audio/music";
import { trackFor } from "../game/audio/musicTrack";
import type { PlayerClass } from "../game/combat/classes";
import type { Costume } from "../game/render/costumes";
import { WorldView, type WorldHud } from "../game/render/WorldView";
import type { ZoneEntry } from "../game/world/zones";
import type { WorldClient, WorldState } from "../net/worldClient";
import type { BagView } from "../game/account/items";
import { START_ZONE } from "../game/world/zones";
import { BagPanel, ShopPanel } from "./BagPanel";
import { QuestTracker } from "./QuestTracker";
import { tutorialGlow } from "../game/account/tutorial";
import type { QuestTrip } from "../game/world/questRoute";
import { useTutorial } from "./useTutorial";
import { TutorialDoneBanner, TutorialTracker } from "./TutorialTracker";
import { SkillBar } from "./SkillBar";
import { PadButtons, TouchStick, isTouchDevice } from "./TouchControls";
import { SkillPanel } from "./SkillPanel";
import { RankingPanel } from "./RankingPanel";
import { iconFor } from "../game/render/icons";
import { QuestPanel } from "./QuestPanel";
import { MapPanel, MinimapCorner } from "./Minimap";
import { FREE_UNTIL, UpgradePanel, type UpgradeReason } from "./UpgradePanel";
import type { Offer } from "../game/account/purchase";
import { t } from "./lang";
import type { Key } from "./strings/ko";
import { QuestCompleteBanner, QuestLog } from "./QuestLog";
import { QUESTS, questDone } from "../game/account/quests";
import { SettingsPanel } from "./SettingsPanel";
import { ChannelPanel } from "./ChannelPanel";
import type { FriendsView } from "../game/account/friends";
import { readChannelRoom } from "../game/world/zones";

interface WorldScreenProps {
  client: WorldClient;
  playerClass: PlayerClass;
  costume: Costume;
  name: string;
  owned: boolean;
  // The purchase, so the locked portal and the menu can open it where the wall is met.
  purchase: { offer: Offer; state: "idle" | "confirming" | "late"; buy: (() => void) | null };
  // Your friends, for the channel list to show who is on which.
  friends: FriendsView | null;
  onExit: () => void;
}

// Why a portal turned you away. The codes the server sends for travel are its own, so they are
// named here rather than shared with the bag's.
const TRAVEL_PROBLEM: Record<string, Key> = {
  not_owned: "problem.not_owned",
  zone_full: "problem.zone_full",
  channel_full: "problem.channel_full",
  not_near: "problem.not_near_portal",
  too_low: "problem.too_low",
};

// A room server that would not take the connection: usually the network or a busy server.
function enterProblem(error: string | null): string {
  if (error === "unavailable") return t("problem.enter");
  if (error?.includes("RS connect") || error?.includes("RS:connect") || error?.includes("rs_connect_failed")) {
    return t("problem.connect");
  }
  return t("problem.enterWith", { error: String(error) });
}

// The world: enters on mount, shows the zone you are in (one WorldView per zone and channel), and
// takes you through portals.
export function WorldScreen({ client, playerClass, costume, name, owned, purchase, friends, onExit }: WorldScreenProps) {
  const [state, setState] = useState<WorldState>(client.state);
  const [problem, setProblem] = useState<{ text: string; at: number } | null>(null);
  // A quest trip under way, kept here as you go from zone to zone (each zone has its own view).
  const trip = useRef<QuestTrip | null>(null);

  useEffect(() => {
    // The screen only cares where you are and whether you are moving between zones; the others'
    // poses change many times a second and go straight to the 3D view, not through React.
    const off = client.onChange((next) =>
      setState((prev) => (prev.phase === next.phase && prev.entry === next.entry && prev.error === next.error && prev.bag === next.bag
        ? prev : next)));
    void client.enter();
    return () => {
      off();
      void client.leave();
    };
  }, [client]);

  useEffect(() => {
    playMusic(trackFor(state.entry?.zone ?? null));
  }, [state.entry?.zone]);

  if (state.phase === "error") {
    return (
      <div className="overlay">
        <div className="solid-panel world-panel">
          <p>{enterProblem(state.error)}</p>
          <button type="button" className="brush-button small" onClick={() => void client.enter()}>{t("common.retry")}</button>
          <button type="button" className="text-button" onClick={onExit}>{t("common.toMenu")}</button>
        </div>
      </div>
    );
  }
  if (!state.entry) return <div className="overlay">{t("world.entering")}</div>;
  return (
    <ZoneScreen
      key={state.entry.roomId}
      entry={state.entry}
      client={client}
      playerClass={playerClass}
      costume={costume}
      name={name}
      owned={owned}
      purchase={purchase}
      friends={friends}
      travelling={state.phase === "travelling"}
      bag={state.bag}
      problem={problem}
      trip={trip}
      onProblem={(code) => setProblem({ text: t(TRAVEL_PROBLEM[code] ?? "problem.cannotTravel"), at: performance.now() })}
      onExit={onExit}
    />
  );
}

// The panels over the world, one at a time.
type Panel = "bag" | "shop" | "smith" | "skills" | "ranking" | "quest" | "quests" | "map" | "channels";

interface ZoneScreenProps extends Omit<WorldScreenProps, "onExit"> {
  entry: ZoneEntry;
  bag: BagView | null;
  travelling: boolean;
  problem: { text: string; at: number } | null;
  // The quest trip carried from zone to zone.
  trip: MutableRefObject<QuestTrip | null>;
  onProblem: (code: string) => void;
  onExit: () => void;
}

// How long the quest-complete panel stays up.
const QUEST_BANNER_MS = 4500;
// How long a refused portal's message stays up.
const PROBLEM_MS = 3000;

function ZoneScreen({
  entry, client, playerClass, costume, name, owned, purchase, friends, travelling, bag, problem, trip, onProblem, onExit,
}: ZoneScreenProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<WorldView | null>(null);
  const [hud, setHud] = useState<WorldHud | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  // The settings panel (P), which also leads out to the menus.
  const [menu, setMenu] = useState(false);
  // Which of the bag and the shop is open.
  const [panel, setPanel] = useState<Panel | null>(null);
  // The quest just finished, shown once as a panel in the middle of the screen.
  const [finished, setFinished] = useState<number | null>(null);
  // The purchase panel, and why it opened; null while it is closed. Once the panel has said its
  // piece about the free fields running out, it does not say it again this session.
  const [upgrade, setUpgrade] = useState<UpgradeReason | null>(null);
  const shown = useRef(false);
  const lastQuest = useRef<{ index: number; done: boolean } | null>(null);
  useEffect(() => {
    if (!bag) return;
    const done = questDone(bag.quest);
    const last = lastQuest.current;
    // Only a quest seen going from unfinished to finished, not one already done when you arrive.
    if (last && last.index === bag.quest.index && !last.done && done) {
      setFinished(bag.quest.index);
      playCue("quest");
    }
    lastQuest.current = { index: bag.quest.index, done };
  }, [bag]);
  useEffect(() => {
    if (finished === null) return;
    const timer = setTimeout(() => setFinished(null), QUEST_BANNER_MS);
    return () => clearTimeout(timer);
  }, [finished]);
  const inVillage = entry.zone === START_ZONE;
  const [now, setNow] = useState(() => performance.now());
  // Every device plays with the pad and the mouse (or a finger); a keyboard's keys show on the
  // buttons that have one.
  const touch = isTouchDevice();
  const keyHints = !touch;

  useEffect(() => {
    const next = new WorldView(host.current!, client, {
      entry, playerClass, costume, name, owned,
      trip: trip.current,
      onTrip: (next) => {
        trip.current = next;
      },
      onProgress: (done, total) => setProgress(done / total),
      onTalk: (id) => {
        // The elder's lesson in the first tutorial: the server checks you are by the elder.
        if (id === "elder" && tutorialStep.current === 0) void client.tutorialTalk();
        setPanel(id === "merchant" ? "shop" : id === "smith" ? "smith" : "quest");
      },
      onTravel: (to) => {
        void client.travel(to).then((code) => {
          if (code) {
            view.current?.travelRefused();
            onProblem(code);
          }
        });
      },
    });
    view.current = next;
    if (import.meta.env.DEV) (window as unknown as { __world?: unknown }).__world = next.debugHandle();
    const off = next.onHud((h) => {
      setHud(h);
      setNow(performance.now());
    });
    void next.start().then(() => setReady(true));
    return () => {
      off();
      next.dispose();
      view.current = null;
    };
    // One view per zone: the key on this component remounts it for a new entry.
  }, []);

  // The menu buttons fold away behind one (M); each has its key. Escape only closes what is open,
  // never opens the menu.
  const [menuOpen, setMenuOpen] = useState(false);
  // Power saving (절전): a dark summary over the world, which goes on undrawn.
  const [saving, setSaving] = useState(false);
  useEffect(() => view.current?.setPowerSave(saving), [saving]);
  // The first tutorial: what to do next, and what lights up for it.
  const tutorial = useTutorial(client, bag, playerClass, hud?.auto ?? false);
  const glow = tutorialGlow(tutorial.step, { menuOpen, skillsOpen: panel === "skills" });
  // Read by the once-bound handlers (talking to the elder, J).
  const tutorialStep = useRef(tutorial.step);
  tutorialStep.current = tutorial.step;
  useEffect(() => {
    if (!tutorial.finished) return;
    playCue("quest");
    const timer = setTimeout(tutorial.clearFinished, QUEST_BANNER_MS);
    return () => clearTimeout(timer);
    // Only when it finishes: clearFinished is a new function every render.
  }, [tutorial.finished]);
  useWakeLock();
  const open = useRef({ panel, menu, upgrade });
  open.current = { panel, menu, upgrade };
  const toggle = (next: Panel) => {
    setPanel((p) => (p === next ? null : next));
  };
  const menuItems: readonly { id: string; label: string; key: string; code: string; act: () => void; on: boolean }[] = [
    { id: "map", label: t("menu.map"), key: "N", code: "KeyN", act: () => toggle("map"), on: panel === "map" },
    ...(owned ? [] : [{
      id: "upgrade", label: t("menu.upgrade"), key: "V", code: "KeyV",
      act: () => setUpgrade({ kind: "menu" }), on: upgrade !== null,
    }]),
    { id: "ranking", label: t("menu.ranking"), key: "O", code: "KeyO", act: () => toggle("ranking"), on: panel === "ranking" },
    { id: "quests", label: t("menu.quests"), key: "L", code: "KeyL", act: () => toggle("quests"), on: panel === "quests" },
    { id: "skills", label: t("menu.skills"), key: "K", code: "KeyK", act: () => toggle("skills"), on: panel === "skills" },
    { id: "forge", label: t("menu.forge"), key: "U", code: "KeyU", act: () => toggle("smith"), on: panel === "smith" },
    { id: "bag", label: t("menu.bag"), key: "I", code: "KeyI", act: () => toggle("bag"), on: panel === "bag" },
    { id: "sleep", label: t("menu.sleep"), key: "B", code: "KeyB", act: () => setSaving((on) => !on), on: saving },
    {
      id: "menu", label: t("menu.settings"), key: "P", code: "KeyP",
      act: () => setMenu((m) => !m),
      on: menu,
    },
  ];
  // The locked portal you are standing at, if any: the key handler below is bound once, so it reads
  // this rather than closing over the HUD.
  const lockedPortal = useRef<string | null>(null);
  lockedPortal.current = hud?.portal?.locked ? hud.portal.to : null;

  // C opens the channel list, like tapping the zone's name at the top.
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  // J does what tapping the quest does: go after its monsters, or (done) report it to the elder.
  const questAct = useRef(() => {});
  questAct.current = () => {
    if (tutorialStep.current === 0) {
      view.current?.goToElder();
      return;
    }
    const quest = bag ? QUESTS[bag.quest.index] : undefined;
    if (!bag || !quest) return;
    if (!questDone(bag.quest)) view.current?.seekQuest(quest.targets);
    else view.current?.goToElder();
  };
  // A clicked button lets go of the focus at once, or Space (jump) and Enter (chat) would press it again.
  useEffect(() => {
    const release = (e: MouseEvent) => {
      const button = (e.target as HTMLElement | null)?.closest?.("button");
      if (!button) return;
      button.blur();
      // A click for buttons in panels; the menu's own buttons sound as their panels open and close.
      if (!button.closest(".hud-menu-buttons, .pad-buttons, .hud-skills")) playCue("click");
    };
    document.addEventListener("click", release);
    return () => document.removeEventListener("click", release);
  }, []);
  // Panels open and close with a sound.
  const hadPanel = useRef(false);
  useEffect(() => {
    const open = panel !== null || menu;
    if (open !== hadPanel.current) playCue(open ? "open" : "close");
    hadPanel.current = open;
  }, [panel, menu]);
  const keys = useRef(menuItems);
  keys.current = menuItems;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.key === "Escape") {
        if (open.current.upgrade) setUpgrade(null);
        else if (open.current.menu) setMenu(false);
        else if (open.current.panel) setPanel(null);
        else setMenuOpen(false);
        return;
      }
      if (e.code === "KeyM") {
        setMenuOpen((o) => !o);
        return;
      }
      if (e.code === "KeyJ") {
        questAct.current();
        return;
      }
      if (e.code === "KeyC") {
        toggleRef.current("channels");
        return;
      }
      // E at a locked portal: nobody is there to talk to, so it opens what the portal asks for.
      if (e.code === "KeyE" && lockedPortal.current) {
        setUpgrade({ kind: "portal", zone: lockedPortal.current });
        return;
      }
      keys.current.find((item) => item.code === e.code)?.act();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Bought: the panel has done its work and steps aside.
  useEffect(() => {
    if (owned) setUpgrade(null);
  }, [owned]);

  // The free fields stop at FREE_UNTIL, so the moment a character reaches it is the moment to say
  // what lies past it — once per character, kept in this browser. A character that was already past
  // it when it first got here (another machine, cleared storage, or a level earned before any of
  // this shipped) is told plainly instead of congratulated on a level it passed long ago.
  const level = hud?.level ?? 0;
  const wasUnder = useRef<boolean | null>(null);
  useEffect(() => {
    if (owned || level === 0) return;
    const under = level < FREE_UNTIL;
    const climbed = wasUnder.current === true && !under;
    wasUnder.current = under;
    if (under || shown.current) return;
    const key = `groveHunters.upgradeShown.${client.account}.${name}`;
    shown.current = true;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, String(level));
    } catch {
      // A browser that will not keep it: the ref above still holds it to this one session.
    }
    setUpgrade(climbed ? { kind: "level", level } : { kind: "menu" });
  }, [owned, level, client, name]);

  const showProblem = problem && now - problem.at < PROBLEM_MS;
  return (
    <div className="app" ref={host}>
      <div className="ui">
      {!ready && <div className="overlay">{t("world.loading", { n: Math.round(progress * 100) })}</div>}
      {travelling && <div className="overlay">{t("world.travelling")}</div>}
      {hud && (
        <>
          {view.current && <TouchStick controls={view.current.controls} look={touch} />}
          <div className="hud-left">
            <button type="button" className="hud-top band hud-channel" onClick={() => toggle("channels")} title={t("channel.title")}>
              <b>{hud.zone}</b>
              <span>{t("world.channel", { n: hud.channel })}</span>
              {keyHints && <kbd className="hud-key">C</kbd>}
            </button>
            <div className="hud-vitals">
              <div className="hud-vitals-row">
                <b>Lv {hud.level}</b>
                <span>{Math.ceil(hud.hp)} / {hud.maxHp}</span>
                {hud.gain !== null && <em className="hud-gain">+{hud.gain} XP</em>}
              </div>
              <div className="hud-bar hp"><i style={{ width: `${Math.round((hud.hp / hud.maxHp) * 100)}%` }} /></div>
              <div className="hud-bar xp"><i style={{ width: `${Math.round((hud.xpInto / hud.xpNeed) * 100)}%` }} /></div>
            </div>
          </div>
          {!saving && <MinimapCorner zone={hud.zoneId} me={hud.me} />}
          <div className={`hud-menu-buttons${menuOpen ? " open" : ""}`}>
            {menuOpen && menuItems.map((item) => (
              <button key={item.id} type="button" className={`hud-icon-button${item.on ? " on" : ""}${glow === "skills" && item.id === "skills" ? " tutorial-glow" : ""}`} onClick={item.act}>
                {iconFor(`ui_${item.id}`) && <img src={iconFor(`ui_${item.id}`)!} alt="" draggable={false} />}
                <span>{item.label}</span>
                {keyHints && <kbd className="hud-key">{item.key}</kbd>}
              </button>
            ))}
            <button type="button" className={`hud-icon-button${menuOpen ? " on" : ""}${glow === "fold" ? " tutorial-glow" : ""}`} onClick={() => setMenuOpen((o) => !o)}>
              <img src={iconFor("ui_more") ?? undefined} alt="" draggable={false} />
              <span>{t("common.menu")}</span>
              {keyHints && <kbd className="hud-key">M</kbd>}
            </button>
          </div>
          {hud.notes.length > 0 && (
            <div className="hud-notes">
              {hud.notes.map((text, i) => <span key={i} className="band">{text}</span>)}
            </div>
          )}
          {hud.npc && !hud.portal && (
            <div className="hud-prompt band">{t("world.talk", { name: hud.npc.name, role: hud.npc.role })}</div>
          )}
          {hud.portal && (
            hud.portal.locked
              ? (
                <button
                  type="button" className="hud-prompt band locked-portal"
                  onClick={() => setUpgrade({ kind: "portal", zone: hud.portal!.to })}
                >
                  {t("world.portalLocked", { zone: hud.portal.to, how: touch ? t("world.portalLocked.tap") : "(E)" })}
                </button>
              )
              : (
                <div className="hud-prompt band">
                  {hud.portal.needLevel
                    ? t("world.portalLevel", { zone: hud.portal.to, n: hud.portal.needLevel })
                    : t("world.portalTo", { zone: hud.portal.to })}
                </div>
              )
          )}
          {showProblem && <div className="hud-error band">{problem.text}</div>}
          {hud.blocking && <div className="hud-shield band">{t("world.blocking")}</div>}
          {hud.target && (
            <div className="hud-target band">
              <b>{hud.target.name}</b>
              <div className="hud-bar hp"><i style={{ width: `${Math.round((hud.target.hp / hud.target.maxHp) * 100)}%` }} /></div>
            </div>
          )}
          {view.current && (
            <PadButtons
              controls={view.current.controls} auto={hud.auto} talkTo={hud.npc?.name ?? null}
              onJump={() => view.current?.tapJump()} onAuto={() => view.current?.toggleAuto()} onTalk={() => view.current?.talk()}
              keys={keyHints} glowAuto={glow === "auto"}
            />
          )}
          <SkillBar hud={hud} playerClass={playerClass} job={bag?.job ?? null} onSkill={(slot) => view.current?.tapSkill(slot)} onPotion={() => view.current?.tapPotion()}
            glow={glow === "slot0" || glow === "bar" ? glow : null}
          />
          {/* The side panels sit where the tracker is; it steps aside while one is open. */}
          {panel !== "quests" && panel !== "skills" && (
            tutorial.step !== null ? (
              <TutorialTracker
                step={tutorial.step} glow={glow} keyLabel={keyHints ? "J" : null}
                onWalk={() => view.current?.goToElder()}
              />
            ) : (
              <QuestTracker
                bag={bag} seeking={hud.seeking} way={hud.way} inVillage={inVillage} keyLabel={keyHints ? "J" : null}
                onSeek={(types) => view.current?.seekQuest(types)} onReport={() => view.current?.goToElder()}
              />
            )
          )}
          <ChatBox client={client} keyHints={keyHints} />
          {hud.hurt > 0 && <div className="hud-hurt" style={{ opacity: hud.hurt }} />}
          {saving && (
            <PowerSaveScreen
              client={client} hud={hud} bag={bag} onWake={() => setSaving(false)}
            />
          )}
          {hud.dead && (
            <DeathPanel client={client} level={hud.level} lostXp={hud.lostXp} gold={bag?.gold ?? null} travelling={travelling} />
          )}
        </>
      )}
      {menu && <SettingsPanel onClose={() => setMenu(false)} onExit={onExit} />}
      {panel === "bag" && (
        <BagPanel
          client={client} bag={bag} inVillage={inVillage} playerClass={playerClass} level={hud?.level ?? 1}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "shop" && <ShopPanel client={client} bag={bag} onClose={() => setPanel(null)} />}
      {panel === "smith" && <SmithPanel client={client} bag={bag} onClose={() => setPanel(null)} />}
      {panel === "channels" && (
        <ChannelPanel
          client={client} world={readChannelRoom(entry.roomId)?.world ?? ""} friends={friends}
          onProblem={onProblem} onClose={() => setPanel(null)}
        />
      )}
      {panel === "skills" && <SkillPanel
        playerClass={playerClass} job={bag?.job ?? null} level={hud?.level ?? 1} tutorial={tutorial.step} onPlaced={tutorial.placed}
        onClose={() => setPanel(null)}
      />}
      {panel === "quests" && (
        <QuestLog
          bag={bag} inVillage={inVillage}
          onSeek={(types) => view.current?.seekQuest(types)} onReport={() => view.current?.goToElder()}
          onClaimDaily={(id) => client.claimDaily(id)} onClose={() => setPanel(null)}
        />
      )}
      {finished !== null && QUESTS[finished] && (
        <QuestCompleteBanner index={finished} inVillage={inVillage} onClose={() => setFinished(null)} />
      )}
      {tutorial.finished && <TutorialDoneBanner onClose={tutorial.clearFinished} />}
      {panel === "quest" && (
        <QuestPanel client={client} bag={bag} onSeek={(types) => view.current?.seekQuest(types)} onClose={() => setPanel(null)} />
      )}
      {upgrade && (
        <UpgradePanel
          reason={upgrade} offer={purchase.offer} state={purchase.state} onBuy={purchase.buy}
          onClose={() => setUpgrade(null)}
        />
      )}
      {panel === "map" && hud && (
        <MapPanel
          zone={hud.zoneId} me={hud.me} onClose={() => setPanel(null)}
          onWalk={(spot) => {
            if (spot.npc) view.current?.walkToNpc(spot.npc);
            else view.current?.walkToSpot(spot);
          }}
        />
      )}
      {panel === "ranking" && <RankingPanel
        account={client.account} load={() => client.ranking()} loadDetail={(id) => client.rankDetail(id)} onClose={() => setPanel(null)}
      />}
      </div>
    </div>
  );
}
