import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveChatJson } from "@/server/llm-router";
import { _resetRateLimitStore } from "@/server/rate-limit";
import { _resetCopilotTokenCache } from "@/server/copilot-token";
import { _resetCopilotModelsCache } from "@/server/copilot-models";

const generated = { ok: true };
const schema = { name: "x", schema: { type: "object" } };

function req(cookie?: string) {
  return new Request("http://x/api/content/writing", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
  });
}

function copilotFetch(catalog: unknown[], content: string) {
  return vi.fn(async (url: string) => {
    if (url.includes("copilot_internal"))
      return { ok: true, status: 200, json: async () => ({ token: "cop", expires_at: 9999999999, endpoints: { api: "https://api.githubcopilot.com" } }), text: async () => "" };
    if (url.endsWith("/models"))
      return { ok: true, status: 200, json: async () => ({ data: catalog }), text: async () => "" };
    if (url.endsWith("/chat/completions"))
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => content };
    throw new Error(`unexpected ${url}`);
  });
}

beforeEach(() => {
  _resetRateLimitStore();
  _resetCopilotTokenCache();
  _resetCopilotModelsCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("resolveChatJson — shared admin Copilot fallback", () => {
  const catalog = [
    { id: "gpt-4o", name: "GPT-4o", model_picker_enabled: true, model_picker_category: "versatile", supported_endpoints: ["/chat/completions"], capabilities: { type: "chat", supports: { structured_outputs: true } } },
  ];

  it("uses the shared Copilot token for an anonymous user (no cookie) when set", async () => {
    vi.stubEnv("EASYIELTS_SHARED_COPILOT_TOKEN", "gho_shared");
    const fetchMock = copilotFetch(catalog, JSON.stringify(generated));
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveChatJson(req(), { rateLimitKey: "content" });
    if (!("chat" in resolved)) throw new Error("expected chat");
    const out = await resolved.chat({ system: "s", user: "u", schema });
    expect(out).toEqual(generated);
    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.startsWith("https://api.githubcopilot.com"))).toBe(true);
    expect(calls.some((u) => u.includes("models.github.ai"))).toBe(false);
  });

  it("uses the admin-selected shared model for an anonymous user when set", async () => {
    vi.stubEnv("EASYIELTS_SHARED_COPILOT_TOKEN", "gho_shared");
    vi.stubEnv("EASYIELTS_SHARED_MODEL", "claude-opus-4.8");
    const fetchMock = copilotFetch(catalog, JSON.stringify(generated));
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveChatJson(req(), { rateLimitKey: "content" });
    if (!("chat" in resolved)) throw new Error("expected chat");
    await resolved.chat({ system: "s", user: "u", schema });
    const body = JSON.parse(fetchMock.mock.calls.find((c) => (c[0] as string).endsWith("/chat/completions"))![1].body as string);
    // The admin's chosen model is used, not the catalog default (gpt-4o).
    expect(body.model).toBe("claude-opus-4.8");
  });

  it("lets the shared token serve an anonymously-requested premium bare id", async () => {
    vi.stubEnv("EASYIELTS_SHARED_COPILOT_TOKEN", "gho_shared");
    const fetchMock = copilotFetch(
      [{ id: "gpt-5.5", name: "GPT-5.5", model_picker_enabled: true, model_picker_category: "powerful", supported_endpoints: ["/chat/completions"], capabilities: { type: "chat", supports: { structured_outputs: true } } }],
      JSON.stringify(generated),
    );
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveChatJson(req(), { model: "gpt-5.5", rateLimitKey: "content" });
    if (!("chat" in resolved)) throw new Error("expected chat (shared token should satisfy premium model)");
    await resolved.chat({ system: "s", user: "u", schema });
    const body = JSON.parse(fetchMock.mock.calls.find((c) => (c[0] as string).endsWith("/chat/completions"))![1].body as string);
    expect(body.model).toBe("gpt-5.5");
  });

  it("prefers the user's own cookie over the shared token", async () => {
    vi.stubEnv("EASYIELTS_SHARED_COPILOT_TOKEN", "gho_shared");
    const fetchMock = copilotFetch(catalog, JSON.stringify(generated));
    vi.stubGlobal("fetch", fetchMock);

    await resolveChatJson(req("eielts_gh=gho_user"), { rateLimitKey: "content" }).then((r) => {
      if (!("chat" in r)) throw new Error("expected chat");
      return r.chat({ system: "s", user: "u", schema });
    });
    // The exchange call must carry the USER token, not the shared one.
    const exchange = fetchMock.mock.calls.find((c) => (c[0] as string).includes("copilot_internal"));
    expect((exchange![1] as { headers: Record<string, string> }).headers.Authorization).toBe("token gho_user");
  });

  it("still 401s for a premium bare id when neither cookie nor shared token exists", async () => {
    vi.stubEnv("EASYIELTS_SHARED_COPILOT_TOKEN", "");
    const resolved = await resolveChatJson(req(), { model: "gpt-5.5", rateLimitKey: "content" });
    expect("error" in resolved && resolved.error.status).toBe(401);
  });

  it("prefers the user's own body GitHub token over the shared Copilot token", async () => {
    vi.stubEnv("EASYIELTS_SHARED_COPILOT_TOKEN", "gho_shared");
    const content = JSON.stringify(generated);
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => content }));
    vi.stubGlobal("fetch", fetchMock);

    // No cookie, but the user supplied their own GitHub Models token in the body.
    const resolved = await resolveChatJson(req(), { bodyToken: "ghp_user", rateLimitKey: "content" });
    if (!("chat" in resolved)) throw new Error("expected chat");
    await resolved.chat({ system: "s", user: "u", schema });
    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    // Must use the user's own GitHub Models token, NOT the shared admin Copilot.
    expect(calls.some((u) => u.includes("models.github.ai"))).toBe(true);
    expect(calls.some((u) => u.includes("api.githubcopilot.com"))).toBe(false);
  });
});

