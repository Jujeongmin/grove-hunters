import { describe, expect, it } from "vitest";
import { resolveTelegraphs, type Telegraph } from "../../src/game/world/telegraphs";
import { LEASH, stepMonsters } from "../../src/game/world/monsterAi";
import { BOSS_MOVES, MONSTERS, spawnMonsters, type MonsterState } from "../../src/game/world/monsters";
import { zoneLayout } from "../../src/game/world/zones";

const layout = zoneLayout("forest1");
const home = layout.playerSpawn;

function rat(x: number, z: number, extra: Partial<MonsterState> = {}): MonsterState {
  return {
    type: "rat", x, z, yaw: 0, hp: MONSTERS.rat.hp, alive: true, stunnedUntil: 0, attackReadyAt: 0, respawnAt: 0,
    homeX: x, homeZ: z, ...extra,
  };
}

describe("monsters", () => {
  it("every hunting field has some, the village none", () => {
    expect(Object.keys(spawnMonsters("forest1")).length).toBeGreaterThan(0);
    expect(Object.keys(spawnMonsters("forest2")).length).toBeGreaterThan(0);
    expect(spawnMonsters("village")).toEqual({});
  });

  it("the first field has slimes in threes, on open ground, for the first quest's fifteen", () => {
    const monsters = Object.values(spawnMonsters("forest1"));
    const slimes = monsters.filter((m) => m.type === "green_blob");
    expect(slimes.length).toBeGreaterThanOrEqual(18);
    expect(slimes.length).toBe(monsters.filter((m) => m.type === "rat").length * 3);
    const { solid, tileSize } = layout;
    for (const m of slimes) expect(solid[Math.floor(m.z / tileSize)]?.[Math.floor(m.x / tileSize)], `${m.x},${m.z}`).toBeFalsy();
  });

  it("leave players be, however close, until hit", () => {
    const monsters = { m: rat(home.x, home.z - 1.2) };
    const hits = [0, 500, 1000, 1500].flatMap((t) => stepMonsters(monsters, [{ account: "a", x: home.x, z: home.z }], layout, 0.5, 1000 + t));
    expect(hits).toEqual([]);
    expect(monsters.m.z).toBe(home.z - 1.2);
  });

  it("once hit, walk toward whoever hit them and bite once close", () => {
    const monsters = { m: rat(home.x, home.z - 5, { hitters: { a: 1 } }) };
    const prey = [{ account: "a", x: home.x, z: home.z }];
    stepMonsters(monsters, prey, layout, 0.5, 1000);
    expect(monsters.m.z).toBeGreaterThan(home.z - 5);
    let hits: ReturnType<typeof stepMonsters> = [];
    for (let t = 1; t < 20 && hits.length === 0; t++) hits = stepMonsters(monsters, prey, layout, 0.5, 1000 + t * 500);
    expect(hits).toEqual([{ monsterId: "m", account: "a", damage: MONSTERS.rat.damage }]);
  });

  it("stand still while stunned, and leave alone those who did not hit them", () => {
    const monsters = { m: rat(home.x, home.z - 5, { stunnedUntil: 5000, hitters: { a: 1 } }) };
    stepMonsters(monsters, [{ account: "a", x: home.x, z: home.z }], layout, 0.5, 1000);
    expect(monsters.m.z).toBe(home.z - 5);
    const far = { m: rat(home.x, home.z - 5) };
    stepMonsters(far, [{ account: "a", x: home.x + 30, z: home.z }], layout, 0.5, 1000);
    expect(far.m.x).toBe(home.x);
  });

  it("chase whoever hit them, even from out of sight, instead of going home to heal", () => {
    // Shot from 13 metres, past a rat's sight, it comes for the archer and keeps its wounds.
    const archer = { account: "a", x: home.x, z: home.z + 13 };
    const monsters = { m: rat(home.x, home.z, { hp: MONSTERS.rat.hp - 30, hitters: { a: 30 } }) };
    for (let t = 0; t < 4; t++) stepMonsters(monsters, [archer, { account: "b", x: home.x + 30, z: home.z }], layout, 0.5, 1000 + t * 500);
    expect(monsters.m.z).toBeGreaterThan(home.z + 2);
    expect(monsters.m.hp).toBe(MONSTERS.rat.hp - 30);
  });

  it("but wasps and bats, and their deep-forest kin, go for anyone who comes near", () => {
    expect(["wasp", "bat", "hornet", "vampire_bat"].every((t) => MONSTERS[t as keyof typeof MONSTERS].aggressive)).toBe(true);
    expect(MONSTERS.rat.aggressive).toBeFalsy();
    const bat = { m: rat(home.x, home.z - 5, { type: "bat", hp: MONSTERS.bat.hp }) };
    const prey = [{ account: "a", x: home.x, z: home.z }];
    let hits: ReturnType<typeof stepMonsters> = [];
    for (let t = 0; t < 20 && hits.length === 0; t++) hits = stepMonsters(bat, prey, layout, 0.5, 1000 + t * 500);
    expect(hits).toEqual([{ monsterId: "m", account: "a", damage: MONSTERS.bat.damage }]);
  });

  it("an aggressive one leaves be whoever keeps past its sight", () => {
    const bat = { m: rat(home.x, home.z, { type: "bat", hp: MONSTERS.bat.hp }) };
    stepMonsters(bat, [{ account: "a", x: home.x, z: home.z + MONSTERS.bat.aggro + 1 }], layout, 0.5, 1000);
    expect(bat.m.z).toBe(home.z);
  });

  it("once past the leash, walk home ignoring whoever hit them, even back inside it, and are whole there", () => {
    // Kited to the edge by an archer standing off beyond it.
    const archer = { account: "a", x: home.x, z: home.z + LEASH + 6 };
    const monsters = { m: rat(home.x, home.z + LEASH + 0.5, { homeX: home.x, homeZ: home.z, hp: 10, hitters: { a: 100 } }) };
    stepMonsters(monsters, [archer], layout, 0.5, 1000);
    expect(monsters.m.returning).toBe(true);
    expect(monsters.m.hitters).toBeUndefined();
    const z = monsters.m.z;
    stepMonsters(monsters, [archer], layout, 0.5, 1500);
    expect(monsters.m.z).toBeLessThan(z);
    monsters.m.z = home.z + 0.2;
    stepMonsters(monsters, [archer], layout, 0.5, 2000);
    expect(monsters.m.returning).toBeUndefined();
    expect(monsters.m.hp).toBe(MONSTERS.rat.hp);
  });

  it("give up past the leash and go home", () => {
    const monsters = { m: rat(home.x, home.z, { homeX: home.x, homeZ: home.z - LEASH - 2, hp: 5 }) };
    stepMonsters(monsters, [{ account: "a", x: home.x, z: home.z + 1 }], layout, 0.5, 1000);
    expect(monsters.m.z).toBeLessThan(home.z);
  });
});

