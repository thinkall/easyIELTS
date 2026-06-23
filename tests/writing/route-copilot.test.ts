import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/writing/evaluate/route";
import { _resetRateLimitStore } from "@/server/rate-limit";
import { _resetCopilotTokenCache } from "@/server/copilot-token";
import { _resetCopilotModelsCache } from "@/server/copilot-models";

const evalContent = JSON.stringify({
  criteria: { taskResponse: 7, coherenceCohesion: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7 },
  feedback: { strengths: [], improvements: [], correctedExamples: [] },
  modelAnswer: "m",
});
const EXCHANGE = { token: "cop", expires_at: 9_999_999_999, endpoints: { api: "https://api.enterprise.githubcopilot.com" } };
const MODELS = {
  data: [
    {
      id: "claude-opus-4.8",
      name: "Claude Opus 4.8",
      model_picker_enabled: true,
      model_picker_category: "powerful",
      supported_endpoints: ["/chat/completions"],
      capabilities: { type: "chat", supports: { structured_outputs: true } },
    },
  ],
};

function res(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function req(body: unknown, cookie?: string) {
  return new Request("http://x/api/writing/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  _resetRateLimitStore();
  _resetCopilotTokenCache();
  _resetCopilotModelsCache();
});
afterEach(() => vi.unstubAllGlobals());

describe("writing route Copilot model selection", () => {
  it("routes a Copilot model id through the Copilot API", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("copilot_internal")) return res(EXCHANGE);
      if (url.endsWith("/models")) return res(MODELS);
      if (url.endsWith("/chat/completions")) return res({ choices: [{ message: { content: evalContent } }] });
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await POST(req({ taskNumber: 2, prompt: "p", response: "a b c", model: "claude-opus-4.8" }, "eielts_gh=gho_u"));
    expect(r.status).toBe(200);
    const calls = vi.mocked(fetchMock).mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.startsWith("https://api.enterprise.githubcopilot.com"))).toBe(true);
    expect(calls.some((u) => u.includes("models.github.ai"))).toBe(false);
  });

  it("requires a device-flow connection (401) for a Copilot model with no cookie", async () => {
    const r = await POST(req({ taskNumber: 2, prompt: "p", response: "a b c", model: "gpt-5.5" }));
    expect(r.status).toBe(401);
  });

  it("still uses GitHub Models for a slash-prefixed model id", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("models.github.ai")) return res({ choices: [{ message: { content: evalContent } }] });
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await POST(req({ taskNumber: 2, prompt: "p", response: "a b c", model: "openai/gpt-4.1", token: "ghp" }, "eielts_gh=gho_u"));
    expect(r.status).toBe(200);
    const calls = vi.mocked(fetchMock).mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.includes("models.github.ai"))).toBe(true);
  });
});
