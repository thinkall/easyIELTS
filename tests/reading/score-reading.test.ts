import { describe, it, expect } from "vitest";
import { scoreReadingTest } from "@/lib/reading/score-reading";
import { getReadingTest } from "@/lib/content/reading";

const test = getReadingTest("gt-tool-libraries")!;

// The official answer key for the seed test.
const correctAnswers: Record<string, string> = {
  q1: "false", q2: "true", q3: "true", q4: "true", q5: "fee",
  q6: "idle", q7: "budget", q8: "B", q9: "C", q10: "workshops",
};

describe("scoreReadingTest", () => {
  it("scores a fully-correct attempt and scales the band to /40", () => {
    const result = scoreReadingTest(test, correctAnswers);
    expect(result.raw).toBe(10);
    expect(result.total).toBe(10);
    expect(result.scaledTo40).toBe(40);
    expect(result.band).toBe(9);
    expect(result.bandIsEstimated).toBe(true); // fewer than 40 questions
  });

  it("marks wrong/missing answers and reports per-question results", () => {
    const result = scoreReadingTest(test, { ...correctAnswers, q1: "true", q5: "" });
    expect(result.raw).toBe(8);
    expect(result.results.find((r) => r.id === "q1")?.correct).toBe(false);
    expect(result.results.find((r) => r.id === "q5")?.correct).toBe(false);
  });

  it("handles an empty answer set", () => {
    const result = scoreReadingTest(test, {});
    expect(result.raw).toBe(0);
    expect(result.scaledTo40).toBe(0);
  });
});
