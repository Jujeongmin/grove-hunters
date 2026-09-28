import { PARTY_MAX, type Activity, type PartyView } from "../game/account/party";
import { t, type Key } from "../ui/lang";
import { COSTUMES, costumeById, type Costume } from "../game/render/costumes";
import { classForSeat, readClass, type PlayerClass } from "../game/combat/classes";
import { errorCode } from "./errors";
import type { MatchTransport } from "./transport";

const PROBLEMS = [
  "not_friends", "party_full", "already_in_party", "no_invite", "not_leader", "party_busy",
] as const;

export function partyProblem(error: unknown): string {
  const code = errorCode(error);
  return (PROBLEMS as readonly string[]).includes(code)
    ? t(`problem.${code}` as Key, { n: PARTY_MAX })
    : t("problem.retryLater");
}

// Your party and invites, refreshed whenever the server changes them and on every sync().
export class PartyClient {
  view: PartyView | null = null;
  private readonly listeners = new Set<(view: PartyView) => void>();
  private unsubscribe: (() => void) | null = null;
  private seen = "";
  private disposed = false;
  private activity: Activity = "menu";

  constructor(private readonly transport: MatchTransport) {}

  async start(): Promise<void> {
    this.unsubscribe = this.transport.subscribeMyState((state) => {
      const seen = JSON.stringify([state.party ?? null, state.partyInvites ?? null]);
      if (seen === this.seen) return;
      this.seen = seen;
      void this.sync().catch(() => undefined);
    });
    await this.sync();
  }

  async sync(): Promise<void> {
    const view = await this.transport.call<PartyView>("syncParty", [this.activity]);
    if (this.disposed) return;
    this.view = view;
    for (const listener of this.listeners) listener(view);
  }

  onChange(listener: (view: PartyView) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Tells the party whether you are on the menu or out in the world.
  async setActivity(activity: Activity): Promise<void> {
    if (activity === this.activity) return;
    this.activity = activity;
    await this.sync();
  }

  async invite(account: string): Promise<void> {
    await this.transport.call("inviteToParty", [account]);
  }

  async accept(from: string): Promise<void> {
    await this.transport.call("acceptPartyInvite", [from]);
  }

  async decline(from: string): Promise<void> {
    await this.transport.call("declinePartyInvite", [from]);
  }

  async leave(): Promise<void> {
    await this.transport.call("leaveParty");
  }

  async kick(account: string): Promise<void> {
    await this.transport.call("kickFromParty", [account]);
  }


  dispose(): void {
    this.disposed = true;
    this.unsubscribe?.();
    this.listeners.clear();
  }
}

// Who stands in the menu scene: you first (with your local look), then the rest of the party.
export function partyLineup(
  me: { account: string; name: string; costume: Costume; playerClass: PlayerClass },
  view: PartyView | null,
): { name: string; costume: Costume; playerClass: PlayerClass; isYou: boolean }[] {
  const others = (view?.party?.members ?? []).filter((m) => m.account !== me.account);
  return [
    { name: me.name, costume: me.costume, playerClass: me.playerClass, isYou: true },
    ...others.map((m, i) => ({
      name: m.nickname ?? m.account,
      costume: costumeById(m.costume) ?? COSTUMES[0],
      playerClass: readClass(m.playerClass) ?? classForSeat(i + 1),
      isYou: false,
    })),
  ];
}
