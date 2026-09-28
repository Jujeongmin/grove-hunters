// The game servers you pick from when you start. Each is its own world: matchmaking only seats
// players who picked the same one.
// A server is the game's name and a number; the name itself is a word like any other (world.name).
export const WORLDS = [1, 2, 3, 4].map((n) => ({ id: `w${n}`, number: n }));

export type World = (typeof WORLDS)[number];

// Accounts that never picked one (older saves, the test seats) play on the first.
export const DEFAULT_WORLD = WORLDS[0];

export function readWorld(id: unknown): World | null {
  return WORLDS.find((w) => w.id === id) ?? null;
}
