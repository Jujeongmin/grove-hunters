import * as THREE from "three";
import type { ModelLibrary } from "../assets/ModelLibrary";
import type { MonsterType } from "../world/monsters";
import { QUALITY, settings } from "../../ui/settings";
import { MONSTER_SKINS } from "./monsterLooks";
import { clipByName, glowingFlatMaterials, ownMaterials, skinnedHeight } from "./skinned";

// The soul codex's picture of a monster: its own model in its own colours, turning slowly on a dark
// stone; one whose soul was never found stands as a black shadow.
const TURN_RATE = 0.5;

export class MonsterStage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  private readonly turntable = new THREE.Group();
  private body: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private showing = 0;
  private raf = 0;
  private last = performance.now();
  private turn = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly library: ModelLibrary) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[settings().quality].pixelRatio));
    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x201810, 1.7));
    const key = new THREE.DirectionalLight(0xffe2b0, 2.4);
    key.position.set(2.5, 5, 3.5);
    const back = new THREE.DirectionalLight(0x8fb7ff, 0.9);
    back.position.set(-3, 2.5, -3);
    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.3, 0.24, 48), new THREE.MeshStandardMaterial({ color: 0x2c241e, roughness: 0.95 }),
    );
    stone.position.y = -0.12;
    this.scene.add(key, back, stone, this.turntable);
    this.loop();
  }

  // Shows a monster: `known`, in its colours; otherwise as a shadow.
  async show(type: MonsterType, known: boolean): Promise<void> {
    const ticket = ++this.showing;
    const skin = MONSTER_SKINS[type];
    await this.library.preload([skin.model]).catch(() => undefined);
    if (ticket !== this.showing || !this.library.has(skin.model)) return;
    this.clear();
    const body = this.library.instance(skin.model);
    const look = skin.look;
    skinnedHeight(body);
    // Every monster at one size on the stone, the long and the tall alike: its biggest side fits.
    const size = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());
    body.scale.setScalar(1.9 / Math.max(0.01, size.x, size.y, size.z));
    body.rotation.y = look.turn ?? 0;
    // Standing on the stone and turning about its own middle (a flier's model hangs above its root).
    body.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body);
    const middle = box.getCenter(new THREE.Vector3());
    body.position.set(-middle.x, -box.min.y, -middle.z);
    if (!known) {
      // Never found: a black shadow, every surface the same flat dark.
      const shadow = new THREE.MeshBasicMaterial({ color: 0x07070a });
      body.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.material = shadow;
      });
    }
    const lit = known ? ownMaterials(body) : [];
    const flat = known ? glowingFlatMaterials(body) : [];
    if (known && look.tint !== null) {
      const tint = new THREE.Color(look.tint);
      for (const m of lit) m.color.multiply(tint);
      for (const f of flat) f.material.color.multiply(tint);
      if (look.glow) {
        const glow = tint.clone().multiplyScalar(look.glow);
        for (const m of lit) m.emissive.copy(glow);
        for (const f of flat) f.glow.copy(glow);
      }
    }
    this.mixer = new THREE.AnimationMixer(body);
    const clips = this.library.get(skin.model).animations;
    this.mixer.clipAction(clipByName(clips, look.clips.idle)).play();
    this.body = body;
    this.turntable.add(body);
  }

  private clear(): void {
    if (this.body) this.turntable.remove(this.body);
    this.mixer?.stopAllAction();
    this.body = null;
    this.mixer = null;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.clear();
    this.renderer.dispose();
  }

  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    // Room above for wings that beat higher than the model stands.
    this.camera.position.set(0, 1.6, 6.4);
    this.camera.lookAt(0, 1.0, 0);
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.resize();
    this.turn += dt * TURN_RATE;
    this.turntable.rotation.y = this.turn;
    this.mixer?.update(dt);
    this.renderer.render(this.scene, this.camera);
  };
}
