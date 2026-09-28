import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t } from "./lang";
import { publicUrl } from "../game/assets/publicUrl";
import { iconFor } from "../game/render/icons";
import {
  minimapFit, minimapModel, minimapPick, minimapPoint,
  type MinimapFit, type MinimapModel, type MinimapPick,
} from "../game/world/minimap";
import type { NpcId } from "../game/world/npcs";
import type { ZoneId } from "../game/world/zones";
import { npcName, zoneName } from "./names";
import { pointIn } from "./useUiScale";

// The map is drawn from the same pictures the world is: the grass and forest-floor photos that lie
// under the ground, the runed circle that marks a portal, and each villager's own icon. The flat
// colours below only show while a picture is still loading, or if one will not load at all.
const GRASS = publicUrl("assets/ground/aerial_grass_rock.jpg");
const FOREST_FLOOR = publicUrl("assets/ground/forest_floor.jpg");
const MAGIC_CIRCLE = publicUrl("assets/fx/magic_circle.png");
// Each villager's mark is the menu icon of what they keep: the shop, the quests, the forge.
const NPC_ICONS: Record<NpcId, string> = { merchant: "ui_shop", elder: "ui_quests", smith: "ui_forge" };

// The map's own colours, which the photos only light and shade — the same way the ground shader
// treats them in the world, so the map reads as the place you are standing in.
const GROUND = "#4e6236";
const FOREST = "#1e2c17";
const HOUSE = "#4a3320";
const ROOF = "#7a4f33";
const PORTAL = "#7fd4ff";
const NPC = "#9fd6ff";
const ME = "#ffffff";
// How far a ground photo spans on the map, in metres: few enough tiles that its grain reads at both
// the corner map's scale and the big one's.
const METRES_PER_PHOTO = 16;

export interface MinimapPose {
  x: number;
  z: number;
  yaw: number;
}

// Every picture is loaded once and kept. One that will not load stays null and the drawing falls
// back to plain colour, so a missing file never leaves an empty map.
const pictures = new Map<string, HTMLImageElement | null>();
const waiting = new Map<string, Promise<void>>();

function picture(url: string, onReady: () => void): HTMLImageElement | null {
  if (!url) return null;
  if (pictures.has(url)) return pictures.get(url) ?? null;
  if (!waiting.has(url)) {
    waiting.set(url, new Promise<void>((done) => {
      const img = new Image();
      img.onload = () => {
        pictures.set(url, img);
        done();
      };
      img.onerror = () => {
        pictures.set(url, null);
        done();
      };
      img.src = url;
    }));
  }
  void waiting.get(url)!.then(onReady);
  return null;
}

// A photo shrunk to the size it tiles at on the map, so its grain reads instead of turning to mush.
const patterns = new Map<string, CanvasPattern | null>();

function tiled(ctx: CanvasRenderingContext2D, img: HTMLImageElement, px: number): CanvasPattern | null {
  const key = `${img.src}@${Math.round(px)}`;
  const cached = patterns.get(key);
  if (cached !== undefined) return cached;
  const side = Math.max(4, Math.round(px));
  const scratch = document.createElement("canvas");
  scratch.width = side;
  scratch.height = side;
  scratch.getContext("2d")?.drawImage(img, 0, 0, side, side);
  const pattern = ctx.createPattern(scratch, "repeat");
  patterns.set(key, pattern);
  return pattern;
}

// White artwork painted in a colour: the runed circle is white so it can stand for any portal.
const tints = new Map<string, HTMLCanvasElement>();

function tinted(img: HTMLImageElement, color: string, px: number): HTMLCanvasElement {
  const key = `${img.src}@${Math.round(px)}:${color}`;
  const cached = tints.get(key);
  if (cached) return cached;
  const side = Math.max(4, Math.round(px));
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(img, 0, 0, side, side);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, side, side);
  }
  tints.set(key, canvas);
  return canvas;
}

// The zone's ground painted once, at the size it is drawn, and kept until the zone, the size or the
// pictures change: only the marks and the arrow are redrawn as you walk.
const grounds = new Map<string, HTMLCanvasElement>();

