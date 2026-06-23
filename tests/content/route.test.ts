import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { POST } from "@/app/api/content/reading/route";
import { _resetRateLimitStore } from "@/server/rate-limit";
import { _resetCopilotTokenCache } from "@/server/copilot-token";
import { _resetCopilotModelsCache } from "@/server/copilot-models";

beforeEach(() => {
  _resetRateLimitStore();
  _resetCopilotTokenCache();
  _resetCopilotModelsCache();
});
afterEach(() => vi.unstubAllGlobals());

const generated = {
  title: "T", passageTitle: "P",
  passageParagraphs: ["one two three", "four five six"],
  questions: Array.from({ length: 8 }, (_, i) => ({ type: "true_false_notgiven", prompt: `q${i}`, accepted: ["true"] })),
};

function req(body: unknown, cookie?: string) {
  return new Request("http://x/api/content/reading", {
    method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
  });
}

describe("POST /api/content/reading", () => {
  it("routes a connected user with no model through their Copilot account", async () => {
    const content = JSON.stringify(generated);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("copilot_internal")) return { ok: true, status: 200, json: async () => ({ token: "cop", expires_at: 9999999999, endpoints: { api: "https://api.githubcopilot.com" } }), text: async () => "" };
      if (url.endsWith("/models")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "gpt-4o", name: "GPT-4o", model_picker_enabled: true, model_picker_category: "versatile", supported_endpoints: ["/chat/completions"], capabilities: { type: "chat", supports: { structured_outputs: true } } }] }), text: async () => "" };
      if (url.endsWith("/chat/completions")) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => content };
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ topic: "gardens" }, "eielts_gh=gho_u"));
    expect(res.status).toBe(200);
    const test = await res.json();
    expect(test.skill).toBe("reading");
    expect(test.sections[0].questions).toHaveLength(8);
    const calls = vi.mocked(fetchMock).mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.includes("models.github.ai"))).toBe(false);
  });

  it("propagates a model error status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => "bad token" })));
    const res = await POST(req({ topic: "x" }, "eielts_gh=gho_u"));
    expect(res.status).toBe(401);
  });
});
