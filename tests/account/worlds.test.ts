import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD, WORLDS, readWorld } from "../../src/game/account/worlds";
import { worldName } from "../../src/ui/names";

describe("worlds", () => {
  it("offers four numbered servers", () => {
    expect(WORLDS.map((w) => w.id)).toEqual(["w1", "w2", "w3", "w4"]);
    expect(WORLDS.map((w) => worldName(w.number))).toEqual(["초록숲-1", "초록숲-2", "초록숲-3", "초록숲-4"]);
  });

  it("reads only known ids", () => {
    expect(worldName(readWorld("w3")!.number)).toBe("초록숲-3");
    expect(readWorld("w9")).toBeNull();
    expect(readWorld(3)).toBeNull();
    expect(DEFAULT_WORLD.id).toBe("w1");
  });
});