describe("the boss", () => {
  const arena = zoneLayout("boss");
  const at = arena.bossSpawn!;
  const king = (extra: Partial<MonsterState> = {}): MonsterState => ({
    type: "mushroom_king", x: at.x, z: at.z, yaw: 0, hp: MONSTERS.mushroom_king.hp, alive: true, stunnedUntil: 0,
    attackReadyAt: 0, respawnAt: 0, homeX: at.x, homeZ: at.z, ...extra,
  });

  it("rears up and marks the ground round itself; the mark lands on everyone still inside, not those who stepped out", () => {
    const monsters: Record<string, MonsterState> = { boss: king({ hitters: { near: 1, far: 1 } }) };
    const prey = [{ account: "near", x: at.x + 5, z: at.z }, { account: "far", x: at.x + 12, z: at.z }];
    const marks: Telegraph[] = [];
    stepMonsters(monsters, prey, arena, 0.2, 0, marks);
    const slamAt = monsters.boss.slamAt!;
    expect(slamAt).toBe(BOSS_MOVES.slamEveryMs);
    expect(marks).toEqual([]);
    stepMonsters(monsters, prey, arena, 0.2, slamAt - BOSS_MOVES.slamWarnMs + 10, marks);
    expect(monsters.boss.slamming).toBe(true);
    expect(marks.length).toBe(1);
    expect(marks[0]).toMatchObject({ hitAt: slamAt, damage: BOSS_MOVES.slamDamage, shape: { kind: "circle", r: BOSS_MOVES.slamRadius } });
    stepMonsters(monsters, prey, arena, 0.2, slamAt + 10, marks);
    expect(monsters.boss.slamming).toBe(false);
    // One more mark, not a second: the next is for the next slam.
    expect(marks.length).toBe(1);
    const landed = resolveTelegraphs(marks, prey.map((p) => ({ ...p, maxHp: 500 })), slamAt + 10);
    expect(landed.hits).toEqual([{ account: "near", damage: BOSS_MOVES.slamDamage }]);
  });

  it("calls its brood once at each threshold, and the brood does not come back", () => {
    const monsters: Record<string, MonsterState> = { boss: king({ hp: MONSTERS.mushroom_king.hp * 0.69, hitters: { a: 1 } }) };
    // The hunter who hit it keeps it fighting (alone at home it would heal).
    const prey = [{ account: "a", x: at.x + 10, z: at.z }];
    stepMonsters(monsters, prey, arena, 0.2, 0);
    stepMonsters(monsters, prey, arena, 0.2, 100);
    const brood = Object.keys(monsters).filter((id) => monsters[id].summoned);
    expect(brood).toHaveLength(BOSS_MOVES.summonCount);
    monsters.boss.hp = MONSTERS.mushroom_king.hp * 0.39;
    stepMonsters(monsters, prey, arena, 0.2, 200);
    expect(Object.values(monsters).filter((m) => m.summoned)).toHaveLength(BOSS_MOVES.summonCount * 2);
    // The brood comes to fight: it goes for a hunter in sight without being hit first.
    const guard = monsters[brood[1]];
    const was = Math.hypot(guard.x - prey[0].x, guard.z - prey[0].z);
    stepMonsters(monsters, prey, arena, 0.5, 300);
    expect(Math.hypot(guard.x - prey[0].x, guard.z - prey[0].z)).toBeLessThan(was);
    monsters[brood[0]].alive = false;
    stepMonsters(monsters, [], arena, 0.2, 60_000);
    expect(monsters[brood[0]]).toBeUndefined();
  });

  it("rages when low: faster and harder bites", () => {
    const monsters: Record<string, MonsterState> = { boss: king({ hp: 100, slamAt: 1e12, hitters: { a: 1 } }) };
    const hits = stepMonsters(monsters, [{ account: "a", x: at.x + 1.5, z: at.z }], arena, 0.2, 1000);
    expect(hits[0].damage).toBe(Math.round(MONSTERS.mushroom_king.damage * BOSS_MOVES.rageDamage));
    expect(monsters.boss.attackReadyAt - 1000).toBe(MONSTERS.mushroom_king.attackMs * BOSS_MOVES.rageSpeed);
  });
});

