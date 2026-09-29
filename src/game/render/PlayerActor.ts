import * as THREE from "three";
import type { Pose } from "../world/types";
import type { Costume } from "./costumes";
import { applyCostume } from "./dyes";
import { skillFx, type HeroRig } from "./heroes";
import { CLASS_SKILLS, skillAt } from "../combat/skills";
import type { JobId } from "../combat/jobs";
import type { Effects } from "./effects";
import { createLabel, setLabel } from "./labels";
import { ActionBlender, clipByName, skinnedHeight } from "./skinned";
import type { MountId } from "../account/mounts";
import { MOUNT_LOOKS } from "./mountLooks";

// The heroes stand a little shorter than a person; the camera and reach are set around this.
export const PLAYER_HEIGHT = 1.45;
const FOLLOW_RATE = 12;
const FALL_RATE = 6;
// Still this far from where the pose says (metres) counts as walking.
const MOVING = 0.03;

export type PlayerStatus = "active" | "dead";

export interface PlayerModel {
  object: THREE.Object3D;
  clips: THREE.AnimationClip[];
  costume: Costume;
  // The class's model and which of its clips to play.
  rig: HeroRig;
  // Where shots and skill rings are drawn; none on the menu.
  effects?: Effects;
}

// A bow or a staff lets go this long after the attack starts.
const RELEASE_SECONDS = 0.25;
// Shots leave from about chest height.
const SHOT_HEIGHT = 0.9;
// An attack or skill holds you in place this long (at most its clip); moving after that cuts the rest
// of the clip short, so a hero never slides along the ground mid-swing.
const ATTACK_COMMIT = 0.45;
const LABEL_NEAR = 10;
const LABEL_FAR = 28;
// A pause this long between swings starts a combo over.
const COMBO_RESET_SECONDS = 1.4;
const SKILL_COMMIT = 0.8;

interface Animated {
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction;
  walk: THREE.AnimationAction;
  run: THREE.AnimationAction;
  attacks: THREE.AnimationAction[];
  guard: THREE.AnimationAction;
  death: THREE.AnimationAction;
  skill: THREE.AnimationAction;
  blender: ActionBlender;
}

// A mount's model, for a rider (see setMount).
export interface MountModel {
  id: MountId;
  object: THREE.Object3D;
  clips: THREE.AnimationClip[];
}

// How a rider sits (radians): thighs forward, knees bent back down, legs apart over the mount's back.
const RIDE_THIGH = 1.25;
const RIDE_KNEE = 1.35;
const RIDE_SPREAD = 0.7;

interface Riding {
  id: MountId;
  object: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  blender: ActionBlender;
  idle: THREE.AnimationAction;
  move: THREE.AnimationAction;
}

// A leg's bones, and where its foot sits in the lower leg's frame at rest: the rig keeps its feet
// under the root (IK style), so a bent leg carries its foot along by hand.
interface Leg {
  upper: THREE.Bone;
  lower: THREE.Bone;
  foot: THREE.Bone;
  footInLower: THREE.Vector3;
  side: 1 | -1;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Turns a bone by `angle` about a world axis (its parent's world frame read now).
function turnInWorld(bone: THREE.Bone, axis: THREE.Vector3, angle: number): void {
  const parent = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  const turn = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  bone.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));
  bone.updateMatrixWorld(true);
}

// The legs of a hero's rig (Quaternius RPG pack: UpperLeg.L, LowerLeg.L, Foot.L; three drops the dots),
// with each foot's place in its lower leg's frame taken from the bind pose. Null for another rig.
function findLegs(body: THREE.Object3D): Leg[] | null {
  let skeleton: THREE.Skeleton | null = null;
  body.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!skeleton && mesh.isSkinnedMesh) skeleton = mesh.skeleton;
  });
  if (!skeleton) return null;
  const { bones, boneInverses } = skeleton as THREE.Skeleton;
  const bind = (bone: THREE.Bone) => boneInverses[bones.indexOf(bone)].clone().invert();
  const legs: Leg[] = [];
  for (const [s, side] of [["L", 1], ["R", -1]] as const) {
    const upper = bones.find((b) => b.name === `UpperLeg${s}`);
    const lower = bones.find((b) => b.name === `LowerLeg${s}`);
    const foot = bones.find((b) => b.name === `Foot${s}`);
    if (!upper || !lower || !foot) return null;
    const footInLower = new THREE.Vector3().setFromMatrixPosition(bind(lower).invert().multiply(bind(foot)));
    legs.push({ upper, lower, foot, footInLower, side });
  }
  return legs;
}

