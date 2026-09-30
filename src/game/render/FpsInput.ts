import type { MoveInput } from "../rules/movement";

// Keys typed into a text box (the chat) are words, not moves.
export function typing(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  return !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
}

// A press that moved less than this many pixels was a click, not a drag to look about.
const DRAG_SLOP = 6;
// Walking keys: WASD or the arrows, each a push along one axis.
const WALK_KEYS: Record<string, { forward?: number; strafe?: number }> = {
  KeyW: { forward: 1 }, ArrowUp: { forward: 1 }, KeyS: { forward: -1 }, ArrowDown: { forward: -1 },
  KeyD: { strafe: 1 }, ArrowRight: { strafe: 1 }, KeyA: { strafe: -1 }, ArrowLeft: { strafe: -1 },
};

export class FpsInput {
  // The attack button held: swing. The right mouse button or the guard button held: raise the shield.
  firing = false;
  blocking = false;
  private readonly pressed = new Set<string>();
  // Walking keys held down.
  private readonly held = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  // On-screen controls (every device): the pad's push, look drags, and held buttons.
  private virtualMove: MoveInput = { forward: 0, strafe: 0 };
  private virtualFiring = false;
  private virtualBlocking = false;

  constructor(private readonly element: HTMLElement) {
    element.addEventListener("mousedown", this.onMouseDown);
    element.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("mousemove", this.onMouseMove);
  }

  // The mouse is never captured: the cursor stays for the buttons, and the view turns while the
  // left button is held and dragged across the world. A press that barely moved is a click at
  // something, which lands a blow.
  private dragging = false;
  private dragged = 0;
  // Where the last click (or tap) that did not drag landed, in client pixels, until read.
  private click: { x: number; y: number } | null = null;

  // Walking is the on-screen pad's, on every device, or on a keyboard WASD's (or the arrows'); the
  // mouse still turns the view by dragging, never captured.
  moveInput(): MoveInput {
    let { forward, strafe } = this.virtualMove;
    for (const code of this.held) {
      forward += WALK_KEYS[code].forward ?? 0;
      strafe += WALK_KEYS[code].strafe ?? 0;
    }
    return { forward: Math.max(-1, Math.min(1, forward)), strafe: Math.max(-1, Math.min(1, strafe)) };
  }

  // The on-screen controls: the joystick's push (each -1 to 1), a look drag in pixels, a held
  // attack or guard button, and a tapped key.
  setVirtualMove(forward: number, strafe: number): void {
    this.virtualMove = { forward, strafe };
  }

  addVirtualLook(dx: number, dy: number): void {
    this.lookX += dx;
    this.lookY += dy;
  }

  // A tap on the attack button, too short to be held over a frame, still lands one blow.
  setVirtualFiring(on: boolean): void {
    this.virtualFiring = on;
    this.firing = on;
    if (on) this.pressed.add("VirtualFire");
  }

  setVirtualBlocking(on: boolean): void {
    this.virtualBlocking = on;
    this.blocking = on || this.mouseBlocking;
  }

  press(code: string): void {
    this.pressed.add(code);
  }

  // A tap on the world on a touch screen: a click at something (a person to talk to), not a blow
  // (the attack button strikes).
  tap(x: number, y: number): void {
    this.click = { x, y };
  }

  consumeClick(): { x: number; y: number } | null {
    const click = this.click;
    this.click = null;
    return click;
  }

  private mouseBlocking = false;

  consumeLook(): { dx: number; dy: number } {
    const look = { dx: this.lookX, dy: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return look;
  }

  consumePress(code: string): boolean {
    const had = this.pressed.has(code);
    this.pressed.delete(code);
    return had;
  }

  dispose(): void {
    this.element.removeEventListener("mousedown", this.onMouseDown);
    this.element.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("mousemove", this.onMouseMove);
  }

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      this.dragging = true;
      this.dragged = 0;
    }
    if (e.button === 2) this.mouseBlocking = true;
    this.blocking = this.mouseBlocking || this.virtualBlocking;
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0 && this.dragging) {
      this.dragging = false;
      // A press that stayed put was a click at something, not a look about.
      if (this.dragged < DRAG_SLOP) {
        this.press("VirtualFire");
        this.click = { x: e.clientX, y: e.clientY };
      }
    }
    if (e.button === 2) this.mouseBlocking = false;
    this.blocking = this.mouseBlocking || this.virtualBlocking;
  };
  // The right button raises the shield, so it must not open the browser's menu.
  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };
  private onKeyDown = (e: KeyboardEvent) => {
    if (typing(e)) return;
    if (e.code in WALK_KEYS) {
      this.held.add(e.code);
      // The arrows would otherwise scroll the page.
      e.preventDefault();
      return;
    }
    if (!e.repeat) this.pressed.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };
  private onBlur = () => {
    this.pressed.clear();
    this.held.clear();
    this.click = null;
    this.dragging = false;
    this.mouseBlocking = false;
    this.firing = this.virtualFiring;
    this.blocking = this.virtualBlocking;
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.dragging) return;
    this.lookX += e.movementX;
    this.lookY += e.movementY;
    this.dragged += Math.abs(e.movementX) + Math.abs(e.movementY);
  };
}
