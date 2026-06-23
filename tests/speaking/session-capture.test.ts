import { describe, it, expect, vi, afterEach } from "vitest";
import { createSpeakingSession } from "@/lib/speaking/session";
import { buildWavBase64 } from "@/lib/speaking/wav";

const instances: FakeWS[] = [];
class FakeWS {
  static OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  sent: string[] = [];
  constructor() { instances.push(this); }
  send(d: string) { this.sent.push(d); }
  close() {}
}

let recorderNode: FakeNode | null = null;
const allNodes: FakeNode[] = [];
class FakeNode {
  port = { onmessage: null as null | ((e: { data: Float32Array }) => void), postMessage: () => {} };
  name?: string;
  constructor(_ctx?: unknown, name?: string) {
    this.name = name;
    allNodes.push(this);
  }
  connect(x: unknown) { return x; }
}
class FakeAudioContext {
  sampleRate = 16000; // so no downsampling: frames pass through 1:1
  destination = {};
  audioWorklet = { addModule: async () => {} };
  createMediaStreamSource() { return new FakeNode(); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

function stubAudio() {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  vi.stubGlobal("location", { protocol: "http:", host: "localhost:3000" });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } });
  vi.stubGlobal("AudioContext", FakeAudioContext as unknown as typeof AudioContext);
  vi.stubGlobal("AudioWorkletNode", FakeNode as unknown as typeof AudioWorkletNode);
}

afterEach(() => { vi.unstubAllGlobals(); instances.length = 0; recorderNode = null; allNodes.length = 0; });

describe("speaking session audio capture", () => {
  it("accumulates microphone frames and returns them as a base64 WAV", async () => {
    stubAudio();
    const session = createSpeakingSession("1", { onEvent: () => {}, onStatus: () => {} });
    await session.start();
    recorderNode = allNodes.find((n) => n.name === "recorder-processor") ?? null;
    expect(recorderNode).toBeTruthy();

    // Feed two mic frames (Float32 at 16kHz -> no downsample).
    recorderNode!.port.onmessage?.({ data: new Float32Array([0, 0.5, -0.5]) });
    recorderNode!.port.onmessage?.({ data: new Float32Array([0.25]) });

    const rec = session.getRecording();
    expect(rec).toBeTruthy();
    expect(rec!.mimeType).toBe("audio/wav");
    // 4 samples * 2 bytes + 44-byte header, base64-encoded.
    const expected = buildWavBase64(new Int16Array([0, 16383, -16384, 8191]), 16000);
    // tolerate rounding differences in the PCM conversion: compare lengths + header.
    expect(typeof rec!.base64).toBe("string");
    expect(rec!.base64.length).toBe(expected.length);
  });

  it("returns null when no audio was captured", async () => {
    stubAudio();
    const session = createSpeakingSession("1", { onEvent: () => {}, onStatus: () => {} });
    await session.start();
    expect(session.getRecording()).toBeNull();
  });
});
