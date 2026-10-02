/**
 * Shrinks the models already in public/assets/models, in place (their sources, art-src/_glb, are not
 * in the repo, so optimize-models.mjs cannot be run again):
 *   - the static (unskinned) ones are quantized like the skinned ones already are: positions 14 bits,
 *     normals 10, texture coordinates 12. They are drawn instanced with each mesh's world matrix
 *     (staticBatch.ts, lodBatch.ts), which carries the dequantizing transform this adds.
 *   - the castle tower's textures go down to 128 px: it only ever stands far off (vista.ts).
 *   - the village houses and the commonest trees lose a third of their triangles, the surface kept
 *     within 0.4% of the model's size (a few centimetres on a house).
 * Each step runs only on a model that has not had it (positions still floats; a marker in the file's
 * extras), so running it again changes nothing.
 * Run it once, look at the zones, and commit the models on develop (game assets live only there).
 *
 *   node scripts/squeeze-models.mjs
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { quantize, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { buildManifest } from "./lib/manifest.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public/assets/models");
// Textures cut down further, by model: only ever seen from far away.
const FAR_TEXTURES = { bld_tower: 128 };
// Triangles cut, by model: the share kept at most, and how far the surface may move (share of size).
const SIMPLIFY = Object.fromEntries([
  "bld_house_long", "bld_house_tall", "bld_house_small", "sn_tree_1", "sn_tree_2", "sn_tree_3", "sn_tree_4", "sn_pine_1", "sn_pine_3",
].map((name) => [name, { ratio: 0.5, error: 0.004 }]));

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
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
  const extras = doc.getRoot().getExtras();
  const done = new Set(Array.isArray(extras.squeezed) ? extras.squeezed : []);
  const floats = doc.getRoot().listAccessors().some((a) => a.getComponentType() === 5126 && a.getType() === "VEC3"
    && a.listParents().some((parent) => parent.propertyType === "Primitive" && parent.getAttribute("POSITION") === a));
  const steps = [];
  if (FAR_TEXTURES[name] && !done.has("textures")) {
    steps.push(textureCompress({ encoder: sharp, targetFormat: "webp", resize: [FAR_TEXTURES[name], FAR_TEXTURES[name]] }));
    done.add("textures");
  }
  if (SIMPLIFY[name] && !done.has("simplify")) {
    steps.push(weld(), simplify({ simplifier: MeshoptSimplifier, ...SIMPLIFY[name] }));
    done.add("simplify");
  }
  // Skinned models were quantized when they were made; doing it twice would only lose precision.
  if (!skinned && floats) steps.push(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  if (steps.length > 0) {
    await doc.transform(...steps);
    doc.getRoot().setExtras({ ...extras, squeezed: [...done, ...(floats || !skinned ? ["quantize"] : [])] });
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