describe("the deep forest", () => {
  it("holds the level 28 to 40 monsters and opens at level 25 with the full game", () => {
    const monsters = Object.values(spawnMonsters("forest3"));
    expect(monsters.length).toBeGreaterThanOrEqual(24);
    for (const m of monsters) {
      expect(MONSTERS[m.type].level).toBeGreaterThanOrEqual(28);
      expect(MONSTERS[m.type].level).toBeLessThanOrEqual(40);
    }
  });
});

describe("a guild boss", () => {
  const arena = zoneLayout("arena");
  const at = arena.bossSpawn!;
  const yeti = (extra: Partial<MonsterState> = {}): MonsterState => ({
    type: "guild_yeti", x: at.x, z: at.z, yaw: 0, hp: 500_000, maxHp: 600_000, alive: true, stunnedUntil: 0,
    attackReadyAt: 0, respawnAt: 0, homeX: at.x, homeZ: at.z, ...extra,
  });

  it("waits, then casts a pattern and stands until its marks land, then casts another", () => {
    const monsters: Record<string, MonsterState> = { boss: yeti() };
    const prey = [{ account: "a", x: at.x, z: at.z + 6 }];
    const marks: Telegraph[] = [];
    // Pattern 1 (index from 0.5 of [0, 1, 2]) is falling ice.
    stepMonsters(monsters, prey, arena, 0.2, 0, marks, () => 0.5);
    expect(marks).toEqual([]);
    stepMonsters(monsters, prey, arena, 0.2, 3000, marks, () => 0.5);
    expect(marks.length).toBe(7);
    const castUntil = monsters.boss.castUntil!;
    expect(castUntil).toBe(Math.max(...marks.map((t) => t.hitAt)));
    const where = { x: monsters.boss.x, z: monsters.boss.z };
    stepMonsters(monsters, prey, arena, 0.5, castUntil - 10, marks, () => 0.5);
    expect({ x: monsters.boss.x, z: monsters.boss.z }).toEqual(where);
    stepMonsters(monsters, prey, arena, 0.2, monsters.boss.nextPatternAt!, marks, () => 0.5);
    // Never the same one twice: not falling ice again.
    expect(monsters.boss.lastPattern).not.toBe(1);
  });

  it("the yeti charges down its lane as the lane lands", () => {
    const monsters: Record<string, MonsterState> = { boss: yeti({ nextPatternAt: 0, lastPattern: 2 }) };
    const prey = [{ account: "a", x: at.x, z: at.z + 6 }];
    const marks: Telegraph[] = [];
    stepMonsters(monsters, prey, arena, 0.2, 0, marks, () => 0);
    expect(marks[0].shape.kind).toBe("line");
    const chargeAt = monsters.boss.chargeAt!;
    stepMonsters(monsters, prey, arena, 0.2, chargeAt, marks, () => 0);
    expect(monsters.boss.z).toBeGreaterThan(at.z + 10);
    expect(monsters.boss.chargeAt).toBeUndefined();
  });

  it("the glub calls its brood", () => {
    const monsters: Record<string, MonsterState> = { boss: { ...yeti({ nextPatternAt: 0, lastPattern: 2 }), type: "guild_glub" } };
    stepMonsters(monsters, [{ account: "a", x: at.x, z: at.z + 6 }], arena, 0.2, 0, [], () => 0);
    expect(Object.values(monsters).filter((m) => m.type === "glub_brood").length).toBe(4);
  });

  it("the snow's emperor waits at its altar, then marks the ground at those who come near, and comes back whole", () => {
    const altar = zoneLayout("snowboss");
    const monsters = spawnMonsters("snowboss");
    const emperor = monsters.boss;
    expect(emperor.type).toBe("frost_emperor");
    const far = [{ account: "a", x: emperor.x + 40, z: emperor.z }];
    const marks: Telegraph[] = [];
    for (let t = 0; t < 10; t++) stepMonsters(monsters, far, altar, 0.5, 1000 + t * 500, marks);
    expect(marks).toEqual([]);
    const near = [{ account: "a", x: emperor.x + 4, z: emperor.z }];
    for (let t = 0; t < 12 && marks.length === 0; t++) stepMonsters(monsters, near, altar, 0.5, 10_000 + t * 500, marks);
    expect(marks.length).toBeGreaterThan(0);
  });
});
