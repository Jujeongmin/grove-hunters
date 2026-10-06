// Rounded, friendly type for a chibi fantasy game: Jua for titles and buttons, Gowun Dodum for
// reading, Black Han Sans for the logo.
import "@fontsource/jua";
import "@fontsource/gowun-dodum";
import "@fontsource/black-han-sans";
import { publicUrl } from "../game/assets/publicUrl";

// UI art cut from the store pack by scripts/extract-ui.mjs. Paths go through publicUrl because
// the game is served from a sub-path, which plain CSS urls cannot know about.
const PIECES = ["grunge_band", "grunge_frame"] as const;

export function installUiTheme(): void {
  const style = document.documentElement.style;
  for (const piece of PIECES) {
    // Absolute, not base-relative: a url() carried in a custom property resolves against the
    // stylesheet that uses it, and the built stylesheet sits in assets/, so "./assets/ui/..." became
    // assets/assets/ui/... and every brush mask vanished on the deployed build (not in dev, where the
    // styles are inlined into the page).
    const href = new URL(publicUrl(`assets/ui/${piece}.webp`), document.baseURI).href;
    style.setProperty(`--ui-${piece.replace(/_/g, "-")}`, `url("${href}")`);
  }
  // The mouse pointer: a gilded arrowhead, brighter over anything that can be pressed (see
  // index.css; only where there is a mouse). Its tip is its top-left pixel.
  for (const cursor of CURSORS) {
    const href = new URL(publicUrl(`cursor/${cursor}.png`), document.baseURI).href;
    style.setProperty(`--cursor-${cursor}`, `url("${href}") 1 1`);
  }
}

const CURSORS = ["pointer", "press"] as const;
