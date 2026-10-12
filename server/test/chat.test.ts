import { CHAT_BURST, CHAT_GAP_MS, CHAT_MAX } from "../../src/game/world/chat";
import { portalsOf } from "../../src/game/world/zones";
import { enterAs, errorOf, join, makeCharacter, walkTo } from "./helpers";

describe("chat", () => {
  test("a line goes out tidied, with the name the room shows", async (server) => {
    await makeCharacter(server, "test-a", "수다쟁이");
    await enterAs(server, "test-a");
    const said = await server.say("  안녕   하세요\n");
    expect(said).toMatchObject({ account: "test-a", name: "수다쟁이", text: "안녕 하세요" });
    await $global.updateUserState("test-a", { chatAt: [] });
    expect(await errorOf(server.say("   "))).toContain("unavailable");
    expect(await errorOf(server.say("가".repeat(CHAT_MAX + 1)))).toContain("unavailable");
    expect(await errorOf(server.say(42))).toContain("unavailable");
  });

  test("lines too close together, or too many at once, are turned away", async (server) => {
    await makeCharacter(server, "test-a", "도배꾼");
    await enterAs(server, "test-a");
    await server.say("하나");
    expect(await errorOf(server.say("둘"))).toContain("too_fast");
    // Spaced out, but a burst's worth already in the window.
    const now = Date.now();
    await $global.updateUserState("test-a", { chatAt: Array.from({ length: CHAT_BURST }, (_, i) => now - CHAT_GAP_MS * (i + 1)) });
    expect(await errorOf(server.say("셋"))).toContain("too_fast");
    await $global.updateUserState("test-a", { chatAt: [now - CHAT_GAP_MS] });
    expect((await server.say("넷")).text).toBe("넷");
  });

  test("the pace follows you through a portal", async (server) => {
    await makeCharacter(server, "test-a", "도배꾼");
    const entry = await enterAs(server, "test-a");
    await server.say("하나");
    const portal = portalsOf(entry.zone).find((p) => p.to === "forest1")!;
    await walkTo(server, portal.x, portal.z);
    await join(server, "test-a", await server.travel("forest1"), entry.roomId);
    expect(await errorOf(server.say("둘"))).toContain("too_fast");
  });
});
