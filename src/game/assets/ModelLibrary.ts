import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { publicUrl } from "./publicUrl";

// With the cache on, textures in dungeon-warden arrived with no image data.
THREE.Cache.enabled = false;

interface ManifestEntry { url: string; bytes: number; animations: string[] }
interface ModelManifest { models: Record<string, ManifestEntry> }
export interface LoadedModel { scene: THREE.Group; animations: THREE.AnimationClip[] }

// One library for the whole visit: a model fetched once (in any zone, or for the stable) stays for
// the next zone rather than being fetched and parsed again. A failed manifest is asked for again.
let shared: Promise<ModelLibrary> | null = null;

export class ModelLibrary {
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private readonly loaded = new Map<string, LoadedModel>();
  private readonly coming = new Map<string, Promise<LoadedModel>>();

  private constructor(private readonly manifest: ModelManifest) {}

  static load(): Promise<ModelLibrary> {
    shared ??= (async () => {
      const res = await fetch(publicUrl("assets/models/manifest.json"));
      if (!res.ok) throw new Error(`model manifest: HTTP ${res.status}`);
      return new ModelLibrary((await res.json()) as ModelManifest);
    })().catch((error: unknown) => {
      shared = null;
      throw error;
    });
    return shared;
  }

  async preload(names: string[], onProgress?: (done: number, total: number) => void): Promise<void> {
    let done = 0;
    onProgress?.(0, names.length);
    await Promise.all(
      names.map(async (name) => {
        if (!this.loaded.has(name)) {
          // Two asking for one model at once (a zone and the stable's warm-up) share the one fetch.
          let coming = this.coming.get(name);
          if (!coming) {
            coming = this.fetchModel(name).finally(() => this.coming.delete(name));
            this.coming.set(name, coming);
          }
          this.loaded.set(name, await coming);
        }
        onProgress?.(++done, names.length);
      }),
    );
  }

  // Every model the game has (the manifest's).
  names(): string[] {
    return Object.keys(this.manifest.models);
  }

  has(name: string): boolean {
    return this.loaded.has(name);
  }

  get(name: string): LoadedModel {
    const model = this.loaded.get(name);
    if (!model) throw new Error(`model not preloaded: ${name}`);
    return model;
  }

  instance(name: string): THREE.Object3D {
    return cloneSkinned(this.get(name).scene);
  }

  private async fetchModel(name: string): Promise<LoadedModel> {
    const entry = this.manifest.models[name];
    if (!entry) throw new Error(`model not in manifest: ${name}`);
    const gltf = await this.loader.loadAsync(publicUrl(entry.url));
    return { scene: gltf.scene, animations: gltf.animations };
  }
}
