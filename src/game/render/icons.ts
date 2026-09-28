import { ITEMS } from "../account/items";
import { publicUrl } from "../assets/publicUrl";

// Icons are pictures from the 496 RPG icons pack (Henrique Lazarini, CC0): items one file each under
// assets/ui/items, everything else (skills, menu and pad buttons) under assets/ui/icons. The skills of
// the paths that brought new ones, and the lock, were drawn with PixelLab in that pack's colours.

// Path skills with a picture of their own (path_slot). The other paths took their class's second and
// third skills over, and keep those skills' pictures.
const PATH_ICONS = [
  "guardian_1", "guardian_2", "tracker_1", "tracker_2", "warder_1", "warder_2", "high_priest_1", "paladin_2",
  "scout_1", "scout_2", "iron_monk_1", "iron_monk_2",
];

// The icons under assets/ui/icons, by id: skills (class_slot, path_slot), menu buttons (ui_) and pad
// buttons (pad_).
export const ICON_IDS = [
  "warrior_0", "warrior_1", "warrior_2", "ranger_0", "ranger_1", "ranger_2", "wizard_0", "wizard_1", "wizard_2",
  "cleric_0", "cleric_1", "cleric_2", "rogue_0", "rogue_1", "rogue_2", "monk_0", "monk_1", "monk_2",
  ...PATH_ICONS,
  "ui_ranking", "ui_quests", "ui_skills", "ui_bag", "ui_shop", "ui_menu", "ui_map", "ui_upgrade", "ui_lock",
];
// Older icons with names of their own.
const ICON_FILES: Record<string, string> = {
  ui_forge: "forge.png", ui_more: "menu.png", ui_sleep: "sleep.png",
  pad_attack: "pad_attack.png", pad_block: "pad_block.png", pad_jump: "pad_jump.png", pad_auto: "pad_auto.png", pad_talk: "pad_talk.png",
};

// The icon for a skill (see skillIconId), a menu or pad button, or an item (by id), as an image URL.
export function iconFor(id: string): string | null {
  if (id in ITEMS) return publicUrl(`assets/ui/items/${id}.png`);
  if (ICON_FILES[id]) return publicUrl(`assets/ui/icons/${ICON_FILES[id]}`);
  if (ICON_IDS.includes(id)) return publicUrl(`assets/ui/icons/${id}.png`);
  return null;
}

// The icon for the skill in a slot (see skillAt): the path's own picture where it has one, otherwise
// the class's for that slot.
export function skillIconId(playerClass: string, job: string | null, slot: number): string {
  const own = slot > 0 && job ? `${job}_${slot}` : null;
  return own && PATH_ICONS.includes(own) ? own : `${playerClass}_${slot}`;
}
