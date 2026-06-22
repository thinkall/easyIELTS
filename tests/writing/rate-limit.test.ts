import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, _resetRateLimitStore } from "@/server/rate-limit";

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
});
