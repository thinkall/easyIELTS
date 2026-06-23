/**
 * Wrap raw little-endian PCM16 mono bytes in a WAV (RIFF) container. Gemini TTS
 * returns headerless `audio/L16` PCM; browsers need the WAV header to play it.
 */
export function wrapPcmWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const dataLength = pcm.length;
  const out = new Uint8Array(44 + dataLength);
  const view = new DataView(out.buffer);

  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataLength, true);
  out.set(pcm, 44);
  return out;
}
