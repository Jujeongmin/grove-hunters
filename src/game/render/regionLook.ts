import type { Region } from "../world/zones";
import { GROVE_NATURE, SNOW_NATURE, type NatureStyle } from "../rules/nature";

// How a region looks: the ground's colours (the photos under them only lend light and shade, see
// groundTextures.ts), the haze, the light, and what grows. The grove is sunlit grass under broad-
// leaved trees; the snow region is snowfield and grey stone under dark pines, in a cold blue haze.
export interface RegionLook {
  // The open ground: its lighter and deeper patches and its dried ones; the floor under the trees; the
  // paths.
  meadow: number;
  deep: number;
  dry: number;
  forest: number;
  dirt: number;
  fog: number;
  // The sky's light from above and the ground's from below.
  hemiSky: number;
  hemiGround: number;
  nature: NatureStyle;
  // The kinds of tree the far forest is drawn with (see treeSprites.ts).
  farTrees: readonly string[];
  // Whether the far castle and the world tree stand on the horizon (the grove's own landmarks).
  landmarks: boolean;
}

export const GROVE_LOOK: RegionLook = {
  meadow: 0x8fb35a, deep: 0x6a9444, dry: 0xb0ac5e, forest: 0x4f6e32, dirt: 0x9a7d52, fog: 0xa5a4a1,
  hemiSky: 0xe6f2ff, hemiGround: 0x5b6b34, nature: GROVE_NATURE,
  farTrees: ["sn_tree_1", "sn_tree_2", "sn_tree_3", "sn_tree_4", "sn_pine_1"], landmarks: true,
};

export const SNOW_LOOK: RegionLook = {
  meadow: 0xeef3f8, deep: 0xd3dde8, dry: 0xf7f9fb, forest: 0x7d8b96, dirt: 0x9ba6b0, fog: 0xc8d4df,
  hemiSky: 0xeaf2ff, hemiGround: 0x9aa8b4, nature: SNOW_NATURE, farTrees: ["sn_pine_1"], landmarks: false,
};

export function lookOf(region: Region): RegionLook {
  return region === "snow" ? SNOW_LOOK : GROVE_LOOK;
}
