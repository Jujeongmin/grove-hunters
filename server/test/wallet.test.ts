import { BASE_MOUNT } from "../../src/game/account/mounts";
import { giveXp, makeCharacter, setWallet } from "./helpers";

// Gems, mount tickets and mounts are each character's (see walletKey in store.ts).
describe("each character's own gems and mounts", () => {
  test("what the account held before the split goes to its strongest character only", async (server) => {
    const first = await makeCharacter(server, "test-a", "약한이", "warrior");
    await server.createCharacter("강한이", "wizard", "0000");
    const strong = (await server.getAccount()).active;
    await giveXp("test-a", 50_000);
    // An account from before the split: its paid side on the account itself.
    await $global.updateUserState("test-a", {
      walletSplit: null, gems: 700, tickets: 3, mounts: ["dragon"], mount: "dragon", mountStars: { dragon: 2 }, pity: { legendary: 40, mythic: 40 },
    });
    const mine = await server.getMounts();
    expect([mine.gems, mine.tickets, mine.owned, mine.selected, mine.stars]).toEqual([700, 3, [BASE_MOUNT, "dragon"], "dragon", { dragon: 2 }]);
    expect(mine.pity.legendary).toBe(60);
    await server.selectCharacter(first.active.id);
    const theirs = await server.getMounts();
    expect([theirs.gems, theirs.tickets, theirs.owned, theirs.selected]).toEqual([0, 0, [BASE_MOUNT], BASE_MOUNT]);
    // Read again, nothing moves twice.
    await server.selectCharacter(strong.id);
    expect((await server.getMounts()).gems).toBe(700);
  });

  test("a draw and its gems stay with the character that made it", async (server) => {
    const first = await makeCharacter(server, "test-a", "하나", "warrior");
    await setWallet("test-a", { gems: 300 });
    const real = Math.random;
    Math.random = () => 0.995;
    try {
      expect((await server.pullMount()).mount).toBe("dragon");
    } finally {
      Math.random = real;
    }
    await server.createCharacter("둘째", "wizard", "0000");
    const other = await server.getMounts();
    expect([other.gems, other.owned]).toEqual([0, [BASE_MOUNT]]);
    expect(await server.selectMount("dragon").catch((e: Error) => e.message)).toContain("no_mount");
    await server.selectCharacter(first.active.id);
    const back = await server.getMounts();
    expect([back.gems, back.owned.includes("dragon")]).toEqual([200, true]);
  });
});
