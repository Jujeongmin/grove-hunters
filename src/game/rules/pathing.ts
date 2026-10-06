import { solidAt, type LevelLayout, type Point2 } from "./levelLayout";
import { platformBlocks } from "./platforms";

// What stands in a walker's way on the floor: the forest, and the log piles, crates and boulders
// (every platform is taller than a step; a walker on the floor goes round them).
function blockedAt(layout: LevelLayout, x: number, z: number): boolean {
  return solidAt(layout, x, z) || platformBlocks(layout.platforms, x, z, 0);
}

// Whether a body of `radius` can walk the straight line between two spots without touching the
// forest or a platform (sampled every quarter metre, at its middle and its edge on either side).
export function lineClear(layout: LevelLayout, from: Point2, to: Point2, radius = 0.4): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return true;
  const sx = (-dz / length) * radius;
  const sz = (dx / length) * radius;
  for (let d = 0; d <= length + 0.25; d += 0.25) {
    const at = Math.min(d, length);
    const x = from.x + (dx * at) / length;
    const z = from.z + (dz * at) / length;
    if (blockedAt(layout, x, z) || blockedAt(layout, x + sx, z + sz) || blockedAt(layout, x - sx, z - sz)) return false;
  }
  return true;
}

// The walking grid auto-battle routes over: half-metre squares, each closed when a body of the
// walker's radius standing at its centre would touch the forest or a platform. Made once per layout
// and radius (the platforms never move).
const NAV_STEP = 0.5;
interface NavGrid { cols: number; rows: number; closed: Uint8Array }
const navGrids = new WeakMap<LevelLayout, Map<number, NavGrid>>();

function navGrid(layout: LevelLayout, radius: number): NavGrid {
  let byRadius = navGrids.get(layout);
  if (!byRadius) navGrids.set(layout, (byRadius = new Map()));
  const known = byRadius.get(radius);
  if (known) return known;
  const cols = Math.ceil((layout.cols * layout.tileSize) / NAV_STEP);
  const rows = Math.ceil((layout.rows * layout.tileSize) / NAV_STEP);
  const closed = new Uint8Array(cols * rows);
  // The forest: the centre and the body's edge all round (eight points) must be clear of it.
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * NAV_STEP;
      const z = (j + 0.5) * NAV_STEP;
      let shut = solidAt(layout, x, z);
      for (let k = 0; k < 8 && !shut; k++) {
        const a = (k * Math.PI) / 4;
        shut = solidAt(layout, x + Math.cos(a) * radius, z + Math.sin(a) * radius);
      }
      if (shut) closed[j * cols + i] = 1;
    }
  }
  // Each platform closes the squares whose centre lies within its box grown by the radius.
  for (const p of layout.platforms) {
    const hw = p.w / 2 + radius;
    const hd = p.d / 2 + radius;
    const i0 = Math.max(0, Math.floor((p.x - hw) / NAV_STEP));
    const i1 = Math.min(cols - 1, Math.floor((p.x + hw) / NAV_STEP));
    const j0 = Math.max(0, Math.floor((p.z - hd) / NAV_STEP));
    const j1 = Math.min(rows - 1, Math.floor((p.z + hd) / NAV_STEP));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (Math.abs((i + 0.5) * NAV_STEP - p.x) < hw && Math.abs((j + 0.5) * NAV_STEP - p.z) < hd) closed[j * cols + i] = 1;
      }
    }
  }
  const grid = { cols, rows, closed };
  byRadius.set(radius, grid);
  return grid;
}

// The open square nearest a spot (within four metres), for a walker pressed against something or a
// monster standing by a log pile; null when there is none.
function openNear(grid: NavGrid, x: number, z: number): number | null {
  const ci = Math.floor(x / NAV_STEP);
  const cj = Math.floor(z / NAV_STEP);
  for (let ring = 0; ring <= 8; ring++) {
    let best: number | null = null;
    let bestD = Infinity;
    for (let j = cj - ring; j <= cj + ring; j++) {
      for (let i = ci - ring; i <= ci + ring; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== ring) continue;
        if (i < 0 || j < 0 || i >= grid.cols || j >= grid.rows || grid.closed[j * grid.cols + i]) continue;
        const d = Math.hypot((i + 0.5) * NAV_STEP - x, (j + 0.5) * NAV_STEP - z);
        if (d < bestD) {
          bestD = d;
          best = j * grid.cols + i;
        }
      }
    }
    if (best !== null) return best;
  }
  return null;
}

