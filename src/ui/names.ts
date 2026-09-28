import { JOBS, type JobId } from "../game/combat/jobs";
import type { PlayerClass } from "../game/combat/classes";
import { t } from "./lang";
import type { Key } from "./strings/ko";

// The names the game's own things go by, in the language in play. The tables themselves carry only
// numbers and ids — the server reads them too, and it has no language — so the words live in the
// bundles and are looked up by id here.
//
// The keys are built from ids, which no type can check for us; a line missing from every bundle
// shows as its own key rather than as nothing, so a gap is loud (see t()).
const key = (...parts: (string | number)[]) => parts.join(".") as Key;

export function className(c: PlayerClass): string {
  return t(key("class", c));
}

export function classBlurb(c: PlayerClass): string {
  return t(key("class", c, "blurb"));
}

export function weaponName(c: PlayerClass): string {
  return t(key("weapon", c));
}

export function skillName(c: PlayerClass, slot: number): string {
  return t(key("skill", c, slot));
}

export function skillBlurb(c: PlayerClass, slot: number): string {
  return t(key("skill", c, slot, "blurb"));
}

export function jobName(id: JobId): string {
  return t(key("job", id));
}

// What an advanced class gives, read off its own numbers rather than written out per path, so the
// words cannot drift from what the game actually hands over.
export function jobBlurb(id: JobId): string {
  const job = JOBS[id];
  const parts: string[] = [];
  if (job.power) parts.push(t("stat.power", { n: Math.round(job.power * 100) }));
  if (job.hp) parts.push(t("stat.hp", { n: job.hp }));
  if (job.guard) parts.push(t("stat.guard", { n: Math.round(job.guard * 100) }));
  if (job.heal) parts.push(t("stat.heal", { n: Math.round(job.heal * 100) }));
  return parts.join(t("list.join"));
}

// A job as it arrives from the room state, which carries the id. Older rooms carried the Korean
// name instead; that is shown as it came rather than as a missing key.
export function jobLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return value in JOBS ? jobName(value as JobId) : value;
}
