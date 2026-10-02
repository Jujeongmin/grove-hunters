import { Suspense, lazy, useEffect, useRef, useState, type MutableRefObject } from "react";
import { combatPowerAt } from "../game/combat/power";
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
import { ZoneTitle } from "./ZoneTitle";
import { BagPanel, ShopPanel, problemText } from "./BagPanel";
import { QuestTracker } from "./QuestTracker";
import { TUTORIAL, tutorialGlow } from "../game/account/tutorial";
import { startBarEmpty } from "./settings";
import type { QuestTrip } from "../game/world/questRoute";
import { useTutorial } from "./useTutorial";
import { TutorialDoneBanner, TutorialTracker } from "./TutorialTracker";
import { SkillBar } from "./SkillBar";
import { PadButtons, TouchStick, isTouchDevice } from "./TouchControls";
import { SkillPanel } from "./SkillPanel";
import { RankingPanel } from "./RankingPanel";
import { iconFor, setIconClass } from "../game/render/icons";
import { DialogueBox } from "./DialogueBox";
import { GrovePanel } from "./GrovePanel";
import { NewsPanel } from "./NewsPanel";
import { MailPanel } from "./MailPanel";
import type { RewardsTab } from "./RewardsPanel";
// Screens opened now and then, fetched the first time they are (the stable brings its own 3D stage).
const MountPanel = lazy(() => import("./MountPanel").then((m) => ({ default: m.MountPanel })));
const MarketPanel = lazy(() => import("./MarketPanel").then((m) => ({ default: m.MarketPanel })));
const GuildPanel = lazy(() => import("./GuildPanel").then((m) => ({ default: m.GuildPanel })));
const RewardsPanel = lazy(() => import("./RewardsPanel").then((m) => ({ default: m.RewardsPanel })));
import { PartyFrame, PartyInviteBanner, PartyPanel } from "./PartyPanel";
import { PARTY_POLL_IDLE_MS, PARTY_POLL_MS, type PartyState } from "../game/account/party";
import { DungeonHud, DungeonMatchBanner, DungeonPanel } from "./DungeonPanel";
import { DUNGEON_POLL_MS, type DungeonView } from "../game/world/dungeon";
import { ArenaHud } from "./ArenaHud";
import { AnnounceBanner } from "./AnnounceBanner";
import { unseenNews } from "../game/news";
import { DonatePanel } from "./DonatePanel";
import { hazeHint, weekOf, type GroveView } from "../game/world/grove";
import type { NpcId } from "../game/world/npcs";
import { MapPanel, MinimapCorner } from "./Minimap";
import { locale, t } from "./lang";
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
  // Your friends, for the channel list to show who is on which.
  friends: FriendsView | null;
  // Out to your characters, or all the way to the title.
  onExit: () => void;
  onTitle: () => void;
}

// Why a portal turned you away. The codes the server sends for travel are its own, so they are
// named here rather than shared with the bag's.
const TRAVEL_PROBLEM: Record<string, Key> = {
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
export function WorldScreen({ client, playerClass, costume, name, friends, onExit, onTitle }: WorldScreenProps) {
  // Weapons are drawn as this character's class wields them, in every panel below (see icons.ts).
  setIconClass(playerClass);
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
      friends={friends}
      travelling={state.phase === "travelling"}
      bag={state.bag}
      problem={problem}
      trip={trip}
      onProblem={(code) => setProblem({ text: t(TRAVEL_PROBLEM[code] ?? "problem.cannotTravel"), at: performance.now() })}
      onExit={onExit}
      onTitle={onTitle}
    />
  );
}

