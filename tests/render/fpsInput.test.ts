import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FpsInput } from "../../src/game/render/FpsInput";

// Node has no DOM: the window, the document and the canvas are plain event targets here.
function event(type: string, fields: Record<string, unknown>): Event {
  return Object.assign(new Event(type), fields);
}

describe("mouse and keys", () => {
  let canvas: EventTarget;
  let input: FpsInput;
  beforeEach(() => {
    Object.assign(globalThis, { window: new EventTarget(), document: new EventTarget() });
    canvas = new EventTarget();
    input = new FpsInput(canvas as HTMLElement);
  });
  afterEach(() => input.dispose());

  it("walks only by the pad, never by WASD", () => {
    // Two keys, not four: W with S (or A with D) would cancel out and hide a key that still walks.
    for (const code of ["KeyW", "KeyD"]) window.dispatchEvent(event("keydown", { code, repeat: false }));
    expect(input.moveInput()).toEqual({ forward: 0, strafe: 0 });
    input.setVirtualMove(1, -0.5);
    expect(input.moveInput()).toEqual({ forward: 1, strafe: -0.5 });
  });

  it("still takes the other keys", () => {
    window.dispatchEvent(event("keydown", { code: "KeyQ", repeat: false }));
    expect(input.consumePress("KeyQ")).toBe(true);
  });

  it("turns the view by dragging, and a click that stayed put strikes", () => {
    canvas.dispatchEvent(event("mousedown", { button: 0 }));
    document.dispatchEvent(event("mousemove", { movementX: 30, movementY: -4 }));
    window.dispatchEvent(event("mouseup", { button: 0 }));
    expect(input.consumeLook()).toEqual({ dx: 30, dy: -4 });
    expect(input.consumePress("VirtualFire")).toBe(false);

    canvas.dispatchEvent(event("mousedown", { button: 0 }));
    document.dispatchEvent(event("mousemove", { movementX: 2, movementY: 1 }));
    window.dispatchEvent(event("mouseup", { button: 0 }));
    expect(input.consumePress("VirtualFire")).toBe(true);
  });

  it("keeps where a click landed, so the world can see what was clicked", () => {
    canvas.dispatchEvent(event("mousedown", { button: 0, clientX: 120, clientY: 80 }));
    window.dispatchEvent(event("mouseup", { button: 0, clientX: 121, clientY: 80 }));
    expect(input.consumeClick()).toEqual({ x: 121, y: 80 });
    expect(input.consumeClick()).toBeNull();
    // A drag is a look about, not a click at something.
    canvas.dispatchEvent(event("mousedown", { button: 0, clientX: 10, clientY: 10 }));
    document.dispatchEvent(event("mousemove", { movementX: 40, movementY: 0 }));
    window.dispatchEvent(event("mouseup", { button: 0, clientX: 50, clientY: 10 }));
    expect(input.consumeClick()).toBeNull();
  });

  it("takes a tap on a touch screen as a click that does not strike", () => {
    input.tap(33, 44);
    expect(input.consumeClick()).toEqual({ x: 33, y: 44 });
    expect(input.consumePress("VirtualFire")).toBe(false);
  });

  it("does not turn the view when the mouse moves without a button held", () => {
    document.dispatchEvent(event("mousemove", { movementX: 50, movementY: 50 }));
    expect(input.consumeLook()).toEqual({ dx: 0, dy: 0 });
  });

  it("raises the shield while the right button is held", () => {
    canvas.dispatchEvent(event("mousedown", { button: 2 }));
    expect(input.blocking).toBe(true);
    window.dispatchEvent(event("mouseup", { button: 2 }));
    expect(input.blocking).toBe(false);
  });
});
