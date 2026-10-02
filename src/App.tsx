import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useGameServer } from "@agent8/gameserver";
import { readClass } from "./game/combat/classes";
import { COSTUMES, costumeById } from "./game/render/costumes";
import { loadRankDetail, loadRanking, loadWorldLoads } from "./net/account";
import { Verse8Transport } from "./net/verse8Transport";
import { devLocalTransport } from "./net/devLocal";
import { syncControls } from "./net/controlsSync";
import { WorldClient } from "./net/worldClient";
import { Lobby } from "./ui/Lobby";
import { WorldScreen } from "./ui/WorldScreen";
import { useAccount } from "./ui/useAccount";
import { useFriends } from "./ui/useFriends";
import { useShop } from "./ui/useShop";
import { useKeyboardFreeze } from "./ui/useKeyboardFreeze";
import { useUiScale } from "./ui/useUiScale";
import { t, useLang } from "./ui/lang";

const ONLINE_AVAILABLE = Boolean(import.meta.env.VITE_AGENT8_VERSE);
// The model gallery (development only, ?gallery): loaded only then, so it and its orbit controls stay
// out of the game's bundle.
const GALLERY = import.meta.env.DEV && new URLSearchParams(window.location.search).has("gallery");
const ModelGallery = GALLERY ? lazy(() => import("./ui/ModelGallery").then((m) => ({ default: m.ModelGallery }))) : null;
const DEV_LOCAL = devLocalTransport();

export default function App() {
  const [inWorld, setInWorld] = useState(false);
  const [returning, setReturning] = useState(false);
  const { server, connected, joinRoom, leaveRoom } = useGameServer();
  useUiScale();
  useKeyboardFreeze();
  // Read so the whole tree says itself again when the language changes.
  useLang();
  const transport = useMemo(
    () => DEV_LOCAL ?? (ONLINE_AVAILABLE && connected ? new Verse8Transport(server, { joinRoom, leaveRoom }) : null),
    [connected, server, joinRoom, leaveRoom],
  );
  const { view, failed, pickWorld, checkName, create, select, remove, refresh } = useAccount(transport);
  useShop(transport);
  const friends = useFriends(transport);
  const world = useMemo(() => (transport ? new WorldClient(transport) : null), [transport]);

  // The bar's set-up follows the account.
  useEffect(() => (transport ? syncControls(transport) : undefined), [transport]);

  // Losing the server takes you back to the menu.
  useEffect(() => {
    if (!world) setInWorld(false);
  }, [world]);

  const rotate = <div className="rotate-hint">{t("rotate.hint")}</div>;
  if (ModelGallery) return <Suspense fallback={null}><ModelGallery /></Suspense>;
  const active = view?.active ?? null;
  if (inWorld && world && view && active) {
    return (
      <>
        {rotate}
        <WorldScreen
          client={world}
          playerClass={readClass(active.playerClass) ?? "warrior"}
          costume={costumeById(active.costume) ?? COSTUMES[0]}
          name={active.name}
          friends={friends.view}
          onExit={() => {
            setInWorld(false);
            setReturning(true);
            void refresh();
          }}
        />
      </>
    );
  }
  return (
    <>
      {rotate}
      <Lobby
        account={transport?.account ?? (connected ? server.account : "")}
        view={view}
        accountFailed={failed}
        online={!!transport}
        onPickWorld={pickWorld}
        checkName={checkName}
        onCreate={create}
        onSelect={select}
        onDelete={remove}
        loadRanking={transport ? () => loadRanking(transport) : null}
        loadWorldLoads={transport ? () => loadWorldLoads(transport) : null}
        loadRankDetail={transport ? (id) => loadRankDetail(transport, id) : null}
        friends={friends.client}
        friendsView={friends.view}
        onStart={() => setInWorld(true)}
        returning={returning && !!view}
      />
    </>
  );
}
