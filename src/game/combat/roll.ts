// The dodge roll (구르기), which took the guard's place: a quick tumble the way you are walking (or
// facing, standing still), during which no blow and no marked attack lands. The client moves you; the
// server times the safe window from when it hears of the roll, so it is a little longer than the
// tumble itself to cover the way there.
export const ROLL = {
  // How long the tumble takes (seconds) and how far it carries you (metres).
  // Twice walking pace: the way action MMOs roll, a burst along the way you are going.
  seconds: 0.5,
  distance: 4,
  // How soon the next may come.
  cooldownMs: 3_000,
  // How long the server lets nothing land, from when it hears of it.
  safeMs: 650,
};

export const ROLL_SPEED = ROLL.distance / ROLL.seconds;

// Whether a roll the server heard of at `rolledAt` still keeps blows off at `now`.
export function dodging(rolledAt: number | undefined, now: number): boolean {
  return typeof rolledAt === "number" && now >= rolledAt && now - rolledAt < ROLL.safeMs;
}

// Whether a roll may start at `now` after one at `rolledAt` (the server gives a fifth of the wait
// back for the way there).
export function rollReady(rolledAt: number | undefined, now: number): boolean {
  return typeof rolledAt !== "number" || now - rolledAt >= ROLL.cooldownMs * 0.8;
}
