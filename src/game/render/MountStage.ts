import * as THREE from "three";
import type { ModelLibrary } from "../assets/ModelLibrary";
import { MOUNTS, type MountId, type MountTier } from "../account/mounts";
import type { PlayerClass } from "../combat/classes";
import type { Costume } from "./costumes";
import { HatchFx, type Grandeur } from "./hatchFx";
import { HEROES } from "./heroes";
import { MOUNT_LOOKS } from "./mountLooks";
import { PLAYER_HEIGHT, PlayerActor } from "./PlayerActor";
import { QUALITY, settings } from "../../ui/settings";
import { skinnedHeight } from "./skinned";

// The stable's stage (the mounts panel): a stone pedestal under a warm light where your own hero sits
// on the mount you look at, turning slowly; a mount you do not own stands there alone, in shadow; and
// the draw is an egg on it: three knocks from inside, each one cracking it further, the cracks glowing
// (in the tier's colour, late, when it is rare or better), a frenzy of shaking as the camera leans in,
// then it bursts (see hatchFx.ts) and the mount stands there.

export type TierKey = MountTier | "base";
export type HatchMoment = "knock" | "burst";
export const TIER_COLORS: Record<TierKey, number> = {
  base: 0xe8c98a, common: 0xcfc6b4, rare: 0x7fc4ff, epic: 0xc792ff, legendary: 0xffcf5a,
};
export const tierKey = (id: MountId): TierKey => MOUNTS[id].tier ?? "base";

