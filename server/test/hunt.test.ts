import { MONSTERS, maxHpAt, spawnMonsters } from "../../src/game/world/monsters";
import { CLASS_SKILLS } from "../../src/game/combat/skills";
import { WEAPONS } from "../../src/game/combat/classes";
import { portalsOf, zoneLayout } from "../../src/game/world/zones";
import { REVIVE_HP_SHARE, deathXpLoss, levelCost, levelOf, reviveCost } from "../../src/game/account/level";
import { enterAs, errorOf, giveXp, join, makeCharacter, walkTo } from "./helpers";

// Into the first hunting field, through the village portal, as the client does it.
async function toForest(server: any, account: string, playerClass = "warrior"): Promise<any> {
  await makeCharacter(server, account, `사냥꾼${account.slice(-1)}`, playerClass);
  const village = await enterAs(server, account);
  const portal = portalsOf("village").find((p) => p.to === "forest1")!;
  await walkTo(server, portal.x, portal.z);
  return join(server, account, await server.travel("forest1"), village.roomId);
}

// Puts one monster of `type` at (x, z) and no other living one in the first field (the rest lie felled
// for good, or the room would stand them back up). Monsters leave players be until hit: `angryAt` is
// an account it has already been hit by, and so goes for.
async function only(
  type: string, x: number, z: number, hp = MONSTERS[type as keyof typeof MONSTERS].hp, angryAt: string | null = null,
): Promise<void> {
  const felled = Object.fromEntries(
    Object.entries(spawnMonsters("forest1")).map(([id, m]) => [id, { ...m, alive: false, respawnAt: Number.MAX_SAFE_INTEGER }]),
  );
  await $room.updateRoomState({
    monsters: {
      ...felled,
      m0: {
        type, x, z, yaw: 0, hp, alive: true, stunnedUntil: 0, attackReadyAt: 0, respawnAt: 0, homeX: x, homeZ: z,
        ...(angryAt ? { hitters: { [angryAt]: 1 } } : {}),
      },
    },
  });
}

// Stands the caller at (x, z) facing -z (yaw 0), with nothing on cooldown.
async function standAt(server: any, x: number, z: number): Promise<void> {
  await walkTo(server, x, z, 0);
  await $room.updateMyState({ strikeReadyAt: 0, skillReady: {} });
}