function groundCanvas(model: MinimapModel, fit: MinimapFit, dpr: number, onReady: () => void): HTMLCanvasElement {
  const grass = picture(GRASS, onReady);
  const floor = picture(FOREST_FLOOR, onReady);
  const key = `${model.zone}:${Math.round(fit.width)}x${Math.round(fit.height)}@${dpr}:${!!grass}${!!floor}`;
  const cached = grounds.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(fit.width * dpr));
  canvas.height = Math.max(1, Math.round(fit.height * dpr));
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const px = METRES_PER_PHOTO * fit.scale * dpr;
    const cell = model.tileSize * fit.scale * dpr;
    // A hair over a cell, so neighbouring cells meet without a seam.
    const over = cell + 1;
    // All the cells of one kind as a single shape: filled in one pass, so the overlap that hides the
    // seams between them is never composited twice (which would draw a bright grid over the map).
    const shape = (kind: "ground" | "forest" | "house") => {
      const path = new Path2D();
      for (let r = 0; r < model.rows; r++) {
        for (let c = 0; c < model.cols; c++) if (model.cells[r][c] === kind) path.rect(c * cell, r * cell, over, over);
      }
      return path;
    };
    const shapes = { ground: shape("ground"), forest: shape("forest"), house: shape("house") };
    const fill = (kind: "ground" | "forest" | "house", paint: string | CanvasPattern) => {
      ctx.fillStyle = paint;
      ctx.fill(shapes[kind]);
    };
    // The photo lays its light and dark over the colour, keeping the meadow green and the wood dark,
    // exactly as the ground shader does with the same pictures underfoot.
    const grain = (kind: "ground" | "forest" | "house", base: string, img: HTMLImageElement | null) => {
      fill(kind, base);
      const pattern = img && tiled(ctx, img, px);
      if (!pattern) return;
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.6;
      fill(kind, pattern);
      ctx.restore();
    };
    grain("ground", GROUND, grass);
    grain("forest", FOREST, floor);
    // A house is a roof seen from above, not ground: a flat span with a lip of shade along its eaves.
    fill("house", ROOF);
    const eaves = new Path2D();
    for (let r = 0; r < model.rows; r++) {
      for (let c = 0; c < model.cols; c++) {
        if (model.cells[r][c] === "house") eaves.rect(c * cell, r * cell + cell * 0.66, over, cell * 0.34 + 1);
      }
    }
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = HOUSE;
    ctx.fill(eaves);
    ctx.restore();
  }
  grounds.set(key, canvas);
  return canvas;
}

interface MinimapProps {
  zone: ZoneId;
  me: MinimapPose;
  // The box the map is drawn in, in CSS pixels.
  width: number;
  height: number;
  // The big map names the portals and the villagers; the corner one has no room for it.
  labels?: boolean;
  // Tapping the map.
  onPick?: (pick: MinimapPick) => void;
}

