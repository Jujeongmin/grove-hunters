/**
 * Shrinks the models already in public/assets/models, in place (their sources, art-src/_glb, are not
 * in the repo, so optimize-models.mjs cannot be run again):
 *   - the static (unskinned) ones are quantized like the skinned ones already are: positions 14 bits,
 *     normals 10, texture coordinates 12. They are drawn instanced with each mesh's world matrix
 *     (staticBatch.ts, lodBatch.ts), which carries the dequantizing transform this adds.
 *   - the castle tower's textures go down to 128 px: it only ever stands far off (vista.ts).
 * Run it once, look at the zones, and commit the models on develop (game assets live only there).
 *
 *   node scripts/squeeze-models.mjs
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { quantize, textureCompress } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { buildManifest } from "./lib/manifest.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public/assets/models");
// Textures cut down further, by model: only ever seen from far away.
const FAR_TEXTURES = { bld_tower: 128 };

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const entries = [];
let before = 0;
let after = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".glb")).sort()) {
  const name = basename(file, ".glb");
  const path = join(dir, file);
  const was = statSync(path).size;
  const doc = await io.read(path);
  const skinned = doc.getRoot().listSkins().length > 0;
  const steps = [];
  if (FAR_TEXTURES[name]) steps.push(textureCompress({ encoder: sharp, targetFormat: "webp", resize: [FAR_TEXTURES[name], FAR_TEXTURES[name]] }));
  // Skinned models were quantized when they were made; doing it twice would only lose precision.
  if (!skinned) steps.push(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  if (steps.length > 0) {
    await doc.transform(...steps);
    doc
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    await io.write(path, doc);
  }
  const now = statSync(path).size;
  before += was;
  after += now;
  entries.push({ name, bytes: now, animations: doc.getRoot().listAnimations().map((a) => a.getName()) });
  if (now !== was) console.log(`${name}: ${Math.round(was / 1024)} KB -> ${Math.round(now / 1024)} KB`);
}
writeFileSync(join(dir, "manifest.json"), JSON.stringify(buildManifest(entries), null, 2) + "\n");
console.log(`all models: ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB`);
