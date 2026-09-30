import { ANNOUNCE_KEEP, readAnnouncement, type AnnounceKind, type Announcement } from "../../src/game/world/announce";

// The announcements to every server (see announce.ts): one row each, the newest ANNOUNCE_KEEP kept.
export const ANNOUNCE_COLLECTION = "announcements";

async function rows(): Promise<Record<string, unknown>[]> {
  return (await $global.getCollectionItems(ANNOUNCE_COLLECTION, { limit: ANNOUNCE_KEEP * 3 })) as Record<string, unknown>[];
}

// Tells everyone. Never fails the thing it tells of: a lost announcement is only a missed line.
export async function announce(kind: AnnounceKind, params: Record<string, string | number>, now: number): Promise<void> {
  try {
    await $global.addCollectionItem(ANNOUNCE_COLLECTION, { kind, params, at: now });
    const all = await rows();
    if (all.length <= ANNOUNCE_KEEP) return;
    const oldest = [...all].sort((a, b) => Number(a.at) - Number(b.at)).slice(0, all.length - ANNOUNCE_KEEP);
    for (const row of oldest) await $global.deleteCollectionItem(ANNOUNCE_COLLECTION, row.__id as string).catch(() => undefined);
  } catch {
    // As above.
  }
}

// Those after `since` (ms), oldest first.
export async function announcementsSince(since: number): Promise<Announcement[]> {
  return (await rows())
    .map((row) => readAnnouncement(row))
    .filter((a): a is Announcement => a !== null && a.at > since)
    .sort((a, b) => a.at - b.at);
}
