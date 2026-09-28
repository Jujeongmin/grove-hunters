import { describe, expect, it } from "vitest";
import { MONSTERS, respawnDelay } from "../../src/game/world/monsters";

describe("monsters coming back", () => {
  it("take their full wait with one hunter in the room", () => {
    expect(respawnDelay("green_blob", 1)).toBe(MONSTERS.green_blob.respawnMs);
    expect(respawnDelay("green_blob", 0)).toBe(MONSTERS.green_blob.respawnMs);
  });

  it("come back sooner the more hunters share the room, down to 6 seconds at ten", () => {
    const five = respawnDelay("green_blob", 5);
    expect(five).toBeLessThan(MONSTERS.green_blob.respawnMs);
    expect(five).toBeGreaterThan(respawnDelay("green_blob", 10));
    expect(respawnDelay("green_blob", 10)).toBe(6_000);
    expect(respawnDelay("green_blob", 30)).toBe(6_000);
  });

  it("never hurry the grove's guardian back", () => {
    expect(respawnDelay("grove_guardian", 10)).toBe(MONSTERS.grove_guardian.respawnMs);
  });

  it("leave the boss to its own clock", () => {
    expect(respawnDelay("mushroom_king", 10)).toBe(MONSTERS.mushroom_king.respawnMs);
  });
});
