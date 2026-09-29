import * as THREE from "three";
import type { ModelLibrary } from "../assets/ModelLibrary";
import { MOUNTS, type MountId, type MountTier } from "../account/mounts";
import type { PlayerClass } from "../combat/classes";
import type { Costume } from "./costumes";
import { HEROES } from "./heroes";
import { MOUNT_LOOKS } from "./mountLooks";
import { PLAYER_HEIGHT, PlayerActor } from "./PlayerActor";
import { skinnedHeight } from "./skinned";

// The stable's stage (the mounts panel): a stone pedestal under a warm light where your own hero sits
// on the mount you look at, turning slowly; a mount you do not own stands there alone, in shadow; and
// the draw is an egg on it that shakes, flashes in its tier's colour and hatches.

export type TierKey = MountTier | "base";
export const TIER_COLORS: Record<TierKey, number> = {
  base: 0xe8c98a, common: 0xcfc6b4, rare: 0x7fc4ff, epic: 0xc792ff, legendary: 0xffcf5a,
};
export const tierKey = (id: MountId): TierKey => MOUNTS[id].tier ?? "base";

// How long the egg shakes before it bursts, and the burst itself (seconds).
const SHAKE_SECONDS = 1.3;
const BURST_SECONDS = 0.3;
const TURN_RATE = 0.35;
// The camera: this far back (metres) and this much above where it looks, on a wide stage; the
// pedestal and a winged mount on it are about twice this wide.
const CAMERA_BACK = 11.5;
const CAMERA_RISE = 1.9;
const LOOK_Y = 0.7;
const STAGE_HALF_WIDTH = 2.2;

interface Lone { object: THREE.Object3D; mixer: THREE.AnimationMixer; pop: number }

// A mount standing alone, sized as it is under a rider, feet on the ground.
function loneMount(library: ModelLibrary, id: MountId, shadowed: boolean): Lone {
  const look = MOUNT_LOOKS[id];
  const model = library.get(MOUNTS[id].model);
  const object = library.instance(MOUNTS[id].model);
  object.scale.setScalar((PLAYER_HEIGHT * look.height) / skinnedHeight(object));
  object.userData.scale = object.scale.x;
  object.updateMatrixWorld(true);
  object.position.y = (look.hover ?? 0) - new THREE.Box3().setFromObject(object).min.y;
  object.traverse((o) => {
    o.frustumCulled = false;
    const mesh = o as THREE.Mesh;
    if (!shadowed || !mesh.isMesh) return;
    // Its own dark copy: the library's materials are shared.
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0a10, roughness: 1 });
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(() => dark) : dark;
  });
  const mixer = new THREE.AnimationMixer(object);
  const clip = THREE.AnimationClip.findByName(model.animations, look.idle) ?? model.animations[0];
  if (clip) mixer.clipAction(clip).play();
  // Pops up onto the pedestal (see the loop).
  return { object, mixer, pop: 0 };
}

function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x201810, 1.7));
  const key = new THREE.DirectionalLight(0xffe2b0, 2.4);
  key.position.set(2.5, 5, 3.5);
  scene.add(key);
  const back = new THREE.DirectionalLight(0x8fb7ff, 0.9);
  back.position.set(-3, 2.5, -3);
  scene.add(back);
}

