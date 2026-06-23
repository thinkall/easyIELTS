import { describe, it, expect, vi, afterEach } from "vitest";
import { createSpeakingSession } from "@/lib/speaking/session";

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

class FakeNode {
  port = { onmessage: null as null | ((e: unknown) => void), postMessage: () => {} };
  connect(x: unknown) { return x; }
}
class FakeAudioContext {
  sampleRate = 48000;
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

afterEach(() => { vi.unstubAllGlobals(); instances.length = 0; });

describe("speaking session kickoff", () => {
  it("sends a kickoff turn in direct mode once ready and the audio graph is up", async () => {
    stubAudio();
    const session = createSpeakingSession("1", { onEvent: () => {}, onStatus: () => {} }, { geminiApiKey: "K" });
    await session.start();
    const ws = instances[0];
    // Direct mode parses raw Gemini frames; setupComplete -> "ready".
    ws.onmessage?.({ data: JSON.stringify({ setupComplete: {} }) });
    const kickoff = ws.sent.map((s) => JSON.parse(s)).find((m) => m.clientContent);
    expect(kickoff).toBeTruthy();
    expect(kickoff.clientContent.turnComplete).toBe(true);
  });

  it("does not kick off client-side in proxy mode (the server does)", async () => {
    stubAudio();
    const session = createSpeakingSession("1", { onEvent: () => {}, onStatus: () => {} });
    await session.start();
    const ws = instances[0];
    ws.onmessage?.({ data: JSON.stringify({ type: "ready" }) });
    const sent = ws.sent.map((s) => JSON.parse(s));
    expect(sent.find((m) => m.clientContent || m.type === "text")).toBeFalsy();
  });

  it("does not kick off before the session is ready", async () => {
    stubAudio();
    const session = createSpeakingSession("1", { onEvent: () => {}, onStatus: () => {} }, { geminiApiKey: "K" });
    await session.start();
    const ws = instances[0];
    expect(ws.sent.map((s) => JSON.parse(s)).find((m) => m.clientContent)).toBeFalsy();
  });
});