describe("resolveChatJson — connected user defaults to Copilot (not GitHub Models)", () => {
  it("routes a connected user with no selected model through Copilot using a default model", async () => {
    const catalog = [
      { id: "gpt-4o", name: "GPT-4o", model_picker_enabled: true, model_picker_category: "versatile", supported_endpoints: ["/chat/completions"], capabilities: { type: "chat", supports: { structured_outputs: true } } },
    ];
    const fetchMock = copilotFetch(catalog, JSON.stringify(generated));
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveChatJson(req("eielts_gh=gho_u"), { rateLimitKey: "content" });
    expect("chat" in resolved).toBe(true);
    if (!("chat" in resolved)) return;
    const out = await resolved.chat({ system: "s", user: "u", schema });
    expect(out).toEqual(generated);

    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    // Must hit the Copilot API, never the rate-limited GitHub Models inference endpoint.
    expect(calls.some((u) => u.startsWith("https://api.githubcopilot.com"))).toBe(true);
    expect(calls.some((u) => u.includes("models.github.ai"))).toBe(false);
    // Default model picked from the catalog is gpt-4o.
    const body = JSON.parse(fetchMock.mock.calls.find((c) => (c[0] as string).endsWith("/chat/completions"))![1].body as string);
    expect(body.model).toBe("gpt-4o");
  });

  it("still routes a connected user's explicitly selected bare-id model through Copilot", async () => {
    const catalog = [
      { id: "claude-opus-4.8", name: "Opus", model_picker_enabled: true, model_picker_category: "powerful", supported_endpoints: ["/chat/completions"], capabilities: { type: "chat", supports: { structured_outputs: true } } },
    ];
    const fetchMock = copilotFetch(catalog, JSON.stringify(generated));
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveChatJson(req("eielts_gh=gho_u"), { model: "claude-opus-4.8", rateLimitKey: "content" });
    if (!("chat" in resolved)) throw new Error("expected chat");
    await resolved.chat({ system: "s", user: "u", schema });
    const body = JSON.parse(fetchMock.mock.calls.find((c) => (c[0] as string).endsWith("/chat/completions"))![1].body as string);
    expect(body.model).toBe("claude-opus-4.8");
  });

  it("uses GitHub Models for anonymous users (no cookie, no model)", async () => {
    const content = JSON.stringify(generated);
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => content }));
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveChatJson(req(), { bodyToken: "ghp_owner", rateLimitKey: "content" });
    if (!("chat" in resolved)) throw new Error("expected chat");
    await resolved.chat({ system: "s", user: "u", schema });
    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.includes("models.github.ai"))).toBe(true);
  });
});
