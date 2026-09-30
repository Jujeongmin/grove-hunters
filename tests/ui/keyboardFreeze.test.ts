import { describe, expect, it } from "vitest";
import { slideFor } from "../../src/ui/useKeyboardFreeze";

describe("the stage under a phone's keyboard", () => {
  it("slides up just enough for the text box to sit above the keyboard", () => {
    // A 360-tall stage, 150 left above the keyboard, the chat box's foot at 280.
    expect(slideFor(280, 150, 360)).toBe(138);
    // Already in view: stays put.
    expect(slideFor(100, 150, 360)).toBe(0);
  });

  it("never slides further than the stage can go", () => {
    expect(slideFor(400, 150, 360)).toBe(210);
  });
});
