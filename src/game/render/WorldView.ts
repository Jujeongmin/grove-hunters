import { FrameGovernor } from "./frameGovernor";
import * as THREE from "three";
import { mountObject } from "./mountLooks";
import { VIP_MIGHT } from "../account/premium";
import { skillLearned } from "../account/tutorial";
import type { OtherPlayer, Payout, WorldClient } from "../../net/worldClient";
import { ITEMS, POTION_GAP_MS } from "../account/items";
import { levelOf } from "../account/level";
import { questWay, zonesWith, type Entry, type QuestTrip } from "../world/questRoute";
import { npcMarker, type NpcMarker } from "../world/dialogue";
import { iconFor } from "./icons";
import { GroveScene, HOUSE_YAW, groveModels } from "./groveScene";
import type { GroveView } from "../world/grove";
import { ModelLibrary } from "../assets/ModelLibrary";
import { WEAPONS, type PlayerClass } from "../combat/classes";
import { AIM_GRACE, facing, inStrikeReach } from "../combat/melee";
import { SKILL_KEYS, SKILL_SLOTS, skillAt, skillTargets, type Skill } from "../combat/skills";
import { readJob, type JobId } from "../combat/jobs";
import { PLAYER_BODY, crowdBlocks, type Body } from "../rules/crowd";
import { solidAt, solidWith, type LevelLayout } from "../rules/levelLayout";
import {
  GROUNDED, MAX_STEP_SECONDS, PLAYER_RADIUS, WALK_SPEED, applyLook, stepAround, stepJump, stepPlayer, turnToward, walkYaw, type Airborne,
  type SolidTest,
} from "../rules/movement";
import { lineClear, walkRoute } from "../rules/pathing";
import { groundAt, platformBlocks } from "../rules/platforms";
import { CHASE, chaseCamera, shoulderFor } from "../rules/chaseCamera";
import {
  BOSS_MOVES, GROVE_GUARDIAN_ZONE, MONSTERS, bodyOf, ZONE_BOSS, ZONE_MONSTERS, type MonsterState, type MonsterType,
} from "../world/monsters";
import { Threats } from "../world/threats";
import { MOUNTS, type MountId } from "../account/mounts";
import type { Point2 } from "../rules/levelLayout";
import { NPCS, npcNear, npcFacing, npcSpot, npcsIn, type NpcId } from "../world/npcs";
import { NpcActor } from "./NpcActor";
import type { Pose } from "../world/types";
import { PORTAL_RADIUS, ZONES, portalsOf, zoneLayout, type Portal, type ZoneEntry, type ZoneId } from "../world/zones";
import { playCue, preloadCues } from "../audio/sfx";
import { costumeById, type Costume } from "./costumes";
import { ARROW_MODEL, Effects, type ShotKind } from "./effects";
import { magicCircle } from "./magicCircle";
import { FpsInput } from "./FpsInput";
import { HEROES, HERO_MODELS, heroClips } from "./heroes";
import { ROLL, ROLL_SPEED } from "../combat/roll";
import { createLabel, setLabel } from "./labels";
import { LEVEL_MODELS, VIEW_FAR, buildLevelScene } from "./levelScene";
import type { LodBatch } from "./lodBatch";
import { TelegraphLayer } from "./telegraphMarks";
import { lookOf } from "./regionLook";
import { GUILD_BOSSES } from "../world/guildBoss";
import { BRACKETS } from "../world/dungeon";
import type { Telegraph } from "../world/telegraphs";
import { MonsterActor } from "./MonsterActor";
import { MONSTER_SKINS } from "./monsterLooks";
import { PlayerActor } from "./PlayerActor";
import { QUALITY, hotbarFor, onSettings, settings } from "../../ui/settings";
import { itemName, jobLabel, monsterName, npcName, npcRole, zoneName } from "../../ui/names";
import { t } from "../../ui/lang";

export const LOOK_SENSITIVITY = 0.0022;
// A portal is a summoning circle (Magic Summoning Circle, CityBuildingKit, CC0).
const PORTAL_MODEL = "fx_summon_circle";
// The circle comes without its pictures: its parts are coloured here (stone, the runed plate, wood).
const PORTAL_PAINT: [string, number, number][] = [["Summoning", 0x7fb6e8, 0x2a5f9e], ["Wood", 0x8a5a2b, 0], ["", 0x9aa0a8, 0]];

function paintPortal(object: THREE.Object3D): THREE.Object3D {
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const old = mesh.material as THREE.Material;
    const [, color, glow] = PORTAL_PAINT.find(([name]) => old.name.includes(name))!;
    mesh.material = new THREE.MeshStandardMaterial({ color, emissive: glow, roughness: 0.9 });
  });
  return object;
}
// Every mount's model, warmed up this long after the world starts (see start).
export const WORLD_MODELS = [...new Set([...LEVEL_MODELS, ...HERO_MODELS, ARROW_MODEL, PORTAL_MODEL])];

// Outdoors nothing roofs the camera in; this only keeps it from flying off.
const SKY_CEILING = 30;
// Share of walking speed kept while the guard is up.
const HUD_INTERVAL_MS = 150;
// A HUD that changed nothing still goes out this often (the screen's clocks ride on it).
const HUD_HEARTBEAT_MS = 1000;
// A portal only takes you once you have stepped this far clear of it (you arrive right beside one).
const PORTAL_REARM = PORTAL_RADIUS + 0.8;
// Auto-battle looks for monsters this close, and lets one go once it is this far.
const AUTO_SEEK = 60;
const AUTO_DROP = 70;
// Auto-battle walks in until this share of your reach.
const AUTO_CLOSE = 0.8;
// How quickly the camera turns to follow an auto-battle.
const AUTO_CAMERA_RATE = 2.5;
// How quickly you turn to face the way the pad walks you.
const TURN_RATE = 14;
// Heading for a quest's monsters, the route is worked out again this often.
const ROUTE_MS = 1500;
// Auto-battle that has moved less than STUCK_DISTANCE for this long takes a new route; for longer,
// it gives up on that monster for UNREACHABLE_MS.
const STUCK_DISTANCE = 0.6;
const STUCK_REROUTE_MS = 1200;
const STUCK_GIVE_UP_MS = 4000;
const UNREACHABLE_MS = 10_000;
// A walk to an NPC ends this close to them.
const TALK_ARRIVE = 2.2;
// Talking to someone, the camera comes round to their face over this many seconds (and goes back).
const DIALOGUE_EASE_S = 0.6;
// The picture over each NPC's head, by what it means (see dialogue.ts).
const MARKER_ICONS: Record<NpcMarker, string> = {
  quest: "marker_quest", report: "marker_report", shop: "ui_shop", forge: "ui_forge",
};
// On a quest trip, a portal is walked this far into, well inside the ring that takes you through.
const PORTAL_ARRIVE = 0.5;
// A spot tapped on the map this close to a way out means the way out (the map is coarse).
const MAP_PORTAL_SNAP = 8;
// A route's corner counts as reached this close.
const WAYPOINT_REACH = 1.2;
// A heal is used on its own once health falls below this share.
const AUTO_HEAL_BELOW = 0.75;
// A click with no monster in your arc still turns you to one this far round from where you look.
const AIM_ASSIST = Math.PI * 0.6;
// No two skills go off closer together than this.
const SKILL_GAP_MS = 900;
// A monster's loss of health this soon after your skill hit it shows as a skill's big number.
const SKILL_NUMBER_MS = 1500;
// How long the red edge flash lasts after a blow.
const HURT_FLASH_MS = 350;
// A quest's walk puts you on your mount after this long on the move (seconds), when more than this
// much of the way is left (metres); without a mount the server is asked again after this long (ms).
const AUTO_MOUNT_SECONDS = 2;
const AUTO_MOUNT_WAY = 12;
const NO_MOUNT_RETRY_MS = 60_000;
// How long a note of gold or a drop stays up.
const NOTE_MS = 3000;
// The zone's boss and the grove's guardian: marked on the map, and their health shown at the top.
const isBoss = (type: MonsterType) => type === "grove_guardian" || Object.values(ZONE_BOSS).includes(type);
// In a hidden tab the game steps this often (ms), and no step covers more than this (s).
const BACKGROUND_STEP_MS = 200;
// A monster falling further off than this makes no sound.
const DIE_HEARD = 18;
const BACKGROUND_MAX_DT = 0.25;

// How far a house model is turned for its door to face each way (it is built facing +z, south).

