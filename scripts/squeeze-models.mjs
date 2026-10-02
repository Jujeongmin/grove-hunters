/**
 * Shrinks the models already in public/assets/models, in place (their sources, art-src/_glb, are not
 * in the repo, so optimize-models.mjs cannot be run again):
 *   - the static (unskinned) ones are quantized like the skinned ones already are: positions 14 bits,
 *     normals 10, texture coordinates 12. They are drawn instanced with each mesh's world matrix
 *     (staticBatch.ts, lodBatch.ts), which carries the dequantizing transform this adds.
 *   - the castle tower's textures go down to 128 px: it only ever stands far off (vista.ts).
 *   - the village houses lose a third of their triangles by shape alone, the surface kept within 0.4%
 *     of the model's size (a few centimetres on a house); more would flatten the roof tiles' steps.
 *   - the commonest trees lose about 60%: their normals and texture coordinates count too, so the
 *     simplifier may cross the hard edges of these low-poly models without tearing shading or texture,
 *     the surface kept within 1.5% (leaf cards stay whole; trunks and branches get coarser). Larger
 *     budgets, or the castle tower (many small separate stones), visibly break.
 * Each step runs only on a model that has not had it (positions still floats; a marker in the file's
 * extras), so running it again changes nothing.
 * Run it once, look at the zones, and commit the models on develop (game assets live only there).
 *
 *   node scripts/squeeze-models.mjs
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO, Primitive } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { compactPrimitive, dequantize, prune, quantize, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { buildManifest } from "./lib/manifest.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public/assets/models");
// Textures cut down further, by model: only ever seen from far away.
const FAR_TEXTURES = { bld_tower: 128 };
// Triangles cut, by model: the share kept at most, and how far the surface may move (share of size).
// `attributes`: normals and texture coordinates weigh in, and seams may be crossed.
const SIMPLIFY = {
  ...Object.fromEntries(["bld_house_long", "bld_house_tall", "bld_house_small"].map((name) => [name, { ratio: 0.5, error: 0.004 }])),
  ...Object.fromEntries(["sn_tree_1", "sn_tree_2", "sn_tree_3", "sn_tree_4", "sn_pine_1", "sn_pine_3"]
    .map((name) => [name, { error: 0.015, attributes: true }])),
};
const ATTRIBUTE_WEIGHTS = [["NORMAL", 0.5], ["TEXCOORD_0", 2], ["COLOR_0", 1]];

// Simplifies every triangle list, its normals and texture coordinates weighing in (meshopt's
// simplifyWithAttributes, which gltf-transform's simplify() does not use); parts that vanish go.
function simplifyWithAttributes(error) {
  return (doc) => {
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute("POSITION");
      const indices = prim.getIndices();
      if (!indices || prim.getMode() !== Primitive.Mode.TRIANGLES) continue;
      const count = position.getCount();
      const parts = ATTRIBUTE_WEIGHTS.map(([key, weight]) => [prim.getAttribute(key), weight]).filter(([a]) => a);
      const stride = parts.reduce((sum, [a]) => sum + a.getElementSize(), 0);
      const attributes = new Float32Array(count * Math.max(stride, 1));
      const weights = [];
      let offset = 0;
      for (const [a, weight] of parts) {
        const size = a.getElementSize();
        const element = new Array(size);
        for (let i = 0; i < count; i++) attributes.set(a.getElement(i, element), i * stride + offset);
        for (let c = 0; c < size; c++) weights.push(weight);
        offset += size;
      }
      const positions = new Float32Array(count * 3);
      const element = [0, 0, 0];
      for (let i = 0; i < count; i++) positions.set(position.getElement(i, element), i * 3);
      const [kept] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(indices.getArray()), positions, 3,
        attributes, stride, weights, null, 0, error, ["Permissive"]);
      if (kept.length === 0) {
        mesh.removePrimitive(prim);
        prim.dispose();
        continue;
      }
      indices.setArray(count > 65535 ? kept : new Uint16Array(kept));
      compactPrimitive(prim);
    }
  };
}

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
  let quantized = !floats;
  if (SIMPLIFY[name] && !done.has("simplify")) {
    const { attributes, ...options } = SIMPLIFY[name];
    // Simplified in floats (dequantize() is lossless on quantized ones), then quantized again.
    steps.push(dequantize(), weld(), attributes
      ? simplifyWithAttributes(options.error)
      : simplify({ simplifier: MeshoptSimplifier, ...options }), prune());
    quantized = false;
    done.add("simplify");
  }
  // Skinned models were quantized when they were made; doing it twice would only lose precision.
  if (!skinned && !quantized) steps.push(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
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
