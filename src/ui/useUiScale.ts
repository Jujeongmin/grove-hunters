import { useEffect } from "react";

// The size the menus and the HUD are laid out at; the stage scales them to whatever it really is.
export const UI_WIDTH = 800;
// Beyond this the text would read too large on a big monitor; the layout widens instead.
export const UI_MAX_SCALE = 1.2;
// The whole overlay is drawn this much smaller than it is laid out, so the HUD takes less of the
// view (a mobile MMO's proportions); the layout keeps its 800-wide measurements.
export const UI_SHRINK = 0.85;

// Keeps --ui-scale in step with the stage, so a small screen shows the same layout, only smaller.
export function useUiScale(): void {
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    const apply = () => {
      const width = root.clientWidth;
      if (width > 0) document.documentElement.style.setProperty("--ui-scale", String(Math.min(UI_MAX_SCALE, width / UI_WIDTH) * UI_SHRINK));
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
