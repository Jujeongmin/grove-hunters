import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLASSES } from "../../src/game/combat/classes";
import { HEROES } from "../../src/game/render/heroes";

// The animation names inside a .glb (its JSON chunk).
function clipsOf(file: string): string[] {
  const bytes = readFileSync(file);
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString()) as { animations?: { name: string }[] };
  return (json.animations ?? []).map((a) => a.name);
}

describe("hero clips", () => {
  const dir = "public/assets/models";
  // The models are only on the deploy branch; without them there is nothing to check.
  it.runIf(existsSync(`${dir}/hero_warrior.glb`))("name only clips the models have", () => {
    for (const c of CLASSES) {
      const rig = HEROES[c];
      const clips = clipsOf(`${dir}/${rig.model}.glb`);
      for (const name of [rig.idle, rig.walk, rig.run, rig.skill, rig.death, ...rig.attacks]) {
        expect(clips, `${c}: ${name}`).toContain(name);
      }
      // The roll, from the model itself or the one it borrows it from (the cleric, the warrior's).
      expect(clipsOf(`${dir}/${rig.rollFrom ?? rig.model}.glb`), `${c}: roll`).toContain(rig.roll);
    }
  });

  it("sound like what they hold: fists for the monk, a staff for the cleric, a blade for the rest up close", () => {
    expect(HEROES.monk.swingCue).toBe("punch");
    expect(HEROES.cleric.swingCue).toBe("staff");
    expect(HEROES.warrior.swingCue).toBe("swing");
    expect(HEROES.rogue.swingCue).toBe("swing");
  });

  it("give the melee classes more than one swing to chain", () => {
    for (const c of ["warrior", "rogue", "monk", "cleric"] as const) expect(HEROES[c].attacks.length).toBeGreaterThan(1);
  });
});
