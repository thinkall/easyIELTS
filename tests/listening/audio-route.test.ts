import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/listening/audio/route";
import { _resetRateLimitStore } from "@/server/rate-limit";
import { _resetListeningAudioCache } from "@/app/api/listening/audio/route";

const pcmB64 = Buffer.from(new Uint8Array([1, 0, 2, 0])).toString("base64");
function ttsResponse(status = 200) {
  const body = { candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: pcmB64 } }] } }] };
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}
function req(body: unknown) {
  return new Request("http://x/api/listening/audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => { _resetRateLimitStore(); _resetListeningAudioCache(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("POST /api/listening/audio", () => {
  it("returns audio/wav generated from the script using the owner key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "owner-key");
    const fetchMock = vi.fn(async () => ttsResponse());
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ script: "Receptionist: Hello. Caller: Hi there." }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("audio/wav");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(String.fromCharCode(buf[0], buf[1], buf[2], buf[3])).toBe("RIFF");
    expect(String(vi.mocked(fetchMock).mock.calls[0][0])).toContain("key=owner-key");
  });

  it("caches by script so a repeat request does not call the model again", async () => {
    vi.stubEnv("GEMINI_API_KEY", "owner-key");
    const fetchMock = vi.fn(async () => ttsResponse());
    vi.stubGlobal("fetch", fetchMock);
    const body = { script: "Receptionist: Hello. Caller: Hi." };
    await POST(req(body));
    await POST(req(body));
    expect(vi.mocked(fetchMock)).toHaveBeenCalledTimes(1);
  });

  it("uses the user's own Gemini key from the body when provided", async () => {
    const fetchMock = vi.fn(async () => ttsResponse());
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ script: "The library opens at nine.", geminiApiKey: "user-key" }));
    expect(res.status).toBe(200);
    expect(String(vi.mocked(fetchMock).mock.calls[0][0])).toContain("key=user-key");
  });

  it("returns 503 when no Gemini key is configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await POST(req({ script: "Hello there." }));
    expect(res.status).toBe(503);
  });

  it("returns 400 for an invalid body", async () => {
    vi.stubEnv("GEMINI_API_KEY", "owner-key");
    expect((await POST(req({ script: "" }))).status).toBe(400);
  });
});
