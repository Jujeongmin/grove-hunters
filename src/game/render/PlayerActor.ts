import * as THREE from "three";
import { ROLL } from "../combat/roll";
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
import { MOUNT_LOOKS, RIDE_LEGS, type RideLegs } from "./mountLooks";

// The heroes stand a little shorter than a person; the camera and reach are set around this.
export const PLAYER_HEIGHT = 1.45;
// How fast another hero closes on where its last pose put it: gentle enough to glide through the gap
// between two poses (POSE_THROTTLE_MS) rather than stop and start.
const FOLLOW_RATE = 8;
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
// Out of view a hero's clips stand still; back in view they catch up by at most this many seconds.
const MAX_CATCH_UP = 2;
// Whether a hero is in view is read from a ball this wide around them (a mount and a raised blade included).
const VIEW_RADIUS = 2.4;
// An attack or skill holds you in place this long (at most its clip); moving after that cuts the rest
// of the clip short, so a hero never slides along the ground mid-swing.
const ATTACK_COMMIT = 0.45;
const LABEL_NEAR = 10;
const LABEL_FAR = 28;
// A pause this long between swings starts a combo over.
const COMBO_RESET_SECONDS = 1.4;
const SKILL_COMMIT = 0.8;
// The tumble runs this much past the roll itself (seconds), to get back on its feet.
const ROLL_TAIL = 0.1;

interface Animated {
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction;
  // Sat on a mount: the pack's plain stand, arms at rest (the weapon stance would hold the blade across the mount's face).
  ride: THREE.AnimationAction;
  walk: THREE.AnimationAction;
  run: THREE.AnimationAction;
  attacks: THREE.AnimationAction[];
  roll: THREE.AnimationAction;
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


// Getting on or off takes this long (seconds): the mount pops up (or shrinks away) in a puff while the
// rider hops up onto it (or down), this high at the top of the hop.
const MOUNT_SECONDS = 0.45;
const MOUNT_HOP = 0.45;
const PUFF_COLOR = 0xfff0c8;

const easeOutBack = (k: number) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;
const smooth = (k: number) => k * k * (3 - 2 * k);

interface Riding {
  id: MountId;
  object: THREE.Object3D;
  // Its full size, where the rider's body sits on it, and how far on or off it is (0 to 1).
  scale: number;
  seat: THREE.Vector3;
  on: number;
  mixer: THREE.AnimationMixer;
  blender: ActionBlender;
  idle: THREE.AnimationAction;
  move: THREE.AnimationAction;
  // How the legs bend over it (radians, about the rider's own body; see mountLooks.ts).
  legs: RideLegs;
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
// its swing count goes up, tumbles when its roll count does and falls when it goes down.
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
  private lastRoll: number | null = null;
  // What is left of a dodge roll's tumble (seconds); it plays over anything but a fall.
  private rollLeft = 0;
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
  // The mount being got off, until it has shrunk away.
  private leaving: Riding | null = null;
  private legs: Leg[] | null | undefined = undefined;
  private standingHips: number | null = null;

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
    if (this.leaving) this.drop(this.leaving);
    const old = this.riding;
    if (old) {
      this.riding = null;
      this.effects?.ring(this.object.position, 0.8, PUFF_COLOR);
      // Off: the hop down and the shrinking play out in sync. Onto another: the old one goes at once
      // (only one mount is ever stepped, so a leaving one under a new one would stay forever).
      if (model) {
        this.object.remove(old.object);
        old.mixer.stopAllAction();
      } else this.leaving = old;
    }
    if (!model) return;
    // Measured standing, once: the body is still on the ground then.
    if (this.standingHips === null) {
      this.body.position.set(0, 0, 0);
      this.standingHips = this.hipsHeight();
    }
    const look = MOUNT_LOOKS[model.id];
    const object = model.object;
    const scale = (PLAYER_HEIGHT * look.height) / skinnedHeight(object);
    object.scale.setScalar(scale);
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
    // Sat on its back: the hips go to the seat (the hips' height over the feet read from the rig at rest).
    if (this.legs === undefined) this.legs = findLegs(this.body);
    const seatY = PLAYER_HEIGHT * look.height * look.seat + (look.hover ?? 0) - this.standingHips;
    this.riding = {
      id: model.id, object, scale, seat: new THREE.Vector3(0, seatY, look.forward), on: 0,
      mixer, idle, move, blender: new ActionBlender(idle), legs: look.legs ?? RIDE_LEGS,
    };
    object.scale.setScalar(scale * 0.01);
    this.effects?.ring(this.object.position, 0.8, PUFF_COLOR);
  }

  private drop(ride: Riding): void {
    this.object.remove(ride.object);
    ride.mixer.stopAllAction();
    if (this.leaving === ride) this.leaving = null;
    if (!this.riding) this.body.position.set(0, 0, 0);
  }

