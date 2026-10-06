import { GUILD_COST, GUILD_CHAT_KEEP, GUILD_MAX, MAX_VICES, REJOIN_MS } from "../../src/game/account/guild";
import { GOLD } from "../../src/game/account/items";
import { editActive, errorOf, makeCharacter } from "./helpers";

// A character with the gold to found a guild.
async function founder(server: any, account = "test-a", name = "길드장"): Promise<void> {
  await makeCharacter(server, account, name);
  await $asset.mint(GOLD, GUILD_COST);
}

// `account`'s character applies to `guild` and the master (`master`) lets it in. Leaves `master` connected.
async function join(server: any, guild: string, account: string, master = "test-a"): Promise<string> {
  server.connect({ account });
  await server.applyGuild(guild);
  const id = (await $global.getUserState(account)).active;
  server.connect({ account: master });
  await server.answerApplication(id, true);
  return id;
}

describe("guilds", () => {
  test("founding costs gold, takes a free name, and makes you its master", async (server) => {
    await founder(server);
    const view = await server.createGuild("숲의수호자");
    expect(view.role).toBe("master");
    expect(view.guild.name).toBe("숲의수호자");
    expect(view.guild.members.map((m: any) => [m.name, m.role])).toEqual([["길드장", "master"]]);
    expect(await $asset.get(GOLD)).toBe(0);
    expect(await errorOf(server.createGuild("다른길드"))).toContain("in_guild");

    await makeCharacter(server, "test-b", "둘째");
    await $asset.mint(GOLD, GUILD_COST);
    expect(await errorOf(server.createGuild("숲의수호자"))).toContain("guild_name_taken");
    // Taken ignoring case, and the gold comes back.
    expect(await $asset.get(GOLD)).toBe(GUILD_COST);
    expect(await errorOf(server.createGuild("x"))).toContain("guild_name_invalid");
    await makeCharacter(server, "test-c", "셋째");
    expect(await errorOf(server.createGuild("셋째길드"))).toContain("not_enough_gold");
  });

  test("two foundings sent at once found one guild and cost the gold once", async (server) => {
    await founder(server);
    await $asset.mint(GOLD, GUILD_COST);
    const tries = await Promise.allSettled([server.createGuild("첫째길드"), server.createGuild("둘째길드")]);
    expect(tries.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await $asset.get(GOLD)).toBe(GUILD_COST);
    expect(await $global.countCollectionItems("guilds")).toBe(1);
  });

  test("applying, answering, and the list of guilds", async (server) => {
    await founder(server);
    const guild = (await server.createGuild("숲길드")).guild.id;
    await makeCharacter(server, "test-b", "신청자");
    const listed = await server.findGuilds("");
    expect(listed).toEqual([{ id: guild, name: "숲길드", members: 1, notice: "" }]);
    expect(await server.findGuilds("숲길드")).toEqual(listed);
    expect(await server.findGuilds("없는길드")).toEqual([]);
    const applied = await server.applyGuild(guild);
    expect(applied.applied).toEqual([{ id: guild, name: "숲길드" }]);
    const applicant = (await $global.getUserState("test-b")).active;

    // Only a master or vice sees and answers applications.
    server.connect({ account: "test-a" });
    expect((await server.getGuild()).guild.applicants.map((a: any) => a.name)).toEqual(["신청자"]);
    const answered = await server.answerApplication(applicant, true);
    expect(answered.guild.members.map((m: any) => [m.name, m.role])).toEqual([["길드장", "master"], ["신청자", "member"]]);
    expect(answered.guild.applicants).toEqual([]);
    server.connect({ account: "test-b" });
    const mine = await server.getGuild();
    expect([mine.role, mine.guild.applicants, mine.applied]).toEqual(["member", [], []]);
    expect(await errorOf(server.applyGuild(guild))).toContain("in_guild");
    expect(await errorOf(server.answerApplication(applicant, true))).toContain("not_allowed");
  });

  test("turned away, withdrawn, or taken by another guild first", async (server) => {
    await founder(server, "test-a", "첫길드장");
    const first = (await server.createGuild("첫길드")).guild.id;
    await founder(server, "test-c", "둘길드장");
    const second = (await server.createGuild("둘길드")).guild.id;
    await makeCharacter(server, "test-b", "떠돌이");
    await server.applyGuild(first);
    await server.applyGuild(second);
    const wanderer = (await $global.getUserState("test-b")).active;
    expect((await server.cancelApplication(second)).applied).toEqual([{ id: first, name: "첫길드" }]);
    server.connect({ account: "test-a" });
    await server.answerApplication(wanderer, false);
    server.connect({ account: "test-b" });
    expect((await server.getGuild()).applied).toEqual([]);

    // Applied to both; the first to accept has it, and the other's application goes.
    await server.applyGuild(first);
    await server.applyGuild(second);
    server.connect({ account: "test-c" });
    await server.answerApplication(wanderer, true);
    expect((await server.getGuild()).guild.members.length).toBe(2);
    server.connect({ account: "test-a" });
    expect((await server.getGuild()).guild.applicants).toEqual([]);
    expect(await errorOf(server.answerApplication(wanderer, true))).toContain("no_applicant");
  });

  test("roles: vices answer and put out members; only the master sets roles, hands over or disbands", async (server) => {
    await founder(server);
    const guild = (await server.createGuild("숲길드")).guild.id;
    await makeCharacter(server, "test-b", "부길마");
    await makeCharacter(server, "test-c", "길드원");
    const vice = await join(server, guild, "test-b");
    const member = await join(server, guild, "test-c");
    const master = (await $global.getUserState("test-a")).active;
    await server.setGuildRole(vice, "vice");
    server.connect({ account: "test-b" });
    expect(await errorOf(server.setGuildRole(member, "vice"))).toContain("not_allowed");
    expect(await errorOf(server.kickMember(master))).toContain("not_allowed");
    await server.setGuildNotice("오늘 9시 사냥");
    await server.kickMember(member);
    const after = await server.getGuild();
    expect(after.guild.notice).toBe("오늘 9시 사냥");
    expect(after.guild.members.map((m: any) => m.name)).toEqual(["길드장", "부길마"]);
    // Put out: no guild, and a day's wait before the next.
    server.connect({ account: "test-c" });
    const out = await server.getGuild();
    expect(out.guild).toBeNull();
    expect(await errorOf(server.applyGuild(guild))).toContain("guild_wait");
    await editActive("test-c", (c) => ({ ...c, guildLeftAt: Date.now() - REJOIN_MS }));
    await server.applyGuild(guild);

    // The master cannot leave, only hand over; a guild with others in it cannot be disbanded.
    server.connect({ account: "test-a" });
    expect(await errorOf(server.leaveGuild())).toContain("master_must_pass");
    expect(await errorOf(server.disbandGuild())).toContain("guild_not_empty");
    await server.passGuildMaster(vice);
    expect((await server.getGuild()).role).toBe("member");
    await server.leaveGuild();
    server.connect({ account: "test-b" });
    const left = await server.getGuild();
    expect(left.role).toBe("master");
    expect(left.guild.members.map((m: any) => m.name)).toEqual(["부길마"]);
    // The waiting application goes with the guild.
    await server.disbandGuild();
    expect(await server.findGuilds("")).toEqual([]);
    server.connect({ account: "test-c" });
    expect((await server.getGuild()).applied).toEqual([]);
  });

  test("no more vices, or members, than a guild holds", async (server) => {
    await founder(server);
    const guild = (await server.createGuild("숲길드")).guild.id;
    const vices: string[] = [];
    for (let i = 0; i <= MAX_VICES; i++) {
      await makeCharacter(server, `test-v${i}`, `부${i}`);
      vices.push(await join(server, guild, `test-v${i}`));
    }
    for (let i = 0; i < MAX_VICES; i++) await server.setGuildRole(vices[i], "vice");
    expect(await errorOf(server.setGuildRole(vices[MAX_VICES], "vice"))).toContain("vice_limit");
    // Fill it to the top.
    for (let i = (await server.getGuild()).guild.members.length; i < GUILD_MAX; i++) {
      await makeCharacter(server, `test-f${i}`, `꽉${i}`);
      await join(server, guild, `test-f${i}`);
    }
    await makeCharacter(server, "test-late", "늦은사람");
    expect(await errorOf(server.applyGuild(guild))).toContain("guild_full");
  });

  test("guild chat: members only, at the chat's pace, the last lines kept", async (server) => {
    await founder(server);
    const guild = (await server.createGuild("숲길드")).guild.id;
    await makeCharacter(server, "test-b", "길드원");
    await join(server, guild, "test-b");
    const said = await server.guildSay("  안녕  하세요 ");
    expect([said.name, said.text]).toEqual(["길드장", "안녕 하세요"]);
    expect(await errorOf(server.guildSay("또"))).toContain("too_fast");
    server.connect({ account: "test-b" });
    const heard = await server.guildChat(0);
    expect(heard.inGuild).toBe(true);
    expect(heard.lines.map((l: any) => l.text)).toEqual(["안녕 하세요"]);
    expect((await server.guildChat(said.at)).lines).toEqual([]);
    await makeCharacter(server, "test-c", "남남");
    expect(await server.guildChat(0)).toEqual({ lines: [], inGuild: false });
    expect(await errorOf(server.guildSay("몰래"))).toContain("no_guild");
    // Only the last GUILD_CHAT_KEEP lines stay.
    for (let i = 0; i < GUILD_CHAT_KEEP + 5; i++) {
      await $global.addCollectionItem("guildChat", { guild, account: "test-a", name: "길드장", text: `줄${i}`, at: i + 1 });
    }
    server.connect({ account: "test-a" });
    await $global.updateUserState("test-a", { guildChatAt: [] });
    await server.guildSay("마지막");
    server.connect({ account: "test-b" });
    const lines = (await server.guildChat(0)).lines;
    expect(lines.length).toBe(GUILD_CHAT_KEEP);
    expect(lines[lines.length - 1].text).toBe("마지막");
  });

  test("the guild's name goes over its members' heads", async (server) => {
    await founder(server);
    server.connect({ account: "test-a" });
    const entry = await server.enterWorld();
    await server.simulateJoin(entry.roomId, "test-a");
    server.connect({ account: "test-a", roomId: entry.roomId });
    await server.arrive();
    await server.createGuild("숲길드");
    expect((await $room.getMyState()).look.guild).toBe("숲길드");
    await server.disbandGuild();
    expect((await $room.getMyState()).look.guild).toBeNull();
  });
});
