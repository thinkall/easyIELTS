import { describe, it, expect } from "vitest";
import { floatTo16BitPCM, int16ToBase64, base64ToInt16, downsample } from "@/lib/speaking/pcm";

describe("PCM helpers", () => {
  it("converts float samples to clamped 16-bit PCM", () => {
    const pcm = floatTo16BitPCM(new Float32Array([0, 1, -1, 2, -2]));
    expect(pcm[0]).toBe(0);
    expect(pcm[1]).toBe(32767);   // +1.0 -> max
    expect(pcm[2]).toBe(-32768);  // -1.0 -> min
    expect(pcm[3]).toBe(32767);   // clamp >1
    expect(pcm[4]).toBe(-32768);  // clamp <-1
  });

  it("round-trips int16 through base64", () => {
    const original = new Int16Array([0, 1, -1, 12345, -12345, 32767, -32768]);
    const restored = base64ToInt16(int16ToBase64(original));
    expect(Array.from(restored)).toEqual(Array.from(original));
  });

  it("downsamples by decimation and shortens the buffer", () => {
    const input = new Float32Array([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]);
    const out = downsample(input, 48000, 16000); // ratio 3 -> length 2 (floor(8/3))
    expect(out.length).toBe(2);
    expect(out[0]).toBeCloseTo(0);
    expect(out[1]).toBeCloseTo(0.3);
  });

  it("returns the input unchanged when target rate >= input rate", () => {
    const input = new Float32Array([1, 2, 3]);
    expect(downsample(input, 16000, 16000)).toBe(input);
  });
});