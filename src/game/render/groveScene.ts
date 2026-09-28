import * as THREE from "three";
import type { ModelLibrary } from "../assets/ModelLibrary";
import type { LevelLayout } from "../rules/levelLayout";
import { BUILDINGS, type GroveView } from "../world/grove";
import { START_ZONE, type ZoneId } from "../world/zones";
import type { Side } from "../world/fieldMap";
import { createLabel, setLabel } from "./labels";
import { t, type Key } from "../../ui/lang";

// What the grove's week and the village's rebuilding look like (see grove.ts): the four building
// sites in the village (a pile of logs and rocks, a label while one is going up, then the building
// with its top givers' names over it), more flowers once stage 1 is reached, and the haze lifting at
// stage 2.

// A house model's door faces +z (south); a yaw turns it to face its side.
export const HOUSE_YAW: Record<Side, number> = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 };

// Where the grove shows its flowers.
const FLOWER_ZONES: readonly ZoneId[] = ["village", "forest1"];
const FLOWERS = 90;
const FLOWER_MODELS = ["sn_flowers", "sn_bush_flowers"];
// How far the fog lets you see while the grove is still hazy, and once it has cleared (the level's
// usual reach).
const HAZE_FAR = 650;
const CLEAR_FAR = 1100;
// The rubble on a site not yet built: logs and rocks spread over its eight metres, a little larger
// than they stand in the fields.
const RUINS: readonly [string, number, number, number][] = [
  ["pt_logs", -2.2, -1.8, 0.3], ["pt_logs", 1.6, 2.1, 1.9], ["pt_logs", 0.2, 0.1, -0.7],
  ["pt_rock", 2.3, -2.0, 0], ["pt_rock", -2.4, 2.2, 1.2], ["pt_rock", -0.4, -2.9, 2.4],
];
const RUIN_SCALE = 1.4;
// How high the site labels hang (over a two-storey roof).
const LABEL_HEIGHT = 7;

// The models a zone needs for the grove's looks.
export function groveModels(zone: ZoneId): string[] {
  const models = FLOWER_ZONES.includes(zone) ? [...FLOWER_MODELS] : [];
  if (zone === START_ZONE) models.push("pt_logs", "pt_rock", ...new Set(BUILDINGS.map((b) => b.model)));
  return models;
}

export class GroveScene {
  private readonly sites = new THREE.Group();
  private readonly flowers = new THREE.Group();
  // What is on screen, so a view that changed nothing does not rebuild it.
  private shown: string | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly library: ModelLibrary,
    private readonly layout: LevelLayout,
    private readonly zone: ZoneId,
  ) {
    scene.add(this.sites, this.flowers);
    this.plantFlowers();
    this.set(null);
  }

  set(view: GroveView | null): void {
    const key = JSON.stringify(view ? [view.stage, view.buildings.map((b) => [b.state, Math.floor(b.share * 100), b.top])] : null);
    if (key === this.shown) return;
    this.shown = key;
    const stage = view?.stage ?? 0;
    this.flowers.visible = stage >= 1;
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.far = stage >= 2 ? CLEAR_FAR : HAZE_FAR;
    if (this.zone === START_ZONE) this.buildSites(view);
  }

  dispose(): void {
    this.scene.remove(this.sites, this.flowers);
  }

  private buildSites(view: GroveView | null): void {
    this.sites.clear();
    const tile = this.layout.tileSize;
    for (const b of BUILDINGS) {
      // A site is two by two cells, its model standing in the middle of them.
      const at = new THREE.Vector3((b.at[0] + 1) * tile, 0, (b.at[1] + 1) * tile);
      const state = view?.buildings.find((x) => x.id === b.id);
      if (state?.state === "done") {
        const house = this.library.instance(b.model);
        house.position.copy(at);
        house.rotation.y = HOUSE_YAW[b.face];
        this.sites.add(house);
      } else {
        // Ruins over the whole lot, so the blocked ground reads as rubble to clear, not a wall.
        for (const [model, dx, dz, yaw] of RUINS) {
          const piece = this.library.instance(model);
          piece.position.set(at.x + dx, 0, at.z + dz);
          piece.rotation.y = yaw;
          piece.scale.setScalar(RUIN_SCALE);
          this.sites.add(piece);
        }
      }
      const name = t(`grove.building.${b.id}` as Key);
      const text = state?.state === "done"
        ? [name, ...state.top].join(" · ")
        : state?.state === "building" ? `${name} · ${t("grove.building", { n: Math.floor(state.share * 100) })}` : null;
      if (!text) continue;
      const label = createLabel(4);
      setLabel(label, text, "#9dffb0");
      label.position.set(at.x, LABEL_HEIGHT, at.z);
      label.visible = true;
      this.sites.add(label);
    }
  }

  // Flowers scattered over open ground, the same every time (seeded by the map's size).
  private plantFlowers(): void {
    if (!FLOWER_ZONES.includes(this.zone)) return;
    const { cols, rows, tileSize, solid } = this.layout;
    let seed = cols * 131 + rows;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let tries = 0, placed = 0; tries < FLOWERS * 8 && placed < FLOWERS; tries++) {
      const c = Math.floor(random() * cols);
      const r = Math.floor(random() * rows);
      if (solid[r]?.[c]) continue;
      const flower = this.library.instance(FLOWER_MODELS[placed % FLOWER_MODELS.length]);
      flower.position.set((c + random()) * tileSize, 0, (r + random()) * tileSize);
      flower.rotation.y = random() * Math.PI * 2;
      this.flowers.add(flower);
      placed++;
    }
  }
}