// Stand-in body for tests and for a model that failed to load.
export function placeholderBody(): THREE.Object3D {
  const root = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x4a5040, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 12), cloth);
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), cloth);
  head.position.y = 1.15;
  root.add(body, head);
  return root;
}

function once(action: THREE.AnimationAction, clamp: boolean): THREE.AnimationAction {
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = clamp;
  return action;
}

// A hero in the match or on the menu: follows its pose, walks in the direction it moves, swings when
// its swing count goes up, raises its guard while blocking and falls when it goes down.
export class PlayerActor {
  readonly object: THREE.Object3D;
  private readonly body: THREE.Object3D;
  private readonly animated: Animated | null;
  private readonly tag = createLabel(1.3);
  private tagText = "";
  private placed = false;
  private dead = false;
  private lastSwing: number | null = null;
  private lastSkill: number | null = null;
  private readonly rig: HeroRig | null;
  // The hero's advanced path, which decides what its second and third skills look like.
  path: JobId | null = null;
  private readonly effects: Effects | null;
  // Shots waiting for the bow or staff to let go: seconds left, and how far each flies.
  private pendingShots: { left: number; reach: number }[] = [];
  private swingLeft = 0;
  private commitLeft = 0;
  private nextAttack = 0;
  // When the last swing began (seconds of play), so a pause starts the combo over.
  private clock = 0;
  private lastSwingAt = Number.NEGATIVE_INFINITY;
  // The mount under this hero, if riding; its legs, found on first riding.
  private riding: Riding | null = null;
  private legs: Leg[] | null | undefined = undefined;

  constructor(readonly account: string, model: PlayerModel | null) {
    this.body = model?.object ?? placeholderBody();
    this.object = new THREE.Group();
    this.tag.position.y = PLAYER_HEIGHT + 0.3;
    this.object.add(this.body, this.tag);
    this.animated = model ? PlayerActor.animate(model) : null;
    this.rig = model?.rig ?? null;
    this.effects = model?.effects ?? null;
    this.object.traverse((o) => {
      o.frustumCulled = false;
    });
    this.object.visible = false;
  }

  // Which mount this hero rides (null: on foot).
  get mountId(): MountId | null {
    return this.riding?.id ?? null;
  }

  // Up on a mount, or down (null). The mount stands under the hero, sized to it, and the hero sits on
  // its back with the legs bent over it.
  setMount(model: MountModel | null): void {
    if (this.riding) {
      this.object.remove(this.riding.object);
      this.riding.mixer.stopAllAction();
      this.riding = null;
    }
    this.body.position.set(0, 0, 0);
    if (!model) return;
    const look = MOUNT_LOOKS[model.id];
    const object = model.object;
    object.scale.setScalar((PLAYER_HEIGHT * look.height) / skinnedHeight(object));
    object.traverse((o) => {
      o.frustumCulled = false;
    });
    this.object.add(object);
    // Its lowest point on the ground (or at its hover): not every model stands on its origin.
    object.position.set(0, 0, 0);
    this.object.updateMatrixWorld(true);
    const bottom = new THREE.Box3().setFromObject(object).min.y - this.object.getWorldPosition(new THREE.Vector3()).y;
    object.position.y = (look.hover ?? 0) - bottom;
    const mixer = new THREE.AnimationMixer(object);
    const find = (name: string) => THREE.AnimationClip.findByName(model.clips, name) ?? model.clips[0];
    const idle = mixer.clipAction(find(look.idle));
    const move = mixer.clipAction(find(look.move));
    this.riding = { id: model.id, object, mixer, idle, move, blender: new ActionBlender(idle) };
    // Sat on its back: the hips go to the seat (the hips' height over the feet read from the rig at rest).
    if (this.legs === undefined) this.legs = findLegs(this.body);
    const seat = PLAYER_HEIGHT * look.height * look.seat + (look.hover ?? 0);
    this.body.position.set(0, seat - this.hipsHeight(), look.forward);
  }

