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

// Room joins go through the useGameServer hook, so its store tracks the room and reconnects to it.
export interface RoomControl {
  joinRoom(roomId: string): Promise<void>;
  leaveRoom(): void;
}

export class Verse8Transport implements MatchTransport {
  constructor(private readonly server: Verse8Server, private readonly rooms: RoomControl) {}

  get account(): string {
    return this.server.account;
  }

  call<T = unknown>(name: string, args: unknown[] = [], options: CallOptions = {}): Promise<T> {
    return withTimeout(this.server.remoteFunction(name, args, options) as Promise<T>, CALL_TIMEOUT_MS);
  }

  subscribeRoomState(roomId: string, cb: (state: Record<string, unknown>) => void): () => void {
    return this.server.subscribeRoomState(roomId, cb);
  }

  subscribeRoomUsers(roomId: string, cb: (users: RoomUser[]) => void): () => void {
    return this.server.subscribeRoomAllUserStates(roomId, cb);
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
