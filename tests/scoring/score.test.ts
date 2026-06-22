import { describe, it, expect } from "vitest";
import { scoreObjective } from "@/lib/scoring/score";
import type { Question } from "@/lib/scoring/types";

const questions: Question[] = [
  { id: "q1", type: "single_choice", accepted: ["B"] },
  { id: "q2", type: "true_false_notgiven", accepted: ["false"] },
  { id: "q3", type: "sentence_completion", accepted: ["library", "the library"], wordLimit: 2 },
  { id: "q4", type: "short_answer", accepted: ["14"], wordLimit: 1 },
];

describe("scoreObjective", () => {
  it("marks correct, case-insensitive, and accepted-variant answers", () => {
    const score = scoreObjective(questions, { q1: "b", q2: "False", q3: "The Library", q4: "14" });
    expect(score.raw).toBe(4);
    expect(score.total).toBe(4);
    expect(score.results.every((r) => r.correct)).toBe(true);
  });

  it("marks wrong and missing answers as incorrect", () => {
    const score = scoreObjective(questions, { q1: "A", q2: "true" });
    expect(score.raw).toBe(0);
    expect(score.results.find((r) => r.id === "q3")?.correct).toBe(false); // missing
  });

  it("rejects answers that exceed the word limit even if content matches", () => {
    // "the public library" is 3 words but limit is 2 -> incorrect
    const score = scoreObjective(questions, { q3: "the public library" });
    expect(score.results.find((r) => r.id === "q3")?.correct).toBe(false);
  });

  it("respects custom points per question", () => {
    const weighted: Question[] = [{ id: "a", type: "single_choice", accepted: ["A"], points: 2 }];
    const score = scoreObjective(weighted, { a: "A" });
    expect(score.raw).toBe(2);
    expect(score.total).toBe(2);
  });
});
