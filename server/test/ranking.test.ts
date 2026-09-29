import { levelOf } from "../../src/game/account/level";
import { combatPower } from "../../src/game/combat/power";
import { errorOf, giveXp, makeCharacter } from "./helpers";

// The board is written when a character's XP changes; hunting will do that (phase 2). Here the
// store writes it directly.
import { readProfile, readRanking, writeRanking } from "../src/store";

describe("ranking", () => {
  test("a fresh account sees an empty board", async (server) => {
    server.connect({ account: "test-a" });
    const view = await server.getRanking();
    expect(view.xp).toBe(0);
    expect(view.level).toEqual(levelOf(0));
    expect(view.rank).toBeNull();
    expect(view.board).toEqual([]);
  });

  test("puts characters on the board by XP, best first, with their names", async (server) => {
    for (const [account, name, xp] of [["test-a", "앞선자", 500], ["test-b", "뒤선자", 20]] as const) {
      await makeCharacter(server, account, name);
      await giveXp(account, xp);
      await writeRanking(account, (await readProfile(account)).active!);
    }
    server.connect({ account: "test-b" });
    const view = await server.getRanking();
    expect(view.board.map((r: any) => r.nickname)).toEqual(["앞선자", "뒤선자"]);
    expect(view.rank).toBe(2);
  });

  test("reads the best of a board longer than it reads, whatever order the rows were written in", async () => {
    for (let i = 0; i < 120; i++) {
      await $global.addCollectionItem("ranking", {
        id: `c-${i}`, account: `test-${i}`, nickname: `줄${i}`, xp: 10 + i, level: 1, playerClass: "warrior", job: null,
      });
    }
    const board = await readRanking();
    expect(board[0].nickname).toBe("줄119");
    expect(board.every((r, i) => i === 0 || board[i - 1].xp >= r.xp)).toBe(true);
  });

  test("each line carries the class, and a line opens the character in full", async (server) => {
    await makeCharacter(server, "test-a", "궁수왕", "ranger");
    await giveXp("test-a", 900);
    await writeRanking("test-a", (await readProfile("test-a")).active!);
    await makeCharacter(server, "test-b", "구경꾼");
    server.connect({ account: "test-b" });
    const view = await server.getRanking();
    expect(view.board[0]).toMatchObject({ nickname: "궁수왕", playerClass: "ranger", job: null });
    expect(view.power).toBeGreaterThan(0);

    const detail = await server.getRankDetail(view.board[0].id);
    const active = (await readProfile("test-a")).active!;
    expect(detail).toMatchObject({
      nickname: "궁수왕", playerClass: "ranger", level: levelOf(900).level, xp: 900, rank: 1, power: combatPower({ ...active, mount: "deer" }),
      gear: active.gear,
    });
    // The server sends the server's id; the screen turns it into a name in the reader's language.
    expect(detail.world).toBe("w1");
    expect(await errorOf(server.getRankDetail("nobody"))).toContain("unavailable");
  });
});
