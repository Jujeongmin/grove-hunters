import { describe, expect, it } from "vitest";
import { connectionOf } from "../../src/net/connection";

describe("the connection, as the menu tells it", () => {
  it("is ready once connected, and trying until then", () => {
    expect(connectionOf({ available: true, connected: true, phase: "connected" })).toBe("ready");
    expect(connectionOf({ available: true, connected: false, phase: "idle" })).toBe("trying");
    expect(connectionOf({ available: true, connected: false, phase: "connecting" })).toBe("trying");
    expect(connectionOf({ available: true, connected: false, phase: "reconnecting" })).toBe("trying");
  });

  it("has failed when the server SDK gives up", () => {
    expect(connectionOf({ available: true, connected: false, phase: "unavailable" })).toBe("failed");
  });

  it("is none in a build with no Verse8 project", () => {
    expect(connectionOf({ available: false, connected: false, phase: "unavailable" })).toBe("none");
  });
});
