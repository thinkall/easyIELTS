import { describe, it, expect } from "vitest";
import { scoreListeningTest } from "@/lib/listening/score-listening";
import { getListeningTest } from "@/lib/content/listening";

const test = getListeningTest("gt-community-hall")!;
const key: Record<string, string> = {
  l1: "fourteenth", l2: "two", l3: "25", l4: "40", l5: "ten", l6: "B", l7: "C", l8: "false",
};

describe("scoreListeningTest", () => {
  it("scores a fully-correct attempt and maps a band via the Listening table", () => {
    const result = scoreListeningTest(test, key);
    expect(result.raw).toBe(8);
    expect(result.total).toBe(8);
    expect(result.scaledTo40).toBe(40);
    expect(result.band).toBe(9);
    expect(result.bandIsEstimated).toBe(true);
  });

  it("accepts numeric or word variants and marks misses", () => {
    const result = scoreListeningTest(test, { ...key, l1: "14", l4: "wrong" });
    expect(result.results.find((r) => r.id === "l1")?.correct).toBe(true); // "14" accepted
    expect(result.results.find((r) => r.id === "l4")?.correct).toBe(false);
    expect(result.raw).toBe(7);
  });
});
