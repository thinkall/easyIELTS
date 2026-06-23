import { describe, it, expect } from "vitest";
import { compressSilence, prepareEvalAudio } from "@/lib/speaking/silence";

describe("compressSilence", () => {
  it("returns an empty array when the audio is entirely silent", () => {
    const silent = new Int16Array(16000); // 1s of zeros
    expect(compressSilence(silent, 16000).length).toBe(0);
  });

  it("keeps voiced audio and truncates long internal silence to the max gap", () => {
    // 20ms frames @16k = 320 samples. maxSilence 40ms = 2 frames = 640 samples.
    const voiced = (n: number) => Int16Array.from({ length: n }, () => 10000);
    const silence = (n: number) => new Int16Array(n);
    const merged = new Int16Array(320 + 3200 + 320);
    merged.set(voiced(320), 0);
    merged.set(silence(3200), 320);
    merged.set(voiced(320), 320 + 3200);

    const out = compressSilence(merged, 16000, { frameMs: 20, maxSilenceMs: 40, thresholdPeak: 500 });
    // voiced(320) + truncated gap(640) + voiced(320) = 1280, far less than 3840.
    expect(out.length).toBe(1280);
    expect(out.length).toBeLessThan(merged.length);
  });

  it("drops leading and trailing silence", () => {
    const merged = new Int16Array(3200 + 320 + 3200);
    merged.set(Int16Array.from({ length: 320 }, () => 8000), 3200);
    const out = compressSilence(merged, 16000, { frameMs: 20, maxSilenceMs: 0, thresholdPeak: 500 });
    expect(out.length).toBe(320);
  });
});

describe("prepareEvalAudio", () => {
  it("compresses silence and caps the result to maxSeconds", () => {
    // 120s of continuous voiced audio @16k.
    const samples = Int16Array.from({ length: 16000 * 120 }, () => 9000);
    const out = prepareEvalAudio(samples, 16000, { maxSeconds: 90 });
    expect(out.length).toBe(16000 * 90);
  });

  it("falls back to the original audio when compression removes almost everything", () => {
    // Below-threshold but non-zero audio (quiet mic): compression yields nothing.
    const samples = Int16Array.from({ length: 16000 }, () => 50);
    const out = prepareEvalAudio(samples, 16000, { maxSeconds: 90, thresholdPeak: 600 });
    expect(out.length).toBe(samples.length);
  });
});
