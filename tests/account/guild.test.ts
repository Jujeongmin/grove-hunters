import { describe, expect, it } from "vitest";
import {
  NOTICE_MAX, REJOIN_MS, canAnswer, canKick, canLead, canWriteNotice, mayJoin, parseGuildName, rankedMembers, readGuild, readGuildTag, readNotice,
  roleOf, type GuildMember,
} from "../../src/game/account/guild";

const member = (characterId: string, role: GuildMember["role"], joined = 0): GuildMember => ({ characterId, account: `a-${characterId}`, name: characterId, role, joined });

describe("guild", () => {
  it("who may do what", () => {
    expect([canAnswer("master"), canAnswer("vice"), canAnswer("member"), canAnswer(null)]).toEqual([true, true, false, false]);
    expect([canWriteNotice("vice"), canWriteNotice("member")]).toEqual([true, false]);
    expect([canLead("master"), canLead("vice")]).toEqual([true, false]);
    // Kicking: the master anyone but the master; a vice only plain members.
    expect(canKick("master", "vice")).toBe(true);
    expect(canKick("master", "member")).toBe(true);
    expect(canKick("master", "master")).toBe(false);
    expect(canKick("vice", "member")).toBe(true);
    expect(canKick("vice", "vice")).toBe(false);
    expect(canKick("vice", "master")).toBe(false);
    expect(canKick("member", "member")).toBe(false);
    expect(canKick("master", null)).toBe(false);
  });

  it("names follow the character name rules; notices are one short line", () => {
    expect(parseGuildName(" 숲의수호자 ")).toEqual({ name: "숲의수호자", key: "숲의수호자" });
    expect(parseGuildName("Grove_1").key).toBe("grove_1");
    expect(() => parseGuildName("a")).toThrow("guild_name_invalid");
    expect(() => parseGuildName("숲 수호")).toThrow("guild_name_invalid");
    expect(readNotice("  오늘   9시 보스  ")).toBe("오늘 9시 보스");
    expect(readNotice("")).toBe("");
    expect(readNotice("가".repeat(NOTICE_MAX))).toBe("가".repeat(NOTICE_MAX));
    expect(readNotice("가".repeat(NOTICE_MAX + 1))).toBeNull();
    expect(readNotice(3)).toBeNull();
  });

  it("waits a day after leaving", () => {
    expect(mayJoin(0, REJOIN_MS)).toBe(true);
    expect(mayJoin(1, REJOIN_MS)).toBe(false);
  });

  it("reads a guild back only with one master", () => {
    const row = {
      __id: "g1", name: "숲", key: "숲", notice: "hi", made: 5,
      members: [member("m", "master"), member("v", "vice", 2), member("x", "member", 1), { characterId: "bad" }, member("m", "member")],
      applicants: [{ characterId: "p", account: "a-p", name: "p", at: 3 }],
    };
    const guild = readGuild(row)!;
    expect(guild.members.map((m) => m.characterId)).toEqual(["m", "v", "x"]);
    expect(guild.applicants).toEqual([{ characterId: "p", account: "a-p", name: "p", at: 3 }]);
    expect(roleOf(guild, "v")).toBe("vice");
    expect(roleOf(guild, "zz")).toBeNull();
    expect(readGuild({ ...row, members: [member("v", "vice")] })).toBeNull();
    expect(readGuild({ ...row, members: [member("m", "master"), member("n", "master")] })).toBeNull();
    expect(rankedMembers(guild.members).map((m) => m.characterId)).toEqual(["m", "v", "x"]);
    expect(rankedMembers([member("a", "member", 2), member("b", "member", 1), member("m", "master", 9)]).map((m) => m.characterId)).toEqual(["m", "b", "a"]);
    expect(readGuildTag({ id: "g1", name: "숲" })).toEqual({ id: "g1", name: "숲" });
    expect(readGuildTag({ id: "g1" })).toBeNull();
  });
});
