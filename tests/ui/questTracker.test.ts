import { describe, expect, it } from "vitest";
import { questHint } from "../../src/ui/questHint";

const state = (s: Partial<{ seeking: boolean; toElder: boolean; fighting: boolean }>) => ({ seeking: false, toElder: false, fighting: false, ...s });

describe("the quest tracker's line", () => {
  it("says it is fighting once auto-battle is at grips with the quest's monster, not still on its way", () => {
    expect(questHint(false, state({}))).toEqual({ key: "quest.goFind", going: false, showWay: false });
    expect(questHint(false, state({ seeking: true }))).toEqual({ key: "quest.seeking", going: true, showWay: true });
    expect(questHint(false, state({ seeking: true, fighting: true }))).toEqual({ key: "quest.fighting", going: true, showWay: false });
  });

  it("done, asks to be tapped to turn it in (and shines), even while auto-battle still hunts", () => {
    expect(questHint(true, state({ seeking: true, fighting: true }))).toEqual({ key: "quest.goReport", going: false, showWay: false });
    expect(questHint(true, state({ seeking: true, toElder: true }))).toEqual({ key: "quest.reporting", going: true, showWay: true });
  });
});

describe("Korean particles", () => {
  it("takes 로 after a vowel or ㄹ, 으로 after other finals", async () => {
    const { directionParticle } = await import("../../src/ui/korean");
    expect(directionParticle("버서커")).toBe("로");
    expect(directionParticle("수호기사")).toBe("로");
    expect(directionParticle("성기사")).toBe("로");
    expect(directionParticle("원소술사")).toBe("로");
    expect(directionParticle("저격수")).toBe("로");
    expect(directionParticle("권성")).toBe("으로");
    expect(directionParticle("검")).toBe("으로");
    expect(directionParticle("길")).toBe("로");
  });
});
