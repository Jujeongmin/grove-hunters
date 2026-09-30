import type { PlayerClass } from "./classes";

// Advancement (전직): from ADVANCE_LEVEL a character picks one of two paths of its class, for good.
// The path is where the second to fourth skills come from (see JOB_SKILLS in skills.ts), and it adds
// to every fight what gear would (damage, health, a share of each blow stopped); a cleric's healer
// path heals more. Its name shows before the character's name; the name itself and the line
// describing what it gives are built in the UI from these numbers (see ui/names.ts).

export const ADVANCE_LEVEL = 10;

export type JobId =
  | "berserker" | "guardian"
  | "sniper" | "tracker"
  | "elementalist" | "warder"
  | "high_priest" | "paladin"
  | "assassin" | "scout"
  | "fist_master" | "iron_monk";

export interface Job {
  playerClass: PlayerClass;
  power: number;
  hp: number;
  guard: number;
  // Heals give back this much more.
  heal: number;
}

const none = { power: 0, hp: 0, guard: 0, heal: 0 };

export const JOBS: Record<JobId, Job> = {
  berserker: { ...none, playerClass: "warrior", power: 0.2 },
  guardian: { ...none, playerClass: "warrior", hp: 80, guard: 0.1 },
  sniper: { ...none, playerClass: "ranger", power: 0.2 },
  tracker: { ...none, playerClass: "ranger", power: 0.1, hp: 40 },
  elementalist: { ...none, playerClass: "wizard", power: 0.25 },
  warder: { ...none, playerClass: "wizard", hp: 60, guard: 0.1 },
  high_priest: { ...none, playerClass: "cleric", hp: 40, heal: 0.5 },
  paladin: { ...none, playerClass: "cleric", power: 0.15, hp: 60 },
  assassin: { ...none, playerClass: "rogue", power: 0.25 },
  scout: { ...none, playerClass: "rogue", power: 0.1, hp: 40 },
  fist_master: { ...none, playerClass: "monk", power: 0.2 },
  iron_monk: { ...none, playerClass: "monk", hp: 80, guard: 0.1 },
};

export function readJob(value: unknown): JobId | null {
  return typeof value === "string" && value in JOBS ? (value as JobId) : null;
}

// The two paths a class can take.
export function jobsOf(playerClass: PlayerClass): JobId[] {
  return (Object.keys(JOBS) as JobId[]).filter((id) => JOBS[id].playerClass === playerClass);
}