// The hatch (seconds from its start): the knocks from inside, how long each rocks the egg, the frenzy,
// and the burst.
const KNOCKS = [0.2, 0.85, 1.4];
const KNOCK_SECONDS = 0.4;
const FRENZY_FROM = 1.8;
const BURST_AT = 2.35;
const BURST_SECONDS = 0.22;
// How far the camera leans in by the burst (a share of the way to the egg).
const LEAN = 0.22;
const GRANDEUR: Record<TierKey, Grandeur> = { base: 0, common: 1, rare: 2, epic: 3, legendary: 4 };
// The cracks' warm light before a rare egg shows its colour.
const CRACK_LIGHT = 0xffe7b0;
const EGG_Y = 0.54;
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
  private hatch: { t: number; id: MountId; done: () => void; cue: (moment: HatchMoment) => void; knocked: number } | null = null;
  private readonly cracks: Cracks;
  private readonly fx: HatchFx[] = [];
  private warmFx: HatchFx | null = null;
  // Where the camera stands (see aim), how far it leans in, and how hard it shakes.
  private readonly eye = new THREE.Vector3();
  private readonly look = new THREE.Vector3(0, LOOK_Y, 0);
  private readonly tierLight = new THREE.Color();
  private lean = 0;
  private quake = 0;
  // The pedestal's light: the tier's own, and a flare on top that dies away.
  private glowBase = 0;
  private flare = 0;
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
    // No sharper than the world itself is drawn (the graphics quality: a phone's is 1.5).
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[settings().quality].pixelRatio));
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
    this.cracks = new Cracks();
    this.eggShell = new THREE.MeshStandardMaterial({
      color: 0xf4ead6, roughness: 0.55, emissive: CRACK_LIGHT, emissiveIntensity: 0, emissiveMap: this.cracks.texture,
    });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), this.eggShell);
    shell.scale.set(1, 1.28, 1);
    shell.position.y = EGG_Y;
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
    this.warm();
    this.loop();
  }

  // Every shader the stage will want, built now while the panel opens rather than mid-hatch (a
  // phone would drop frames building the burst's and a new mount's at the moment they appear).
  private warm(): void {
    const kit = new THREE.Group();
    for (const id of Object.keys(MOUNTS) as MountId[]) kit.add(loneMount(this.library, id, false).object);
    const fx = new HatchFx(TIER_COLORS.legendary, 4, EGG_Y);
    kit.add(fx.group);
    this.egg.visible = true;
    this.scene.add(kit);
    this.renderer.compile(this.scene, this.camera);
    this.scene.remove(kit);
    this.egg.visible = false;
    // Kept till the stage goes: disposing its materials would free the very shaders just built.
    this.warmFx = fx;
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
    this.egg.position.y = 0;
    this.egg.scale.setScalar(1);
    this.eggShell.emissive.setHex(CRACK_LIGHT);
    this.eggShell.emissiveIntensity = 0;
    this.cracks.draw(0, 0);
    this.lean = 0;
  }

  // The draw: knocks, cracks, the burst, and the mount pops out. Resolves once it stands there; cue
  // hears each knock and the burst (for their sounds).
  hatchInto(id: MountId, cue: (moment: HatchMoment) => void = () => {}): Promise<void> {
    this.showEgg();
    return new Promise((done) => {
      this.hatch = { t: 0, id, done, cue, knocked: 0 };
    });
  }

  // The hatch cut short (its frames did not come): the mount stands there now.
  finishHatch(): void {
    const h = this.hatch;
    if (!h) return;
    this.burst(h.id);
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
    for (const fx of this.fx.splice(0)) fx.dispose();
    this.warmFx?.dispose();
    this.cracks.texture.dispose();
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
    this.glowBase = tier === "legendary" ? 3 : tier === "epic" ? 2 : tier === "rare" ? 1.4 : 0.4;
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
    for (let i = this.fx.length - 1; i >= 0; i--) {
      if (this.fx[i].step(dt)) continue;
      this.fx[i].dispose();
      this.fx.splice(i, 1);
    }
    this.flare *= Math.exp(-2.5 * dt);
    this.glow.intensity = this.glowBase + this.flare;
    // Leaning in while the egg shakes, easing back after; shaken by knocks and the burst.
    if (!this.hatch) this.lean *= Math.exp(-3 * dt);
    this.quake *= Math.exp(-7 * dt);
    this.camera.position.lerpVectors(this.eye, this.look, this.lean * LEAN);
    this.camera.position.x += (Math.random() - 0.5) * this.quake * 0.12;
    this.camera.position.y += (Math.random() - 0.5) * this.quake * 0.12;
    this.camera.lookAt(this.look);
    this.renderer.render(this.scene, this.camera);
  };

  private stepHatch(dt: number): void {
    const h = this.hatch!;
    h.t += dt;
    const t = h.t;
    const tier = tierKey(h.id);
    if (t < BURST_AT) {
      this.lean = Math.min(1, t / BURST_AT) ** 2;
      // A knock from inside: a hop, a rock that dies away, the cracks grow and flare.
      while (h.knocked < KNOCKS.length && t >= KNOCKS[h.knocked]) {
        h.knocked++;
        this.quake = 0.3 + 0.25 * h.knocked;
        h.cue("knock");
      }
      const last = KNOCKS[h.knocked - 1];
      const since = last === undefined ? Infinity : t - last;
      let rock = 0;
      let hop = 0;
      if (since < KNOCK_SECONDS) {
        rock = Math.sin(since * 30) * Math.exp(-7 * since) * (0.12 + 0.1 * h.knocked);
        hop = since < 0.22 ? Math.sin((Math.PI * since) / 0.22) * 0.05 * h.knocked : 0;
      }
      // The frenzy: shaking all over, faster and faster.
      const frenzy = Math.max(0, (t - FRENZY_FROM) / (BURST_AT - FRENZY_FROM));
      this.egg.rotation.x = 0;
      if (frenzy > 0) {
        rock += Math.sin(t * (34 + 30 * frenzy)) * 0.2 * frenzy;
        this.egg.rotation.x = Math.sin(t * 29) * 0.1 * frenzy;
        hop += Math.abs(Math.sin(t * 23)) * 0.04 * frenzy;
        this.quake = Math.max(this.quake, 0.25 * frenzy);
      }
      this.egg.rotation.z = rock;
      this.egg.position.y = hop;
      // The cracks: more with each knock, all of them in the frenzy; their light pulses with the knocks.
      const crack = Math.min(1, (h.knocked / KNOCKS.length) * 0.8 + frenzy * 0.2);
      this.cracks.draw(crack, 0);
      const pulse = since < 0.5 ? Math.exp(-5 * since) : 0;
      this.eggShell.emissiveIntensity = 0.6 + crack * 1.4 + pulse * 1.5 + frenzy * 1.5;
      // A rare or better egg shows its colour once the frenzy starts.
      if (GRANDEUR[tier] >= 2 && frenzy > 0) {
        this.eggShell.emissive.setHex(CRACK_LIGHT).lerp(this.tierLight.setHex(TIER_COLORS[tier]), Math.min(1, frenzy * 2));
        this.tint(tier);
        this.flare = Math.max(this.flare, 2 * frenzy);
      }
      return;
    }
    if (t < BURST_AT + BURST_SECONDS) {
      // The burst: the egg swells and goes white hot.
      if (h.knocked <= KNOCKS.length) {
        h.knocked = KNOCKS.length + 1;
        h.cue("burst");
      }
      const k = (t - BURST_AT) / BURST_SECONDS;
      this.egg.rotation.set(0, 0, 0);
      this.egg.position.y = 0;
      this.egg.scale.set(1 + 0.3 * k, 1 + 0.5 * k, 1 + 0.3 * k);
      this.cracks.draw(1, k);
      this.eggShell.emissiveIntensity = 3 + 4 * k;
      this.tint(tier);
      this.flare = 4 * k;
      this.lean = 1;
      return;
    }
    this.burst(h.id);
    h.done();
  }

  // The egg gone in a blast; the mount stands where it was.
  private burst(id: MountId): void {
    const tier = tierKey(id);
    this.showAlone(id, false);
    const fx = new HatchFx(TIER_COLORS[tier], GRANDEUR[tier], EGG_Y);
    this.scene.add(fx.group);
    this.fx.push(fx);
    this.flare = 4 + GRANDEUR[tier];
    this.quake = 1.2;
  }

  // Far enough back that the pedestal fits both ways: on a narrow, tall stage the width decides.
  private aim(aspect: number): void {
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const back = Math.max(CAMERA_BACK, STAGE_HALF_WIDTH / (Math.tan(halfFov) * aspect));
    this.eye.set(0, LOOK_Y + (back * CAMERA_RISE) / CAMERA_BACK, back);
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

// The egg's cracks, drawn on a small canvas that lights the shell (its emissive map): a few jagged
// lines round its middle that grow with the knocks, forking as they go; at the burst the whole shell
// goes white. Redrawn only when what shows changes.
class Cracks {
  readonly texture: THREE.CanvasTexture;
  private readonly g: CanvasRenderingContext2D;
  private readonly segments: number[][] = [];
  private shown = -1;
  private white = -1;

  constructor() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    this.g = canvas.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(canvas);
    // Six cracks, each a jagged walk out from the middle band, with a fork partway; laid out in the
    // order they appear.
    const walks: number[][][] = [];
    for (let i = 0; i < 6; i++) {
      const walk: number[][] = [];
      let x = (i / 6) * 256 + Math.random() * 30;
      let y = 55 + Math.random() * 18;
      const up = i % 2 === 0 ? -1 : 1;
      for (let j = 0; j < 9; j++) {
        const nx = x + (Math.random() - 0.5) * 25;
        const ny = y + up * (4 + Math.random() * 7);
        walk.push([x, y, nx, ny]);
        if (j === 4) {
          let fx = nx;
          let fy = ny;
          for (let f = 0; f < 3; f++) {
            const gx = fx + (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 9);
            const gy = fy + up * (3 + Math.random() * 5);
            walk.push([fx, fy, gx, gy]);
            fx = gx;
            fy = gy;
          }
        }
        x = nx;
        y = ny;
      }
      walks.push(walk);
    }
    const longest = Math.max(...walks.map((w) => w.length));
    for (let j = 0; j < longest; j++) for (const walk of walks) if (walk[j]) this.segments.push(walk[j]);
  }

  // progress 0 to 1 of the cracks; white 0 to 1 over the whole shell.
  draw(progress: number, white: number): void {
    const shown = Math.floor(progress * this.segments.length);
    const w = Math.round(white * 10) / 10;
    if (shown === this.shown && w === this.white) return;
    this.shown = shown;
    this.white = w;
    const g = this.g;
    g.fillStyle = "#000";
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = "#fff";
    g.lineCap = "round";
    g.lineWidth = 4;
    g.beginPath();
    for (const [x1, y1, x2, y2] of this.segments.slice(0, shown)) {
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
    }
    g.stroke();
    if (w > 0) {
      g.fillStyle = `rgba(255,255,255,${w})`;
      g.fillRect(0, 0, 256, 128);
    }
    this.texture.needsUpdate = true;
  }
}
