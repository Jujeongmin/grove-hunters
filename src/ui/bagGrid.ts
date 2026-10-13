import { ITEM_IDS, MAX_STACK, type BagView, type GearPiece, type ItemId } from "../game/account/items";

// One square of the bag's grid: a stack of potions or materials (materials that may be traded
// stand apart from those that may not), or one piece of gear. A stack holds MAX_STACK to a square:
// more of a kind goes on in the next square (part counts them from 0).
export type Cell =
  | { kind: "stack"; id: ItemId; trade: boolean; n: number; part: number }
  | { kind: "piece"; id: ItemId; trade: boolean; piece: GearPiece };

// The squares one stack of `total` fills: full ones first, then the rest.
function stackSquares(id: ItemId, trade: boolean, total: number): Cell[] {
  const out: Cell[] = [];
  for (let part = 0; part * MAX_STACK < total; part++) {
    out.push({ kind: "stack", id, trade, n: Math.min(MAX_STACK, total - part * MAX_STACK), part });
  }
  return out;
}

// The grid in the item table's order, each kind's pieces together.
export function bagCells(bag: Pick<BagView, "bag" | "bagTrade" | "pieces">): Cell[] {
  const out: Cell[] = [];
  for (const id of ITEM_IDS) {
    out.push(...stackSquares(id, false, bag.bag[id] ?? 0), ...stackSquares(id, true, bag.bagTrade[id] ?? 0));
    for (const piece of bag.pieces) if (piece.id === id) out.push({ kind: "piece", id, trade: piece.trade, piece });
  }
  return out;
}

export function cellKey(cell: Cell): string {
  return cell.kind === "piece" ? cell.piece.uid : `${cell.id}:${cell.trade}:${cell.part}`;
}

// How many a stack's square holds now (0 once the stack has shrunk below it).
export function squareCount(total: number, part: number): number {
  return Math.max(0, Math.min(MAX_STACK, total - part * MAX_STACK));
}

// The squares picked for throwing away, as the server takes them: pieces by uid, and each stack's
// squares added up into one count.
export function bulkOf(cells: readonly Cell[], keys: ReadonlySet<string>): {
  pieces: string[]; stacks: { id: ItemId; n: number; trade: boolean }[];
} {
  const pieces: string[] = [];
  const stacks: { id: ItemId; n: number; trade: boolean }[] = [];
  for (const cell of cells) {
    if (!keys.has(cellKey(cell))) continue;
    if (cell.kind === "piece") {
      pieces.push(cell.piece.uid);
      continue;
    }
    const same = stacks.find((s) => s.id === cell.id && s.trade === cell.trade);
    if (same) same.n += cell.n;
    else stacks.push({ id: cell.id, n: cell.n, trade: cell.trade });
  }
  return { pieces, stacks };
}