  // Getting on (the mount grows in, the rider hops up and sits) or off (the other way round), and the
  // mount's own walk or stand.
  // Unposed (out of view), only the getting on or off moves along.
  private stepMount(ride: Riding, on: boolean, moving: boolean, dt: number, posed = true): void {
    ride.on = Math.max(0, Math.min(1, ride.on + (on ? dt : -dt) / MOUNT_SECONDS));
    const k = ride.on;
    if (!posed) {
      if (!on && k <= 0) this.drop(ride);
      return;
    }
    ride.object.scale.setScalar(ride.scale * Math.max(0.01, on ? easeOutBack(k) : smooth(k)));
    const hop = MOUNT_HOP * Math.sin(Math.PI * k);
    this.body.position.set(0, ride.seat.y * smooth(k) + (k < 1 ? hop : 0), ride.seat.z * smooth(k));
    ride.blender.fadeTo(moving ? ride.move : ride.idle);
    ride.mixer.update(dt);
    this.object.updateMatrixWorld(true);
    this.sitLegs(smooth(k), ride.legs);
    if (!on && k <= 0) this.drop(ride);
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
  // The bends are about the body's own axes (its right, and the way it faces): about the world's, the
  // legs knelt backwards facing one way and swung sideways facing another.
  private sitLegs(weight: number, bend: RideLegs): void {
    if (!this.legs || weight <= 0) return;
    this.body.updateMatrixWorld(true);
    const frame = this.body.getWorldQuaternion(new THREE.Quaternion());
    const across = X_AXIS.clone().applyQuaternion(frame);
    const ahead = Z_AXIS.clone().applyQuaternion(frame);
    for (const leg of this.legs) {
      turnInWorld(leg.upper, across, -bend.thigh * weight);
      turnInWorld(leg.upper, ahead, leg.side * bend.spread * weight);
      turnInWorld(leg.lower, across, bend.knee * weight);
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
      ride: THREE.AnimationClip.findByName(clips, "Idle") ? action("Idle") : idle,
      walk: action(rig.walk),
      run: action(rig.run),
      attacks: rig.attacks.map((n) => once(action(n), false)),
      // A model with no roll (and none borrowed) slides along standing rather than failing to load.
      roll: once(THREE.AnimationClip.findByName(clips, rig.roll) ? action(rig.roll) : mixer.clipAction(clipByName(clips, rig.idle).clone()), false),
      death: once(action(rig.death), true),
      skill: once(action(rig.skill), false),
      blender: new ActionBlender(idle),
    };
  }

  // With a view, a hero outside it is hidden and its clips and mount are not posed until it comes back.
  sync(pose: Pose | null, status: PlayerStatus, dt: number, view: THREE.Frustum | null = null): void {
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
    // A higher roll count is a dodge roll: the tumble, sped up to the roll's length, cuts any swing short.
    const roll = pose.roll ?? 0;
    if (this.lastRoll !== null && roll > this.lastRoll && !this.dead) {
      this.rollLeft = ROLL.seconds + ROLL_TAIL;
      a.roll.timeScale = a.roll.getClip().duration / this.rollLeft;
      this.swingLeft = 0;
      this.commitLeft = 0;
      if (a.blender.active === a.roll) a.roll.reset().play();
      else a.blender.fadeTo(a.roll, 0.04);
    }
    this.lastRoll = roll;
    this.rollLeft = Math.max(0, this.rollLeft - dt);
    this.fireShots(dt, pose.yaw);
    this.swingLeft = Math.max(0, this.swingLeft - dt);
    this.commitLeft = Math.max(0, this.commitLeft - dt);
    const moving = Math.hypot(dx, dz) >= MOVING;
    // Walking off once the swing has landed ends it.
    if (this.swingLeft > 0 && this.commitLeft === 0 && moving) this.swingLeft = 0;

    if (this.dead) a.blender.fadeTo(a.death, 0.1);
    else if (this.rollLeft > 0 || this.swingLeft > 0) {
      // The tumble, or the swing, plays through.
    }
    // A rider sits still; the mount does the walking.
    else a.blender.fadeTo(this.riding ? a.ride : this.moveClip(a, dx, dz, pose.yaw));
    this.bounds.center.set(p.x, p.y + 1, p.z);
    const seen = view === null || view.intersectsSphere(this.bounds);
    this.object.visible = seen;
    if (!seen) {
      this.unseen = Math.min(MAX_CATCH_UP, this.unseen + dt);
      if (this.riding) this.stepMount(this.riding, true, moving, dt, false);
      else if (this.leaving) this.stepMount(this.leaving, false, moving, dt, false);
      return;
    }
    const step = dt + this.unseen;
    this.unseen = 0;
    a.mixer.update(step);
    if (this.riding) this.stepMount(this.riding, true, moving, step);
    else if (this.leaving) this.stepMount(this.leaving, false, moving, step);
  }

  private readonly bounds = new THREE.Sphere(new THREE.Vector3(), VIEW_RADIUS);
  // Time gone by unanimated, out of view.
  private unseen = 0;

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