// The zone from above, north up: the ground and the wood as they are underfoot, the village's roofs,
// the portals' circles, the villagers, and an arrow for you, pointing where you look.
export function Minimap({ zone, me, width, height, labels = false, onPick }: MinimapProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Bumped when a picture finishes loading, to draw the map again with it.
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let live = true;
    const again = () => {
      if (live) setLoaded((n) => n + 1);
    };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.max(1, Math.round(width * dpr));
    el.height = Math.max(1, Math.round(height * dpr));
    const model = minimapModel(zone);
    const fit = minimapFit(model, width, height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(groundCanvas(model, fit, dpr, again), fit.left, fit.top, fit.width, fit.height);

    const mark = labels ? 26 : 13;
    ctx.font = `600 11px "Gowun Dodum", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const circle = picture(MAGIC_CIRCLE, again);
    for (const m of model.marks) {
      const at = minimapPoint(fit, m);
      // The corner map is too small for an icon to read, so only the big one carries them.
      const icon = labels && m.npc ? picture(iconFor(NPC_ICONS[m.npc]) ?? "", again) : null;
      if (m.kind === "portal" && circle) {
        // A portal sits on the zone's edge, where half its circle would be cut off, so the drawing
        // (not the place it stands for) is nudged back inside the map.
        const size = mark * 1.5;
        const x = Math.min(Math.max(at.x - size / 2, fit.left), fit.left + fit.width - size);
        const y = Math.min(Math.max(at.y - size / 2, fit.top), fit.top + fit.height - size);
        ctx.drawImage(tinted(circle, PORTAL, size * 2), x, y, size, size);
      } else if (icon) {
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 4;
        ctx.drawImage(icon, at.x - mark / 2, at.y - mark / 2, mark, mark);
        ctx.restore();
      } else {
        ctx.fillStyle = m.kind === "portal" ? PORTAL : NPC;
        ctx.beginPath();
        ctx.arc(at.x, at.y, labels ? 6 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!labels) continue;
      const label = m.npc ? npcName(m.npc) : m.to ? zoneName(m.to) : "";
      // A mark at the zone's edge would have its name hang off the map, so the name slides back in.
      const half = ctx.measureText(label).width / 2 + 2;
      const x = Math.min(Math.max(at.x, fit.left + half), fit.left + fit.width - half);
      ctx.fillStyle = m.kind === "portal" ? "#ffe0b0" : "#e6f3ff";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
      ctx.lineWidth = 3;
      ctx.strokeText(label, x, at.y - mark / 2 - 2);
      ctx.fillText(label, x, at.y - mark / 2 - 2);
    }

    // You: an arrowhead pointing the way you look. Turning the canvas by -yaw sends its tip, drawn
    // straight up, along minimapHeading(yaw).
    const at = minimapPoint(fit, me);
    const arm = labels ? 11 : 7;
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(-me.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -arm);
    ctx.lineTo(-arm * 0.6, arm * 0.7);
    ctx.lineTo(0, arm * 0.3);
    ctx.lineTo(arm * 0.6, arm * 0.7);
    ctx.closePath();
    ctx.fillStyle = ME;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    return () => {
      live = false;
    };
  }, [zone, me.x, me.z, me.yaw, width, height, labels, loaded]);

  const pick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPick) return;
    const model = minimapModel(zone);
    const fit = minimapFit(model, width, height);
    const hit = minimapPick(model, fit, pointIn(e.currentTarget, e.clientX, e.clientY), labels ? 16 : 8);
    if (hit) onPick(hit);
  };

  return (
    <canvas
      ref={canvas} className={`minimap-canvas${onPick ? " pickable" : ""}`} style={{ width, height }}
      onClick={onPick ? pick : undefined}
    />
  );
}

const CORNER = 132;

// The little map in the corner, always there while you play.
export function MinimapCorner({ zone, me }: { zone: ZoneId; me: MinimapPose }) {
  return (
    <div className="minimap">
      <Minimap zone={zone} me={me} width={CORNER} height={CORNER} />
    </div>
  );
}

interface MapPanelProps {
  zone: ZoneId;
  me: MinimapPose;
  // Somewhere on the map was tapped: walk there, or to the villager tapped.
  onWalk: (pick: MinimapPick) => void;
  onClose: () => void;
}

// The whole zone, opened with N: the same map drawn large, with the portals and the villagers named.
// Tapping a place you can stand on closes the map and walks you there.
export function MapPanel({ zone, me, onWalk, onClose }: MapPanelProps) {
  // The sheet is sized by the stage, which is itself sized by the window, so the map is measured
  // rather than fixed: a small window gets a small map, not one hanging over the edge.
  const area = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="map-panel" role="dialog" onClick={onClose}>
      <div className="map-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{zoneName(zone)}</h2>
        <div className="map-area" ref={area}>
          {box && (
            <Minimap
              zone={zone} me={me} width={box.width} height={box.height} labels
              onPick={(hit) => {
                onWalk(hit);
                if (hit.open) onClose();
              }}
            />
          )}
        </div>
        <p className="note">
          {t("map.tapToWalk")}
          <i className="map-key portal" /> {t("map.portals")}
          <i className="map-key npc" /> {t("map.villagers")}
          <i className="map-key me" /> {t("map.you")}
        </p>
        <button type="button" className="text-button" onClick={onClose}>{t("map.close")}</button>
      </div>
    </div>
  );
}
