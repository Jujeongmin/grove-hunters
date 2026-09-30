import { useEffect } from "react";

// On a phone, the on-screen keyboard takes most of the height, and the 16:9 stage (sized from the
// window, see index.html) used to shrink to the strip above it, the whole game drawn tiny. While a text
// box has the focus the stage keeps its size instead, held to the top, and slides up just enough that
// the box sits right above the keyboard; the rest of the game waits under it. The class on <html>
// also tells index.html not to report the held size to Verse8's frame as the game's own.

// Space left between the text box and the keyboard (CSS pixels).
const ABOVE_KEYBOARD = 8;

// How far the stage slides up so a box whose foot is at `boxBottom` shows in a view `viewHeight`
// tall: nothing when it already shows, and never more than the stage can go.
export function slideFor(boxBottom: number, viewHeight: number, stageHeight: number): number {
  const over = boxBottom + ABOVE_KEYBOARD - viewHeight;
  return over > 0 ? Math.min(over, Math.max(0, stageHeight - viewHeight)) : 0;
}

function isTextBox(el: EventTarget | Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  const type = (el as HTMLInputElement).type;
  return !["button", "checkbox", "radio", "range", "submit", "color", "file"].includes(type);
}

export function useKeyboardFreeze(): void {
  useEffect(() => {
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;
    const root = document.getElementById("root");
    if (!root) return;
    const html = document.documentElement;
    let held = false;
    let slide = 0;

    const place = () => {
      if (!held) return;
      const box = document.activeElement;
      if (!isTextBox(box)) return;
      // A browser that scrolled the page itself to show the box is put back: the slide does it.
      window.scrollTo(0, 0);
      const view = window.visualViewport?.height ?? window.innerHeight;
      // The box's foot as it would be with the stage unslid.
      const bottom = box.getBoundingClientRect().bottom + slide;
      slide = slideFor(bottom, view, root.offsetHeight);
      root.style.marginTop = slide > 0 ? `${-slide}px` : "";
    };
    const hold = () => {
      if (held) return;
      held = true;
      root.style.width = `${root.offsetWidth}px`;
      root.style.height = `${root.offsetHeight}px`;
      html.classList.add("typing");
    };
    const letGo = () => {
      if (!held) return;
      held = false;
      slide = 0;
      root.style.width = "";
      root.style.height = "";
      root.style.marginTop = "";
      html.classList.remove("typing");
      window.scrollTo(0, 0);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isTextBox(e.target)) return;
      hold();
      // The keyboard comes up after the focus: place again as the view shrinks (see the listeners).
      requestAnimationFrame(place);
    };
    // Focus moving from one box to another is not letting go: wait a moment to see where it lands.
    const onFocusOut = () => {
      setTimeout(() => {
        if (!isTextBox(document.activeElement)) letGo();
      }, 0);
    };
    const onResize = () => requestAnimationFrame(place);

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      letGo();
    };
  }, []);
}