  // How high the hips are over the feet, standing.
  private hipsHeight(): number {
    let hips: THREE.Object3D | null = null;
    this.body.traverse((o) => {
      if (!hips && o.name === "Hips") hips = o;
    });
    if (!hips) return PLAYER_HEIGHT * 0.38;
    this.object.updateMatrixWorld(true);
    return (hips as THREE.Object3D).getWorldPosition(new THREE.Vector3()).y - this.object.getWorldPosition(new THREE.Vector3()).y;
  }

  // The legs bent over the mount, after the clip has posed the rest of the body.
  private sitLegs(): void {
    if (!this.legs) return;
    this.body.updateMatrixWorld(true);
    for (const leg of this.legs) {
      turnInWorld(leg.upper, X_AXIS, -RIDE_THIGH);
      turnInWorld(leg.upper, Z_AXIS, leg.side * RIDE_SPREAD);
      turnInWorld(leg.lower, X_AXIS, RIDE_KNEE);
      const foot = leg.lower.localToWorld(leg.footInLower.clone());
      leg.foot.position.copy(leg.foot.parent!.worldToLocal(foot));
      leg.foot.updateMatrixWorld(true);
    }
  }

  // Whether an attack or skill still holds this hero in place.
  get rooted(): boolean {
    return this.commitLeft > 0 && !this.dead;
  }

  // Names fade out between these distances from the camera, so a crowd does not fill the screen.
  fadeLabel(distance: number): void {
    const material = this.tag.material;
    const shown = this.tagText.length > 0 && distance < LABEL_FAR;
    this.tag.visible = shown;
    if (shown) material.opacity = distance <= LABEL_NEAR ? 1 : 1 - (distance - LABEL_NEAR) / (LABEL_FAR - LABEL_NEAR);
  }

  // The name over the head; empty hides it.
  label(text: string, color = "#f2e8d5"): void {
    if (text === this.tagText) return;
    this.tagText = text;
    setLabel(this.tag, text, color);
  }

  private static animate({ object, clips, costume, rig }: PlayerModel): Animated {
    // Dressed first, then measured, so a cloak or pauldrons do not shrink the body.
    applyCostume(object, costume, rig);
    object.scale.setScalar(PLAYER_HEIGHT / skinnedHeight(object));
    const mixer = new THREE.AnimationMixer(object);
    const action = (name: string) => mixer.clipAction(clipByName(clips, name));
    const idle = action(rig.idle);
    return {
      mixer,
      idle,
      walk: action(rig.walk),
      run: action(rig.run),
      attacks: rig.attacks.map((n) => once(action(n), false)),
      guard: action(rig.guard),
      death: once(action(rig.death), true),
      skill: once(action(rig.skill), false),
      blender: new ActionBlender(idle),
    };
  }

