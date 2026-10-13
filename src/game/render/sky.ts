import * as THREE from "three";
import { publicUrl } from "../assets/publicUrl";

// The sky: a photo of a real sky (Kloppenheim 06, Poly Haven, CC0; tone-mapped and shrunk to
// 2048 x 1024), wrapped round the world as an equirectangular background.

// The colour the sky reaches at the horizon (measured from the photo); the fog fades distant trees
// into it.
export const HORIZON = 0xa5a4a1;

let cached: THREE.Texture | null = null;
const gradients = new Map<string, THREE.Texture>();

// A sky of two colours, from `top` overhead down to `horizon`, and on below it (a region's own sky in
// place of the photo). Null where there is no document (tests).
export function gradientSky(top: number, horizon: number): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const key = `${top}:${horizon}`;
  const known = gradients.get(key);
  if (known) return known;
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const g = canvas.getContext("2d")!;
  const fill = g.createLinearGradient(0, 0, 0, canvas.height);
  const css = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
  fill.addColorStop(0, css(top));
  fill.addColorStop(0.5, css(horizon));
  fill.addColorStop(1, css(horizon));
  g.fillStyle = fill;
  g.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  gradients.set(key, texture);
  return texture;
}

// The sky picture, loading in the background. Null where there is no document (tests).
export function skyTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  if (cached) return cached;
  const texture = new THREE.TextureLoader().load(publicUrl("assets/sky/kloppenheim_06.jpg"));
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  cached = texture;
  return texture;
}
