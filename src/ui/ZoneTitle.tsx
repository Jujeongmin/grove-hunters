import { useEffect, useState } from "react";
import { t } from "./lang";
import { zoneName } from "./names";
import { ZONES, type ZoneEntry } from "../game/world/zones";

// How long the zone's name stays up on coming in (its fade in and out included; see .zone-title).
export const ZONE_TITLE_MS = 3200;

// Coming into a zone (a portal, a channel, the world itself), its name across the top, with the
// channel and the level it asks for, fading in and out again.
export function ZoneTitle({ entry }: { entry: ZoneEntry }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShown(false), ZONE_TITLE_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!shown) return null;
  const minLevel = ZONES[entry.zone].minLevel;
  return (
    <div className="zone-title" aria-live="polite">
      <b className="band">{zoneName(entry.zone)}</b>
      <span>
        {t("world.channel", { n: entry.channel })}
        {minLevel > 1 && <> · {t("zoneTitle.level", { n: minLevel })}</>}
      </span>
    </div>
  );
}
