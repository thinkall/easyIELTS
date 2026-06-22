import { describe, it, expect } from "vitest";
import { getWritingTests, getWritingTest } from "@/lib/content/writing";

describe("writing content", () => {
  it("provides Task 1 and Task 2 prompts with minimum word counts", () => {
    const test = getWritingTest(getWritingTests()[0].id)!;
    expect(test.tasks).toHaveLength(2);
    expect(test.tasks.find((t) => t.taskNumber === 1)?.minWords).toBe(150);
    expect(test.tasks.find((t) => t.taskNumber === 2)?.minWords).toBe(250);
    expect(getWritingTest("nope")).toBeUndefined();
  });
});
