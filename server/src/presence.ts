import { readWorld } from "../../src/game/account/worlds";

// Who is about on each server, for the server picker's crowd marks. Counting rooms would take a call
// per server, channel and zone; instead each account leaves one row, refreshed at most every
// PRESENCE_MS by the friends' heartbeat, and the picker counts the fresh ones in one query.
export const PRESENCE_COLLECTION = "presence";
export const PRESENCE_MS = 120_000;
// A row fresher than this counts as someone about.
export const PRESENCE_FRESH_MS = 2 * PRESENCE_MS + 60_000;
const PRESENCE_READ = 1000;

export async function notePresence(account: string, now: number): Promise<void> {
  const state = await $global.getUserState(account);
  const at = typeof state.presenceAt === "number" ? state.presenceAt : 0;
  const world = readWorld(state.world)?.id;
  if (!world || (now - at < PRESENCE_MS && state.presenceWorld === world)) return;
  const row = { account, world, at: now };
  let id = typeof state.presenceRow === "string" ? state.presenceRow : null;
  if (id) {
    try {
      await $global.updateCollectionItem(PRESENCE_COLLECTION, { __id: id, ...row });
    } catch {
      id = null;
    }
  }
  if (!id) id = ((await $global.addCollectionItem(PRESENCE_COLLECTION, row)) as { __id: string }).__id;
  await $global.updateUserState(account, { presenceAt: now, presenceWorld: world, presenceRow: id });
}

// How many are about on each server, by its id.
export async function worldLoads(now: number): Promise<Record<string, number>> {
  const rows = await $global.getCollectionItems(PRESENCE_COLLECTION, {
    filters: [{ field: "at", operator: ">=", value: now - PRESENCE_FRESH_MS }], limit: PRESENCE_READ,
  });
  const out: Record<string, number> = {};
  for (const r of rows as { world?: unknown }[]) if (typeof r.world === "string") out[r.world] = (out[r.world] ?? 0) + 1;
  return out;
}
