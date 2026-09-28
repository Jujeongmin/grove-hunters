/**
 * Cuts the menu pieces (Dark UI Kit brush shapes) out of the Unity Asset Store UI pack into public/assets/ui (webp).
 * The results are store assets, so they are git-ignored like the models.
 *
 *   node scripts/extract-ui.mjs
 */
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packs = join(process.env.UNITY_PROJECT ?? resolve(root, "../My project"), "Assets/Resources");
const outDir = join(root, "public/assets/ui");
mkdirSync(outDir, { recursive: true });

const GRUNGE = join(packs, "kΩsmaragd/Dark Buttons/dark-Buttons.png");

// [left, top, width, height] in the source image; each cut is trimmed to its visible pixels.
const CUTS = [
  { out: "grunge_band", src: GRUNGE, box: [1040, 30, 780, 280], width: 640 },
  { out: "grunge_frame", src: GRUNGE, box: [60, 580, 670, 380], width: 560 },
];

// A cut can catch a speck of the next shape on the sheet. Stretched over a button, that speck shows
// as a stray mark under it (the band's did). Everything outside the bounds of the largest shape —
// the brush stroke itself — is cleared; the spray along the stroke's own edge stays.
function dropStrays(data, width, height) {
  const alpha = (i) => data[i * 4 + 3] > 8;
  const label = new Int32Array(width * height).fill(-1);
  const sizes = [];
  for (let start = 0; start < width * height; start++) {
    if (label[start] !== -1 || !alpha(start)) continue;
    const id = sizes.length;
    const queue = [start];
    label[start] = id;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const x = i % width;
      for (const n of [i - 1, i + 1, i - width, i + width]) {
        if (n < 0 || n >= width * height || (n === i - 1 && x === 0) || (n === i + 1 && x === width - 1)) continue;
        if (label[n] === -1 && alpha(n)) {
          label[n] = id;
          queue.push(n);
        }
      }
    }
    sizes.push(queue.length);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  let [x0, y0, x1, y1] = [width, height, 0, 0];
  for (let i = 0; i < width * height; i++) {
    if (label[i] !== main) continue;
    const x = i % width, y = Math.floor(i / width);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  for (let i = 0; i < width * height; i++) {
    const x = i % width, y = Math.floor(i / width);
    if (x < x0 || x > x1 || y < y0 || y > y1) data[i * 4 + 3] = 0;
  }
}

for (const cut of CUTS) {
  const [left, top, width, height] = cut.box;
  const piece = await sharp(cut.src).extract({ left, top, width, height }).png().toBuffer();
  const { data, info } = await sharp(piece).trim().resize({ width: cut.width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  dropStrays(data, info.width, info.height);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 88 }).toFile(join(outDir, `${cut.out}.webp`));
  console.log(cut.out);
}
