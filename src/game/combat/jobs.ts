import type { PlayerClass } from "./classes";

// Advancement (전직): from ADVANCE_LEVEL a character picks one of two paths of its class, for good.
// The path is where the second to fourth skills come from (see JOB_SKILLS in skills.ts), and it adds
// to every fight what gear would (attack, health, defence); a cleric's healer
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
  atk: number;
  hp: number;
  def: number;
  // Heals give back this much more.
  heal: number;
}

const none = { atk: 0, hp: 0, def: 0, heal: 0 };

export const JOBS: Record<JobId, Job> = {
  berserker: { ...none, playerClass: "warrior", atk: 30 },
  guardian: { ...none, playerClass: "warrior", hp: 80, def: 12 },
  sniper: { ...none, playerClass: "ranger", atk: 30 },
  tracker: { ...none, playerClass: "ranger", atk: 15, hp: 40 },
  elementalist: { ...none, playerClass: "wizard", atk: 38 },
  warder: { ...none, playerClass: "wizard", hp: 60, def: 12 },
  high_priest: { ...none, playerClass: "cleric", hp: 40, heal: 0.5 },
  paladin: { ...none, playerClass: "cleric", atk: 22, hp: 60 },
  assassin: { ...none, playerClass: "rogue", atk: 38 },
  scout: { ...none, playerClass: "rogue", atk: 15, hp: 40 },
  fist_master: { ...none, playerClass: "monk", atk: 30 },
  iron_monk: { ...none, playerClass: "monk", hp: 80, def: 12 },
};

export function readJob(value: unknown): JobId | null {
  return typeof value === "string" && value in JOBS ? (value as JobId) : null;
}

// The two paths a class can take.
export function jobsOf(playerClass: PlayerClass): JobId[] {
  return (Object.keys(JOBS) as JobId[]).filter((id) => JOBS[id].playerClass === playerClass);
}
