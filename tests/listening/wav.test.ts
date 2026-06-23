import { describe, it, expect } from "vitest";
import { wrapPcmWav } from "@/lib/listening/wav";

function ascii(view: DataView, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

describe("wrapPcmWav", () => {
  it("prepends a valid 44-byte RIFF/WAVE header to raw PCM16 bytes", () => {
    const pcm = new Uint8Array([1, 0, 2, 0, 3, 0, 4, 0]); // 4 samples
    const wav = wrapPcmWav(pcm, 24000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(wav.length).toBe(44 + pcm.length);
    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(view.getUint32(24, true)).toBe(24000); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bits/sample
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(pcm.length);
    // PCM payload preserved
    expect(wav[44]).toBe(1);
    expect(wav[45]).toBe(0);
  });
});
