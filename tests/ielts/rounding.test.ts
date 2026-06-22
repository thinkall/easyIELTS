import { describe, it, expect } from "vitest";
import { roundToHalfBand } from "@/lib/ielts/rounding";

describe("roundToHalfBand", () => {
  it("rounds to the nearest half band", () => {
    expect(roundToHalfBand(6.1)).toBe(6.0);
    expect(roundToHalfBand(6.3)).toBe(6.5);
    expect(roundToHalfBand(6.85)).toBe(7.0);
  });
  it("rounds exact .25 up to the next half band", () => {
    expect(roundToHalfBand(6.25)).toBe(6.5);
  });
  it("rounds exact .75 up to the next whole band", () => {
    expect(roundToHalfBand(6.75)).toBe(7.0);
  });
  it("leaves exact half/whole bands unchanged", () => {
    expect(roundToHalfBand(6.5)).toBe(6.5);
    expect(roundToHalfBand(7)).toBe(7.0);
  });
  it("clamps to the 0..9 range", () => {
    expect(roundToHalfBand(-1)).toBe(0);
    expect(roundToHalfBand(9.4)).toBe(9);
  });
});