  sync(pose: Pose | null, status: PlayerStatus, dt: number): void {
    this.clock += dt;
    if (!pose) {
      this.object.visible = false;
      return;
    }
    const p = this.object.position;
    if (!this.placed) {
      p.set(pose.x, 0, pose.z);
      this.placed = true;
    }
    const k = 1 - Math.exp(-dt * FOLLOW_RATE);
    const dx = pose.x - p.x;
    const dz = pose.z - p.z;
    p.x += dx * k;
    p.z += dz * k;
    // Jumps arrive a few samples per arc; the same easing keeps them smooth.
    const y = this.dead ? 0 : (pose.y ?? 0);
    p.y += (y - p.y) * k;
    // Pose yaw uses the camera convention; the model faces +z.
    this.object.rotation.y = pose.yaw + Math.PI;
    if (status === "dead") this.dead = true;

    const a = this.animated;
    if (!a) {
      if (this.dead) {
        const fall = this.body.rotation;
        fall.x += (-Math.PI / 2 - fall.x) * (1 - Math.exp(-dt * FALL_RATE));
      }
      this.object.visible = true;
      return;
    }

    // A higher swing count than last time means a new swing.
    const swing = pose.swing ?? 0;
    if (this.lastSwing !== null && swing > this.lastSwing && !this.dead) {
      // Swings in quick succession run through the model's attack clips as a combo; after a pause
      // it starts again from the first.
      if (this.clock - this.lastSwingAt > COMBO_RESET_SECONDS) this.nextAttack = 0;
      this.lastSwingAt = this.clock;
      const attack = a.attacks[this.nextAttack];
      this.nextAttack = (this.nextAttack + 1) % a.attacks.length;
      this.swingLeft = attack.getClip().duration;
      this.commitLeft = Math.min(this.swingLeft, ATTACK_COMMIT);
      if (a.blender.active === attack) attack.reset().play();
      else a.blender.fadeTo(attack, 0.05);
      if (this.rig?.shot) this.pendingShots.push({ left: RELEASE_SECONDS, reach: this.rig.reach });
    }
    this.lastSwing = swing;
    // Likewise a higher skill count plays the class's skill.
    const skill = pose.skill ?? 0;
    if (this.lastSkill !== null && skill > this.lastSkill && !this.dead) {
      this.swingLeft = a.skill.getClip().duration;
      this.commitLeft = Math.min(this.swingLeft, SKILL_COMMIT);
      if (a.blender.active === a.skill) a.skill.reset().play();
      else a.blender.fadeTo(a.skill, 0.05);
      const used = this.rig ? skillAt(this.rig.playerClass, this.path, pose.slot ?? 0) ?? CLASS_SKILLS[this.rig.playerClass] : null;
      const fx = this.rig && used ? skillFx(this.rig, used) : null;
      if (fx && this.effects) this.effects.ring(p, fx.ring.radius, fx.ring.color);
      if (fx?.shot) this.pendingShots.push({ left: RELEASE_SECONDS, reach: fx.shot });
    }
    this.lastSkill = skill;
    this.fireShots(dt, pose.yaw);
    this.swingLeft = Math.max(0, this.swingLeft - dt);
    this.commitLeft = Math.max(0, this.commitLeft - dt);
    const moving = Math.hypot(dx, dz) >= MOVING;
    // Walking off once the swing has landed ends it.
    if (this.swingLeft > 0 && this.commitLeft === 0 && moving) this.swingLeft = 0;

    if (this.dead) a.blender.fadeTo(a.death, 0.1);
    else if (this.swingLeft > 0) {
      // The swing plays through.
    } else if (pose.block) a.blender.fadeTo(a.guard, 0.08);
    // A rider sits still; the mount does the walking.
    else a.blender.fadeTo(this.riding ? a.idle : this.moveClip(a, dx, dz, pose.yaw));
    a.mixer.update(dt);
    const ride = this.riding;
    if (ride) {
      ride.blender.fadeTo(Math.hypot(dx, dz) >= MOVING ? ride.move : ride.idle);
      ride.mixer.update(dt);
      this.object.updateMatrixWorld(true);
      this.sitLegs();
    }
    this.object.visible = true;
  }

  private fireShots(dt: number, yaw: number): void {
    if (this.pendingShots.length === 0) return;
    for (const shot of this.pendingShots) shot.left -= dt;
    const ready = this.pendingShots.filter((s) => s.left <= 0);
    this.pendingShots = this.pendingShots.filter((s) => s.left > 0);
    if (!this.effects || !this.rig?.shot) return;
    const from = this.object.position.clone();
    from.y += SHOT_HEIGHT;
    for (const shot of ready) this.effects.shoot(this.rig.shot, from, yaw, shot.reach);
  }

  // Running forward or sideways, walking when backing away (the pack has no strafe clips).
  private moveClip(a: Animated, dx: number, dz: number, yaw: number): THREE.AnimationAction {
    if (Math.hypot(dx, dz) < MOVING) return a.idle;
    // Forward is (-sin yaw, -cos yaw).
    const forward = dx * -Math.sin(yaw) + dz * -Math.cos(yaw);
    return forward < -MOVING / 2 ? a.walk : a.run;
  }
}
