import * as THREE from "three";

// The egg bursting on the stable's pedestal: shell shards flung out and bouncing, a fountain of
// sparks in the tier's colour, a beam of light straight up, and rings of light racing over the stone.
// The rarer the mount, the more of it. Everything here is its own (geometry, materials, textures) and
// goes with dispose().

export type Grandeur = 0 | 1 | 2 | 3 | 4 | 5;

const GRAVITY = 9;
const SPARK_GRAVITY = 1.6;
// Seconds each part lasts.
const SHARD_LIFE = 1.6;
const SPARK_LIFE = 2.4;
const BEAM_LIFE = 1.8;
const RING_LIFE = 0.8;

interface Shard { mesh: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3 }
interface Ring { mesh: THREE.Mesh; delay: number }

// A soft round dot, for the sparks.
function dotTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.8)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Bright at the foot, fading out upward: the beam's alpha.
function beamTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, "#fff");
  grad.addColorStop(0.35, "#888");
  grad.addColorStop(1, "#000");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

export class HatchFx {
  readonly group = new THREE.Group();
  private age = 0;
  private readonly shards: Shard[] = [];
  private readonly shardMaterial: THREE.MeshStandardMaterial;
  private readonly sparks: THREE.Points;
  private readonly sparkV: Float32Array;
  private readonly sparkMaterial: THREE.PointsMaterial;
  private readonly beam: THREE.Mesh;
  private readonly beamMaterial: THREE.MeshBasicMaterial;
  private readonly rings: Ring[] = [];
  private readonly textures: THREE.Texture[] = [];

  // At the egg's middle, this high over the pedestal; grandeur 0 (basic) to 4 (legendary) and 5 (mythic).
  constructor(color: number, grandeur: Grandeur, eggY: number) {
    const tint = new THREE.Color(color);

    // The shell, in pieces.
    this.shardMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4ead6, roughness: 0.5, emissive: tint, emissiveIntensity: 0.35, transparent: true, side: THREE.DoubleSide,
    });
    const piece = new THREE.TetrahedronGeometry(0.1);
    for (let i = 0; i < 16 + grandeur * 3; i++) {
      const mesh = new THREE.Mesh(piece, this.shardMaterial);
      const a = Math.random() * Math.PI * 2;
      const out = 1.6 + Math.random() * 2.2;
      mesh.position.set(Math.cos(a) * 0.3, eggY + (Math.random() - 0.3) * 0.5, Math.sin(a) * 0.3);
      mesh.scale.set(1, 0.35, 1 + Math.random());
      const v = new THREE.Vector3(Math.cos(a) * out, 2.2 + Math.random() * 2.8, Math.sin(a) * out);
      const spin = new THREE.Vector3(Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7);
      this.shards.push({ mesh, v, spin });
      this.group.add(mesh);
    }

    // Sparks: a fountain, most of it up and out, drifting down slowly.
    const count = 70 + grandeur * 45;
    const at = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    this.sparkV = new Float32Array(count * 3);
    const white = new THREE.Color(0xffffff);
    const gold = new THREE.Color(0xffe39a);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random();
      const speed = 1.2 + Math.random() * (2.2 + grandeur * 0.5);
      at.set([0, eggY, 0], i * 3);
      this.sparkV.set([Math.cos(a) * speed * (1 - up * 0.6), 1 + up * (3 + grandeur * 0.6), Math.sin(a) * speed * (1 - up * 0.6)], i * 3);
      // Mostly the tier's colour, some white; the legendary's are shot through with gold.
      const c = Math.random() < 0.25 ? white : grandeur >= 4 && Math.random() < 0.4 ? gold : tint;
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(at, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const dot = dotTexture();
    this.textures.push(dot);
    this.sparkMaterial = new THREE.PointsMaterial({
      size: 0.16 + grandeur * 0.02, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.sparks = new THREE.Points(geometry, this.sparkMaterial);
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);

    // The beam.
    const fade = beamTexture();
    this.textures.push(fade);
    this.beamMaterial = new THREE.MeshBasicMaterial({
      color: tint, alphaMap: fade, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 7, 32, 1, true), this.beamMaterial);
    this.beam.position.y = 3.5;
    this.group.add(this.beam);

    // Rings over the stone: one, and more for the rarer.
    for (let i = 0; i < 1 + Math.floor(grandeur / 2); i++) {
      const material = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xffffff : tint, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.03;
      this.rings.push({ mesh, delay: i * 0.18 });
      this.group.add(mesh);
    }
  }

  // False once it has all faded (then dispose of it).
  step(dt: number): boolean {
    this.age += dt;
    const t = this.age;

    for (const s of this.shards) {
      s.v.y -= GRAVITY * dt;
      s.mesh.position.addScaledVector(s.v, dt);
      if (s.mesh.position.y < 0.02) {
        // A bounce on the stone, losing most of it.
        s.mesh.position.y = 0.02;
        s.v.y = Math.abs(s.v.y) * 0.3;
        s.v.x *= 0.6;
        s.v.z *= 0.6;
        s.spin.multiplyScalar(0.6);
      }
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.y += s.spin.y * dt;
      s.mesh.rotation.z += s.spin.z * dt;
    }
    this.shardMaterial.opacity = 1 - smoothstep(SHARD_LIFE - 0.5, SHARD_LIFE, t);

    const at = this.sparks.geometry.getAttribute("position") as THREE.BufferAttribute;
    const drag = Math.exp(-1.8 * dt);
    for (let i = 0; i < at.count; i++) {
      const j = i * 3;
      this.sparkV[j] *= drag;
      this.sparkV[j + 2] *= drag;
      this.sparkV[j + 1] = this.sparkV[j + 1] * drag - SPARK_GRAVITY * dt;
      at.array[j] += this.sparkV[j] * dt;
      at.array[j + 1] += this.sparkV[j + 1] * dt;
      at.array[j + 2] += this.sparkV[j + 2] * dt;
    }
    at.needsUpdate = true;
    // They twinkle as they fade.
    this.sparkMaterial.opacity = (1 - smoothstep(SPARK_LIFE * 0.4, SPARK_LIFE, t)) * (0.8 + 0.2 * Math.sin(t * 40));

    const b = Math.min(1, t / 0.12) * (1 - smoothstep(0.4, BEAM_LIFE, t));
    this.beamMaterial.opacity = 0.85 * b;
    this.beam.scale.set(0.6 + 0.6 * smoothstep(0, 0.5, t), 1, 0.6 + 0.6 * smoothstep(0, 0.5, t));
    this.beam.rotation.y += dt * 2;

    for (const r of this.rings) {
      const k = Math.max(0, (t - r.delay) / RING_LIFE);
      r.mesh.visible = k > 0 && k < 1;
      r.mesh.scale.setScalar(1 + 2.8 * (1 - (1 - Math.min(1, k)) ** 3));
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - Math.min(1, k);
    }
    return t < SPARK_LIFE;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    });
    for (const texture of this.textures) texture.dispose();
  }
}

function smoothstep(a: number, b: number, x: number): number {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
}
