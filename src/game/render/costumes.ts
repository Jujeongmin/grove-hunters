// What a hero looks like beyond its class (the class picks the model, see heroes.ts): whether it
// wears its accessories, and the colours of its clothes, skin and weapon. The server stores and the
// match carries the costume as its id: one digit per part, in PART_KEYS order (e.g. "0000").

// How a colour part repaints (see dyes.ts): "skin" repaints only the skin; "hue" turns every
// colour but the skin round the colour wheel.
export type Dye =
  | { kind: "skin"; rgb: readonly [number, number, number] }
  | { kind: "hue"; degrees: number; saturation: number };

export interface PartOption {
  // A colour part's repaint; left out for the pack's own colours.
  dye?: Dye;
  // For the gear part: whether the accessories are worn.
  gear?: boolean;
}

export interface Part {
  options: readonly PartOption[];
}

const skin = (r: number, g: number, b: number): PartOption => ({ dye: { kind: "skin", rgb: [r, g, b] } });
const hue = (degrees: number, saturation = 1): PartOption => ({ dye: { kind: "hue", degrees, saturation } });
const HUES: readonly PartOption[] = [
  {}, hue(60), hue(120), hue(180), hue(240), hue(300),
  hue(0, 0),
];

export const PARTS = {
  gear: { options: [{ gear: true }, { gear: false }] },
  clothColor: { options: HUES },
  skin: {
    options: [{}, skin(250, 222, 196), skin(196, 132, 86), skin(124, 82, 56)],
  },
  weaponColor: { options: HUES },
} as const satisfies Record<string, Part>;

export type PartKey = keyof typeof PARTS;
export const PART_KEYS = Object.keys(PARTS) as PartKey[];
export type CostumeParts = Record<PartKey, number>;

export interface Costume {
  id: string;
  parts: CostumeParts;
}

export function encodeCostume(parts: CostumeParts): string {
  return PART_KEYS.map((k) => String(parts[k])).join("");
}

function make(parts: CostumeParts): Costume {
  return { id: encodeCostume(parts), parts };
}

// Ready-made looks.
export const COSTUMES: readonly Costume[] = [
  make({ gear: 0, clothColor: 0, skin: 0, weaponColor: 0 }),
  make({ gear: 1, clothColor: 4, skin: 1, weaponColor: 3 }),
  make({ gear: 0, clothColor: 6, skin: 2, weaponColor: 6 }),
];

// Reads a costume id: one digit per part, each within its part's options. Anything else (including
// the ids saved before the RPG heroes) is null.
export function costumeById(id: unknown): Costume | null {
  if (typeof id !== "string" || id.length !== PART_KEYS.length || !/^\d+$/.test(id)) return null;
  const parts = {} as CostumeParts;
  for (let i = 0; i < PART_KEYS.length; i++) {
    const key = PART_KEYS[i];
    const n = Number(id[i]);
    if (n >= PARTS[key].options.length) return null;
    parts[key] = n;
  }
  return COSTUMES.find((c) => c.id === id) ?? make(parts);
}

// The same costume with one part stepped to its next (or previous) option.
export function withPart(costume: Costume, key: PartKey, step: number): Costume {
  const n = PARTS[key].options.length;
  const parts = { ...costume.parts, [key]: (((costume.parts[key] + step) % n) + n) % n };
  return costumeById(encodeCostume(parts))!;
}

// A random costume, for the menu's dice button.
export function randomCostume(random: () => number = Math.random): Costume {
  const parts = {} as CostumeParts;
  for (const key of PART_KEYS) parts[key] = Math.floor(random() * PARTS[key].options.length);
  return costumeById(encodeCostume(parts))!;
}

// The option a costume picked for one part.
export function optionOf(costume: Costume, key: PartKey): PartOption {
  return (PARTS[key].options as readonly PartOption[])[costume.parts[key]];
}

// Seats get different clothes so players (and bots) of one class can tell each other apart.
export function costumeForSeat(seat: number): Costume {
  const n = PARTS.clothColor.options.length;
  return costumeById(encodeCostume({ gear: 0, clothColor: ((seat % n) + n) % n, skin: 0, weaponColor: 0 }))!;
}

// What a player wears in a match: the costume they picked in the menu, and the seat's own look
// for bots and for anyone whose choice the match never heard of.
export function wearing(
  looks: Record<string, string> | undefined, account: string, seat: number,
): Costume {
  return costumeById(looks?.[account]) ?? costumeForSeat(seat);
}
