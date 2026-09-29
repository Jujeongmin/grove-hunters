import { useEffect } from "react";

// The size the menus and the HUD are laid out at; the stage scales them to whatever it really is.
export const UI_WIDTH = 800;
// Beyond this the text would read too large on a big monitor; the layout widens instead.
export const UI_MAX_SCALE = 1.2;
// On a big stage the whole overlay is drawn this much smaller than it is laid out, so the HUD takes
// less of the view (a mobile MMO's proportions); the layout keeps its 800-wide measurements. A phone's
// stage is small already: there it is not shrunk (its smallest text would drop to about 8px), and
// between the two it shrinks a little at a time.
export const UI_SHRINK = 0.85;
const SHRINK_FROM = 720;
const SHRINK_FULL = 960;

export function uiScaleFor(width: number): number {
  const along = Math.min(1, Math.max(0, (width - SHRINK_FROM) / (SHRINK_FULL - SHRINK_FROM)));
  return Math.min(UI_MAX_SCALE, width / UI_WIDTH) * (1 - (1 - UI_SHRINK) * along);
}

// Keeps --ui-scale in step with the stage, so a small screen shows the same layout, only smaller.
export function useUiScale(): void {
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    const apply = () => {
      const width = root.clientWidth;
      if (width > 0) document.documentElement.style.setProperty("--ui-scale", String(uiScaleFor(width)));
    };
    apply();
    const observer = new ResizeObserver(() => requestAnimationFrame(apply));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
}

// Where a pointer landed inside an element, in the pixels the UI is laid out in. The whole overlay
// is scaled to the stage, so a bounding rect comes back in screen pixels and reading it straight
// would be out by --ui-scale — a click on the map would walk you somewhere else.
export function pointIn(el: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const box = el.getBoundingClientRect();
  return {
    x: box.width > 0 ? (clientX - box.left) * (el.offsetWidth / box.width) : 0,
    y: box.height > 0 ? (clientY - box.top) * (el.offsetHeight / box.height) : 0,
  };
}
