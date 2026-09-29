import { describe, expect, it } from "vitest";
import { arrivalVitals, readVitals } from "../../src/game/account/vitals";

const hurt = { hp: 40, dead: false, hitAt: 1000, strikeReadyAt: 2000, skillReady: { "0": 9000 } };

describe("what a character comes into a room with", () => {
  it("is whole the first time, with nothing carried and nothing here", () => {
    expect(arrivalVitals(null, {}, 100)).toEqual({ hp: 100, dead: false, hitAt: 0, strikeReadyAt: 0, skillReady: {} });
  });

  it("is what it carried out of the last room: its wounds, its cooldowns, its fall", () => {
    expect(arrivalVitals(hurt, { hp: 100 }, 100)).toEqual(hurt);
    expect(arrivalVitals({ ...hurt, hp: 0, dead: true }, {}, 100)).toMatchObject({ hp: 0, dead: true });
  });

  it("else what this room already holds of it: a reload, or a second arrive, heals nothing", () => {
    expect(arrivalVitals(null, { ...hurt, pose: {} }, 100)).toEqual(hurt);
  });

  it("never more than its health, nor standing at nothing", () => {
    expect(arrivalVitals({ ...hurt, hp: 500 }, {}, 120).hp).toBe(120);
    expect(arrivalVitals({ ...hurt, hp: 0 }, {}, 120).hp).toBe(1);
  });

  it("reads only what is whole", () => {
    expect(readVitals(null)).toBeNull();
    expect(readVitals({ dead: true })).toBeNull();
    expect(readVitals({ hp: 30 })).toEqual({ hp: 30, dead: false, hitAt: 0, strikeReadyAt: 0, skillReady: {} });
    expect(readVitals({ hp: 30, skillReady: { "0": "x", "1": 5 } })?.skillReady).toEqual({ "1": 5 });
  });
});
