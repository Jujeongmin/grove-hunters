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
