import { describe, it, expect } from "vitest";
import { normalizeAnswer, wordCount, exceedsWordLimit } from "@/lib/scoring/normalize";

describe("normalizeAnswer", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeAnswer("  The   Library ")).toBe("the library");
  });
  it("strips surrounding punctuation but keeps internal apostrophes/hyphens", () => {
    expect(normalizeAnswer("well-known.")).toBe("well-known");
    expect(normalizeAnswer("o'clock,")).toBe("o'clock");
  });
});

describe("wordCount", () => {
  it("counts whitespace-separated tokens; a number is one word", () => {
    expect(wordCount("twenty past four")).toBe(3);
    expect(wordCount("14")).toBe(1);
    expect(wordCount("   ")).toBe(0);
  });
});

describe("exceedsWordLimit", () => {
  it("is false when no limit is set", () => {
    expect(exceedsWordLimit("a b c", undefined)).toBe(false);
  });
  it("flags answers over the limit", () => {
    expect(exceedsWordLimit("two words", 2)).toBe(false);
    expect(exceedsWordLimit("three little words", 2)).toBe(true);
  });
});
