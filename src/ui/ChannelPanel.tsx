import { useEffect, useState } from "react";
import { t } from "./lang";
import type { FriendsView } from "../game/account/friends";
import { CHANNEL_CAPACITY } from "../game/world/zones";
import type { WorldClient } from "../net/worldClient";

// While open, the counts are read again this often.
const REFRESH_MS = 5000;

interface ChannelPanelProps {
  client: WorldClient;
  // Your server, for telling which of your friends are on it.
  world: string;
  friends: FriendsView | null;
  onProblem: (code: string) => void;
  onClose: () => void;
}

// Changing channel, as in MapleStory: every channel of your server with how many play on it and
// which of your friends are there, and a move to any that has room. You land where you stand.
export function ChannelPanel({ client, world, friends, onProblem, onClose }: ChannelPanelProps) {
  const [list, setList] = useState<{ current: number; players: number[] } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    const read = () => void client.channels().then((next) => live && next && setList(next));
    read();
    const timer = window.setInterval(read, REFRESH_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [client]);

  const friendsOn = (channel: number) =>
    (friends?.friends ?? [])
      .filter((f) => f.where?.world === world && f.where.channel === channel)
      .map((f) => f.nickname ?? f.account);

  const move = (channel: number) => {
    setBusy(true);
    void client.changeChannel(channel).then((code) => {
      setBusy(false);
      if (code) onProblem(code);
      else onClose();
    });
  };

  return (
    <div className="menu-modal" onClick={onClose}>
      <div className="solid-panel channel-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("channel.title")}</h2>
        <p className="note">{t("channel.note")}</p>
        {!list ? (
          <p className="note">{t("common.loading")}</p>
        ) : (
          <div className="channel-grid">
            {list.players.map((count, i) => {
              const channel = i + 1;
              const here = channel === list.current;
              const full = count >= CHANNEL_CAPACITY;
              const pals = friendsOn(channel);
              return (
                <button
                  key={channel} type="button"
                  className={`channel-card${here ? " picked" : ""}${full && !here ? " full" : ""}`}
                  disabled={here || full || busy}
                  onClick={() => move(channel)}
                >
                  <b>{t("world.channel", { n: channel })}</b>
                  <span className="channel-count">
                    {here ? t("channel.here") : full ? t("channel.full") : `${count}/${CHANNEL_CAPACITY}`}
                  </span>
                  {pals.length > 0 && <span className="channel-friends">{t("channel.friends", { names: pals.join(t("list.join")) })}</span>}
                </button>
              );
            })}
          </div>
        )}
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}
