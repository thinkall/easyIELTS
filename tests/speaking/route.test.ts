import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { POST } from "@/app/api/speaking/evaluate/route";
import { _resetRateLimitStore } from "@/server/rate-limit";
import { _resetCopilotTokenCache } from "@/server/copilot-token";
import { _resetCopilotModelsCache } from "@/server/copilot-models";

beforeEach(() => {
  _resetRateLimitStore();
  _resetCopilotTokenCache();
  _resetCopilotModelsCache();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const llmContent = JSON.stringify({
  criteria: { fluencyCoherence: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7, pronunciation: 6.5 },
  feedback: { strengths: [], improvements: [], examples: [] },
});

function req(body: unknown, cookie?: string) {
  return new Request("http://x/api/speaking/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describe("POST /api/speaking/evaluate", () => {
  it("returns 400 for an invalid body", async () => {
    expect((await POST(req({ transcript: [] }))).status).toBe(400);
  });
  it("scores a transcript via the connected user's Copilot account (no Gemini key)", async () => {
    // No owner Gemini key -> exercise the transcript fallback path (now Copilot-routed).
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("copilot_internal")) return { ok: true, status: 200, json: async () => ({ token: "cop", expires_at: 9999999999, endpoints: { api: "https://api.githubcopilot.com" } }), text: async () => "" };
      if (url.endsWith("/models")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "gpt-4o", name: "GPT-4o", model_picker_enabled: true, model_picker_category: "versatile", supported_endpoints: ["/chat/completions"], capabilities: { type: "chat", supports: { structured_outputs: true } } }] }), text: async () => "" };
      if (url.endsWith("/chat/completions")) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: llmContent } }] }), text: async () => llmContent };
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ transcript: [{ role: "candidate", text: "Hello there, I enjoy reading." }] }, "eielts_gh=gho_u"));
    expect(res.status).toBe(200);
    expect((await res.json()).speakingBand).toBe(7); // avg(7,7,7,6.5)=6.875 -> 7
    const calls = vi.mocked(fetchMock).mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.includes("models.github.ai"))).toBe(false);
  });
});
