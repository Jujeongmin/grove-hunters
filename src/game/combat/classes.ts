// What a player fights with. Each class is one of the RPG Character Pack heroes (Quaternius) with
// its own weapon: three fight up close, the ranger and the wizard from afar, and the cleric heals.
export type PlayerClass = "warrior" | "ranger" | "wizard" | "cleric" | "rogue" | "monk";

export const CLASSES: readonly PlayerClass[] = ["warrior", "ranger", "wizard", "cleric", "rogue", "monk"];

// The classes anyone can make; the other four come with the full game. Characters made before
// this rule keep their class.
export const FREE_CLASSES: readonly PlayerClass[] = ["warrior", "ranger"];

export function isFreeClass(c: PlayerClass): boolean {
  return FREE_CLASSES.includes(c);
}

export interface Weapon {
  damage: number;
  intervalMs: number;
  // How far in front a blow or shot lands, and how wide its arc is (radians, total).
  reach: number;
  arc: number;
  // The share of a monster's blow a raised guard stops, facing it.
  block: number;
  // Shots fly to their target instead of landing where the arm swings.
  ranged: boolean;
}

const deg = (d: number) => (d * Math.PI) / 180;

export const WEAPONS: Record<PlayerClass, Weapon> = {
  warrior: { damage: 40, intervalMs: 600, reach: 2.6, arc: deg(110), block: 0.7, ranged: false },
  ranger: { damage: 26, intervalMs: 750, reach: 9, arc: deg(18), block: 0.3, ranged: true },
  wizard: { damage: 32, intervalMs: 950, reach: 9, arc: deg(24), block: 0.3, ranged: true },
  cleric: { damage: 24, intervalMs: 700, reach: 2.8, arc: deg(110), block: 0.5, ranged: false },
  rogue: { damage: 30, intervalMs: 400, reach: 2.2, arc: deg(90), block: 0.4, ranged: false },
  monk: { damage: 28, intervalMs: 480, reach: 2.3, arc: deg(110), block: 0.6, ranged: false },
};


// The pre-RPG classes, kept so an old save still reads as something close.
const OLD: Record<string, PlayerClass> = { striker: "warrior", guardian: "monk" };

export function readClass(value: unknown): PlayerClass | null {
  if (typeof value === "string" && OLD[value]) return OLD[value];
  return CLASSES.find((c) => c === value) ?? null;
}

// Seats nobody chose for (bots, or a player who never picked) take turns, so a room gets a mix.
export function classForSeat(seat: number): PlayerClass {
  const n = CLASSES.length;
  return CLASSES[((seat % n) + n) % n];
}

export function classFor(classes: Record<string, string> | undefined, account: string, seat: number): PlayerClass {
  return readClass(classes?.[account]) ?? classForSeat(seat);
}
