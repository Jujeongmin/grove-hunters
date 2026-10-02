import { useEffect } from "react";

// What a tap may press: buttons, and the HUD's clickable panels (the quest tracker and the like).
const PRESSABLE = "button, [role='button'], a[href], label, .clickable";
// The browser's own click, if it comes after all, is dropped this long after ours.
const ECHO_MS = 500;

function pressable(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(PRESSABLE) : null;
}

// Phones send no click for a tap made while another finger is down (the movement stick held, say),
// so with a thumb on the stick no button answered. This presses it for them: a touch that goes down
// while another is down, and comes up over what it went down on, clicks it. Should the browser click
// too, its click is dropped, so nothing is pressed twice.
export function useMultiTouchClicks(): void {
  useEffect(() => {
    const down = new Set<number>();
    const presses = new Map<number, HTMLElement>();
    let echo: { el: HTMLElement; until: number } | null = null;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const others = down.size > 0;
      down.add(e.pointerId);
      const el = pressable(e.target);
      if (others && el && !(el as HTMLButtonElement).disabled) presses.set(e.pointerId, el);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      down.delete(e.pointerId);
      const el = presses.get(e.pointerId);
      presses.delete(e.pointerId);
      if (!el || !el.isConnected) return;
      if (pressable(document.elementFromPoint(e.clientX, e.clientY)) !== el) return;
      echo = { el, until: performance.now() + ECHO_MS };
      el.click();
    };
    const onCancel = (e: PointerEvent) => {
      down.delete(e.pointerId);
      presses.delete(e.pointerId);
    };
    const onClick = (e: MouseEvent) => {
      // Our own click (el.click()) is untrusted and goes through; the browser's late one does not.
      if (!echo || !e.isTrusted || performance.now() > echo.until || pressable(e.target) !== echo.el) return;
      echo = null;
      e.stopPropagation();
      e.preventDefault();
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onCancel, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onCancel, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
}
