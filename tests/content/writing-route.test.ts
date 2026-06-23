import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/content/writing/route";
import { _resetRateLimitStore } from "@/server/rate-limit";
import { _resetCopilotTokenCache } from "@/server/copilot-token";
import { _resetCopilotModelsCache } from "@/server/copilot-models";

const generated = {
  title: "T",
  task1Instructions: "Write a letter. Begin 'Dear Sir or Madam,'.",
  task2Instructions: "Discuss both views and give your opinion.",
};

function req(body: unknown, cookie?: string) {
  return new Request("http://x/api/content/writing", {
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

describe("POST /api/content/writing", () => {
  it("routes a connected user with no model through their Copilot account", async () => {
    const content = JSON.stringify(generated);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("copilot_internal")) return { ok: true, status: 200, json: async () => ({ token: "cop", expires_at: 9999999999, endpoints: { api: "https://api.githubcopilot.com" } }), text: async () => "" };
      if (url.endsWith("/models")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "gpt-4o", name: "GPT-4o", model_picker_enabled: true, model_picker_category: "versatile", supported_endpoints: ["/chat/completions"], capabilities: { type: "chat", supports: { structured_outputs: true } } }] }), text: async () => "" };
      if (url.endsWith("/chat/completions")) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => content };
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ topic: "travel" }, "eielts_gh=gho_u"));
    expect(res.status).toBe(200);
    const test = await res.json();
    expect(test.skill).toBe("writing");
    expect(test.tasks).toHaveLength(2);
    const calls = vi.mocked(fetchMock).mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.startsWith("https://api.githubcopilot.com"))).toBe(true);
    expect(calls.some((u) => u.includes("models.github.ai"))).toBe(false);
  });

  it("routes a premium Copilot model id through the Copilot API", async () => {
    const content = JSON.stringify(generated);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("copilot_internal")) return { ok: true, status: 200, json: async () => ({ token: "cop", expires_at: 9999999999, endpoints: { api: "https://api.enterprise.githubcopilot.com" } }), text: async () => "" };
      if (url.endsWith("/models")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "gpt-5.5", name: "GPT-5.5", model_picker_enabled: true, supported_endpoints: ["/responses"], capabilities: { type: "chat", supports: { structured_outputs: true } } }] }), text: async () => "" };
      if (url.endsWith("/responses")) return { ok: true, status: 200, json: async () => ({ output: [{ type: "message", content: [{ type: "output_text", text: content }] }] }), text: async () => content };
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ topic: "x", model: "gpt-5.5" }, "eielts_gh=gho_u"));
    expect(res.status).toBe(200);
    const calls = vi.mocked(fetchMock).mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.startsWith("https://api.enterprise.githubcopilot.com"))).toBe(true);
  });

  it("requires a connection (401) for a premium model without a cookie", async () => {
    const res = await POST(req({ topic: "x", model: "gpt-5.5" }));
    expect(res.status).toBe(401);
  });
});
