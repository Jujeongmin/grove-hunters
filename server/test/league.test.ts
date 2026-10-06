import { GUILD_COST } from "../../src/game/account/guild";
import { GOLD } from "../../src/game/account/items";
import { LEAGUE_GUILD_GEMS, LEAGUE_PLAYER_GEMS, bossMax, bossOfWeek, currentWeek } from "../../src/game/world/guildBoss";
import { makeCharacter } from "./helpers";

// A guild of one, founded by `account`.
async function founder(server: any, account: string, name: string): Promise<string> {
  await makeCharacter(server, account, name);
  await $asset.mint(GOLD, GUILD_COST);
  return (await server.createGuild(`${name}길드`)).guild.id;
}

// A week of `guild`'s boss as the arena leaves it: `damage` from its one hitter.
async function week(guild: string, account: string, name: string, w: number, damage: number, killedAt: number | null = null) {
  const character = (await $global.getUserState(account)).active;
  await $global.addCollectionItem("guildBoss", {
    guild, week: w, boss: bossOfWeek(w), max: bossMax(1), damage, stagesPaid: 0, killedAt,
    entries: {}, hitters: { [character]: { account, name, damage } },
  });
}

const leagueMail = async (server: any, account: string) => {
  server.connect({ account });
  return (await server.getMail()).mail.filter((m: any) => m.kind === "guild_league");
};

describe("guild boss league", () => {
  test("ranks guilds by kill first, then share; last week is paid once and its winner told", async (server) => {
    const now = currentWeek(Date.now());
    const a = await founder(server, "test-a", "가나다");
    const b = await founder(server, "test-b", "라마바");
    const c = await founder(server, "test-c", "사아자");
    const max = bossMax(1);
    await week(a, "test-a", "가나다", now - 1, max * 0.5);
    await week(b, "test-b", "라마바", now - 1, max, 1000);
    await week(c, "test-c", "사아자", now - 1, max * 0.8);

    server.connect({ account: "test-a" });
    const first = await server.guildLeague();
    expect(first.last.guilds.map((g: any) => g.name)).toEqual(["라마바길드", "사아자길드", "가나다길드"]);
    expect(first.last.guilds[0].killed).toBe(true);
    expect(first.last.myGuildRank).toBe(3);
    expect(first.last.players[0]).toMatchObject({ name: "라마바", guild: "라마바길드" });
    expect(first.now.guilds).toEqual([]);

    // Seen again: paid only the once.
    await server.guildLeague();
    const b1 = await leagueMail(server, "test-b");
    expect(b1.map((m: any) => m.gems).sort((x: number, y: number) => x - y)).toEqual([LEAGUE_PLAYER_GEMS[0], LEAGUE_GUILD_GEMS[0]]);
    const a1 = await leagueMail(server, "test-a");
    expect(a1.map((m: any) => m.gems).sort((x: number, y: number) => x - y)).toEqual([LEAGUE_PLAYER_GEMS[2], LEAGUE_GUILD_GEMS[2]]);
    const told = await $global.getCollectionItems("announcements", {});
    expect(told.filter((r: any) => r.kind === "guild_week").map((r: any) => r.params.guild)).toEqual(["라마바길드"]);
  });

  test("a guild's gems go once to each account that fought that week, not to whoever is in it when paid", async (server) => {
    const now = currentWeek(Date.now());
    const a = await founder(server, "test-a", "가나다");
    const character = (await $global.getUserState("test-a")).active;
    // Two of test-a's characters went in, and test-c, who has left the guild since.
    await $global.addCollectionItem("guildBoss", {
      guild: a, week: now - 1, boss: bossOfWeek(now - 1), max: bossMax(1), damage: 100, stagesPaid: 0, killedAt: null,
      entries: {
        [character]: { account: "test-a", name: "가나다", day: "d" },
        "c-second": { account: "test-a", name: "둘째", day: "d" },
        "c-gone": { account: "test-c", name: "떠난이", day: "d" },
      },
      hitters: { [character]: { account: "test-a", name: "가나다", damage: 100 } },
    });
    // test-b joins only after the week is over.
    await makeCharacter(server, "test-b", "늦은이");
    await server.applyGuild(a);
    server.connect({ account: "test-a" });
    await server.answerApplication((await $global.getUserState("test-b")).active, true);
    await server.guildLeague();
    const guildGems = async (account: string) => (await leagueMail(server, account)).filter((m: any) => m.params.who === "guild").map((m: any) => m.gems);
    expect(await guildGems("test-a")).toEqual([LEAGUE_GUILD_GEMS[0]]);
    expect(await guildGems("test-c")).toEqual([LEAGUE_GUILD_GEMS[0]]);
    expect(await guildGems("test-b")).toEqual([]);
  });

  test("a guild that did no damage is paid nothing", async (server) => {
    const now = currentWeek(Date.now());
    const a = await founder(server, "test-a", "가나다");
    await week(a, "test-a", "가나다", now - 1, 0);
    server.connect({ account: "test-a" });
    await server.guildLeague();
    expect(await leagueMail(server, "test-a")).toEqual([]);
  });
});
