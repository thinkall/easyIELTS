import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, _resetRateLimitStore, _rateLimitSize } from "@/server/rate-limit";

beforeEach(() => _resetRateLimitStore());

describe("rateLimit", () => {
  it("allows up to the limit, then blocks within the window", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 1000, 1000).allowed).toBe(true);
    }
    expect(rateLimit("k", 3, 1000, 1000).allowed).toBe(false);
  });

  it("resets after the window elapses", () => {
    expect(rateLimit("k", 1, 1000, 1000).allowed).toBe(true);
    expect(rateLimit("k", 1, 1000, 1500).allowed).toBe(false);
    expect(rateLimit("k", 1, 1000, 2001).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    expect(rateLimit("a", 1, 1000, 1000).allowed).toBe(true);
    expect(rateLimit("b", 1, 1000, 1000).allowed).toBe(true);
    expect(rateLimit("a", 1, 1000, 1000).allowed).toBe(false);
  });

  it("evicts expired buckets when a new window opens", () => {
    rateLimit("a", 1, 1000, 1000);
    rateLimit("b", 1, 1000, 1000);
    expect(_rateLimitSize()).toBe(2);
    // now=3000 is past a/b's resetAt (2000); opening c's window evicts a and b.
    rateLimit("c", 1, 1000, 3000);
    expect(_rateLimitSize()).toBe(1);
  });
});
