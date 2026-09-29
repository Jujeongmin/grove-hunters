import { MONSTERS, type MonsterState } from "./monsters";

// A monster counts as hitting you when it swings this close to you (its reach, and a little for your
// position running ahead of the server's), and for this long after its last swing.
const REACH_SLACK = 1;
const MEMORY_MS = 3000;

// Which monsters are hitting you, as the screen sees it: every swing pushes a monster's
// attackReadyAt forward (see monsterAi.ts), and one that swung within reach of you swung at you.
// Auto-battle turns on them, whatever the quest asks for.
export class Threats {
  private readonly ready = new Map<string, number>();
  private readonly swungAt = new Map<string, number>();

  // Every frame, with the room's monsters and where you stand.
  watch(monsters: Record<string, MonsterState>, me: { x: number; z: number }, now: number): void {
    for (const [id, m] of Object.entries(monsters)) {
      const before = this.ready.get(id);
      this.ready.set(id, m.attackReadyAt);
      const near = Math.hypot(m.x - me.x, m.z - me.z) <= MONSTERS[m.type].range + REACH_SLACK;
      if (before !== undefined && m.attackReadyAt > before && m.alive && near) this.swungAt.set(id, now);
    }
    for (const [id, at] of this.swungAt) {
      if (now - at > MEMORY_MS || !monsters[id]?.alive) this.swungAt.delete(id);
    }
  }

  has(id: string): boolean {
    return this.swungAt.has(id);
  }

  // The nearest monster hitting you, or null.
  nearest(monsters: Record<string, MonsterState>, me: { x: number; z: number }): string | null {
    let best: { id: string; d: number } | null = null;
    for (const id of this.swungAt.keys()) {
      const m = monsters[id];
      if (!m?.alive) continue;
      const d = Math.hypot(m.x - me.x, m.z - me.z);
      if (!best || d < best.d) best = { id, d };
    }
    return best?.id ?? null;
  }
}