// The monster models a zone needs.
function zoneMonsterModels(zone: ZoneId): string[] {
  const types: MonsterType[] = [...ZONE_MONSTERS[zone]];
  const boss = ZONE_BOSS[zone];
  // A boss brings its brood; the first field may be visited by the grove's guardian.
  if (boss) types.push(boss, BOSS_MOVES.summonType);
  if (zone === GROVE_GUARDIAN_ZONE) types.push("grove_guardian");
  // A guild's arena may hold any of the week's bosses, and the glub's brood.
  if (zone === "arena") types.push(...GUILD_BOSSES, "glub_brood");
  // The Trial Dungeon may hold any bracket's waves and boss.
  if (zone === "dungeon") for (const b of BRACKETS) types.push(...b.waves, b.boss, "glub_brood");
  return [...new Set(types.map((t) => MONSTER_SKINS[t].model))];
}

export interface WorldHud {
  zone: string;
  zoneId: ZoneId;
  channel: number;
  // Where you stand and which way you look, for the map.
  me: { x: number; z: number; yaw: number };
  // The portal you stand at, and the level it asks for when yours is under it.
  portal: { to: string; needLevel: number | null } | null;
  // The four slots of the bar (keys 1 to 4): the skill each holds, or null while empty.
  skills: ({ skill: number; readyInMs: number; cooldownMs: number; level: number; open: boolean } | null)[];
  // Whole seconds until the dodge roll may go again; 0 when it may.
  rollIn: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  // XP lost to the last fall.
  lostXp: number;
  level: number;
  xpInto: number;
  xpNeed: number;
  auto: boolean;
  // The mount you are on, if any.
  riding: MountId | null;
  // Auto-battle is hunting for a quest's monsters.
  seeking: boolean;
  // Of that: on the way to the elder to report it; and, on a hunt, at grips with one of them.
  toElder: boolean;
  fighting: boolean;
  // How far is left to walk on the way you were sent (a quest's monster, the elder, a portal on the
  // way to another zone, a spot on the map), in metres.
  way: number | null;
  // Where the boss and the grove's guardian are, once the village's watchtower shows them.
  bosses: { x: number; z: number }[];
  // The village NPC you are standing by, to talk to.
  npc: { id: NpcId; name: string; role: string } | null;
  // The monster you are fighting.
  // The boss you fight, for the bar at the top (other monsters carry their bar over their heads).
  target: { name: string; hp: number; maxHp: number } | null;
  // How strongly the screen's edge flashes red (0 to 1), just after a blow.
  hurt: number;
  // Potions in the bag (Q drinks one), and what the last kills paid.
  potions: number;
  notes: string[];
}

export interface WorldViewOptions {
  entry: ZoneEntry;
  playerClass: PlayerClass;
  costume: Costume;
  name: string;
  onProgress?: (done: number, total: number) => void;
  // Walking into a portal asks to go through.
  onTravel: (to: ZoneId) => void;
  // Talking to a village NPC (E, the pad's button, or arriving where you were sent).
  onTalk: (id: NpcId) => void;
  // A quest trip carried in from the zone before, if any, and word whenever the trip changes, so
  // the next zone's view can carry it on.
  trip: QuestTrip | null;
  onTrip: (trip: QuestTrip | null) => void;
}

// One zone of the open world on screen: the forest and its portals, you (over the shoulder) and the
// others and the monsters in your channel. Moving, jumping, guarding, attacking and your skill are
// drawn here and sent through the WorldClient; the server decides what they hit. Auto-battle (its button)
// walks you to the nearest monster, fights it and uses your skill when it helps.
export class WorldView {
  // Smoothed edges only at the high graphics quality: a phone's GPU pays dearly for them (the world is
  // built again on every travel, so a changed quality takes hold at the next one).
  private readonly renderer = new THREE.WebGLRenderer({ antialias: settings().quality === "high" });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(70, 1, 0.1, VIEW_FAR);
  private readonly clock = new THREE.Clock();
  private readonly input: FpsInput;
  private readonly effects = new Effects(this.scene);
  // The marks of telegraphed attacks on the ground.
  private readonly marks = new TelegraphLayer();
  private readonly others = new Map<string, { actor: PlayerActor; key: string; look?: OtherPlayer["look"]; showNames?: boolean }>();
  private readonly monsters = new Map<string, MonsterActor>();
  private readonly npcs: { id: NpcId; actor: NpcActor; at: Point2 }[] = [];
  private readonly raycaster = new THREE.Raycaster();
  // The grove's week and the village (see grove.ts), as last read, and how the world shows them.
  private groveView: GroveView | null = null;
  private grove: GroveScene | null = null;
  // A talk under way: whom with, how far the camera has come round to them (0 to 1), and whether it
  // is going back.
  private dialogue: { id: NpcId; blend: number; closing: boolean } | null = null;
  // Where you were sent to walk (to an NPC), and whom to talk to on arrival.
  // Where you were sent: to talk to someone at the end, or into a portal on a quest trip.
  private walkGoal: { to: Point2; talk: NpcId | null; portal?: boolean } | null = null;
  // The quest trip under way (see questRoute.ts), and one carried in, begun once you are in the room.
  private trip: QuestTrip | null = null;
  private tripToResume: QuestTrip | null;
  private readonly hudListeners = new Set<(hud: WorldHud) => void>();
  // Told when you asked for your mount by hand and have none (the screen opens the stable).
  private readonly noMountListeners = new Set<() => void>();
  private readonly layout: LevelLayout;
  private readonly portals: Portal[];
  private readonly walls: SolidTest;
  private readonly resizeObserver: ResizeObserver;
  private resizeFrame = 0;
  private library: ModelLibrary | null = null;
  private readonly portalGlows: THREE.Object3D[] = [];
  private me: PlayerActor | null = null;
  private pose: Pose;
  private air: Airborne = GROUNDED;
  private yaw = 0;
  private pitch = 0;
  private swings = 0;
  // Dodge rolls made (sent with the pose, so a new one shows), the one under way (what is left of it
  // and which way it goes), and when the next may come.
  private rolls = 0;
  private rolling: { left: number; yaw: number } | null = null;
  private rollReadyAt = 0;
  private skills = 0;
  private lastAttackAt = Number.NEGATIVE_INFINITY;
  // When each skill slot was last used, and which one went last (others see it by the slot).
  private readonly lastSkillAt = Array.from({ length: SKILL_SLOTS }, () => Number.NEGATIVE_INFINITY);
  private lastSlot = 0;
  // The level the last HUD went out with, so a level going up rings once.
  private lastLevel: number | null = null;
  private bodies: Body[] = [];
  // No portal takes you until you have walked clear of the one you came through.
  private portalArmed = false;
  private travelling = false;
  private lastHudAt = Number.NEGATIVE_INFINITY;
  private auto = false;
  private target: string | null = null;
  // Hunting for a quest: the kinds it asks for, and the route to the nearest one.
  private questSeek: MonsterType[] | null = null;
  private route: { points: Point2[]; at: number } | null = null;
  // Where auto-battle last made headway, and the monsters it gave up on (until when).
  private stuckSince: { x: number; z: number; at: number } | null = null;
  private readonly unreachable = new Map<string, number>();
  // The mount you are on: yours at once when you get on or off, the server's word when it takes you
  // off (a blow, a strike); and the mount models being fetched.
  private riding: MountId | null = null;
  private serverRiding: MountId | null = null;
  // Getting on is asked of the server once at a time; how long you have been walking where a quest
  // sent you (a couple of seconds of it gets you on); and, after the server said you have no mount,
  // when to try again.
  private mounting = false;
  private sentFor = 0;
  private noMountUntil = 0;
  private readonly mountsLoading = new Set<string>();
  // The monsters swinging at you: auto-battle fights them first.
  private readonly threats = new Threats();
  private notes: { text: string; at: number }[] = [];
  private lastPotionAt = Number.NEGATIVE_INFINITY;
  // Your health last frame, to show what a blow took; the monsters your last skill hit, whose next
  // loss of health shows as a big number.
  private lastHp: number | null = null;
  private skillHits = new Map<string, number>();
  // When you were last hurt, for the red flash at the screen's edge.
  private hurtAt = Number.NEGATIVE_INFINITY;
  private frame = 0;
  private disposed = false;

  private readonly isSolid = (x: number, z: number) =>
    this.walls(x, z) || platformBlocks(this.layout.platforms, x, z, this.air.y) || crowdBlocks(this.bodies, this.pose, x, z);

