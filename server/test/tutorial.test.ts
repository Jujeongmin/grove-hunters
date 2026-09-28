import { TUTORIAL, TUTORIAL_GOLD, TUTORIAL_POTIONS } from "../../src/game/account/tutorial";
import { zoneLayout } from "../../src/game/world/zones";
import { enterAs, errorOf, makeCharacter, toNpc, walkTo } from "./helpers";

// A brand-new character in the village, tutorial and all.
async function newcomer(server: any, account = "test-a"): Promise<void> {
  await makeCharacter(server, account, `새내기${account.slice(-1)}`, "warrior", "0000", true);
  await enterAs(server, account);
}

describe("the first tutorial", () => {
  test("a new character starts at the elder, with an empty bag and without its first skill", async (server) => {
    await newcomer(server);
    const bag = await server.getBag();
    expect(bag.tutorial).toBe(TUTORIAL.talk);
    expect(bag.bag).toEqual({});
    expect(await errorOf(server.useSkill(0))).toContain("unavailable");
  });

  test("the elder teaches the skill and hands over potions once, and only up close", async (server) => {
    await newcomer(server);
    const spawn = zoneLayout("village").playerSpawn;
    await walkTo(server, spawn.x, spawn.z);
    expect(await errorOf(server.tutorialTalk())).toContain("not_near");
    await toNpc(server, "elder");
    const taught = await server.tutorialTalk();
    expect(taught.tutorial).toBe(TUTORIAL.register);
    expect(taught.bag.potion_small).toBe(TUTORIAL_POTIONS);
    expect(await errorOf(server.useSkill(0))).toBe("");
    const again = await server.tutorialTalk();
    expect(again.tutorial).toBe(TUTORIAL.register);
    expect(again.bag.potion_small).toBe(TUTORIAL_POTIONS);
  });

  test("the steps only go forward, one at a time, and finishing pays once", async (server) => {
    await newcomer(server);
    await toNpc(server, "elder");
    await server.tutorialTalk();
    expect(await errorOf(server.tutorialStep(0))).toContain("unavailable");
    expect(await errorOf(server.tutorialStep(3))).toContain("unavailable");
    expect((await server.tutorialStep(TUTORIAL.auto)).tutorial).toBe(TUTORIAL.register);
    expect((await server.tutorialFinish()).gold).toBe(0);
    expect((await server.tutorialStep(TUTORIAL.register)).tutorial).toBe(TUTORIAL.auto);
    expect((await server.tutorialStep(TUTORIAL.register)).tutorial).toBe(TUTORIAL.auto);
    expect((await server.tutorialStep(TUTORIAL.auto)).tutorial).toBe(TUTORIAL.battle);
    const done = await server.tutorialFinish();
    expect(done.tutorial).toBeNull();
    expect(done.gold).toBe(TUTORIAL_GOLD);
    expect((await server.tutorialFinish()).gold).toBe(TUTORIAL_GOLD);
  });

  test("a character from before the tutorial is left as it was", async (server) => {
    await makeCharacter(server, "test-b", "고참");
    await enterAs(server, "test-b");
    const state = await $global.getUserState("test-b");
    const map = { ...state.characterMap };
    delete map[state.active].tutorial;
    await $global.updateUserState("test-b", { characterMap: map });
    expect((await server.getBag()).tutorial).toBeNull();
    expect(await errorOf(server.useSkill(0))).toBe("");
    await toNpc(server, "elder");
    const talked = await server.tutorialTalk();
    expect(talked.tutorial).toBeNull();
    expect(talked.bag.potion_small).toBe(TUTORIAL_POTIONS);
  });
});
