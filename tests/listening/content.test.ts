import { describe, it, expect } from "vitest";
import { getListeningTests, getListeningTest } from "@/lib/content/listening";

describe("listening content", () => {
  it("exposes a test with a non-empty script and questions", () => {
    const tests = getListeningTests();
    expect(tests.length).toBeGreaterThan(0);
    const test = getListeningTest(tests[0].id)!;
    expect(test.sections[0].script.length).toBeGreaterThan(50);
    expect(test.sections[0].questions.length).toBeGreaterThan(0);
    expect(getListeningTest("nope")).toBeUndefined();
  });
});
