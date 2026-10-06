import type { GameServer } from "@agent8/gameserver";
import { withTimeout } from "./linkWatch";
import type { CallOptions, MatchTransport, RoomUser } from "./transport";

// A call the server never answers gives up after this long, so nothing waits on it for ever (the
// slowest real calls take a lock or two: a few seconds).
const CALL_TIMEOUT_MS = 15_000;

export type Verse8Server = Pick<
  GameServer,
  "account" | "remoteFunction" | "subscribeRoomState" | "subscribeRoomAllUserStates" | "onRoomMessage" | "subscribeGlobalMyState"
>;

// The SDK counts each room subscription so it asks the room only once, and wipes the counts whenever
// the room connection is remade. Letting go of one made before the wipe then leaves its count below
// zero, and the next subscription to it is never asked for (no room state, no players): those are
// put back to none.
function mendCounts(server: Verse8Server): void {
  const counts = (server as { rsSubscribeCount?: Record<string, number> }).rsSubscribeCount;
  if (!counts) return;
  for (const key of Object.keys(counts)) if (counts[key] < 0) delete counts[key];
}

// Room joins go through the useGameServer hook, so its store tracks the room and reconnects to it.
export interface RoomControl {
  joinRoom(roomId: string): Promise<void>;
  leaveRoom(): void;
}

export class Verse8Transport implements MatchTransport {
  private readonly links = new Set<(connected: boolean, roomId: string | null) => void>();

  constructor(private readonly server: Verse8Server, private readonly rooms: RoomControl) {}

  // Told by the app (from the SDK's store) whenever the room connection changes.
  roomLink(connected: boolean, roomId: string | null): void {
    for (const cb of this.links) cb(connected, roomId);
  }

  onRoomLink(cb: (connected: boolean, roomId: string | null) => void): () => void {
    this.links.add(cb);
    return () => {
      this.links.delete(cb);
    };
  }

  get account(): string {
    return this.server.account;
  }

  call<T = unknown>(name: string, args: unknown[] = [], options: CallOptions = {}): Promise<T> {
    return withTimeout(this.server.remoteFunction(name, args, options) as Promise<T>, CALL_TIMEOUT_MS);
  }

  subscribeRoomState(roomId: string, cb: (state: Record<string, unknown>) => void): () => void {
    const off = this.server.subscribeRoomState(roomId, cb);
    return () => {
      off();
      mendCounts(this.server);
    };
  }

  subscribeRoomUsers(roomId: string, cb: (users: RoomUser[]) => void): () => void {
    const off = this.server.subscribeRoomAllUserStates(roomId, cb);
    return () => {
      off();
      mendCounts(this.server);
    };
  }

  onRoomMessage(roomId: string, type: string, cb: (message: unknown) => void): () => void {
    return this.server.onRoomMessage(roomId, type, cb);
  }

  subscribeMyState(cb: (state: Record<string, unknown>) => void): () => void {
    return this.server.subscribeGlobalMyState(cb);
  }

  joinRoom(roomId: string): Promise<void> {
    return this.rooms.joinRoom(roomId);
  }

  leaveRoom(): void {
    this.rooms.leaveRoom();
  }
}
