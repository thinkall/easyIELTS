import type { Attempt, Skill, SkillStats, DashboardStats } from "./types";
import { overallBand } from "@/lib/ielts/aggregate";

const SKILLS: Skill[] = ["reading", "listening", "writing", "speaking"];

function skillStats(skill: Skill, attempts: Attempt[]): SkillStats {
  const mine = attempts.filter((a) => a.skill === skill).sort((a, b) => a.createdAt - b.createdAt);
  if (mine.length === 0) {
    return { skill, latest: null, best: null, attempts: 0, history: [], distanceToSeven: null, metTarget: false };
  }
  const latest = mine[mine.length - 1].band;
  const best = Math.max(...mine.map((a) => a.band));
  return {
    skill,
    latest,
    best,
    attempts: mine.length,
    history: mine.map((a) => ({ createdAt: a.createdAt, band: a.band })),
    distanceToSeven: Math.max(0, Number((7 - latest).toFixed(1))),
    metTarget: latest >= 7,
  };
}

export function computeStats(attempts: Attempt[]): DashboardStats {
  const perSkill = Object.fromEntries(SKILLS.map((s) => [s, skillStats(s, attempts)])) as Record<Skill, SkillStats>;
  const haveAll = SKILLS.every((s) => perSkill[s].latest !== null);
  const overall = haveAll
    ? overallBand({
        listening: perSkill.listening.latest!,
        reading: perSkill.reading.latest!,
        writing: perSkill.writing.latest!,
        speaking: perSkill.speaking.latest!,
      })
    : null;
  return {
    perSkill,
    overall,
    overallDistanceToSeven: overall === null ? null : Math.max(0, Number((7 - overall).toFixed(1))),
    totalAttempts: attempts.length,
  };
}
