import { describe, it, expect } from "vitest";
import { buildWavBase64 } from "@/lib/speaking/wav";

function decode(base64: string): DataView {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new DataView(bytes.buffer);
}
function ascii(view: DataView, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

describe("buildWavBase64", () => {
  it("writes a valid RIFF/WAVE PCM16 mono header for the given sample rate", () => {
    const samples = new Int16Array([0, 1000, -1000, 32767, -32768]);
    const view = decode(buildWavBase64(samples, 16000));
    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(ascii(view, 12, 4)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(samples.length * 2); // data size
  });

  it("preserves the sample values little-endian after the 44-byte header", () => {
    const samples = new Int16Array([1234, -5678]);
    const view = decode(buildWavBase64(samples, 24000));
    expect(view.getInt16(44, true)).toBe(1234);
    expect(view.getInt16(46, true)).toBe(-5678);
    expect(view.getUint32(24, true)).toBe(24000);
  });
});
