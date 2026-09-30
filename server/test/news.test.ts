import { NEWS } from "../../src/game/news";
import { errorOf } from "./helpers";

describe("news", () => {
  test("an account keeps the newest notice it has read, and never goes back", async (server) => {
    server.connect({ account: "test-a" });
    expect(await server.getNewsSeen()).toEqual({ seen: null });
    expect(await server.markNewsSeen(NEWS[0].id)).toEqual({ seen: NEWS[0].id });
    expect(await server.getNewsSeen()).toEqual({ seen: NEWS[0].id });
    // A late call for an older one changes nothing.
    expect(await server.markNewsSeen(NEWS[1].id)).toEqual({ seen: NEWS[0].id });
    expect(await server.getNewsSeen()).toEqual({ seen: NEWS[0].id });
    // Kept per account.
    server.connect({ account: "test-b" });
    expect(await server.getNewsSeen()).toEqual({ seen: null });
  });

  test("only notices on the list", async (server) => {
    server.connect({ account: "test-a" });
    expect(await errorOf(server.markNewsSeen("1999-01-01-gone"))).toContain("unavailable");
    expect(await errorOf(server.markNewsSeen(3))).toContain("unavailable");
    expect(await server.getNewsSeen()).toEqual({ seen: null });
  });
});
