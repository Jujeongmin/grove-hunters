import type { AccountView } from "../game/account/nickname";
import { t, type Key } from "../ui/lang";
import type { RankDetail, RankingView } from "../game/account/ranking";
import { errorCode } from "./errors";
import type { MatchTransport } from "./transport";

const PROBLEMS = ["nickname_taken", "nickname_invalid", "character_limit"] as const;

export function loadAccount(transport: MatchTransport): Promise<AccountView> {
  return transport.call<AccountView>("getAccount");
}

export function saveWorld(transport: MatchTransport, world: string): Promise<AccountView> {
  return transport.call<AccountView>("setWorld", [world]);
}

// Whether a name is free for a new character.
export async function nameFree(transport: MatchTransport, name: string): Promise<boolean> {
  return (await transport.call<{ free: boolean }>("checkName", [name])).free;
}

export function createCharacter(transport: MatchTransport, name: string, playerClass: string, costume: string): Promise<AccountView> {
  return transport.call<AccountView>("createCharacter", [name, playerClass, costume]);
}

export function selectCharacter(transport: MatchTransport, id: string): Promise<AccountView> {
  return transport.call<AccountView>("selectCharacter", [id]);
}

// What to show when making a character fails.
export function nicknameProblem(error: unknown): string {
  const code = errorCode(error);
  return (PROBLEMS as readonly string[]).includes(code) ? t(`problem.${code}` as Key) : t("problem.saveFailed");
}

export function loadRanking(transport: MatchTransport): Promise<RankingView> {
  return transport.call<RankingView>("getRanking");
}

export function loadRankDetail(transport: MatchTransport, id: string): Promise<RankDetail> {
  return transport.call<RankDetail>("getRankDetail", [id]);
}