// The panels over the world, one at a time.
type Panel = "bag" | "shop" | "smith" | "skills" | "ranking" | "quests" | "map" | "channels" | "grove" | "donate" | "mounts" | "news" | "mail" | "market" | "guild" | "rewards" | "party" | "dungeon";

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
// How often the grove is read again while you play.
const GROVE_REFRESH_MS = 60_000;
// How often the mailbox is counted again while you play.
const MAIL_REFRESH_MS = 120_000;
// How long the haze's hint stays up unless tapped.
const HAZE_HINT_MS = 12_000;
// How long a refused portal's message stays up.
const PROBLEM_MS = 3000;

function ZoneScreen({
  entry, client, playerClass, costume, name, friends, travelling, bag, problem, trip, onProblem, onExit, onTitle,
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
  // Whom you are talking to: the HUD steps aside for their words while the camera is at their face.
  const [talkingTo, setTalkingTo] = useState<NpcId | null>(null);
  // The server's grove and village, read on coming in and every minute (the grove panel, the gifts to
  // the village and how the world looks).
  const [grove, setGrove] = useState<GroveView | null>(null);
  const [groveFailed, setGroveFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () => void client.grove().then((next) => {
      if (!live) return;
      if (next) setGrove(next);
      else setGroveFailed(true);
    });
    load();
    const timer = setInterval(load, GROVE_REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [client]);
  // The world shows the grove too (the sites, the flowers, the haze), once it is drawn.
  useEffect(() => view.current?.setGrove(grove), [grove, ready]);
  // Once a week while the haze stands, a line on coming in says why and how far the week has got
  // (a new player would not know); a tap opens the grove.
  const [haze, setHaze] = useState<number | null>(null);
  const hazeTold = useRef(false);
  useEffect(() => {
    if (!ready || !grove || hazeTold.current) return;
    hazeTold.current = true;
    const key = `groveHunters.hazeShown.${client.account}`;
    const week = weekOf(Date.now());
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(key);
    } catch {
      // A browser that will not keep it tells you again next time.
    }
    const n = hazeHint(grove, seen, week);
    if (n === null) return;
    try {
      window.localStorage.setItem(key, week);
    } catch {
      // As above.
    }
    setHaze(n);
  }, [ready, grove, client]);
  const hazeUp = haze !== null;
  useEffect(() => {
    if (!hazeUp) return;
    const timer = setTimeout(() => setHaze(null), HAZE_HINT_MS);
    return () => clearTimeout(timer);
  }, [hazeUp]);

  useEffect(() => {
    const next = new WorldView(host.current!, client, {
      entry, playerClass, costume, name,
      trip: trip.current,
      onTrip: (next) => {
        trip.current = next;
      },
      onProgress: (done, total) => setProgress(done / total),
      onTalk: (id) => {
        // The elder's lesson in the first tutorial: the server checks you are by the elder.
        if (id === "elder" && tutorialStep.current === 0) void client.tutorialTalk();
        setPanel(null);
        setMenuOpen(false);
        setTalkingTo(id);
        view.current?.beginDialogue(id);
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
    // The ride button with no mount opens the stable, where eggs hatch for gems.
    const offNoMount = next.onNoMount(() => setPanel("mounts"));
    void next.start().then(() => setReady(true));
    return () => {
      off();
      offNoMount();
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
  const tutorial = useTutorial(client, bag, playerClass, hud?.auto ?? false, panel === "skills");
  // A character new to the game finds its bar empty, for the tutorial to have it fill the first slot.
  useEffect(() => {
    if (tutorial.step !== null && tutorial.step <= TUTORIAL.register) startBarEmpty(playerClass);
  }, [tutorial.step, playerClass]);
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
  // Update notices not yet read (a dot on the menu), which open by themselves once a visit when there
  // are any, but never over the first tutorial.
  const [newsUnread, setNewsUnread] = useState(0);
  useEffect(() => {
    let live = true;
    void client.newsSeen().then((seen) => {
      if (live) setNewsUnread(unseenNews(seen));
    });
    return () => {
      live = false;
    };
  }, [client]);
  // Letters waiting in the mailbox, and applications waiting on your guild (dots on the menu),
  // counted on coming in and every minute.
  const [mailWaiting, setMailWaiting] = useState(0);
  // Achievements waiting to be claimed (counted with the mail), and today's attendance sheet stamped but
  // not yet looked at. The sheet is stamped as the world is entered, so it is asked once the world is
  // ready; it opens by itself, and the news waits for the answer to open after it.
  const [claimable, setClaimable] = useState(0);
  const [attendPending, setAttendPending] = useState(false);
  const [attendKnown, setAttendKnown] = useState(false);
  const [rewardsTab, setRewardsTab] = useState<RewardsTab>("attendance");
  // The party and invitations waiting (see party.ts), asked every PARTY_POLL_MS once the world is ready.
  const [party, setParty] = useState<PartyState | null>(null);
  const [answering, setAnswering] = useState(false);
  const [partyNote, setPartyNote] = useState<string | null>(null);
  const pollParty = useRef(() => {});
  pollParty.current = () => {
    void client.partyState().then((next) => {
      if (next) setParty(next);
    });
  };
  const partyBusy = !!party?.party || (party?.invites.length ?? 0) > 0;
  useEffect(() => {
    if (!ready) return;
    pollParty.current();
    const timer = setInterval(() => pollParty.current(), partyBusy ? PARTY_POLL_MS : PARTY_POLL_IDLE_MS);
    return () => clearInterval(timer);
  }, [ready, partyBusy]);
  // The Trial Dungeon: how things stand, asked every DUNGEON_POLL_MS while queued, matched or looking
  // at its screen (asking also works the queue through). A started match you said yes to takes you in.
  const [dungeon, setDungeon] = useState<DungeonView | null>(null);
  const [readying, setReadying] = useState(false);
  const pollDungeon = useRef(() => {});
  pollDungeon.current = () => {
    void client.dungeonState().then((next) => {
      if (next) setDungeon(next);
    });
  };
  const inDungeon = entry.zone === "dungeon";
  // A match your party's leader made shows up in the party's poll.
  const dungeonBusy = !!dungeon?.queued || !!dungeon?.match || panel === "dungeon" || party?.dungeonMatch === true;
  useEffect(() => {
    if (!ready || inDungeon) return;
    pollDungeon.current();
    if (!dungeonBusy) return;
    const timer = setInterval(() => pollDungeon.current(), DUNGEON_POLL_MS);
    return () => clearInterval(timer);
  }, [ready, inDungeon, dungeonBusy]);
  const goingIn = useRef(false);
  useEffect(() => {
    if (inDungeon || goingIn.current || !dungeon?.match?.started || !dungeon.match.ready) return;
    goingIn.current = true;
    setPanel(null);
    void client.enterDungeon().then((problem) => {
      goingIn.current = false;
      if (problem) setPartyNote(problemText(problem));
    });
  }, [dungeon, inDungeon, client]);
  const readyDungeon = async () => {
    setReadying(true);
    const r = await client.dungeonCall("readyDungeon");
    setReadying(false);
    if ("problem" in r) setPartyNote(problemText(r.problem));
    else setDungeon(r);
  };
  const answerInvite = async (id: string, accept: boolean) => {
    setAnswering(true);
    setPartyNote(null);
    // Gone from the banner at once; the next poll shows where things stand.
    setParty((p) => (p ? { ...p, invites: p.invites.filter((i) => i.id !== id) } : p));
    const problem = await client.answerPartyInvite(id, accept);
    setAnswering(false);
    if (problem) setPartyNote(problemText(problem));
    pollParty.current();
  };
  useEffect(() => {
    if (!ready || attendKnown) return;
    let live = true;
    void client.attendance().then((a) => {
      if (!live) return;
      setAttendPending(a !== null && a.stampedToday && !a.seen);
      setAttendKnown(true);
    });
    return () => {
      live = false;
    };
  }, [client, ready, attendKnown]);
  const [applicants, setApplicants] = useState(0);
  const [bossReady, setBossReady] = useState(false);
  useEffect(() => {
    let live = true;
    const count = () => {
      void client.mailCount().then((n) => {
        if (live) setMailWaiting(n);
      });
      void client.achievements().then((a) => {
        if (live && a) setClaimable(a.claimable);
      });
      void client.guildBadge().then((b) => {
        if (!live) return;
        setApplicants(b.applicants);
        setBossReady(b.bossReady);
      });
    };
    count();
    const timer = setInterval(count, MAIL_REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [client]);
  const tutorialOver = bag !== null && bag.tutorial === null;
  useEffect(() => {
    if (!ready || !tutorialOver || !attendPending || client.attendanceShown) return;
    client.attendanceShown = true;
    setRewardsTab("attendance");
    setPanel((p) => p ?? "rewards");
  }, [ready, tutorialOver, attendPending, client]);
  useEffect(() => {
    if (panel !== "rewards") return;
    client.attendanceShown = true;
    setAttendPending(false);
  }, [panel, client]);
  useEffect(() => {
    // Over nothing else: once today's sheet is closed, the news follows.
    if (!ready || !tutorialOver || !attendKnown || attendPending || panel !== null || newsUnread === 0 || client.newsShown) return;
    client.newsShown = true;
    setPanel("news");
  }, [ready, tutorialOver, attendKnown, attendPending, panel, newsUnread, client]);
  useEffect(() => {
    if (panel !== "news") return;
    client.newsShown = true;
    client.markNewsRead();
    setNewsUnread(0);
  }, [panel, client]);
  const open = useRef({ panel, menu, talkingTo });
  open.current = { panel, menu, talkingTo };
  // A talk ends: the camera goes back over your shoulder and the HUD returns.
  const endTalk = () => {
    view.current?.endDialogue();
    setTalkingTo(null);
  };
  const endTalkRef = useRef(endTalk);
  endTalkRef.current = endTalk;
  const toggle = (next: Panel) => {
    setPanel((p) => (p === next ? null : next));
  };
  // Pinned: the ones used most sit beside the menu button, always in reach; the rest fold into it.
  // dot: something new waits behind it.
  const menuItems: readonly {
    id: string; label: string; key: string; code: string; act: () => void; on: boolean; pinned?: boolean; dot?: boolean;
  }[] = [
    { id: "map", label: t("menu.map"), key: "N", code: "KeyN", act: () => toggle("map"), on: panel === "map" },
    { id: "ranking", label: t("menu.ranking"), key: "O", code: "KeyO", act: () => toggle("ranking"), on: panel === "ranking" },
    { id: "quests", label: t("menu.quests"), key: "L", code: "KeyL", act: () => toggle("quests"), on: panel === "quests" },
    { id: "skills", label: t("menu.skills"), key: "K", code: "KeyK", act: () => toggle("skills"), on: panel === "skills" },
    { id: "grove", label: t("menu.grove"), key: "G", code: "KeyG", act: () => toggle("grove"), on: panel === "grove" },
    { id: "forge", label: t("menu.forge"), key: "U", code: "KeyU", act: () => toggle("smith"), on: panel === "smith", pinned: true },
    { id: "bag", label: t("menu.bag"), key: "I", code: "KeyI", act: () => toggle("bag"), on: panel === "bag", pinned: true },
    { id: "mounts", label: t("menu.mounts"), key: "H", code: "KeyH", act: () => toggle("mounts"), on: panel === "mounts", pinned: true },
    { id: "guild", label: t("menu.guild"), key: "Z", code: "KeyZ", act: () => toggle("guild"), on: panel === "guild", dot: applicants > 0 || bossReady },
    { id: "market", label: t("menu.market"), key: "X", code: "KeyX", act: () => toggle("market"), on: panel === "market" },
    { id: "mail", label: t("menu.mail"), key: "F", code: "KeyF", act: () => toggle("mail"), on: panel === "mail", dot: mailWaiting > 0 },
    {
      id: "rewards", label: t("menu.rewards"), key: "V", code: "KeyV",
      act: () => {
        if (panel !== "rewards") setRewardsTab(claimable > 0 && !attendPending ? "achievements" : "attendance");
        toggle("rewards");
      },
      on: panel === "rewards", dot: claimable > 0 || attendPending,
    },
    {
      id: "dungeon", label: t("menu.dungeon"), key: "6", code: "Digit6", act: () => toggle("dungeon"), on: panel === "dungeon",
      dot: !!dungeon?.match && !dungeon.match.ready,
    },
    {
      id: "party", label: t("menu.party"), key: "5", code: "Digit5", act: () => toggle("party"), on: panel === "party",
      dot: (party?.invites.length ?? 0) > 0,
    },
    { id: "news", label: t("menu.news"), key: "Y", code: "KeyY", act: () => toggle("news"), on: panel === "news", dot: newsUnread > 0 },
    { id: "sleep", label: t("menu.sleep"), key: "B", code: "KeyB", act: () => setSaving((on) => !on), on: saving },
    {
      id: "menu", label: t("menu.settings"), key: "P", code: "KeyP",
      act: () => setMenu((m) => !m),
      on: menu,
    },
  ];
  const menuButton = (item: (typeof menuItems)[number]) => (
    <button key={item.id} type="button" className={`hud-icon-button${item.on ? " on" : ""}${glow === "skills" && item.id === "skills" ? " tutorial-glow" : ""}`} onClick={item.act}>
      {iconFor(`ui_${item.id}`) && <img src={iconFor(`ui_${item.id}`)!} alt="" draggable={false} />}
      <span>{item.label}</span>
      {keyHints && <kbd className="hud-key">{item.key}</kbd>}
      {item.dot && <i className="hud-dot" />}
    </button>
  );
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
        if (open.current.talkingTo) endTalkRef.current();
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
      keys.current.find((item) => item.code === e.code)?.act();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showProblem = problem && now - problem.at < PROBLEM_MS;
  return (
    <div className="app" ref={host}>
      <div className="ui">
      {!ready && <div className="overlay">{t("world.loading", { n: Math.round(progress * 100) })}</div>}
      {travelling && <div className="overlay">{t("world.travelling")}</div>}
      {hud && !talkingTo && (
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
                <span className="hud-xp">EXP {(Math.min(1, hud.xpInto / hud.xpNeed) * 100).toFixed(2)}%</span>
                {bag && (
                  <span className="hud-power" title={t("rank.power")}>
                    {t("rank.power")} {combatPowerAt(hud.level, playerClass, bag.gear, bag.job, bag.mount, bag.mountStars, bag.vip).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="hud-bar hp">
                <i style={{ width: `${Math.round((hud.hp / hud.maxHp) * 100)}%` }} />
                <span className="hud-bar-text">{Math.ceil(hud.hp)} / {hud.maxHp}</span>
              </div>
              <div className="hud-bar xp"><i style={{ width: `${Math.round((hud.xpInto / hud.xpNeed) * 100)}%` }} /></div>
            </div>
            {/* Under the vitals in the same column, so a taller vitals box pushes it down, never under. */}
            {!saving && <MinimapCorner zone={hud.zoneId} me={hud.me} bosses={hud.bosses} />}
            {!saving && (
              <PartyFrame
                state={party} me={client.account} others={client.state.others} here={{ zone: hud.zoneId, channel: hud.channel }}
                onOpen={() => toggle("party")}
              />
            )}
          </div>
          {party && party.invites.length > 0 && (
            <PartyInviteBanner invite={party.invites[0]} busy={answering} onAnswer={(accept) => void answerInvite(party.invites[0].id, accept)} />
          )}
          {dungeon?.match && !inDungeon && (
            <DungeonMatchBanner view={dungeon} busy={readying} onReady={() => void readyDungeon()} />
          )}
          {partyNote && <button type="button" className="party-note band" onClick={() => setPartyNote(null)}>{partyNote}</button>}
          {/* The menu sits left of the corner map and unfolds into a grid below itself, so the two
              never cover each other. */}
          <div className={`hud-menu-buttons${menuOpen ? " open" : ""}`}>
            <div className="hud-menu-row">
              {menuItems.filter((item) => item.pinned).map(menuButton)}
              <button type="button" className={`hud-icon-button${menuOpen ? " on" : ""}${glow === "fold" ? " tutorial-glow" : ""}`} onClick={() => setMenuOpen((o) => !o)}>
                <img src={iconFor("ui_more") ?? undefined} alt="" draggable={false} />
                <span>{t("common.menu")}</span>
                {keyHints && <kbd className="hud-key">M</kbd>}
                {!menuOpen && menuItems.some((item) => !item.pinned && item.dot) && <i className="hud-dot" />}
              </button>
            </div>
            {/* The wallet, always in view under the pinned buttons (the unfolded menu goes below it):
                gold opens the bag, gems the stable where they are bought and spent. */}
            {bag && (
              <div className="hud-wallet">
                <button type="button" onClick={() => toggle("bag")} title={t("wallet.gold")}>
                  <img src={iconFor("ui_gold") ?? undefined} alt="" draggable={false} />
                  <b>{bag.gold.toLocaleString(locale())}</b>
                </button>
                <button type="button" className="gems" onClick={() => toggle("mounts")} title={t("wallet.gems")}>
                  <img src={iconFor("ui_gem") ?? undefined} alt="" draggable={false} />
                  <b>{bag.gems.toLocaleString(locale())}</b>
                </button>
              </div>
            )}
            {menuOpen && <div className="hud-menu-grid">{menuItems.filter((item) => !item.pinned).map(menuButton)}</div>}
          </div>
          {hud.notes.length > 0 && (
            <div className="hud-notes">
              {hud.notes.map((text, i) => <span key={i} className="band">{text}</span>)}
            </div>
          )}
          {haze !== null && (
            <button
              type="button" className="hud-haze band"
              onClick={() => {
                setHaze(null);
                setPanel("grove");
              }}
            >
              {t("grove.hazeHint", { n: haze })}
            </button>
          )}
          {keyHints && hud.npc && !hud.portal && (
            <div className="hud-prompt band">{t("world.talk", { name: hud.npc.name, role: hud.npc.role })}</div>
          )}
          {hud.portal && (
            <div className="hud-prompt band">
              {hud.portal.needLevel
                ? t("world.portalLevel", { zone: hud.portal.to, n: hud.portal.needLevel })
                : t("world.portalTo", { zone: hud.portal.to })}
            </div>
          )}
          {showProblem && <div className="hud-error band">{problem.text}</div>}
          {hud.target && (
            <div className="hud-target band">
              <b>{hud.target.name}</b>
              <div className="hud-bar hp"><i style={{ width: `${Math.round((hud.target.hp / hud.target.maxHp) * 100)}%` }} /></div>
            </div>
          )}
          {view.current && (
            <PadButtons
              controls={view.current.controls} auto={hud.auto}
              onJump={() => view.current?.tapJump()} onAuto={() => view.current?.toggleAuto()}
              keys={keyHints} glowAuto={glow === "auto"}
              riding={hud.riding !== null} onRide={() => view.current?.toggleRide()} rollIn={hud.rollIn}
            />
          )}
          <SkillBar hud={hud} playerClass={playerClass} job={bag?.job ?? null} onSkill={(slot) => view.current?.tapSkill(slot)} onPotion={() => view.current?.tapPotion()}
            glow={glow === "slot0" || glow === "bar" ? glow : null}
          />
          {/* The side panels sit where the tracker is; it steps aside while one is open, and while the
              unfolded menu reaches down over it (the tutorial's stays, to say what to press). */}
          {panel !== "quests" && panel !== "skills" && (tutorial.step !== null || !menuOpen) && (
            tutorial.step !== null ? (
              <TutorialTracker
                step={tutorial.step} skillOnBar={tutorial.skillOnBar} glow={glow} keyLabel={keyHints ? "J" : null}
                onWalk={() => view.current?.goToElder()} way={hud.seeking ? hud.way : null}
              />
            ) : (
              <QuestTracker
                bag={bag} seeking={hud.seeking} toElder={hud.toElder} fighting={hud.fighting} way={hud.way} keyLabel={keyHints ? "J" : null}
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
          {entry.zone === "arena" && <ArenaHud client={client} />}
          {inDungeon && <DungeonHud client={client} />}
          <AnnounceBanner client={client} />
          <ZoneTitle entry={entry} />
          {hud.dead && entry.zone !== "arena" && !inDungeon && (
            <DeathPanel client={client} level={hud.level} lostXp={hud.lostXp} gold={bag?.gold ?? null} vip={bag?.vip ?? 0} travelling={travelling} />
          )}
        </>
      )}
      {talkingTo && (
        <DialogueBox
          id={talkingTo} bag={bag} building={grove?.buildings.some((b) => b.state === "building") ?? false}
          onClaim={async () => {
            const code = await client.claimQuest();
            if (!code) endTalk();
            return code;
          }}
          onChoice={(choice) => {
            endTalk();
            const quest = bag ? QUESTS[bag.quest.index] : undefined;
            if (choice === "seek" && quest) view.current?.seekQuest(quest.targets);
            if (choice === "shop") setPanel("shop");
            if (choice === "forge") setPanel("smith");
            if (choice === "donate") setPanel("donate");
          }}
        />
      )}
      {/* Every panel loaded on demand (lazy, above) must be drawn in here: one outside suspends with no
          boundary to catch it, and that takes the whole game down. */}
      <Suspense fallback={null}>
        {panel === "mounts" && (
          <MountPanel
            client={client} library={view.current?.models ?? null} playerClass={playerClass} costume={costume}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === "guild" && <GuildPanel client={client} onBadge={setApplicants} onClose={() => setPanel(null)} />}
        {panel === "market" && <MarketPanel client={client} bag={bag} onClose={() => setPanel(null)} />}
        {panel === "rewards" && <RewardsPanel client={client} tab={rewardsTab} onClaimable={setClaimable} onClose={() => setPanel(null)} />}
      </Suspense>
      {panel === "news" && <NewsPanel onClose={() => setPanel(null)} />}
      {panel === "mail" && <MailPanel client={client} onCount={setMailWaiting} onClose={() => setPanel(null)} />}
      {panel === "dungeon" && (
        <DungeonPanel
          client={client} view={dungeon} partyLeader={party?.party?.leader === client.account} onView={setDungeon} onClose={() => setPanel(null)}
        />
      )}
      {panel === "party" && hud && (
        <PartyPanel
          client={client} state={party} me={client.account} here={{ zone: hud.zoneId, channel: hud.channel }}
          onChanged={() => pollParty.current()} onClose={() => setPanel(null)}
        />
      )}
      {panel === "grove" && <GrovePanel view={grove} failed={groveFailed} onClose={() => setPanel(null)} />}
      {panel === "donate" && grove && (
        <DonatePanel
          view={grove} bag={bag} onClose={() => setPanel(null)}
          onDonate={async (items, gold) => {
            const result = await client.donate(items, gold);
            if (typeof result === "string") return result;
            setGrove(result);
            return null;
          }}
        />
      )}
      {menu && <SettingsPanel onClose={() => setMenu(false)} onExit={onExit} onTitle={onTitle} />}
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