  constructor(
    private readonly container: HTMLElement,
    private readonly client: WorldClient,
    private readonly options: WorldViewOptions,
  ) {
    this.layout = zoneLayout(options.entry.zone);
    this.portals = portalsOf(options.entry.zone);
    this.tripToResume = options.trip;
    this.walls = solidWith(this.layout, Infinity);
    this.pose = { x: options.entry.x, z: options.entry.z, yaw: 0 };
    // As many pixels a point as the graphics quality allows (phones start at 1.5: small screens, warm
    // chips), fewer while frames come late (see frameGovernor.ts).
    const cap = () => Math.min(window.devicePixelRatio, QUALITY[settings().quality].pixelRatio);
    const floor = () => Math.min(cap(), QUALITY[settings().quality].floor);
    this.governor = new FrameGovernor(cap(), floor());
    this.renderer.setPixelRatio(this.governor.pixelRatio);
    this.stopQuality = onSettings(() => {
      // A ratio of one draws the same at every quality; the floor still differs.
      if (cap() === this.governorCap && floor() === this.governorFloor) return;
      this.governorCap = cap();
      this.governorFloor = floor();
      this.governor.setCap(this.governorCap, floor());
      this.renderer.setPixelRatio(this.governor.pixelRatio);
      this.resize();
    });
    this.governorCap = cap();
    this.governorFloor = floor();
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);
    this.input = new FpsInput(this.renderer.domElement);
    this.scene.add(this.camera);
    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => this.resize());
    });
    this.resizeObserver.observe(container);
    this.resize();
  }

  async start(): Promise<void> {
    const library = await ModelLibrary.load();
    const npcModels = [...new Set(npcsIn(this.options.entry.zone).map((n) => n.model))];
    const houseModels = [...new Set((ZONES[this.options.entry.zone].houses ?? []).map((h) => h.model))];
    await library.preload(
      [...WORLD_MODELS, ...zoneMonsterModels(this.options.entry.zone), ...npcModels, ...houseModels, ...groveModels(this.options.entry.zone)],
      this.options.onProgress,
    );
    // React StrictMode mounts twice; the first view may be gone by now.
    if (this.disposed) return;
    this.library = library;
    this.effects.useModels(library);
    this.lod = buildLevelScene(this.scene, library, this.layout, this.renderer, this.doorways(), lookOf(ZONES[this.options.entry.zone].region));
    this.addPortals();
    this.addHouses();
    this.grove = new GroveScene(this.scene, library, this.layout, this.options.entry.zone);
    this.grove.set(this.groveView);
    // Your own name stays off: the camera is right behind you and it would only cover the view.
    this.me = this.hero(this.options.playerClass, this.options.costume);
    this.addNpcs();
    // Every shader of what stands in the zone made now, behind the loading screen, rather than on the
    // frame something first comes into view.
    this.renderer.compile(this.scene, this.camera);
    this.clock.start();
    preloadCues();
    this.frame = requestAnimationFrame(this.tick);
    this.startBackgroundSteps();
  }

  // For checking the game from the browser console in development.
  debugHandle(): {
    pose: () => Pose; setPose: (p: { x: number; z: number; yaw?: number }) => void; npcs: () => unknown; zone: string;
    drawn: () => { calls: number; triangles: number; geometries: number; textures: number };
    heaviest: () => [string, number][]; shoot: (kind: ShotKind, turn?: number) => void;
  } {
    return {
      zone: this.options.entry.zone,
      drawn: () => ({ ...this.renderer.info.render, ...this.renderer.info.memory }),
      // Triangles per kind of mesh across the scene (instances counted), heaviest first.
      heaviest: () => {
        const by = new Map<string, number>();
        this.scene.traverse((o) => {
          const mesh = o as THREE.Mesh & { count?: number; isInstancedMesh?: boolean };
          if (!mesh.isMesh || !mesh.visible) return;
          const g = mesh.geometry;
          const tris = (g.index ? g.index.count : g.getAttribute("position").count) / 3;
          const n = mesh.isInstancedMesh ? mesh.count ?? 1 : 1;
          // Named by the mesh, or the nearest named thing it hangs from.
          let named: THREE.Object3D | null = mesh;
          while (named && !named.name) named = named.parent;
          const key = (named?.name.split(":")[0].split("|")[0] || `?${mesh.type}:${(mesh.material as THREE.Material).type}:${n}`).slice(0, 40);
          by.set(key, (by.get(key) ?? 0) + tris * n);
        });
        return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
      },
      npcs: () => this.npcs.map((n) => ({ id: n.id, at: n.at, shown: n.actor.object.visible, pos: n.actor.object.position.toArray() })),
      pose: () => ({ ...this.pose }),
      // A shot from where you stand, the way you face, to see the effect.
      shoot: (kind, turn = 0) => this.effects.shoot(kind, new THREE.Vector3(this.pose.x, 1.1, this.pose.z), this.yaw + turn, 20),
      setPose: (p) => {
        this.pose = { x: p.x, z: p.z, yaw: p.yaw ?? this.yaw };
        if (p.yaw !== undefined) this.yaw = p.yaw;
      },
    };
  }

  // Auto-battle on or off (the HUD button).
  toggleAuto(): void {
    this.auto = !this.auto;
    this.questSeek = null;
    this.walkGoal = null;
    if (this.trip) this.setTrip(null);
    this.route = null;
    if (!this.auto) this.target = null;
  }

  // Goes hunting for the monsters a quest asks for: auto-battle walks to the nearest of those kinds,
  // wherever it stands in the zone, and fights them until told otherwise. When they live in another
  // field, the trip heads through the portals there first.
  seekQuest(types: readonly MonsterType[]): void {
    this.startTrip({ kind: "hunt", types: [...types] });
  }

  // Heads for the nearest town's elder (the village's, or the snow outpost's captain), from anywhere
  // (to report a quest), and talks on arrival.
  goToElder(): void {
    this.startTrip({ kind: "elder" });
  }

  private startTrip(trip: QuestTrip): void {
    const goals = trip.kind === "hunt" ? zonesWith(trip.types) : [...new Set(NPCS.filter((n) => n.role === "elder").map((n) => n.zone))];
    const way = questWay(this.options.entry.zone, goals, (zone) => this.entryTo(zone));
    const note = (text: string) => this.notes.push({ text, at: performance.now() });
    this.setTrip(null);
    if (way.kind === "nowhere") {
      note(t("note.notHere"));
    } else if (way.kind === "locked") {
      note(t("note.questLevel", { zone: zoneName(way.zone), n: ZONES[way.zone].minLevel }));
    } else if (way.kind === "here") {
      if (trip.kind === "elder") {
        const elder = npcsIn(this.options.entry.zone).find((n) => n.role === "elder");
        if (elder) this.walkToNpc(elder.id);
        return;
      }
      this.walkGoal = null;
      this.questSeek = [...trip.types];
      this.route = null;
      this.target = null;
      this.auto = true;
    } else {
      const portal = this.portals.find((p) => p.to === way.next);
      if (!portal) return;
      this.walkGoal = { to: portal, talk: null, portal: true };
      this.auto = false;
      this.questSeek = null;
      this.route = null;
      this.target = null;
      this.setTrip(trip);
    }
  }

  private setTrip(trip: QuestTrip | null): void {
    this.trip = trip;
    this.options.onTrip(trip);
  }

  // Whether you may go into a zone, as its portal will judge it.
  private entryTo(zone: ZoneId): Entry {
    if (levelOf(this.client.state.me?.xp ?? 0).level < ZONES[zone].minLevel) return "level";
    return "open";
  }

  // Walks you to an NPC of this town and opens the talk on arrival (the quest tracker's report).
  walkToNpc(id: NpcId): void {
    if (!npcsIn(this.options.entry.zone).some((n) => n.id === id)) return;
    this.setTrip(null);
    this.walkGoal = { to: npcSpot(id), talk: id };
    this.auto = false;
    this.questSeek = null;
    this.route = null;
  }

  // Walks you to a place picked on the map. Nothing waits at the end; the forest and the houses are
  // turned away rather than walked into.
  walkToSpot(to: Point2): void {
    if (solidAt(this.layout, to.x, to.z)) {
      this.notes.push({ text: t("note.cannotWalk"), at: performance.now() });
      return;
    }
    this.setTrip(null);
    // A spot on (or right by) a way out is walked right into, so the map's portals take you on.
    const portal = this.portals.find((p) => Math.hypot(p.x - to.x, p.z - to.z) <= MAP_PORTAL_SNAP);
    this.walkGoal = portal ? { to: { x: portal.x, z: portal.z }, talk: null, portal: true } : { to, talk: null };
    this.auto = false;
    this.questSeek = null;
    this.route = null;
  }

  // The on-screen buttons: a skill or the potion by tap, a jump, talking to the NPC close by.
  talk(): void {
    if (this.dialogue) return;
    const id = npcNear(this.options.entry.zone, this.pose.x, this.pose.z);
    if (id) this.options.onTalk(id);
  }

  tapSkill(slot: number): void {
    this.input.press(SKILL_KEYS[slot]);
  }

  tapPotion(): void {
    this.input.press("KeyQ");
  }

  // On your mount (the one picked in the mounts panel), or off it (T, or the pad's button).
  toggleRide(): void {
    if (this.riding) {
      this.getOff();
      return;
    }
    this.getOn(true);
  }

  // Asks the server to put you on your mount. Asked by hand, it always asks; on its own (a quest's
  // walk), not again for a while once the server has said you have none.
  private getOn(byHand = false): void {
    if (this.mounting || this.riding || this.client.state.me?.dead) return;
    if (!byHand && performance.now() < this.noMountUntil) return;
    this.mounting = true;
    void this.client.ride(true).then((id) => {
      this.mounting = false;
      this.riding = id;
      if (id) playCue("open");
      else {
        this.noMountUntil = performance.now() + NO_MOUNT_RETRY_MS;
        // Asked by hand: say why nothing happened, and show where a mount comes from.
        if (byHand) {
          this.notes.push({ text: t("mount.none"), at: performance.now() });
          for (const cb of this.noMountListeners) cb();
        }
      }
    });
  }

  // Attacking takes you off your mount (the server does the same on its side).
  private getOff(): void {
    if (!this.riding) return;
    this.riding = null;
    this.sentFor = 0;
    playCue("close");
    void this.client.ride(false);
  }

  // Puts an actor on its mount (or off), once the mount's model has come.
  private applyMount(actor: PlayerActor, id: MountId | null): void {
    if (actor.mountId === id) return;
    if (!id) {
      actor.setMount(null);
      return;
    }
    const library = this.library!;
    const model = MOUNTS[id].model;
    if (!library.has(model)) {
      if (!this.mountsLoading.has(model)) {
        this.mountsLoading.add(model);
        void library.preload([model]).catch(() => this.mountsLoading.delete(model));
      }
      return;
    }
    actor.setMount({ id, object: mountObject(library, id), clips: library.get(model).animations });
  }

  // The models, for the mounts panel's stage.
  get models(): ModelLibrary | null {
    return this.library;
  }

  tapJump(): void {
    this.input.press("Space");
  }

  // The on-screen joystick and look area feed the same input as the keyboard and mouse.
  get controls(): FpsInput {
    return this.input;
  }

  onHud(cb: (hud: WorldHud) => void): () => void {
    this.hudListeners.add(cb);
    return () => {
      this.hudListeners.delete(cb);
    };
  }

  onNoMount(cb: () => void): () => void {
    this.noMountListeners.add(cb);
    return () => {
      this.noMountListeners.delete(cb);
    };
  }

  dispose(): void {
    this.disposed = true;
    this.marks.dispose();
    cancelAnimationFrame(this.frame);
    this.stopBackground();
    this.stopQuality();
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.resizeFrame);
    this.effects.dispose();
    this.grove?.dispose();
    this.input.dispose();
    this.renderer.dispose();
    // A zone's context goes with it (each zone makes a new one; a browser keeps only a few).
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.hudListeners.clear();
  }

  private tick = (): void => {
    this.frame = requestAnimationFrame(this.tick);
    if (this.powerSave) {
      // Power saving: nothing drawn, and the game stepped only as often as in a hidden tab.
      const now = performance.now();
      if (now - this.lastSavedStep < BACKGROUND_STEP_MS) return;
      this.lastSavedStep = now;
      this.step(Math.min(this.clock.getDelta(), BACKGROUND_MAX_DT), false);
      return;
    }
    this.step(Math.min(this.clock.getDelta(), 0.1), !this.covered);
    if (this.covered) return;
    const ratio = this.governor.frame(performance.now());
    if (ratio !== null) {
      this.renderer.setPixelRatio(ratio);
      this.resize();
    }
  };

  private powerSave = false;
  // What the camera saw last frame: monsters outside it are skipped (see MonsterActor.sync).
  private readonly view = new THREE.Frustum();
  private readonly viewMatrix = new THREE.Matrix4();
  private readonly governor: FrameGovernor;
  private governorCap: number;
  private governorFloor: number;
  // Trees and ground cover near you in full, further off as pictures or not at all.
  private lod: LodBatch | null = null;
  private lastSavedStep = 0;

  // Power saving (절전): the screen shows a summary instead of the world, which goes on undrawn.
  setPowerSave(on: boolean): void {
    this.powerSave = on;
  }

  // A window over the whole screen (the stable): the world goes on but is not drawn under it.
  setCovered(on: boolean): void {
    this.covered = on;
  }

  private covered = false;

  // A hidden tab gets no animation frames: then a worker's timer steps the game (moving, fighting,
  // potions, poses to the server) without drawing it, so auto-battle goes on while you look elsewhere.
  private startBackgroundSteps(): void {
    const onBeat = () => {
      if (this.disposed || !document.hidden) return;
      this.step(Math.min(this.clock.getDelta(), BACKGROUND_MAX_DT), false);
    };
    try {
      const source = `setInterval(() => postMessage(0), ${BACKGROUND_STEP_MS});`;
      const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      const worker = new Worker(url);
      URL.revokeObjectURL(url);
      worker.onmessage = onBeat;
      this.stopBackground = () => worker.terminate();
    } catch {
      // No workers here (a strict embed): a plain timer, which a hidden tab slows to about once a second.
      const timer = setInterval(onBeat, BACKGROUND_STEP_MS);
      this.stopBackground = () => clearInterval(timer);
    }
  }

  private stopBackground: () => void = () => {};
  private stopQuality: () => void = () => {};

  // One step of the game: `draw` is false in a hidden tab, which only needs the game to go on.
  private step(dt: number, draw: boolean): void {
    const state = this.client.state;

    const look = this.input.consumeLook();
    const view = applyLook(this.yaw, this.pitch, look.dx, look.dy, LOOK_SENSITIVITY * settings().sensitivity);
    this.renderer.toneMappingExposure = settings().brightness;
    this.yaw = view.yaw;
    this.pitch = view.pitch;

    const dead = state.me?.dead === true;
    const here = state.phase === "in" && !this.travelling && !dead;
    // A quest trip carried in from the zone before goes on once you are here (your level decides
    // which portals it may take, so it waits for your state).
    if (this.tripToResume && here && state.me) {
      const trip = this.tripToResume;
      this.tripToResume = null;
      this.startTrip(trip);
    }
    // Mid-swing you stand still (and turn only through the attack itself).
    const rooted = this.me?.rooted === true;
    const potion = this.input.consumePress("KeyQ");
    const wantRoll = this.input.consumePress("Roll");
    if (!here) this.rolling = null;
    if (this.input.consumePress("KeyE")) this.talk();
    // A click or tap on someone in the village walks you to them to talk, instead of a blow.
    const click = this.input.consumeClick();
    const clicked = click && here && !this.dialogue ? this.npcAt(click) : null;
    if (clicked) {
      this.input.consumePress("VirtualFire");
      this.walkToNpc(clicked);
    }
    // Talking, you stand still and the pad and the buttons wait.
    const talking = this.dialogue !== null;
    if (this.input.consumePress("KeyR")) this.toggleAuto();
    if (this.input.consumePress("KeyT")) this.toggleRide();
    const serverRiding = state.me?.riding ?? null;
    if (serverRiding !== this.serverRiding) {
      this.serverRiding = serverRiding;
      this.riding = serverRiding;
    }
    // The auto potion works whether or not auto-battle is on, at the threshold the player set.
    const autoPotion = settings().autoPotion && !!state.me && state.me.hp <= state.me.maxHp * (settings().potionAt / 100);
    if (here && (potion || autoPotion)) this.drinkPotion();
    // You face the way you last walked (the camera turns on its own, by dragging).
    let facingYaw = this.pose.yaw;
    if (here) {
      // Other players are walked through (two standing on one spot could otherwise lock each other in);
      // monsters and the village folk still stand in the way.
      this.bodies = [];
      for (const m of Object.values(state.monsters)) {
        if (m.alive) this.bodies.push({ x: m.x, z: m.z, r: PLAYER_BODY + MONSTERS[m.type].body });
      }
      for (const npc of this.npcs) this.bodies.push({ x: npc.at.x, z: npc.at.z, r: PLAYER_BODY * 2 });
      const speed = WALK_SPEED * (this.riding ? MOUNTS[this.riding].speed : 1);
      const move = talking ? { forward: 0, strafe: 0 } : this.input.moveInput();
      const idle = move.forward === 0 && move.strafe === 0;
      // A dodge roll goes the way you are walking (where you face, standing still), not on a mount.
      const clock = performance.now();
      if (wantRoll && !talking && !this.riding && !this.rolling && clock >= this.rollReadyAt) {
        this.rolling = { left: ROLL.seconds, yaw: walkYaw(this.yaw, move) ?? this.pose.yaw };
        this.rollReadyAt = clock + ROLL.cooldownMs;
        this.rolls++;
      }
      // Your own steps cancel a walk you were sent on, and the trip it was part of.
      if (!idle) {
        this.walkGoal = null;
        if (this.trip) this.setTrip(null);
      }
      this.threats.watch(state.monsters, this.pose, performance.now());
      const chase = talking ? null
        : idle && this.walkGoal ? this.walkTo(this.walkGoal) : this.auto && idle ? this.autoChase(state.monsters) : null;
      // Sent somewhere by a quest (auto-hunting its monsters, or on the way to the elder), a couple of
      // seconds on the move gets you on your mount, if the way left is long enough to be worth it.
      const sent = (this.auto && this.questSeek !== null) || this.trip !== null || this.walkGoal !== null;
      this.sentFor = sent && chase?.walk === true && !rooted ? this.sentFor + dt : 0;
      if (this.sentFor >= AUTO_MOUNT_SECONDS && !this.riding && (this.wayLeft() ?? 0) > AUTO_MOUNT_WAY) this.getOn();
      if (this.rolling) {
        // The tumble carries you on, whatever else is going on.
        facingYaw = this.rolling.yaw;
        // In steps the movement rules take (a slow frame would otherwise cut the roll short), and no
        // further than what is left of it.
        for (let left = Math.min(dt, this.rolling.left); left > 1e-6; left -= MAX_STEP_SECONDS) {
          const step = Math.min(left, MAX_STEP_SECONDS);
          this.pose = stepAround({ ...this.pose, yaw: this.rolling.yaw }, this.rolling.yaw, step, this.isSolid, ROLL_SPEED);
        }
        this.rolling.left -= dt;
        if (this.rolling.left <= 0) this.rolling = null;
      } else if (rooted) {
        facingYaw = chase ? chase.yaw : this.pose.yaw;
      } else if (chase) {
        facingYaw = chase.yaw;
        // The camera swings round behind you to the fight, unless you are looking about yourself.
        if (look.dx === 0) this.yaw = turnToward(this.yaw, chase.yaw, dt, AUTO_CAMERA_RATE);
        if (chase.walk) this.pose = stepAround({ ...this.pose, yaw: chase.yaw }, chase.yaw, dt, this.isSolid, speed);
      } else {
        // The pad walks you round the camera; you turn to face the way you go.
        const heading = walkYaw(this.yaw, move);
        if (heading !== null) facingYaw = turnToward(this.pose.yaw, heading, dt, TURN_RATE);
        this.pose = stepPlayer({ ...this.pose, yaw: this.yaw }, move, dt, this.isSolid, speed);
      }
    }
    const jump = this.input.consumePress("Space");
    const ground = groundAt(this.layout.platforms, this.pose.x, this.pose.z, PLAYER_RADIUS);
    this.air = here ? stepJump(this.air, jump, dt, ground) : GROUNDED;
    facingYaw = this.handleActions(here && !talking, state.monsters, facingYaw);
    this.pose = {
      ...this.pose, yaw: facingYaw, y: this.air.y, roll: this.rolls, swing: this.swings, skill: this.skills,
      slot: this.lastSlot,
    };
    if (here) this.client.reportPose(this.pose);
    this.checkPortals(here);

    this.showHurt(state.me?.hp ?? null);
    this.syncActors(state.others, dt, dead);
    this.syncMonsters(state.monsters, dt);
    this.syncMarks(state.telegraphs);
    this.effects.update(dt, this.camera);
    for (const glow of this.portalGlows) glow.rotation.y += dt * 0.6;
    // The shoulder eases over to the open side, so the camera never jumps.
    this.shoulder += (shoulderFor(this.pose, this.yaw, this.walls) - this.shoulder) * (1 - Math.exp(-dt * 4));
    const cam = chaseCamera(this.pose, this.yaw, this.pitch, this.walls, SKY_CEILING, this.shoulder);
    this.camera.position.set(cam.x, cam.y, cam.z);
    this.lod?.setNear(QUALITY[settings().quality].near);
    // Round the camera, and only the way it looks: half its view across, from its height and shape.
    const halfWidth = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect);
    this.lod?.update(cam.x, cam.z, false, { yaw: this.yaw, halfWidth });
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    this.camera.updateMatrixWorld();
    this.view.setFromProjectionMatrix(this.viewMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
    this.frameDialogue(dt);
    this.emitHud();
    if (draw) this.renderer.render(this.scene, this.camera);
  }

  // Where auto-battle goes: toward the monster it is fighting (or the nearest one it can find), and
  // whether it still has to walk to reach it. Hunting for a quest, it picks the nearest of the asked
  // kinds anywhere in the zone and follows a route through the groves to it. Null when there is
  // nothing to fight.
  private autoChase(monsters: Record<string, MonsterState>): { yaw: number; walk: boolean } | null {
    const current = this.target ? monsters[this.target] : undefined;
    const now = performance.now();
    // A monster it could not get to is left alone for a while.
    for (const [id, until] of this.unreachable) if (until <= now) this.unreachable.delete(id);
    if (this.target && this.stuckFor(now) > STUCK_GIVE_UP_MS) {
      this.unreachable.set(this.target, now + UNREACHABLE_MS);
      this.target = null;
      this.route = null;
    }
    // Something hitting you comes first, whatever the quest asks for (unless the one it is on is
    // hitting you too); once it falls the hunt goes back to the quest's kinds.
    const hitter = this.threats.nearest(monsters, this.pose);
    if (hitter && hitter !== this.target && !(this.target && this.threats.has(this.target)) && !this.unreachable.has(hitter)) {
      this.target = hitter;
      this.route = null;
    }
    const wanted = (m: MonsterState, id: string) =>
      m.alive && !m.returning && !this.unreachable.has(id) && (!this.questSeek || this.questSeek.includes(m.type) || this.threats.has(id));
    if (!current || !wanted(current, this.target!) || (!this.questSeek && this.distanceTo(current) > AUTO_DROP)) {
      this.target = null;
      this.route = null;
      let best = this.questSeek ? Infinity : AUTO_SEEK;
      for (const [id, m] of Object.entries(monsters)) {
        const d = this.distanceTo(m);
        if (wanted(m, id) && d < best) {
          best = d;
          this.target = id;
        }
      }
    }
    const m = this.target ? monsters[this.target] : undefined;
    if (!m) return null;
    const reach = WEAPONS[this.options.playerClass].reach;
    const d = this.distanceTo(m);
    if (d <= reach * AUTO_CLOSE) {
      this.stuckSince = null;
      return { yaw: this.yawTo(m), walk: false };
    }
    // Straight at it when nothing stands between; otherwise by the route round the groves (walked
    // corner to corner), worked out again every so often and at once when it gets stuck.
    if (lineClear(this.layout, this.pose, m, PLAYER_RADIUS + 0.1)) {
      this.route = null;
      return { yaw: this.yawTo(m), walk: true };
    }
    const stuck = this.stuckFor(now) > STUCK_REROUTE_MS;
    if (!this.route || now - this.route.at > ROUTE_MS || stuck) {
      const points = walkRoute(this.layout, this.pose, m, PLAYER_RADIUS + 0.1);
      this.route = points ? { points, at: now } : null;
    }
    const points = this.route?.points;
    if (!points || points.length === 0) return { yaw: this.yawTo(m), walk: true };
    while (points.length > 1 && this.passed(points)) points.shift();
    return { yaw: this.yawTo(points[0]), walk: true };
  }

  // On a quest's hunt, with its monster near enough to be swinging at (or nearly).
  private fightingForQuest(): boolean {
    if (!this.auto || !this.questSeek || !this.target) return false;
    const m = this.client.state.monsters[this.target];
    return !!m && m.alive && this.distanceTo(m) <= WEAPONS[this.options.playerClass].reach * AUTO_CLOSE * 1.6;
  }

  // A talk begins: the camera comes round to the NPC's face and they turn to you. The screen shows the
  // words and ends the talk with endDialogue.
  beginDialogue(id: NpcId): void {
    this.walkGoal = null;
    this.auto = false;
    this.questSeek = null;
    this.target = null;
    this.dialogue = { id, blend: this.dialogue?.blend ?? 0, closing: false };
  }

  // The grove as the server last said: the sites, the flowers, the haze, and (with the watchtower
  // built) the bosses on the minimap.
  setGrove(view: GroveView | null): void {
    this.groveView = view;
    this.grove?.set(view);
  }

  endDialogue(): void {
    if (this.dialogue) this.dialogue.closing = true;
  }

  // The NPC under a click (client pixels), if any: the nearest whose body or marker the ray meets.
  private npcAt(click: { x: number; y: number }): NpcId | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ndc = new THREE.Vector2(((click.x - rect.left) / rect.width) * 2 - 1, -((click.y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    let best: { id: NpcId; d: number } | null = null;
    for (const npc of this.npcs) {
      const hit = this.raycaster.ray.intersectBox(npc.actor.hitBox(), new THREE.Vector3());
      if (!hit) continue;
      const d = hit.distanceTo(this.camera.position);
      if (!best || d < best.d) best = { id: npc.id, d };
    }
    return best?.id ?? null;
  }

  // During a talk the camera eases from over your shoulder to a close shot of the NPC's face (a
  // little to one side, so the words below leave them in view), and back when it ends. Your own
  // figure steps out of the shot while it is close.
  private frameDialogue(dt: number): void {
    const d = this.dialogue;
    if (!d) return;
    d.blend = Math.min(1, Math.max(0, d.blend + (d.closing ? -dt : dt) / DIALOGUE_EASE_S));
    if (d.closing && d.blend === 0) {
      this.dialogue = null;
      if (this.me) this.me.object.visible = true;
      return;
    }
    const npc = this.npcs.find((n) => n.id === d.id);
    const spec = NPCS.find((n) => n.id === d.id);
    if (!npc || !spec) return;
    const at = npc.actor.object.position;
    let dx = this.pose.x - at.x;
    let dz = this.pose.z - at.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // Across the line from them to you, to put them a little off the middle.
    const sx = -dz;
    const sz = dx;
    const eye = new THREE.Vector3(at.x + dx * 1.7 + sx * 0.4, spec.height * 0.9, at.z + dz * 1.7 + sz * 0.4);
    // Aimed below the face, so the face sits in the upper half of the screen above the words.
    const look = new THREE.Vector3(at.x + sx * 0.3, spec.height * 0.55, at.z + sz * 0.3);
    const shot = new THREE.Matrix4().lookAt(eye, look, new THREE.Vector3(0, 1, 0));
    const ease = d.blend * d.blend * (3 - 2 * d.blend);
    this.camera.position.lerp(eye, ease);
    this.camera.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(shot), ease);
    if (this.me) this.me.object.visible = ease < 0.5;
  }

  // Heading for a spot you were sent to: straight when clear, by the route otherwise. On arrival the
  // walk ends (and the talk it was for opens).
  private walkTo(goal: { to: Point2; talk: NpcId | null; portal?: boolean }): { yaw: number; walk: boolean } | null {
    // A portal is walked right into (it takes you on); a person is walked up to.
    if (this.distanceTo(goal.to) <= (goal.portal ? PORTAL_ARRIVE : TALK_ARRIVE)) {
      this.walkGoal = null;
      this.route = null;
      if (goal.talk) this.options.onTalk(goal.talk);
      return null;
    }
    if (lineClear(this.layout, this.pose, goal.to, PLAYER_RADIUS + 0.1)) return { yaw: this.yawTo(goal.to), walk: true };
    const now = performance.now();
    if (!this.route || now - this.route.at > ROUTE_MS) {
      const points = walkRoute(this.layout, this.pose, goal.to, PLAYER_RADIUS + 0.1);
      this.route = points ? { points, at: now } : null;
    }
    const points = this.route?.points;
    if (!points || points.length === 0) return { yaw: this.yawTo(goal.to), walk: true };
    while (points.length > 1 && this.passed(points)) points.shift();
    return { yaw: this.yawTo(points[0]), walk: true };
  }

  // The village's people, each their own model, their name and role in gold overhead, standing
  // turned toward where you arrive.
  // The ground just outside each house's door, where a path leads.
  private doorways(): Point2[] {
    const t = this.layout.tileSize;
    return (ZONES[this.options.entry.zone].houses ?? []).map((h) => {
      const yaw = HOUSE_YAW[h.face];
      const out = t + 1;
      return { x: (h.at[0] + 1) * t + Math.sin(yaw) * out, z: (h.at[1] + 1) * t + Math.cos(yaw) * out };
    });
  }

  // The zone's houses, each in the middle of its 2 by 2 block of cells, door the way it faces.
  private addHouses(): void {
    const t = this.layout.tileSize;
    for (const house of ZONES[this.options.entry.zone].houses ?? []) {
      const object = this.library!.instance(house.model);
      object.position.set((house.at[0] + 1) * t, 0, (house.at[1] + 1) * t);
      // The model's door faces +z (south).
      object.rotation.y = HOUSE_YAW[house.face];
      this.scene.add(object);
    }
  }

  private addNpcs(): void {
    const library = this.library!;
    for (const npc of npcsIn(this.options.entry.zone)) {
      const at = npcSpot(npc.id);
      // Looking out from their door.
      const out = npcFacing(npc.id);
      const yaw = Math.atan2(-out.x, -out.z);
      const actor = new NpcActor(
        library.instance(npc.model), library.get(npc.model).animations, npc, `${npcName(npc.id)} · ${npcRole(npc.id)}`, at.x, at.z, yaw,
      );
      this.scene.add(actor.object);
      this.npcs.push({ id: npc.id, actor, at });
    }
  }

  // Whether the route's next turn is reached: right on it, or near it with the one after already in
  // a clear straight line (so a corner round a log pile is never cut into it).
  private passed(points: Point2[]): boolean {
    const d = this.distanceTo(points[0]);
    if (d < 0.35) return true;
    return d < WAYPOINT_REACH && lineClear(this.layout, this.pose, points[1], PLAYER_RADIUS + 0.05);
  }

  // How long auto-battle has been walking without getting anywhere, in ms.
  private stuckFor(now: number): number {
    const at = { x: this.pose.x, z: this.pose.z };
    if (!this.stuckSince || Math.hypot(at.x - this.stuckSince.x, at.z - this.stuckSince.z) > STUCK_DISTANCE) {
      this.stuckSince = { ...at, at: now };
      return 0;
    }
    return now - this.stuckSince.at;
  }

  // What is left of the walk you were sent on, along its route where it has one.
  private wayLeft(): WorldHud["way"] {
    const goal = this.walkGoal?.to ?? (this.auto && this.questSeek && this.target ? this.client.state.monsters[this.target] : undefined);
    if (!goal) return null;
    const points = this.route?.points ?? [];
    let metres = 0;
    let from: Point2 = this.pose;
    for (const p of [...points, goal]) {
      metres += Math.hypot(p.x - from.x, p.z - from.z);
      from = p;
    }
    return metres;
  }

  private distanceTo(p: { x: number; z: number }): number {
    return Math.hypot(p.x - this.pose.x, p.z - this.pose.z);
  }

  // yaw 0 faces -z.
  private yawTo(p: { x: number; z: number }): number {
    return Math.atan2(-(p.x - this.pose.x), -(p.z - this.pose.z));
  }

  // The monster a blow from here lands on: the nearest one in your arc; failing that, the nearest in
  // reach not far round from where you look (you turn to it).
  private aim(monsters: Record<string, MonsterState>, yaw: number): string | null {
    const weapon = WEAPONS[this.options.playerClass];
    let best: { id: string; score: number } | null = null;
    for (const [id, m] of Object.entries(monsters)) {
      if (!m.alive) continue;
      const d = this.distanceTo(m);
      const edge = bodyOf(m) + AIM_GRACE;
      if (d > weapon.reach + edge || !facing({ ...this.pose, yaw }, m, AIM_ASSIST)) continue;
      const score = inStrikeReach({ ...this.pose, yaw }, m, weapon, false, edge) ? d : d + 100;
      if (!best || score < best.score) best = { id, score };
    }
    return best?.id ?? null;
  }

  // A click attacks (a bow or a staff shoots), keys 1 to 3 use the class's skills; in auto-battle
  // they all go by themselves. Returns where you face (toward what you hit).
  private handleActions(here: boolean, monsters: Record<string, MonsterState>, yaw: number): number {
    const pressed = SKILL_KEYS.map((key) => this.input.consumePress(key));
    if (!here || this.rolling) return yaw;
    const now = performance.now();
    const c = this.options.playerClass;
    const weapon = WEAPONS[c];
    const chasing = this.auto && this.target && monsters[this.target]?.alive ? this.target : null;
    const inReach = chasing && this.distanceTo(monsters[chasing]) <= weapon.reach + bodyOf(monsters[chasing]) + AIM_GRACE ? chasing : null;
    const firing = this.input.consumePress("VirtualFire") || this.input.firing;
    if ((firing || inReach) && now - this.lastAttackAt >= weapon.intervalMs) {
      const target = inReach ?? this.aim(monsters, yaw);
      if (target) yaw = this.yawTo(monsters[target]);
      this.lastAttackAt = now;
      this.swings += 1;
      this.getOff();
      const shot = HEROES[c].shot;
      playCue(shot ?? HEROES[c].swingCue);
      if (target) void this.client.strike(target, yaw);
    }
    if (now - Math.max(...this.lastSkillAt) < SKILL_GAP_MS) return yaw;
    // The bar's slots hold skills; a key or auto-battle picks a slot, and the skill in it is used.
    const bar = hotbarFor(c);
    const skillIn = (index: number) => skillAt(c, this.path, index);
    const ready = (index: number | null): index is number => {
      const skill = index === null ? null : skillIn(index);
      return skill !== null && this.learned(index!) && this.skillOpen(skill) && now - this.lastSkillAt[index!] >= skill.cooldownMs;
    };
    let slot = pressed.findIndex((p, i) => p && ready(bar[i]));
    // Auto-battle reaches for the strongest skill it may use that would help.
    if (slot < 0 && this.auto) {
      const allowed = settings().autoSkills;
      let bestDamage = -1;
      bar.forEach((index, i) => {
        if (!allowed[i] || !ready(index)) return;
        const skill = skillIn(index)!;
        if (skill.damage + skill.heal > bestDamage && this.skillHelps(skill, monsters, yaw)) {
          bestDamage = skill.damage + skill.heal;
          slot = i;
        }
      });
    }
    const index = slot < 0 ? null : bar[slot];
    if (index === null) return yaw;
    const skill = skillIn(index)!;
    const target = this.aim(monsters, yaw);
    if (target && skill.damage > 0) yaw = this.yawTo(monsters[target]);
    this.lastSkillAt[index] = now;
    this.getOff();
    this.lastSlot = index;
    this.skills += 1;
    playCue(HEROES[this.options.playerClass].skillCue);
    void this.client.useSkill(index, yaw).then((r) => {
      for (const id of r?.hit ?? []) this.skillHits.set(id, performance.now());
    });
    return yaw;
  }

  // Your advanced path, once the bag has said: it decides the skills on keys 2 and 3.
  private get path(): JobId | null {
    return this.client.state.bag?.job ?? null;
  }

  // Where the character is in the first tutorial: until the elder has taught it, the first skill
  // is not there to use.
  private learned(index: number): boolean {
    return skillLearned(this.client.state.bag?.tutorial ?? null, index);
  }

  private skillOpen(skill: Skill): boolean {
    return levelOf(this.client.state.me?.xp ?? 0).level >= skill.level;
  }

  // Whether auto-battle should use a skill now: a heal when hurt, anything else when it would hit.
  private skillHelps(skill: Skill, monsters: Record<string, MonsterState>, yaw: number): boolean {
    const me = this.client.state.me;
    const hurt = !!me && me.hp < me.maxHp * AUTO_HEAL_BELOW;
    const hits = skill.damage > 0 && skillTargets({ ...this.pose, yaw }, monsters, skill, false, bodyOf).length > 0;
    return skill.heal > 0 ? hurt || hits : hits;
  }

  // What the server paid you: for the kills you dealt the most damage to (anyone's kill you hit
  // counts toward your quest, which pays nothing here).
  private gained(result: Payout): void {
    const now = performance.now();
    if (result.gold > 0 || result.items.length > 0) playCue("gold");
    if (result.gold > 0) this.notes.push({ text: t("note.gotGold", { n: result.gold }), at: now });
    for (const id of result.items) this.notes.push({ text: t("note.gotItem", { name: id in ITEMS ? itemName(id) : id }), at: now });
  }

  // Drinks the potion that fits: the big one when a lot is missing, otherwise the small one.
  private drinkPotion(): void {
    const now = performance.now();
    const me = this.client.state.me;
    const bag = this.client.state.bag?.bag;
    if (!me || !bag || me.hp >= me.maxHp || now - this.lastPotionAt < POTION_GAP_MS) return;
    const missing = me.maxHp - me.hp;
    const big = (bag.potion_big ?? 0) > 0;
    const small = (bag.potion_small ?? 0) > 0;
    const pick = big && (missing >= ITEMS.potion_big.heal || !small) ? "potion_big" : small ? "potion_small" : null;
    if (!pick) return;
    this.lastPotionAt = now;
    playCue("potion");
    void this.client.drink(pick);
  }

  private checkPortals(here: boolean): void {
    const near = this.nearestPortal();
    if (!near || near.d > PORTAL_REARM) this.portalArmed = true;
    if (!here || !this.portalArmed || !near || near.d > PORTAL_RADIUS) return;
    this.portalArmed = false;
    this.travelling = true;
    this.options.onTravel(near.portal.to);
  }

  // The view hears back when a trip through a portal was refused, so you can walk again.
  travelRefused(): void {
    this.travelling = false;
    if (this.trip) this.setTrip(null);
  }

  private nearestPortal(): { portal: Portal; d: number } | null {
    let best: { portal: Portal; d: number } | null = null;
    for (const portal of this.portals) {
      const d = Math.hypot(portal.x - this.pose.x, portal.z - this.pose.z);
      if (!best || d < best.d) best = { portal, d };
    }
    return best;
  }

  private hero(playerClass: PlayerClass, costume: Costume): PlayerActor {
    const library = this.library!;
    const rig = HEROES[playerClass];
    const actor = new PlayerActor("", {
      object: library.instance(rig.model), clips: heroClips(library, rig), costume, rig, effects: this.effects,
    });
    this.scene.add(actor.object);
    return actor;
  }

  private syncActors(others: OtherPlayer[], dt: number, dead: boolean): void {
    if (!this.library) return;
    // The camera sits behind you, so your own body is drawn from your local pose.
    if (this.me) {
      this.me.path = this.path;
      this.applyMount(this.me, dead ? null : this.riding);
    }
    this.me?.sync(this.pose, dead ? "dead" : "active", dt);
    const bag = this.client.state.bag;
    const npcState = bag ? { quest: bag.quest, tutorial: bag.tutorial } : null;
    for (const npc of this.npcs) {
      const marker = npcMarker(npc.id, npcState);
      // Nothing over the head of the one you are talking to: the camera is at their face.
      npc.actor.setMarker(marker && this.dialogue?.id !== npc.id ? iconFor(MARKER_ICONS[marker]) : null);
      npc.actor.faceToward(this.dialogue?.id === npc.id && !this.dialogue.closing ? this.pose : null);
      npc.actor.inTalk = this.dialogue?.id === npc.id;
      npc.actor.sync(dt, this.distanceTo(npc.at), this.camera.position.distanceTo(npc.actor.object.position), this.view);
    }
    const seen = new Set<string>();
    for (const other of others) {
      seen.add(other.account);
      const key = `${other.look.playerClass}|${other.look.costume}`;
      let entry = this.others.get(other.account);
      if (entry && entry.key !== key) {
        this.scene.remove(entry.actor.object);
        entry = undefined;
      }
      if (!entry) {
        const playerClass = (HEROES as Record<string, unknown>)[other.look.playerClass] ? other.look.playerClass as PlayerClass : "warrior";
        const actor = this.hero(playerClass, costumeById(other.look.costume) ?? this.options.costume);
        entry = { actor, key };
        this.others.set(other.account, entry);
      }
      // The name is written again only when the look (or the names setting) changes, not every frame.
      const showNames = settings().showNames;
      if (entry.look !== other.look || entry.showNames !== showNames) {
        entry.look = other.look;
        entry.showNames = showNames;
        const vip = other.look.vip ? `VIP${other.look.vip} · ` : "";
        // A mercenary says so before its name, in its own colour.
        const tag = other.merc ? `${t("merc.tag")} ` : "";
        entry.actor.label(
          showNames ? `${vip}Lv${other.look.level} ${tag}${jobLabel(other.look.job) ? `${jobLabel(other.look.job)} ` : ""}${other.look.name}${other.look.guild ? ` <${other.look.guild}>` : ""}` : "",
          // VIP 5 and above: the name in gold.
          other.merc ? "#9fd8ff" : (other.look.vip ?? 0) >= VIP_MIGHT ? "#ffd36a" : undefined,
        );
        entry.actor.path = readJob(other.look.job);
      }
      this.applyMount(entry.actor, other.riding);
      entry.actor.sync(other.pose, other.merc && other.dead ? "dead" : "active", dt, this.view);
      entry.actor.fadeLabel(this.camera.position.distanceTo(entry.actor.object.position));
    }
    for (const [account, entry] of this.others) {
      if (seen.has(account)) continue;
      this.scene.remove(entry.actor.object);
      this.others.delete(account);
    }
  }

  // What a blow took off you, in red over your head, with a flash at the screen's edge.
  private showHurt(hp: number | null): void {
    if (hp !== null && this.lastHp !== null && hp < this.lastHp && this.me) {
      const at = new THREE.Vector3(this.pose.x, 2.1, this.pose.z);
      if (settings().damageNumbers) this.effects.floatText(at, `-${Math.round(this.lastHp - hp)}`, "#ff5a4a");
      this.hurtAt = performance.now();
      playCue("hurt");
    }
    this.lastHp = hp;
  }

  // The ground marks of attacks about to land: a warning as one appears, a shockwave as it lands.
  private syncMarks(telegraphs: readonly Telegraph[]): void {
    if (!this.marks.object.parent) this.scene.add(this.marks.object);
    const { appeared, landed } = this.marks.sync(telegraphs, performance.now());
    if (appeared) playCue("warn");
    for (const t of landed) {
      const reach = t.shape.kind === "circle" ? t.shape.r : t.shape.kind === "ring" ? t.shape.outer : 0;
      if (reach > 0) this.effects.ring(new THREE.Vector3(t.shape.x, 0, t.shape.z), reach, 0xff7a3a);
    }
  }

  private syncMonsters(monsters: Record<string, MonsterState>, dt: number): void {
    const library = this.library;
    if (!library) return;
    for (const [id, state] of Object.entries(monsters)) {
      let actor = this.monsters.get(id);
      if (!actor) {
        const skin = MONSTER_SKINS[state.type];
        // A kind this zone did not load (a server ahead of this client): not drawn, rather than the
        // whole view stopping on it.
        if (!library.has(skin.model)) continue;
        actor = new MonsterActor(id, library.instance(skin.model), library.get(skin.model).animations, skin.look, state.maxHp ?? MONSTERS[state.type].hp, `Lv${MONSTERS[state.type].level} ${monsterName(state.type)}`);
        this.monsters.set(id, actor);
        this.scene.add(actor.object);
      }
      if (!state.alive) this.skillHits.delete(id);
      // Blows come from the nearest hunter; near you, that is almost always you.
      actor.hitFrom(this.pose.x, this.pose.z);
      const change = actor.sync(state, dt, this.camera, this.view);
      const at = new THREE.Vector3(actor.object.position.x, actor.height + 0.2, actor.object.position.z);
      if (change.damage > 0) {
        const skillAt = this.skillHits.get(id);
        const big = skillAt !== undefined && performance.now() - skillAt < SKILL_NUMBER_MS;
        if (big) this.skillHits.delete(id);
        if (settings().damageNumbers) this.effects.floatText(at, String(Math.round(change.damage)), big ? "#ffb347" : "#fff4dc", big);
      }
      // Heard only near you, not from across the field.
      const near = Math.hypot(actor.object.position.x - this.pose.x, actor.object.position.z - this.pose.z) < DIE_HEARD;
      if (change.died && near) playCue("die");
    }
    for (const [id, actor] of this.monsters) {
      if (monsters[id]) continue;
      this.scene.remove(actor.object);
      actor.dispose();
      this.monsters.delete(id);
    }
  }

  // Each portal: a summoning circle on the ground and the name of where it leads.
  private addPortals(): void {
    const model = this.library!.get(PORTAL_MODEL).scene;
    const width = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).x;
    for (const portal of this.portals) {
      const locked = levelOf(this.client.state.me?.xp ?? 0).level < ZONES[portal.to].minLevel;
      const ring = paintPortal(model.clone(true));
      ring.scale.setScalar((PORTAL_RADIUS * 2) / width);
      ring.position.set(portal.x, 0, portal.z);
      // A magic circle turning over the stone: blue, or orange where you may not go yet.
      const glow = magicCircle(locked ? 0xff8a5c : 0x6fd0ff, 0.9);
      glow.scale.setScalar(PORTAL_RADIUS * 0.8);
      glow.position.set(portal.x, 0.12, portal.z);
      this.portalGlows.push(glow);
      const label = createLabel(2.6);
      label.position.set(portal.x, 3.3, portal.z);
      const why = locked ? t("portal.needsLevel", { n: ZONES[portal.to].minLevel }) : "";
      setLabel(label, `${zoneName(portal.to)}${why}`, locked ? "#ffb08a" : "#bff0ff");
      this.scene.add(ring, glow, label);
    }
  }

  private lastHudKey = "";
  private shoulder = CHASE.shoulder;
  private lastHudSentAt = 0;

  private emitHud(): void {
    const now = performance.now();
    if (now - this.lastHudAt < HUD_INTERVAL_MS) return;
    this.lastHudAt = now;
    for (const payout of this.client.takePayouts()) this.gained(payout);
    this.notes = this.notes.filter((n) => now - n.at < NOTE_MS).slice(-4);
    const entry = this.client.state.entry ?? this.options.entry;
    const near = this.nearestPortal();
    const me = this.client.state.me;
    const level = levelOf(me?.xp ?? 0);
    // Only once the server has said what you are: before that the level reads 1, and arriving at
    // your real level is not a level-up.
    if (me) {
      if (this.lastLevel !== null && level.level > this.lastLevel) playCue("levelup");
      this.lastLevel = level.level;
    }
    const fighting = this.target ? this.client.state.monsters[this.target] : undefined;
    const hud: WorldHud = {
      zone: zoneName(entry.zone),
      zoneId: entry.zone,
      channel: entry.channel,
      me: { x: this.pose.x, z: this.pose.z, yaw: this.yaw },
      portal: near && near.d <= PORTAL_REARM + 2
        ? {
          to: zoneName(near.portal.to),
          needLevel: level.level < ZONES[near.portal.to].minLevel ? ZONES[near.portal.to].minLevel : null,
        }
        : null,
      skills: hotbarFor(this.options.playerClass).map((index) => {
        const skill = index === null ? null : skillAt(this.options.playerClass, this.path, index);
        if (index === null || !skill || !this.learned(index)) return null;
        return {
          skill: index, cooldownMs: skill.cooldownMs, level: skill.level, open: level.level >= skill.level,
          readyInMs: Math.max(0, this.lastSkillAt[index] + skill.cooldownMs - now),
        };
      }),
      rollIn: Math.max(0, Math.ceil((this.rollReadyAt - performance.now()) / 1000)),
      hp: me?.hp ?? 0,
      maxHp: me?.maxHp ?? 1,
      dead: me?.dead === true,
      lostXp: me?.lostXp ?? 0,
      level: level.level,
      xpInto: level.into,
      xpNeed: level.need,
      auto: this.auto,
      riding: this.riding,
      seeking: (this.auto && this.questSeek !== null) || this.trip !== null || this.walkGoal?.talk === "elder",
      toElder: this.trip?.kind === "elder" || this.walkGoal?.talk === "elder",
      fighting: this.fightingForQuest(),
      way: this.wayLeft(),
      bosses: this.groveView?.revealsBosses
        ? Object.values(this.client.state.monsters)
          .filter((m) => m.alive && isBoss(m.type))
          .map((m) => ({ x: m.x, z: m.z }))
        : [],
      npc: (() => {
        const id = npcNear(this.options.entry.zone, this.pose.x, this.pose.z);
        const npc = id ? NPCS.find((n) => n.id === id)! : null;
        return npc ? { id: npc.id, name: npcName(npc.id), role: npcRole(npc.id) } : null;
      })(),
      target: fighting?.alive && isBoss(fighting.type)
        ? { name: `Lv${MONSTERS[fighting.type].level} ${monsterName(fighting.type)}`, hp: fighting.hp, maxHp: fighting.maxHp ?? MONSTERS[fighting.type].hp }
        : null,
      potions: (this.client.state.bag?.bag.potion_small ?? 0) + (this.client.state.bag?.bag.potion_big ?? 0),
      hurt: Math.max(0, 1 - (now - this.hurtAt) / HURT_FLASH_MS),
      notes: this.notes.map((n) => n.text),
    };
    // The whole screen redraws on each one, so one that changes nothing (standing about, no cooldowns)
    // is held back, though one still goes out every HUD_HEARTBEAT_MS.
    // Steps of half a metre, a twentieth of a turn's worth of yaw and a quarter second of cooldown are
    // as fine as the minimap and the skill buttons can show.
    const key = JSON.stringify(hud, (k, v) => (typeof v === "number" && (k === "x" || k === "z") ? Math.round(v * 2)
      : typeof v === "number" && k === "yaw" ? Math.round(v * 6)
      : typeof v === "number" && k === "readyInMs" ? Math.ceil(v / 250) : typeof v === "number" && k === "hurt" ? Math.round(v * 10) : v));
    if (key === this.lastHudKey && now - this.lastHudSentAt < HUD_HEARTBEAT_MS) return;
    this.lastHudKey = key;
    this.lastHudSentAt = now;
    for (const listener of this.hudListeners) listener(hud);
  }

  private resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
