import * as THREE from "three";

// Frost over what grows and lies about (a region's look, the snow's): each material's colour is mixed
// toward the frost's, `base` of the way everywhere and `top` more on faces turned up to the sky, where
// snow would settle. Done in the shader, so a textured pine still shows its needles under the white.
export interface Frost { color: number; base: number; top: number }

// The library's materials are shared by every zone: a frosted one is a copy, made once per material.
const copies = new WeakMap<THREE.Material, THREE.Material>();

function addFrost(material: THREE.Material, frost: Frost, lit: boolean): void {
  const color = new THREE.Color(frost.color);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.frostColor = { value: color };
    shader.uniforms.frostBase = { value: frost.base };
    shader.uniforms.frostTop = { value: frost.top };
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      "uniform vec3 frostColor;\nuniform float frostBase;\nuniform float frostTop;\nvoid main() {",
    );
    shader.fragmentShader = lit
      // After the normal is known, before the lights take the colour.
      ? shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        "#include <normal_fragment_maps>\n{\n  vec3 upView = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);\n"
          + "  float up = clamp(dot(normal, upView), 0.0, 1.0);\n"
          + "  diffuseColor.rgb = mix(diffuseColor.rgb, frostColor, clamp(frostBase + frostTop * up, 0.0, 1.0));\n}",
      )
      // A picture (the far forest's cards) has no faces to turn up: half the settled frost all over.
      : shader.fragmentShader.replace(
        "#include <map_fragment>",
        "#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, frostColor, clamp(frostBase + frostTop * 0.5, 0.0, 1.0));",
      );
  };
  material.customProgramCacheKey = () => `frost:${lit}:${frost.color}:${frost.base}:${frost.top}`;
}

// The frosted copy of a model's material (lit materials only; others are left as they are).
export function frostedMaterial(material: THREE.Material, frost: Frost): THREE.Material {
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;
  let copy = copies.get(material);
  if (!copy) {
    copy = material.clone();
    addFrost(copy, frost, true);
    copies.set(material, copy);
  }
  return copy;
}

export function frostedMaterials(material: THREE.Material | THREE.Material[], frost: Frost | undefined): THREE.Material | THREE.Material[] {
  if (!frost) return material;
  return Array.isArray(material) ? material.map((m) => frostedMaterial(m, frost)) : frostedMaterial(material, frost);
}

// Frosts a picture's own material in place (the far cards: each made for its forest).
export function frostPicture(material: THREE.MeshBasicMaterial, frost: Frost | undefined): THREE.MeshBasicMaterial {
  if (frost) addFrost(material, frost, false);
  return material;
}
