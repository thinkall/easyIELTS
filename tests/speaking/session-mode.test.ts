import { describe, it, expect, vi, afterEach } from "vitest";
import { createSpeakingSession } from "@/lib/speaking/session";

const urls: string[] = [];
class FakeWS {
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  constructor(url: string) { urls.push(url); }
  send() {}
  close() {}
}

afterEach(() => { vi.unstubAllGlobals(); urls.length = 0; });

describe("speaking session mode", () => {
  it("connects to the proxy when no user key is given", () => {
    vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
    vi.stubGlobal("location", { protocol: "http:", host: "localhost:3000" });
    // getUserMedia will be undefined; we only care about the socket URL chosen synchronously.
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise(() => {}) } });
    createSpeakingSession("1", { onEvent: () => {}, onStatus: () => {} }).start().catch(() => {});
    expect(urls[0]).toContain("/ws/speaking?part=1");
  });

  it("connects directly to Gemini when a user key is given", () => {
    vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise(() => {}) } });
    createSpeakingSession("1", { onEvent: () => {}, onStatus: () => {} }, { geminiApiKey: "USERKEY" }).start().catch(() => {});
    expect(urls[0]).toContain("generativelanguage.googleapis.com");
    expect(urls[0]).toContain("key=USERKEY");
  });
});
