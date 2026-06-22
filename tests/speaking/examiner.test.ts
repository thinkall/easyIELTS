import { describe, it, expect } from "vitest";
import { buildExaminerSystemInstruction, getCueCard } from "@/lib/speaking/examiner";

describe("buildExaminerSystemInstruction", () => {
  it("describes the IELTS examiner role and the requested part", () => {
    const p1 = buildExaminerSystemInstruction("1");
    expect(p1.toLowerCase()).toContain("examiner");
    expect(p1).toContain("Part 1");
    expect(buildExaminerSystemInstruction("2")).toContain("Part 2");
    expect(buildExaminerSystemInstruction("3")).toContain("Part 3");
  });
  it("instructs the model to speak one turn at a time and not coach", () => {
    const text = buildExaminerSystemInstruction("1");
    expect(text.toLowerCase()).toContain("one question at a time");
  });
});

describe("getCueCard", () => {
  it("returns a Part 2 cue card with a topic and bullet prompts", () => {
    const card = getCueCard();
    expect(card.topic.length).toBeGreaterThan(0);
    expect(card.bullets.length).toBeGreaterThanOrEqual(3);
  });
});
