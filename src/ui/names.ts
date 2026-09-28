import { ITEMS, type ItemId, type Plus } from "../game/account/items";
import { readWorld } from "../game/account/worlds";
import { JOBS, type JobId } from "../game/combat/jobs";
import type { MonsterType } from "../game/world/monsters";
import type { DailyQuest } from "../game/account/quests";
import { PARTS, type Costume, type PartKey } from "../game/render/costumes";
import type { NpcId } from "../game/world/npcs";
import type { ZoneId } from "../game/world/zones";
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

// A skill by slot, as skillAt reads it: 0 is the class's own, 1 and 2 are the advanced path's.
function skillKey(c: PlayerClass, job: JobId | null, slot: number): string | null {
  if (slot === 0) return key("skill", c, 0);
  return job ? key("skill", job, slot - 1) : null;
}

export function skillName(c: PlayerClass, job: JobId | null, slot: number): string {
  const k = skillKey(c, job, slot);
  return k ? t(k as Key) : "";
}

export function skillBlurb(c: PlayerClass, job: JobId | null, slot: number): string {
  const k = skillKey(c, job, slot);
  return k ? t(`${k}.blurb` as Key) : "";
}

// One of a path's two skills (0 or 1), for showing a path before it is taken.
export function pathSkillName(job: JobId, i: number): string {
  return t(key("skill", job, i));
}

export function pathSkillBlurb(job: JobId, i: number): string {
  return t(key("skill", job, i, "blurb"));
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

export function itemName(id: ItemId): string {
  return t(key("item", id));
}

// What an item is for, read off its own numbers where it has them: a potion says what it gives
// back, gear says what it adds, and a material says where it is found (which is words, not numbers).
export function itemBlurb(id: ItemId): string {
  const item = ITEMS[id];
  if (item.kind === "potion") return t("item.heal", { n: item.heal });
  if (item.kind === "material") return t(key("item", id, "blurb"));
  const parts: string[] = [];
  if (item.power) parts.push(t("stat.power", { n: Math.round(item.power * 100) }));
  if (item.hp) parts.push(t("stat.hp", { n: item.hp }));
  if (item.guard) parts.push(t("stat.guard", { n: Math.round(item.guard * 100) }));
  return parts.join(t("list.join"));
}

export function monsterName(type: MonsterType): string {
  return t(key("monster", type));
}

export function zoneName(id: ZoneId): string {
  return t(key("zone", id));
}

export function npcName(id: NpcId): string {
  return t(key("npc", id));
}

export function npcRole(id: NpcId): string {
  return t(key("npc", id, "role"));
}

// A server is the game's name and a number: 초록숲-1, Grove-1, みどり森-1.
export function worldName(number: number): string {
  return `${t("world.name")}-${number}`;
}

// A server as it arrives from the server, which sends its id.
export function serverName(id: string): string {
  const world = readWorld(id);
  return world ? worldName(world.number) : id;
}

// A piece of gear's name with its +, as the screens show it.
export function gearName(id: ItemId, plus: Plus = {}): string {
  const n = plus[id] ?? 0;
  return n > 0 ? `+${n} ${itemName(id)}` : itemName(id);
}

// A quest is known by where it stands in the village's list; a daily one by its own id.
export function questName(index: number): string {
  return t(key("quest", index));
}

export function questGoal(index: number): string {
  return t(key("quest", index, "goal"));
}

export function dailyName(quest: DailyQuest): string {
  return t(key("daily", quest.id));
}

export function dailyGoal(quest: DailyQuest): string {
  return t(key("daily", quest.id, "goal"));
}

// What a part of a look is called, and what each of its options is. The table itself is colours and
// flags; the words sit here, named after the part and the place the option holds in it.
const PART_LABEL: Record<PartKey, Key> = {
  gear: "part.gear", clothColor: "part.clothColor", skin: "part.skin", weaponColor: "part.weaponColor",
};
const SKIN_NAMES: Key[] = ["look.default", "look.skinLight", "look.skinTan", "look.skinDark"];

export function partLabel(part: PartKey): string {
  return t(PART_LABEL[part]);
}

export function partOptionName(part: PartKey, index: number): string {
  if (part === "gear") return t(index === 0 ? "look.on" : "look.off");
  if (part === "skin") return t(SKIN_NAMES[index] ?? "look.default");
  // The colour parts: the pack's own, five dyes, then the one without colour at all.
  if (index === 0) return t("look.default");
  if (index === PARTS[part].options.length - 1) return t("look.grey");
  return t("look.dye", { n: index });
}

// The three ready-made looks have names; anything the player put together is their own.
const PRESET_NAMES: Key[] = ["look.default", "look.preset.light", "look.preset.shadow"];

export function costumeName(costume: Costume, presets: readonly Costume[]): string {
  const made = presets.findIndex((c) => c.id === costume.id);
  return made >= 0 ? t(PRESET_NAMES[made] ?? "look.mine") : t("look.mine");
}
