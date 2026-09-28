import { useState, type FormEvent } from "react";
import { t } from "./lang";
import { serverName, zoneName } from "./names";
import type { FriendEntry, FriendsView } from "../game/account/friends";
import { friendProblem, sortFriends, type FriendsClient } from "../net/friends";

interface FriendsPanelProps {
  onClose: () => void;
  // Null while offline: friends live on the game server.
  client: FriendsClient | null;
  view: FriendsView | null;
  // Friends find you by your character's name, so adding them waits for a character.
  hasCharacter: boolean;
}

function nameOf(entry: FriendEntry): string {
  return entry.nickname ?? t("common.noName");
}

// Right-hand side drawer: add a friend by nickname, answer requests, see who is online.
export function FriendsPanel({
  onClose, client, view, hasCharacter,
}: FriendsPanelProps) {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  // One action at a time; `key` marks which button is working.
  const run = async (key: string, action: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(key);
    setNotice(null);
    try {
      setNotice(await action());
    } catch (error) {
      setNotice(friendProblem(error));
    } finally {
      setBusy(null);
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!client || query.trim() === "") return;
    void run("add", async () => {
      const status = await client.request(query.trim());
      setQuery("");
      return t(status === "accepted" ? "friends.bothWays" : "friends.sent");
    });
  };

  const remove = (entry: FriendEntry) => {
    if (!client) return;
    if (confirming !== entry.account) {
      setConfirming(entry.account);
      return;
    }
    setConfirming(null);
    void run(entry.account, async () => {
      await client.remove(entry.account);
      return null;
    });
  };

  const friends = view ? sortFriends(view.friends) : [];
  const onlineCount = friends.filter((f) => f.online).length;
  return (
    <aside className="friends-panel">
      <header>
        <h2>{t("friends.title")}</h2>
        <button type="button" className="text-button" onClick={onClose}>{t("common.close")}</button>
      </header>
      {client && !hasCharacter && <p className="note">{t("friends.needCharacter")}</p>}
      <form className="friend-add" onSubmit={add}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("friends.search")}
          disabled={!client || !hasCharacter}
        />
        <button type="submit" className="text-button" disabled={!client || !hasCharacter || busy !== null || query.trim() === ""}>{t("common.add")}</button>
      </form>
      {notice && <p className="friend-notice">{notice}</p>}

      {!client && <p className="note">{t("friends.needServer")}</p>}
      {client && !view && <p className="note">{t("friends.loading")}</p>}

      {view && view.incoming.length > 0 && (
        <>
          <h3>{t("friends.incoming", { n: view.incoming.length })}</h3>
          <ul className="friend-list">
            {view.incoming.map((entry) => (
              <li key={entry.account}>
                <span className="friend-name">{nameOf(entry)}</span>
                <button type="button" className="text-button" disabled={busy !== null}
                  onClick={() => void run(entry.account, async () => {
                    await client!.accept(entry.account);
                    return t("friends.nowFriends", { name: nameOf(entry) });
                  })}>{t("common.accept")}</button>
                <button type="button" className="text-button" disabled={busy !== null}
                  onClick={() => void run(entry.account, async () => {
                    await client!.remove(entry.account);
                    return null;
                  })}>{t("common.decline")}</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {view && (
        <>
          <h3>{t("friends.list")} {friends.length > 0 && t("friends.online", { on: onlineCount, all: friends.length })}</h3>
          {friends.length === 0 && <p className="note">{t("friends.none")}</p>}
          <ul className="friend-list">
            {friends.map((entry) => (
              <li key={entry.account} className={entry.online ? "online" : "offline"}>
                <span className="presence" aria-label={t(entry.online ? "friends.isOnline" : "friends.isOffline")} />
                <span className="friend-name">
                  {nameOf(entry)}
                  {entry.where && (
                    <span className="friend-where">
                      {t("friends.where", {
                        server: serverName(entry.where.world),
                        channel: t("world.channel", { n: entry.where.channel }),
                        zone: zoneName(entry.where.zone),
                      })}
                    </span>
                  )}
                </span>
                <button type="button" className="text-button" disabled={busy !== null} onClick={() => remove(entry)}>
                  {t(confirming === entry.account ? "common.removeSure" : "common.remove")}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {view && view.outgoing.length > 0 && (
        <>
          <h3>{t("friends.outgoing")}</h3>
          <ul className="friend-list">
            {view.outgoing.map((entry) => (
              <li key={entry.account}>
                <span className="friend-name">{nameOf(entry)}</span>
                <span className="friend-status">{t("friends.waiting")}</span>
                <button type="button" className="text-button" disabled={busy !== null}
                  onClick={() => void run(entry.account, async () => {
                    await client!.remove(entry.account);
                    return null;
                  })}>{t("common.cancel")}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
