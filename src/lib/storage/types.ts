export type Skill = "reading" | "listening" | "writing" | "speaking";

export interface Attempt {
  id: string;
  skill: Skill;
  testId: string;
  title: string;
  band: number;
  raw?: number;
  total?: number;
  estimated?: boolean;
  createdAt: number;
}

export interface SkillStats {
  skill: Skill;
  latest: number | null;
  best: number | null;
  attempts: number;
  history: { createdAt: number; band: number }[];
  distanceToSeven: number | null;
  metTarget: boolean;
}

export interface DashboardStats {
  perSkill: Record<Skill, SkillStats>;
  overall: number | null;
  overallDistanceToSeven: number | null;
  totalAttempts: number;
}
