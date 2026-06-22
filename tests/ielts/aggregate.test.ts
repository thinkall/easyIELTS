import { describe, it, expect } from "vitest";
import { writingBand, skillAverageBand, overallBand } from "@/lib/ielts/aggregate";

describe("writingBand", () => {
  it("weights Task 2 twice as much as Task 1", () => {
    // (6 + 2*7)/3 = 6.666... -> 6.5
    expect(writingBand(6, 7)).toBe(6.5);
    // (7 + 2*7)/3 = 7 -> 7
    expect(writingBand(7, 7)).toBe(7);
    // (8 + 2*6)/3 = 6.666... -> 6.5
    expect(writingBand(8, 6)).toBe(6.5);
  });
});

describe("skillAverageBand", () => {
  it("averages the four criteria and rounds", () => {
    // (7+7+6.5+6.5)/4 = 6.75 -> 7
    expect(skillAverageBand([7, 7, 6.5, 6.5])).toBe(7);
    // (6.5+6.5+6.5+7)/4 = 6.625 -> 6.5
    expect(skillAverageBand([6.5, 6.5, 6.5, 7])).toBe(6.5);
  });
  it("throws on empty input", () => {
    expect(() => skillAverageBand([])).toThrow();
  });
});

describe("overallBand", () => {
  it("averages the four skills with ties rounding up", () => {
    // (7+7+6.5+6.5)/4 = 6.75 -> 7
    expect(overallBand({ listening: 7, reading: 7, writing: 6.5, speaking: 6.5 })).toBe(7);
    // (6.5+6.5+6.5+6.5)/4 = 6.5
    expect(overallBand({ listening: 6.5, reading: 6.5, writing: 6.5, speaking: 6.5 })).toBe(6.5);
    // (8+7+7+6.5)/4 = 7.125 -> 7
    expect(overallBand({ listening: 8, reading: 7, writing: 7, speaking: 6.5 })).toBe(7);
  });
});
