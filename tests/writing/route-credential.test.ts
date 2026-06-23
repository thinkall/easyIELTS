import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { POST } from "@/app/api/writing/evaluate/route";
import { _resetRateLimitStore } from "@/server/rate-limit";
import { _resetCopilotTokenCache } from "@/server/copilot-token";
import { _resetCopilotModelsCache } from "@/server/copilot-models";

beforeEach(() => {
  _resetRateLimitStore();
  _resetCopilotTokenCache();
  _resetCopilotModelsCache();
});
afterEach(() => vi.unstubAllGlobals());

const llmContent = JSON.stringify({
  criteria: { taskResponse: 7, coherenceCohesion: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7 },
  feedback: { strengths: [], improvements: [], correctedExamples: [] },
  modelAnswer: "m",
});

// A connected user (device-flow cookie) is routed through their Copilot account,
// which is not subject to the shared GitHub Models rate limit.
function mockCopilotOk() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("copilot_internal")) return { ok: true, status: 200, json: async () => ({ token: "cop", expires_at: 9_999_999_999, endpoints: { api: "https://api.githubcopilot.com" } }), text: async () => "" };
    if (url.endsWith("/models")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "gpt-4o", name: "GPT-4o", model_picker_enabled: true, model_picker_category: "versatile", supported_endpoints: ["/chat/completions"], capabilities: { type: "chat", supports: { structured_outputs: true } } }] }), text: async () => "" };
    if (url.endsWith("/chat/completions")) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: llmContent } }] }), text: async () => llmContent };
    throw new Error(`unexpected ${url}`);
  }));
}

function req(cookie?: string) {
  return new Request("http://x/api/writing/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ taskNumber: 2, prompt: "p", response: "a b c" }),
  });
}

describe("writing route credential resolution", () => {
  it("routes a connected user through Copilot and is NOT rate-limited", async () => {
    mockCopilotOk();
    // 12 calls with a cookie credential; none should hit the 10/hr shared limit.
    for (let i = 0; i < 12; i++) {
      const res = await POST(req("eielts_gh=gho_user"));
      expect(res.status).toBe(200);
    }
  });
});
