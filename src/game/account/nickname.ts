import type { CharacterView } from "./characters";
import type { LevelView } from "./level";

import { RuleViolation } from "../world/types";
import { isBannedName } from "./profanity";

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;
// Composed Hangul syllables only, so lone jamo like "ㅋㅋ" do not count.
const ALLOWED = /^[0-9A-Za-z_가-힣]+$/;

export interface Nickname {
  name: string;
  // Case-insensitive form; no two accounts may share one.
  key: string;
}

export function parseNickname(raw: unknown): Nickname {
  if (typeof raw !== "string") throw new RuleViolation("nickname_invalid");
  const name = raw.normalize("NFC").trim();
  const length = [...name].length;
  if (length < NICKNAME_MIN || length > NICKNAME_MAX || !ALLOWED.test(name)) {
    throw new RuleViolation("nickname_invalid");
  }
  return { name, key: name.toLowerCase() };
}

// A name for a new character: as parseNickname, and with no banned word in it (see profanity.ts).
// Names already given are only read with parseNickname, so they can still be found and freed.
export function parseNewNickname(raw: unknown): Nickname {
  const nickname = parseNickname(raw);
  if (isBannedName(nickname.name)) throw new RuleViolation("name_banned");
  return nickname;
}

export interface AccountView {
  account: string;
  // The server picked when you last started (see worlds.ts); null if you never picked one.
  world: string | null;
  // Your characters on that server, and the one you play (null until you pick or make one).
  characters: CharacterView[];
  active: CharacterView | null;
  // The active character, spelled out for the menus; null and level 1 without one.
  nickname: string | null;
  xp: number;
  level: LevelView;
  playerClass: string | null;
  costume: string | null;
}