describe("hunting", () => {
  test("a hunting field fills with monsters on its first tick", async (server) => {
    const entry = await toForest(server, "test-a");
    await server.simulateTick(entry.roomId, 200);
    const { monsters } = await $room.getRoomState();
    expect(Object.keys(monsters).length).toBe(Object.keys(spawnMonsters("forest1")).length);
    expect(Object.values(monsters).every((m: any) => m.alive && m.hp > 0)).toBe(true);
  });

  test("a room kept from before the field gained monsters gets the new ones", async (server) => {
    const entry = await toForest(server, "test-a");
    const { m0 } = spawnMonsters("forest1");
    await $room.updateRoomState({ monsters: { m0 } });
    await server.simulateTick(entry.roomId, 200);
    const { monsters } = await $room.getRoomState();
    expect(Object.keys(monsters).length).toBe(Object.keys(spawnMonsters("forest1")).length);
  });

  test("you arrive whole, with health that grows with your level", async (server) => {
    await makeCharacter(server, "test-a", "튼튼이");
    await giveXp("test-a", 1000);
    await enterAs(server, "test-a");
    const mine = await $room.getMyState();
    expect(mine.dead).toBe(false);
    expect(mine.hp).toBeGreaterThan(maxHpAt(1));
    expect(mine.hp).toBe(mine.maxHp);
  });

  test("a monster in reach hits you, and a raised guard takes part of it", async (server) => {
    const entry = await toForest(server, "test-a");
    const spawn = zoneLayout("forest1").playerSpawn;
    await standAt(server, spawn.x, spawn.z);
    // Left alone it does nothing; once hit it bites back.
    await only("rat", spawn.x, spawn.z - 1);
    await server.simulateTick(entry.roomId, 200);
    expect((await $room.getMyState()).hp).toBe(maxHpAt(1));
    await only("rat", spawn.x, spawn.z - 1, undefined, "test-a");
    await server.simulateTick(entry.roomId, 200);
    const full = maxHpAt(1);
    const bare = full - (await $room.getMyState()).hp;
    expect(bare).toBe(MONSTERS.rat.damage);

    await only("rat", spawn.x, spawn.z - 1, undefined, "test-a");
    await $room.updateMyState({ hp: full, pose: { ...(await $room.getMyState()).pose, block: true } });
    await server.simulateTick(entry.roomId, 200);
    const guarded = full - (await $room.getMyState()).hp;
    expect(guarded).toBeGreaterThan(0);
    expect(guarded).toBeLessThan(bare);

    // Mid-swing (the weapon not ready again yet) the guard does nothing: no striking behind it.
    await only("rat", spawn.x, spawn.z - 1, undefined, "test-a");
    await $room.updateMyState({ hp: full, strikeReadyAt: Date.now() + 60_000 });
    await server.simulateTick(entry.roomId, 200);
    expect(full - (await $room.getMyState()).hp).toBe(bare);
  });

  test("a reported step into the forest is not taken", async (server) => {
    await toForest(server, "test-a");
    const layout = zoneLayout("forest1");
    // An open cell with forest right beside it.
    let open: { x: number; z: number } | null = null;
    let wall: { x: number; z: number } | null = null;
    for (let r = 1; r < layout.rows - 1 && !open; r++) {
      for (let c = 1; c < layout.cols - 1 && !open; c++) {
        if (!layout.solid[r][c] && layout.solid[r][c + 1]) {
          open = { x: (c + 0.5) * layout.tileSize, z: (r + 0.5) * layout.tileSize };
          wall = { x: (c + 1.5) * layout.tileSize, z: open.z };
        }
      }
    }
    await walkTo(server, open!.x, open!.z);
    // Time enough to walk there: only the forest stands in the way.
    await walkTo(server, wall!.x, wall!.z);
    const pose = (await $room.getMyState()).pose;
    expect(pose.x).toBe(open!.x);
    expect(pose.z).toBe(open!.z);
  });

  test("your blow lands only in reach, not faster than your weapon, and a kill pays XP", async (server) => {
    const entry = await toForest(server, "test-a");
    const spawn = zoneLayout("forest1").playerSpawn;
    await standAt(server, spawn.x, spawn.z);
    await only("rat", spawn.x, spawn.z - 8);
    expect(await errorOf(server.strike("m0"))).toContain("out_of_range");
    expect(await errorOf(server.strike("nobody"))).toContain("no_monster");

    // Two blows' worth of health.
    const hp = WEAPONS.warrior.damage * 2 - 5;
    await only("rat", spawn.x, spawn.z - 1.5, hp);
    const first = await server.strike("m0");
    expect(first.hit).toEqual(["m0"]);
    expect((await $room.getRoomState()).monsters.m0.hp).toBe(hp - WEAPONS.warrior.damage);
    expect(await errorOf(server.strike("m0"))).toContain("too_fast");

    await $room.updateMyState({ strikeReadyAt: 0 });
    const kill = await server.strike("m0");
    expect(kill.killed).toEqual(["m0"]);
    expect((await $room.getRoomState()).monsters.m0.alive).toBe(false);
    expect((await $room.getMyState()).xp).toBe(MONSTERS.rat.xp);
    server.connect({ account: "test-a", roomId: entry.roomId });
    expect((await server.getAccount()).xp).toBe(MONSTERS.rat.xp);
    await $room.updateMyState({ strikeReadyAt: 0 });
    expect(await errorOf(server.strike("m0"))).toContain("monster_dead");
  });

  test("a kill pays whoever dealt the most damage, and counts for everyone who hit it", async (server) => {
    const entry = await toForest(server, "test-b");
    await toForest(server, "test-a");
    const spawn = zoneLayout("forest1").playerSpawn;
    await standAt(server, spawn.x, spawn.z);
    // test-b has taken most of its health; test-a lands the last blow.
    await only("green_blob", spawn.x, spawn.z - 1.5, 10);
    const { monsters } = await $room.getRoomState();
    await $room.updateRoomState({ monsters: { m0: { ...monsters.m0, hitters: { "test-b": MONSTERS.green_blob.hp - 10 } } } });
    const kill = await server.strike("m0");
    expect(kill.killed).toEqual(["m0"]);
    expect(kill).toMatchObject({ xp: 0, gold: 0, items: [] });
    expect((await server.getAccount()).xp).toBe(0);
    expect((await server.getBag()).quest.count).toBe(1);
    expect((await $room.getMyState()).payout).toMatchObject({ xp: 0, gold: 0 });

    server.connect({ account: "test-b", roomId: entry.roomId });
    expect((await server.getAccount()).xp).toBe(MONSTERS.green_blob.xp);
    const bag = await server.getBag();
    expect(bag.quest.count).toBe(1);
    expect(bag.gold).toBeGreaterThanOrEqual(MONSTERS.green_blob.gold[0]);
    expect((await $room.getMyState()).payout).toMatchObject({ xp: MONSTERS.green_blob.xp });
    // Whole again, it forgets who hit it.
    expect((await $room.getRoomState()).monsters.m0.hitters).toBeUndefined();
  });

  test("a fallen monster comes back where it started once its time is up", async (server) => {
    const entry = await toForest(server, "test-a");
    const spawn = zoneLayout("forest1").playerSpawn;
    await standAt(server, spawn.x, spawn.z);
    await only("rat", spawn.x, spawn.z - 1.5, 1);
    await server.strike("m0");
    const { monsters } = await $room.getRoomState();
    await $room.updateRoomState({ monsters: { m0: { ...monsters.m0, respawnAt: 0, x: 0, z: 0 } } });
    await server.simulateTick(entry.roomId, 200);
    const back = (await $room.getRoomState()).monsters.m0;
    expect(back).toMatchObject({ alive: true, hp: MONSTERS.rat.hp, x: back.homeX, z: back.homeZ });
  });

  test("the warrior's skill hits everything around, then waits for its cooldown", async (server) => {
    await toForest(server, "test-a");
    const spawn = zoneLayout("forest1").playerSpawn;
    await standAt(server, spawn.x, spawn.z);
    const at = (dx: number, dz: number) => ({
      type: "frog", x: spawn.x + dx, z: spawn.z + dz, yaw: 0, hp: 80, alive: true, stunnedUntil: 0, attackReadyAt: 0,
      respawnAt: 0, homeX: spawn.x + dx, homeZ: spawn.z + dz,
    });
    await $room.updateRoomState({ monsters: { a: at(0, -1.5), b: at(0, 1.5), c: at(9, 0) } });
    const used = await server.useSkill();
    expect([...used.hit].sort()).toEqual(["a", "b"]);
    expect((await $room.getRoomState()).monsters.a.hp).toBe(80 - CLASS_SKILLS.warrior.damage);
    expect(await errorOf(server.useSkill())).toContain("too_fast");
  });

  test("falling costs a little XP, never a level, and you can stand up where you fell for gold", async (server) => {
    const entry = await toForest(server, "test-a");
    const xp = levelCost(1) + 400;
    await giveXp("test-a", xp);
    server.connect({ account: "test-a", roomId: entry.roomId });
    const spawn = zoneLayout("forest1").playerSpawn;
    await standAt(server, spawn.x, spawn.z);
    expect(await errorOf(server.reviveHere())).toContain("unavailable");
    await only("spider", spawn.x, spawn.z - 1, undefined, "test-a");
    await $room.updateMyState({ hp: 1 });
    await server.simulateTick(entry.roomId, 200);
    const lost = deathXpLoss(xp);
    expect(lost).toBeGreaterThan(0);
    expect(await $room.getMyState()).toMatchObject({ dead: true, lostXp: lost, xp: xp - lost });
    expect((await server.getAccount()).xp).toBe(xp - lost);

    expect(await errorOf(server.reviveHere())).toContain("not_enough_gold");
    const cost = reviveCost(levelOf(xp - lost).level);
    await $asset.mint("gold", cost + 5);
    expect((await server.reviveHere()).gold).toBe(5);
    const mine = await $room.getMyState();
    expect(mine).toMatchObject({ dead: false, hp: Math.ceil(mine.maxHp * REVIVE_HP_SHARE) });
    // The spider leaves you be for a moment.
    await server.simulateTick(entry.roomId, 200);
    expect((await $room.getMyState()).hp).toBe(mine.hp);
    // Just into a level, there is nothing to lose.
    expect(deathXpLoss(levelCost(1))).toBe(0);
  });

  test("fallen, you can only go back to the village, where you stand up whole", async (server) => {
    const entry = await toForest(server, "test-a");
    const spawn = zoneLayout("forest1").playerSpawn;
    await standAt(server, spawn.x, spawn.z);
    expect(await errorOf(server.respawn())).toContain("unavailable");
    await only("spider", spawn.x, spawn.z - 1, undefined, "test-a");
    await $room.updateMyState({ hp: 1 });
    await server.simulateTick(entry.roomId, 200);
    expect((await $room.getMyState()).dead).toBe(true);
    expect(await errorOf(server.strike("m0"))).toContain("unavailable");
    const home = await server.respawn();
    expect(home.zone).toBe("village");
    await join(server, "test-a", home, entry.roomId);
    expect(await $room.getMyState()).toMatchObject({ dead: false, hp: maxHpAt(1) });
  });

  test("a second arrive, a channel or going back to the menu heals nothing, and a fall comes back with you", async (server) => {
    const entry = await toForest(server, "test-a");
    const spawn = zoneLayout("forest1").playerSpawn;
    await standAt(server, spawn.x, spawn.z);
    await $room.updateMyState({ hp: 40, strikeReadyAt: Date.now() + 60_000 });
    await server.arrive();
    expect((await $room.getMyState()).hp).toBe(40);
    const moved = await join(server, "test-a", await server.changeChannel(3), entry.roomId);
    expect((await $room.getMyState()).hp).toBe(40);
    expect((await $room.getMyState()).strikeReadyAt).toBeGreaterThan(Date.now());
    await $room.updateMyState({ hp: 0, dead: true });
    await server.leaveWorld();
    server.connect({ account: "test-a" });
    await join(server, "test-a", await server.enterWorld(), moved.roomId);
    expect(await $room.getMyState()).toMatchObject({ dead: true, hp: 0 });
  });

  test("a monster walking home from a lost chase takes no harm", async (server) => {
    await toForest(server, "test-a");
    const spawn = zoneLayout("forest1").playerSpawn;
    await standAt(server, spawn.x, spawn.z);
    await only("rat", spawn.x, spawn.z - 1);
    const { monsters } = await $room.getRoomState();
    await $room.updateRoomState({ monsters: { ...monsters, m0: { ...monsters.m0, returning: true } } });
    expect((await server.strike("m0")).hit).toEqual([]);
    expect((await $room.getRoomState()).monsters.m0.hp).toBe(MONSTERS.rat.hp);
  });

  test("a kill pays no character picked in another tab since", async (server) => {
    const entry = await toForest(server, "test-a");
    const spawn = zoneLayout("forest1").playerSpawn;
    await standAt(server, spawn.x, spawn.z);
    await only("rat", spawn.x, spawn.z - 1.5, 1);
    await makeCharacter(server, "test-a", "다른탭");
    server.connect({ account: "test-a", roomId: entry.roomId });
    expect((await server.strike("m0")).killed).toEqual(["m0"]);
    const state = await $global.getUserState("test-a");
    expect(state.characterMap[state.active].xp).toBe(0);
  });

  test("a rider gets off on striking or on being hit, and rides faster than a walker walks", async (server) => {
    const entry = await toForest(server, "test-a");
    const spawn = zoneLayout("forest1").playerSpawn;
    await standAt(server, spawn.x, spawn.z);
    await server.selectMount("deer");
    await server.ride(true);
    // Half a second on: a walker's pose may move 4 m at most (pace, allowance and slack), a rider's more.
    const at = Date.now();
    await $room.updateMyState({ pose: { ...(await $room.getMyState()).pose, at: at - 500 } });
    await server.reportPose({ x: spawn.x, z: spawn.z - 6, yaw: 0 });
    const walked = spawn.z - (await $room.getMyState()).pose.z;
    expect(walked).toBeGreaterThan(4.5);
    await standAt(server, spawn.x, spawn.z);
    await only("rat", spawn.x, spawn.z - 1.5, 1);
    await server.strike("m0");
    expect((await $room.getMyState()).riding).toBeNull();

    await server.ride(true);
    await only("rat", spawn.x, spawn.z - 1, undefined, "test-a");
    await server.simulateTick(entry.roomId, 200);
    expect((await $room.getMyState()).riding).toBeNull();
  });

  test("a reported pose is held to walking pace", async (server) => {
    await toForest(server, "test-a");
    const spawn = zoneLayout("forest1").playerSpawn;
    await walkTo(server, spawn.x, spawn.z);
    await server.reportPose({ x: spawn.x + 30, z: spawn.z, yaw: 0 });
    const pose = (await $room.getMyState()).pose;
    expect(pose.x - spawn.x).toBeLessThan(3);
    expect(pose.x).toBeGreaterThan(spawn.x);
  });
});