// A walkable way for a body of `radius` from one spot to another, round the forest and every log
// pile, crate and boulder: the shortest chain of open half-metre squares (eight ways, never cutting a
// closed corner), pulled taut so only the turns are left. Ends at `to`. Null when there is no way.
export function walkRoute(layout: LevelLayout, from: Point2, to: Point2, radius = 0.45): Point2[] | null {
  const grid = navGrid(layout, radius);
  const start = openNear(grid, from.x, from.z);
  const goal = openNear(grid, to.x, to.z);
  if (start === null || goal === null) return null;
  const { cols, rows, closed } = grid;
  const size = closed.length;
  const cost = new Float32Array(size).fill(Infinity);
  const came = new Int32Array(size).fill(-1);
  const done = new Uint8Array(size);
  const gi = goal % cols;
  const gj = Math.floor(goal / cols);
  const guess = (k: number) => {
    const di = Math.abs((k % cols) - gi);
    const dj = Math.abs(Math.floor(k / cols) - gj);
    return Math.max(di, dj) + (Math.SQRT2 - 1) * Math.min(di, dj);
  };
  // A binary heap of [estimate, square].
  const heap: [number, number][] = [];
  const push = (f: number, k: number) => {
    heap.push([f, k]);
    for (let n = heap.length - 1; n > 0; ) {
      const up = (n - 1) >> 1;
      if (heap[up][0] <= heap[n][0]) break;
      [heap[up], heap[n]] = [heap[n], heap[up]];
      n = up;
    }
  };
  const pop = (): number => {
    const top = heap[0][1];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let n = 0; ; ) {
        const l = 2 * n + 1;
        const r = l + 1;
        let m = n;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === n) break;
        [heap[m], heap[n]] = [heap[n], heap[m]];
        n = m;
      }
    }
    return top;
  };
  cost[start] = 0;
  push(guess(start), start);
  let found = false;
  while (heap.length > 0) {
    const k = pop();
    if (done[k]) continue;
    done[k] = 1;
    if (k === goal) {
      found = true;
      break;
    }
    const i = k % cols;
    const j = Math.floor(k / cols);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0) continue;
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const nk = nj * cols + ni;
        if (closed[nk] || done[nk]) continue;
        // Diagonally only when both squares beside the step are open.
        if (di !== 0 && dj !== 0 && (closed[j * cols + ni] || closed[nj * cols + i])) continue;
        const next = cost[k] + (di !== 0 && dj !== 0 ? Math.SQRT2 : 1);
        if (next < cost[nk]) {
          cost[nk] = next;
          came[nk] = k;
          push(next + guess(nk), nk);
        }
      }
    }
  }
  if (!found) return null;
  const squares: Point2[] = [];
  for (let k = goal; k !== -1; k = came[k]) squares.push({ x: ((k % cols) + 0.5) * NAV_STEP, z: (Math.floor(k / cols) + 0.5) * NAV_STEP });
  squares.reverse();
  squares.push({ x: to.x, z: to.z });
  // Pulled taut: from where it stands, on to the farthest point in a clear straight line, and so on.
  const out: Point2[] = [];
  let at: Point2 = from;
  let n = -1;
  while (n < squares.length - 1) {
    let far = n + 1;
    for (let m = squares.length - 1; m > n + 1; m--) {
      if (lineClear(layout, at, squares[m], radius)) {
        far = m;
        break;
      }
    }
    out.push(squares[far]);
    at = squares[far];
    n = far;
  }
  return out;
}

// A walkable route across a zone's grid, for auto-battle heading to a monster it cannot see yet:
// the shortest chain of open cells from one spot to another, as the centres of the cells where the
// route turns (the straight runs between are walked as they are).
export function gridRoute(layout: LevelLayout, from: Point2, to: Point2): Point2[] | null {
  const t = layout.tileSize;
  const cell = (p: Point2) => [Math.floor(p.x / t), Math.floor(p.z / t)] as const;
  const [sc, sr] = cell(from);
  const [ec, er] = cell(to);
  const open = (c: number, r: number) => c >= 0 && r >= 0 && c < layout.cols && r < layout.rows && !layout.solid[r][c];
  if (!open(sc, sr) || !open(ec, er)) return null;
  const key = (c: number, r: number) => r * layout.cols + c;
  const came = new Map<number, number>([[key(sc, sr), -1]]);
  const queue: [number, number][] = [[sc, sr]];
  let found = false;
  while (queue.length > 0 && !found) {
    const [c, r] = queue.shift()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (!open(nc, nr) || came.has(key(nc, nr))) continue;
      came.set(key(nc, nr), key(c, r));
      if (nc === ec && nr === er) {
        found = true;
        break;
      }
      queue.push([nc, nr]);
    }
  }
  if (!found) return null;
  const cells: [number, number][] = [];
  for (let k: number = key(ec, er); k !== -1; k = came.get(k)!) cells.push([k % layout.cols, Math.floor(k / layout.cols)]);
  cells.reverse();
  // Keep only the corners.
  const out: Point2[] = [];
  for (let i = 1; i < cells.length; i++) {
    const [pc, pr] = cells[i - 1];
    const [c, r] = cells[i];
    const [nc, nr] = cells[i + 1] ?? [c + (c - pc), r + (r - pr)];
    if (nc - c !== c - pc || nr - r !== r - pr) out.push({ x: (c + 0.5) * t, z: (r + 0.5) * t });
  }
  out.push({ x: to.x, z: to.z });
  return out;
}
