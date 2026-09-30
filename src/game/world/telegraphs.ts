// Telegraphed attacks: a boss marks the ground where a blow will land, and some time later it lands
// on whoever is still inside. The server keeps them in the room state and decides every hit; the
// screen draws each mark filling up until it lands.

// A player standing this close to a mark's edge is let off (their last reported spot lags a little
// behind where they are).
export const EDGE_GRACE = 0.3;
// A pool left behind hurts whoever stands in it this often.
export const POOL_TICK_MS = 1000;

export type Shape =
  | { kind: "circle"; x: number; z: number; r: number }
  // A doughnut: safe inside `inner`, struck out to `outer`.
  | { kind: "ring"; x: number; z: number; inner: number; outer: number }
  // A fan from (x, z) toward yaw, `arc` wide in all (radians), out to r.
  | { kind: "cone"; x: number; z: number; yaw: number; r: number; arc: number }
  // A lane from (x, z) toward yaw, `length` long and `width` wide.
  | { kind: "line"; x: number; z: number; yaw: number; length: number; width: number };

export interface Telegraph {
  id: string;
  shape: Shape;
  // When it was marked and when it lands (server ms).
  startAt: number;
  hitAt: number;
  // What it takes: a share of the player's own health (fair at any level), or a fixed amount.
  share?: number;
  damage?: number;
  // Once landed, it stays on the ground until `until`, taking tickShare of health a second.
  pool?: { until: number; tickShare: number; nextAt: number };
  // Marks cast together (one pattern): where several overlap, a player is struck by one of them only.
  group?: string;
}

// The way yaw faces, as the rest of the game has it (a yaw of 0 looks toward -z).
export function facingOf(yaw: number): { x: number; z: number } {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

// The yaw that looks from (x, z) toward (tx, tz).
export function yawToward(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(-(tx - x), -(tz - z));
}

// Whether (px, pz) is inside the shape, `grace` in from its edges.
export function inShape(shape: Shape, px: number, pz: number, grace = EDGE_GRACE): boolean {
  const dx = px - shape.x;
  const dz = pz - shape.z;
  const d = Math.hypot(dx, dz);
  switch (shape.kind) {
    case "circle":
      return d <= shape.r - grace;
    case "ring":
      return d >= shape.inner + grace && d <= shape.outer - grace;
    case "cone": {
      if (d > shape.r - grace) return false;
      if (d < 1e-6) return true;
      const f = facingOf(shape.yaw);
      const cos = (dx * f.x + dz * f.z) / d;
      const off = Math.acos(Math.max(-1, Math.min(1, cos)));
      // The grace at the sides is the same distance as at the rim, as an angle at this distance.
      return off <= shape.arc / 2 - grace / Math.max(d, 1);
    }
    case "line": {
      const f = facingOf(shape.yaw);
      const ahead = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      return ahead >= -grace && ahead <= shape.length - grace && side <= shape.width / 2 - grace;
    }
  }
}

export interface Target { account: string; x: number; z: number; maxHp: number }
export interface TelegraphHit { account: string; damage: number }

function damageOf(t: Telegraph, maxHp: number, share = t.share): number {
  if (share !== undefined) return Math.max(1, Math.round(maxHp * share));
  return t.damage ?? 0;
}

// One room tick of the marks: those whose time has come land on whoever is inside; a pool keeps
// hurting until it dries up. Answers the blows, and the marks still on the ground.
export function resolveTelegraphs(
  telegraphs: readonly Telegraph[], targets: readonly Target[], now: number,
): { hits: TelegraphHit[]; left: Telegraph[] } {
  const hits: TelegraphHit[] = [];
  const left: Telegraph[] = [];
  // Who a group's marks have already struck this tick (by group, then account).
  const struck = new Set<string>();
  const once = (t: Telegraph, account: string) => {
    if (!t.group) return true;
    const key = `${t.group}|${account}`;
    if (struck.has(key)) return false;
    struck.add(key);
    return true;
  };
  for (const t of telegraphs) {
    if (now < t.hitAt) {
      left.push(t);
      continue;
    }
    const landing = !t.pool || t.pool.nextAt === t.hitAt;
    if (landing) {
      for (const p of targets) if (inShape(t.shape, p.x, p.z) && once(t, p.account)) hits.push({ account: p.account, damage: damageOf(t, p.maxHp) });
    }
    if (!t.pool) continue;
    let nextAt = landing ? t.hitAt + POOL_TICK_MS : t.pool.nextAt;
    if (!landing && now >= nextAt) {
      for (const p of targets) {
        if (inShape(t.shape, p.x, p.z) && once(t, p.account)) hits.push({ account: p.account, damage: damageOf(t, p.maxHp, t.pool.tickShare) });
      }
      nextAt += POOL_TICK_MS;
    }
    if (now < t.pool.until) left.push({ ...t, pool: { ...t.pool, nextAt } });
  }
  return { hits, left };
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function readShape(raw: unknown): Shape | null {
  const s = raw as Record<string, unknown> | null;
  if (!s || !num(s.x) || !num(s.z)) return null;
  if (s.kind === "circle" && num(s.r)) return { kind: "circle", x: s.x, z: s.z, r: s.r };
  if (s.kind === "ring" && num(s.inner) && num(s.outer)) return { kind: "ring", x: s.x, z: s.z, inner: s.inner, outer: s.outer };
  if (s.kind === "cone" && num(s.yaw) && num(s.r) && num(s.arc)) return { kind: "cone", x: s.x, z: s.z, yaw: s.yaw, r: s.r, arc: s.arc };
  if (s.kind === "line" && num(s.yaw) && num(s.length) && num(s.width)) {
    return { kind: "line", x: s.x, z: s.z, yaw: s.yaw, length: s.length, width: s.width };
  }
  return null;
}

// The marks as the room state carries them; anything that does not read back whole is dropped.
export function readTelegraphs(raw: unknown): Telegraph[] {
  if (!Array.isArray(raw)) return [];
  const out: Telegraph[] = [];
  for (const entry of raw) {
    const t = entry as Record<string, unknown> | null;
    const shape = readShape(t?.shape);
    if (!t || !shape || typeof t.id !== "string" || !num(t.startAt) || !num(t.hitAt)) continue;
    const p = t.pool as Record<string, unknown> | undefined;
    out.push({
      id: t.id, shape, startAt: t.startAt, hitAt: t.hitAt, ...(typeof t.group === "string" ? { group: t.group } : {}),
      ...(num(t.share) ? { share: t.share } : {}), ...(num(t.damage) ? { damage: t.damage } : {}),
      ...(p && num(p.until) && num(p.tickShare) && num(p.nextAt) ? { pool: { until: p.until, tickShare: p.tickShare, nextAt: p.nextAt } } : {}),
    });
  }
  return out;
}