export class MountStage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private readonly turntable = new THREE.Group();
  private readonly rim: THREE.MeshStandardMaterial;
  private readonly glow = new THREE.PointLight(0xffcf5a, 0, 6);
  private readonly rider: PlayerActor;
  private readonly riderPose = { x: 0, z: 0, yaw: 0, y: 0 };
  private riderMount: MountId | null = null;
  private lone: Lone | null = null;
  private readonly egg = new THREE.Group();
  private readonly eggShell: THREE.MeshStandardMaterial;
  private hatch: { t: number; id: MountId; done: () => void } | null = null;
  private turn = 0.6;
  private last = performance.now();
  private raf = 0;
  private readonly portraits = new Map<MountId, string>();
  // One small renderer draws every card's picture (a browser allows only so many WebGL contexts).
  private painter: THREE.WebGLRenderer | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly library: ModelLibrary,
    rider: { playerClass: PlayerClass; costume: Costume },
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    lights(this.scene);
    this.scene.add(this.glow);
    this.glow.position.set(0, 1.2, 1.2);

    // The pedestal: worn stone, and a ring round its top in the tier's colour.
    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.3, 0.28, 48),
      new THREE.MeshStandardMaterial({ color: 0x3a3129, roughness: 0.95 }),
    );
    stone.position.y = -0.14;
    this.rim = new THREE.MeshStandardMaterial({ color: 0x1a140e, emissive: 0xe8c98a, emissiveIntensity: 0.9 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.035, 8, 64), this.rim);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(stone, ring, this.turntable);

    // The egg: cream, speckled gold, a little taller than wide.
    this.eggShell = new THREE.MeshStandardMaterial({ color: 0xf4ead6, roughness: 0.55, emissive: 0xffffff, emissiveIntensity: 0 });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), this.eggShell);
    shell.scale.set(1, 1.28, 1);
    shell.position.y = 0.54;
    this.egg.add(shell);
    const speck = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.4 });
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39;
      const h = 0.18 + ((i * 37) % 60) / 100;
      const r = 0.42 * Math.sqrt(Math.max(0, 1 - ((h - 0.54) / 0.54) ** 2)) + 0.005;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035 + (i % 3) * 0.012, 8, 6), speck);
      dot.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
      this.egg.add(dot);
    }
    this.egg.visible = false;
    this.turntable.add(this.egg);

    const rig = HEROES[rider.playerClass];
    this.rider = new PlayerActor("", {
      object: library.instance(rig.model), clips: library.get(rig.model).animations, costume: rider.costume, rig,
    });
    this.rider.object.visible = false;
    this.scene.add(this.rider.object);

    this.aim(1);
    this.loop();
  }

  // Your hero on this mount (an owned one).
  showRiding(id: MountId): void {
    this.clear();
    this.tint(tierKey(id));
    this.rider.object.visible = true;
    if (this.riderMount !== id) {
      this.riderMount = id;
      this.rider.setMount({ id, object: this.library.instance(MOUNTS[id].model), clips: this.library.get(MOUNTS[id].model).animations });
    }
  }

  // A mount alone: in shadow when not yet owned.
  showAlone(id: MountId, shadowed: boolean): void {
    this.clear();
    this.tint(tierKey(id));
    this.lone = loneMount(this.library, id, shadowed);
    this.turntable.add(this.lone.object);
  }

  showEgg(): void {
    this.clear();
    this.tint("base");
    this.egg.visible = true;
    this.egg.rotation.set(0, 0, 0);
    this.egg.scale.setScalar(1);
    this.eggShell.emissiveIntensity = 0;
  }

  // The draw: the egg shakes, bursts in the tier's colour, and the mount pops out. Resolves once it
  // stands there.
  hatchInto(id: MountId): Promise<void> {
    this.showEgg();
    return new Promise((done) => {
      this.hatch = { t: 0, id, done };
    });
  }

  // The hatch cut short (its frames did not come): the mount stands there now.
  finishHatch(): void {
    const h = this.hatch;
    if (!h) return;
    this.showAlone(h.id, false);
    h.done();
  }

  // A small picture of a mount, for its card (drawn once, then kept).
  portrait(id: MountId): string {
    const kept = this.portraits.get(id);
    if (kept) return kept;
    const size = 192;
    if (!this.painter) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      this.painter = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    }
    const renderer = this.painter;
    const scene = new THREE.Scene();
    lights(scene);
    const { object, mixer } = loneMount(this.library, id, false);
    mixer.update(0.2);
    object.rotation.y = 0.65;
    scene.add(object);
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const centre = box.getCenter(new THREE.Vector3());
    const reach = box.getSize(new THREE.Vector3()).length();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(centre.x + reach * 0.9, centre.y + reach * 0.45, centre.z + reach * 1.7);
    camera.lookAt(centre);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL("image/png");
    this.portraits.set(id, url);
    return url;
  }

  // The stage's own canvas keeps its context (a new stage on the same canvas takes it up again); the
  // card painter's goes.
  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
    this.painter?.dispose();
    this.painter?.forceContextLoss();
    this.painter = null;
  }

  private clear(): void {
    this.hatch = null;
    this.egg.visible = false;
    this.rider.object.visible = false;
    if (this.lone) {
      this.turntable.remove(this.lone.object);
      this.lone = null;
    }
  }

  private tint(tier: TierKey): void {
    this.rim.emissive.setHex(TIER_COLORS[tier]);
    this.glow.color.setHex(TIER_COLORS[tier]);
    this.glow.intensity = tier === "legendary" ? 3 : tier === "epic" ? 2 : tier === "rare" ? 1.4 : 0.4;
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.resize();
    this.turn += dt * TURN_RATE;
    this.turntable.rotation.y = this.turn;
    this.riderPose.yaw = this.turn + Math.PI;
    if (this.rider.object.visible) this.rider.sync(this.riderPose, "active", dt);
    if (this.lone) {
      this.lone.pop = Math.min(1, this.lone.pop + dt / 0.4);
      const k = this.lone.pop;
      const s = 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;
      this.lone.object.scale.setScalar(this.lone.object.userData.scale * Math.max(0.01, s));
      this.lone.mixer.update(dt);
    }
    if (this.hatch) this.stepHatch(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private stepHatch(dt: number): void {
    const h = this.hatch!;
    h.t += dt;
    if (h.t < SHAKE_SECONDS) {
      // Harder and harder, with a hop now and then.
      const k = h.t / SHAKE_SECONDS;
      this.egg.rotation.z = Math.sin(h.t * (18 + 22 * k)) * 0.22 * k;
      this.egg.position.y = Math.max(0, Math.sin(h.t * 9)) * 0.08 * k;
      return;
    }
    if (h.t < SHAKE_SECONDS + BURST_SECONDS) {
      // The burst: the egg swells and whitens, and the light turns the tier's colour.
      const k = (h.t - SHAKE_SECONDS) / BURST_SECONDS;
      this.egg.rotation.z = 0;
      this.egg.scale.setScalar(1 + 0.35 * k);
      this.eggShell.emissiveIntensity = 1.6 * k;
      this.tint(tierKey(h.id));
      this.glow.intensity *= 1 + 3 * k;
      return;
    }
    const { id, done } = h;
    this.showAlone(id, false);
    done();
  }

  // Far enough back that the pedestal fits both ways: on a narrow, tall stage the width decides.
  private aim(aspect: number): void {
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const back = Math.max(CAMERA_BACK, STAGE_HALF_WIDTH / (Math.tan(halfFov) * aspect));
    this.camera.position.set(0, LOOK_Y + (back * CAMERA_RISE) / CAMERA_BACK, back);
    this.camera.lookAt(0, LOOK_Y, 0);
  }

  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x === w && size.y === h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.aim(w / h);
  }
}
