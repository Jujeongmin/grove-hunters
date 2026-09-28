import { FRIEND_LIMIT, type FriendEntry, type FriendsView } from "../game/account/friends";
import { t, type Key } from "../ui/lang";
import { errorCode } from "./errors";
import type { MatchTransport } from "./transport";

const PROBLEMS = [
  "friend_not_found", "friend_self", "already_friends", "friend_limit", "request_limit", "no_request",
] as const;

export function friendProblem(error: unknown): string {
  const code = errorCode(error);
  return (PROBLEMS as readonly string[]).includes(code)
    ? t(`problem.${code}` as Key, { n: FRIEND_LIMIT })
    : t("problem.retryLater");
}

// Online first, then by name.
export function sortFriends(friends: FriendEntry[]): FriendEntry[] {
  const name = (f: FriendEntry) => f.nickname ?? f.account;
  return [...friends].sort((a, b) => Number(b.online) - Number(a.online) || name(a).localeCompare(name(b), "ko"));
}

// Your friend lists, refreshed whenever the server changes them (a request arrives, someone accepts)
// and on every sync(), which also tells the server you are online.
export class FriendsClient {
  view: FriendsView | null = null;
  private readonly listeners = new Set<(view: FriendsView) => void>();
  private unsubscribe: (() => void) | null = null;
  private lists = "";
  private disposed = false;

  constructor(private readonly transport: MatchTransport) {}

  async start(): Promise<void> {
    this.unsubscribe = this.transport.subscribeMyState((state) => {
      const lists = JSON.stringify(state.friendLists ?? null);
      if (lists === this.lists) return;
      this.lists = lists;
      void this.sync().catch(() => undefined);
    });
    await this.sync();
  }

  async sync(): Promise<void> {
    const view = await this.transport.call<FriendsView>("syncFriends");
    if (this.disposed) return;
    this.view = view;
    for (const listener of this.listeners) listener(view);
  }

  onChange(listener: (view: FriendsView) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async request(nickname: string): Promise<"requested" | "accepted"> {
    return (await this.transport.call<{ status: "requested" | "accepted" }>("requestFriend", [nickname])).status;
  }

  async accept(account: string): Promise<void> {
    await this.transport.call("acceptFriend", [account]);
  }

  // Unfriend, decline their request, or cancel yours.
  async remove(account: string): Promise<void> {
    await this.transport.call("removeFriend", [account]);
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe?.();
    this.listeners.clear();
  }
}
