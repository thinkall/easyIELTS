import { describe, it, expect } from "vitest";
import { computeStats } from "@/lib/storage/stats";
import type { Attempt } from "@/lib/storage/types";

const A = (skill: Attempt["skill"], band: number, createdAt: number): Attempt => ({
  id: `${skill}-${createdAt}`, skill, testId: "t", title: "T", band, createdAt,
});

describe("computeStats", () => {
  it("computes latest, best, and distance-to-7 per skill", () => {
    const stats = computeStats([A("reading", 6, 1), A("reading", 6.5, 3), A("reading", 7, 2)]);
    const r = stats.perSkill.reading;
    expect(r.latest).toBe(6.5);
    expect(r.best).toBe(7);
    expect(r.attempts).toBe(3);
    expect(r.distanceToSeven).toBe(0.5);
    expect(r.metTarget).toBe(false);
  });

  it("computes overall only when all four skills have attempts", () => {
    const none = computeStats([A("reading", 7, 1)]);
    expect(none.overall).toBeNull();
    const all = computeStats([A("reading", 7, 1), A("listening", 7, 1), A("writing", 6.5, 1), A("speaking", 6.5, 1)]);
    expect(all.overall).toBe(7);
    expect(all.overallDistanceToSeven).toBe(0);
  });

  it("reports empty skills cleanly", () => {
    const stats = computeStats([]);
    expect(stats.totalAttempts).toBe(0);
    expect(stats.perSkill.writing.latest).toBeNull();
    expect(stats.perSkill.writing.metTarget).toBe(false);
  });
});
