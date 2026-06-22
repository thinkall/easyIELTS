import { describe, it, expect } from "vitest";
import { listeningRawToBand, gtReadingRawToBand } from "@/lib/ielts/bands";

describe("listeningRawToBand", () => {
  it("maps the Band 7 boundary (30-31) correctly", () => {
    expect(listeningRawToBand(29)).toBe(6.5);
    expect(listeningRawToBand(30)).toBe(7);
    expect(listeningRawToBand(31)).toBe(7);
    expect(listeningRawToBand(32)).toBe(7.5);
  });
  it("maps the extremes", () => {
    expect(listeningRawToBand(40)).toBe(9);
    expect(listeningRawToBand(39)).toBe(9);
    expect(listeningRawToBand(0)).toBeLessThanOrEqual(2.5);
  });
});

describe("gtReadingRawToBand", () => {
  it("requires 34-35 for Band 7 (harder than Academic)", () => {
    expect(gtReadingRawToBand(33)).toBe(6.5);
    expect(gtReadingRawToBand(34)).toBe(7);
    expect(gtReadingRawToBand(35)).toBe(7);
    expect(gtReadingRawToBand(36)).toBe(7.5);
  });
  it("maps the top of the scale", () => {
    expect(gtReadingRawToBand(40)).toBe(9);
    expect(gtReadingRawToBand(39)).toBe(8.5);
    expect(gtReadingRawToBand(37)).toBe(8);
  });
  it("clamps out-of-range raw scores", () => {
    expect(gtReadingRawToBand(41)).toBe(9);
    expect(gtReadingRawToBand(-5)).toBeLessThanOrEqual(2.5);
  });
});
