import { useEffect, useState, memo } from "react";
import { ANNOUNCE_POLL_MS, ANNOUNCE_SHOW_MS, type Announcement } from "../game/world/announce";
import type { WorldClient } from "../net/worldClient";
import { announceText } from "./announceText";
import { settings } from "./settings";

// The announcements to every server, one at a time in a gold band at the top of the screen for a few
// seconds each (they also go into the chat). New ones are asked for every ANNOUNCE_POLL_MS.
function AnnounceBannerView({ client }: { client: WorldClient }) {
  const [queue, setQueue] = useState<Announcement[]>([]);
  useEffect(() => {
    let live = true;
    const poll = () => void client.pollAnnouncements().then((fresh) => {
      if (live && fresh.length > 0 && settings().showAnnouncements) setQueue((q) => [...q, ...fresh]);
    });
    poll();
    const timer = setInterval(poll, ANNOUNCE_POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [client]);
  const showing = queue[0] ?? null;
  useEffect(() => {
    if (!showing) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), ANNOUNCE_SHOW_MS);
    return () => clearTimeout(timer);
  }, [showing]);
  if (!showing) return null;
  return (
    <div key={showing.id} className={`announce announce-${showing.kind}`} role="status">
      <span className="announce-mark">📢</span>
      <span>{announceText(showing)}</span>
    </div>
  );
}

// Its props never change while the world is up, so the HUD's updates pass it by.
export const AnnounceBanner = memo(AnnounceBannerView);
