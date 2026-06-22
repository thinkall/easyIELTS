import { describe, it, expect } from "vitest";
import { getReadingTests, getReadingTest } from "@/lib/content/reading";

describe("reading content", () => {
  it("exposes at least one test, retrievable by id", () => {
    const tests = getReadingTests();
    expect(tests.length).toBeGreaterThan(0);
    expect(getReadingTest(tests[0].id)).toBe(tests[0]);
    expect(getReadingTest("does-not-exist")).toBeUndefined();
  });

  it("every question has a non-empty accepted answer and a unique id", () => {
    const ids = new Set<string>();
    for (const test of getReadingTests()) {
      for (const section of test.sections) {
        for (const q of section.questions) {
          expect(q.accepted.length).toBeGreaterThan(0);
          expect(q.accepted.every((a) => a.trim() !== "")).toBe(true);
          expect(ids.has(q.id)).toBe(false);
          ids.add(q.id);
        }
      }
    }
  });
});
