import { useState, type FormEvent } from "react";
import { t } from "./lang";
import { serverName, zoneName } from "./names";
import { usePages } from "./Pager";
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

// Rows on one page of a list: as many as the drawer holds on the smallest stage, a location line
// under each name included.
const FRIENDS_PER_PAGE = 5;

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
  // Requests waiting for you open on their own tab first, so none goes unseen.
  const [tab, setTab] = useState<"friends" | "incoming" | "outgoing">(() => ((view?.incoming.length ?? 0) > 0 ? "incoming" : "friends"));
  const friendPage = usePages(friends, FRIENDS_PER_PAGE);
  const incomingPage = usePages(view?.incoming ?? [], FRIENDS_PER_PAGE);
  const outgoingPage = usePages(view?.outgoing ?? [], FRIENDS_PER_PAGE);
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

      {view && (
        <>
          {/* The three lists are tabs, each a page at a time, so the drawer never grows a scroll. */}
          <div className="friend-tabs">
            <button type="button" className={`text-button${tab === "friends" ? " on" : ""}`} onClick={() => setTab("friends")}>
              {t("friends.list")}
            </button>
            <button type="button" className={`text-button${tab === "incoming" ? " on" : ""}`} onClick={() => setTab("incoming")}>
              {t("friends.incoming", { n: view.incoming.length })}
            </button>
            <button type="button" className={`text-button${tab === "outgoing" ? " on" : ""}`} onClick={() => setTab("outgoing")}>
              {t("friends.outgoing")} {view.outgoing.length}
            </button>
          </div>
          {tab === "friends" && (
            <>
              {friends.length === 0 && <p className="note">{t("friends.none")}</p>}
              <ul className="friend-list">
                {friendPage.shown.map((entry) => (
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
              <div className="friend-foot">
                {friends.length > 0 && <span className="note">{t("friends.online", { on: onlineCount, all: friends.length })}</span>}
                {friendPage.pager}
              </div>
            </>
          )}
          {tab === "incoming" && (
            <>
              {view.incoming.length === 0 && <p className="note">{t("friends.noIncoming")}</p>}
              <ul className="friend-list">
                {incomingPage.shown.map((entry) => (
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
              <div className="friend-foot">{incomingPage.pager}</div>
            </>
          )}
          {tab === "outgoing" && (
            <>
              {view.outgoing.length === 0 && <p className="note">{t("friends.noOutgoing")}</p>}
              <ul className="friend-list">
                {outgoingPage.shown.map((entry) => (
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
              <div className="friend-foot">{outgoingPage.pager}</div>
            </>
          )}
        </>
      )}
    </aside>
  );
}
