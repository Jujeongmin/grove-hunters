import { ITEMS, slotOf } from "../account/items";
import { publicUrl } from "../assets/publicUrl";
import type { PlayerClass } from "../combat/classes";

// Icons are pictures from the 496 RPG icons pack (Henrique Lazarini, CC0): items one file each under
// assets/ui/items, everything else (skills, menu and pad buttons) under assets/ui/icons. The skills of
// the paths that brought new ones, and the lock, were drawn with PixelLab in that pack's colours.

// Path skills with a picture of their own (path_slot). The other paths took their class's second and
// third skills over, and keep those skills' pictures.
const PATH_ICONS = [
  "guardian_1", "guardian_2", "tracker_1", "tracker_2", "warder_1", "warder_2", "high_priest_1", "paladin_2",
  "scout_1", "scout_2", "iron_monk_1", "iron_monk_2",
  // Every path's fourth skill: its third's picture, gilded (drawn by scripts/fourth-skill-icons.py).
  "berserker_3", "guardian_3", "sniper_3", "tracker_3", "elementalist_3", "warder_3",
  "high_priest_3", "paladin_3", "assassin_3", "scout_3", "fist_master_3", "iron_monk_3",
];

// The icons under assets/ui/icons, by id: skills (class_slot, path_slot), menu buttons (ui_) and pad
// buttons (pad_).
export const ICON_IDS = [
  "warrior_0", "warrior_1", "warrior_2", "ranger_0", "ranger_1", "ranger_2", "wizard_0", "wizard_1", "wizard_2",
  "cleric_0", "cleric_1", "cleric_2", "rogue_0", "rogue_1", "rogue_2", "monk_0", "monk_1", "monk_2",
  ...PATH_ICONS,
  "ui_ranking", "ui_quests", "ui_skills", "ui_bag", "ui_shop", "ui_menu", "ui_map", "ui_upgrade", "ui_lock",
  // Over the elder's head (PixelLab): ! for something to hear, ? for a quest to hand in.
  "marker_quest", "marker_report",
  // The grove panel's menu button (PixelLab).
  "ui_grove",
  // Mounts: the pad's ride button, the mounts panel's menu button, and gems (the pack's paw, open chest
  // and diamond).
  "pad_ride", "ui_mounts", "ui_gem",
  // News, mail, the market and guilds (drawn by scripts/menu-icons.py).
  "ui_news", "ui_mail", "ui_market", "ui_guild",
  // The HUD's gold (drawn by scripts/menu-icons.py too).
  "ui_gold",
  // Attendance and achievements (drawn by scripts/rewards-icon.mjs).
  "ui_rewards", "ui_ticket",
];
// Older icons with names of their own.
const ICON_FILES: Record<string, string> = {
  ui_forge: "forge.png", ui_more: "menu.png", ui_sleep: "sleep.png",
  pad_attack: "pad_attack.png", pad_block: "pad_block.png", pad_jump: "pad_jump.png", pad_auto: "pad_auto.png",
};

// A weapon is one item for every class (the same stats, the same name, traded as one), but it is
// drawn as the looker's own class wields it: a sword for a warrior, a bow for a ranger, and so on.
// The screen sets whose eyes these are (setIconClass) when the world opens; the sword stands for
// everyone before that. Pictures: <weapon id>_<kind>.png, drawn by scripts/weapon-icons.py.
export type WeaponKind = "sword" | "bow" | "staff" | "holy" | "dagger" | "fist";
export const WEAPON_KINDS: Record<PlayerClass, WeaponKind> = {
  warrior: "sword", ranger: "bow", wizard: "staff", cleric: "holy", rogue: "dagger", monk: "fist",
};
let looker: PlayerClass | null = null;

export function setIconClass(playerClass: PlayerClass | null): void {
  looker = playerClass;
}

// The file an item's picture comes from, for a class (or the sword's for none).
export function itemPicture(id: string, playerClass: PlayerClass | null): string {
  const kind = playerClass ? WEAPON_KINDS[playerClass] : "sword";
  return slotOf(id as keyof typeof ITEMS) === "weapon" && kind !== "sword" ? `${id}_${kind}` : id;
}

// The icon for a skill (see skillIconId), a menu or pad button, or an item (by id), as an image URL.
export function iconFor(id: string): string | null {
  if (id in ITEMS) return publicUrl(`assets/ui/items/${itemPicture(id, looker)}.png`);
  if (ICON_FILES[id]) return publicUrl(`assets/ui/icons/${ICON_FILES[id]}`);
  if (ICON_IDS.includes(id)) return publicUrl(`assets/ui/icons/${id}.png`);
  return null;
}

// The icon for the skill in a slot (see skillAt): the path's own picture where it has one, otherwise
// the class's for that slot (the class has three; a fourth slot waiting for its path shows the third's).
export function skillIconId(playerClass: string, job: string | null, slot: number): string {
  const own = slot > 0 && job ? `${job}_${slot}` : null;
  return own && PATH_ICONS.includes(own) ? own : `${playerClass}_${Math.min(slot, 2)}`;
}
