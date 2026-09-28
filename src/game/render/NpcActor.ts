import * as THREE from "three";
import { ActionBlender, clipByName, ownMaterials, skinnedHeight } from "./skinned";
import { createLabel, setLabel } from "./labels";

// How a village NPC is drawn: its model (Quaternius, CC0), its standing height, its clips (one to
// stand in, one to greet you with when you walk up) and any colours to lay over its materials.
export interface NpcLook {
  model: string;
  height: number;
  idle: string;
  greet: string;
  // Colours laid over its materials, by material name.
  colors: Record<string, number>;
}

// Names fade out between these distances from the camera (as players' do).
const LABEL_NEAR = 10;
const LABEL_FAR = 32;
// Coming this close sets them greeting; they do it again only after you have gone this far away.
const GREET_NEAR = 6;
const GREET_RESET = 10;
// The picture over their head (see dialogue.ts): how big, how far above the name, and how it bobs.
const MARKER_SIZE = 0.62;
const MARKER_ABOVE = 0.55;
const BOB_HEIGHT = 0.08;
const BOB_RATE = 2.4;
// How quickly they turn to face whoever is talking to them, and back.
const TURN_RATE = 6;

// Marker pictures are shared by every NPC that shows them.
const markerTextures = new Map<string, THREE.Texture>();
function markerTexture(url: string): THREE.Texture {
  let texture = markerTextures.get(url);
  if (!texture) {
    texture = new THREE.TextureLoader().load(url);
    // Pixel art: kept sharp rather than smoothed.
    texture.magFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    markerTextures.set(url, texture);
  }
  return texture;
}

// A village NPC on screen: stands in place turned toward the arrival spot, idles, and greets you
// once each time you come close, with its name and role in gold overhead.
export class NpcActor {
  readonly object = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly idle: THREE.AnimationAction;
  private readonly greet: THREE.AnimationAction;
  private readonly blender: ActionBlender;
  private readonly tag = createLabel(1.8);
  private readonly marker = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  private markerUrl: string | null = null;
  private markerY: number;
  private bob = 0;
  private readonly body: THREE.Object3D;
  // The way they stand when nobody is talking to them, and where they turn to while someone is.
  private readonly restYaw: number;
  private faceYaw: number | null = null;
  private greeted = false;
  private greetLeft = 0;
  // Being talked to: the camera is at their face, so their name steps aside (the words below say it).
  inTalk = false;

  constructor(body: THREE.Object3D, clips: THREE.AnimationClip[], look: NpcLook, label: string, x: number, z: number, yaw: number) {
    body.scale.setScalar(look.height / skinnedHeight(body));
    for (const material of ownMaterials(body)) {
      const colour = look.colors[material.name];
      if (colour !== undefined) material.color.setHex(colour);
    }
    this.mixer = new THREE.AnimationMixer(body);
    this.idle = this.mixer.clipAction(clipByName(clips, look.idle));
    this.greet = this.mixer.clipAction(clipByName(clips, look.greet));
    this.greet.setLoop(THREE.LoopOnce, 1);
    this.blender = new ActionBlender(this.idle);
    setLabel(this.tag, label, "#ffd36a");
    this.tag.position.y = look.height + 0.35;
    this.markerY = this.tag.position.y + MARKER_ABOVE;
    this.marker.scale.set(MARKER_SIZE, MARKER_SIZE, 1);
    this.marker.position.y = this.markerY;
    this.marker.visible = false;
    this.body = body;
    this.object.add(body, this.tag, this.marker);
    this.object.position.set(x, 0, z);
    // The model faces +z; yaw uses the camera convention.
    body.rotation.y = yaw + Math.PI;
    this.restYaw = body.rotation.y;
    this.object.traverse((o) => {
      o.frustumCulled = false;
    });
  }

  // The picture over their head, by URL, or null for none.
  setMarker(url: string | null): void {
    if (url === this.markerUrl) return;
    this.markerUrl = url;
    this.marker.visible = url !== null;
    if (url) {
      this.marker.material.map = markerTexture(url);
      this.marker.material.needsUpdate = true;
    }
  }

  // Turns to face a point while being talked to (null: back to how they stood).
  faceToward(at: { x: number; z: number } | null): void {
    this.faceYaw = at
      ? Math.atan2(at.x - this.object.position.x, at.z - this.object.position.z)
      : null;
  }

  // What a click can hit: the body and the picture over it.
  hitBox(): THREE.Box3 {
    return new THREE.Box3().setFromObject(this.object);
  }

  // `you` is your distance from them, `camera` the camera's (for the name's fade).
  sync(dt: number, you: number, camera: number): void {
    // The model faces +z, so a yaw toward a point is its body's rotation as it stands.
    const target = this.faceYaw ?? this.restYaw;
    let turn = (target - this.body.rotation.y) % (2 * Math.PI);
    if (turn > Math.PI) turn -= 2 * Math.PI;
    if (turn < -Math.PI) turn += 2 * Math.PI;
    this.body.rotation.y += turn * (1 - Math.exp(-dt * TURN_RATE));
    if (this.marker.visible) {
      this.bob += dt * BOB_RATE;
      this.marker.position.y = this.markerY + Math.sin(this.bob) * BOB_HEIGHT;
    }
    if (!this.greeted && you < GREET_NEAR) {
      this.greeted = true;
      this.greetLeft = this.greet.getClip().duration;
      this.greet.reset();
      this.blender.fadeTo(this.greet, 0.15);
    } else if (this.greeted && you > GREET_RESET) {
      this.greeted = false;
    }
    if (this.greetLeft > 0) {
      this.greetLeft -= dt;
      if (this.greetLeft <= 0) this.blender.fadeTo(this.idle, 0.25);
    }
    const shown = camera < LABEL_FAR && !this.inTalk;
    this.tag.visible = shown;
    if (shown) this.tag.material.opacity = camera <= LABEL_NEAR ? 1 : 1 - (camera - LABEL_NEAR) / (LABEL_FAR - LABEL_NEAR);
    this.mixer.update(dt);
  }
}
