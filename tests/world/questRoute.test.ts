import { describe, expect, it } from "vitest";
import { questWay, zonesWith, type Entry } from "../../src/game/world/questRoute";

const open = (): Entry => "open";

describe("finding the way to a quest", () => {
  it("knows which fields each kind of monster lives in, the boss too", () => {
    expect(zonesWith(["green_blob"])).toEqual(["forest1"]);
    expect(zonesWith(["spider", "dire_spider"])).toEqual(["forest2", "forest3"]);
    expect(zonesWith(["mushroom_king"])).toEqual(["boss"]);
  });

  it("hunts where it is when the monsters live here", () => {
    expect(questWay("forest1", ["forest1"], open)).toEqual({ kind: "here" });
  });

  it("goes through the portal toward the nearest field that has them", () => {
    expect(questWay("village", ["forest1"], open)).toEqual({ kind: "go", next: "forest1", goal: "forest1" });
    expect(questWay("village", ["forest2", "forest3"], open)).toEqual({ kind: "go", next: "forest1", goal: "forest2" });
    expect(questWay("forest3", ["village"], open)).toEqual({ kind: "go", next: "forest2", goal: "village" });
  });

  it("says what stands in the way when the field is shut to you", () => {
    const shut = (zone: string): Entry => (zone === "forest2" ? "paid" : "open");
    expect(questWay("village", ["forest2"], shut)).toEqual({ kind: "locked", zone: "forest2", why: "paid" });
    const low = (zone: string): Entry => (zone === "forest3" ? "level" : "open");
    expect(questWay("forest1", ["forest3"], low)).toEqual({ kind: "locked", zone: "forest3", why: "level" });
  });

  it("takes an open field over a shut one further on", () => {
    const shut = (zone: string): Entry => (zone === "forest3" ? "level" : "open");
    expect(questWay("forest1", ["forest3", "forest2"], shut)).toEqual({ kind: "go", next: "forest2", goal: "forest2" });
  });

  it("has nowhere to go for monsters no field has", () => {
    expect(questWay("village", [], open)).toEqual({ kind: "nowhere" });
  });
});
