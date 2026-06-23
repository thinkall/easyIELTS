import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  filterUsableModels,
  listCopilotModels,
  chatJsonCopilot,
  _resetCopilotModelsCache,
} from "@/server/copilot-models";
import { _resetCopilotTokenCache } from "@/server/copilot-token";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const EXCHANGE = {
  token: "cop_tok",
  expires_at: 9_999_999_999,
  endpoints: { api: "https://api.enterprise.githubcopilot.com" },
};

const RAW_MODELS = {
  data: [
    {
      id: "claude-opus-4.8",
      name: "Claude Opus 4.8",
      model_picker_enabled: true,
      model_picker_category: "powerful",
      supported_endpoints: ["/v1/messages", "/chat/completions"],
      capabilities: { type: "chat", supports: { structured_outputs: true } },
    },
    {
      id: "gpt-5.5",
      name: "GPT-5.5",
      model_picker_enabled: true,
      model_picker_category: "versatile",
      supported_endpoints: ["/responses", "ws:/responses"],
      capabilities: { type: "chat", supports: { structured_outputs: true } },
    },
    {
      id: "claude-sonnet-4.5", // no structured_outputs flag -> excluded
      name: "Claude Sonnet 4.5",
      model_picker_enabled: true,
      supported_endpoints: ["/chat/completions"],
      capabilities: { type: "chat", supports: {} },
    },
    {
      id: "gpt-4.1", // not in picker -> excluded
      name: "GPT-4.1",
      model_picker_enabled: false,
      supported_endpoints: [],
      capabilities: { type: "chat", supports: { structured_outputs: true } },
    },
    {
      id: "text-embedding-3-small", // embedding -> excluded
      model_picker_enabled: true,
      supported_endpoints: ["/embeddings"],
      capabilities: { type: "embedding", supports: {} },
    },
    {
      id: "mai-code-1-flash-internal", // internal -> excluded
      model_picker_enabled: true,
      supported_endpoints: ["/responses"],
      capabilities: { type: "chat", supports: { structured_outputs: true } },
    },
  ],
};

/** Build a fetch mock that routes by URL. */
function routerFetch(handlers: { exchange?: unknown; models?: unknown; chat?: unknown; responses?: unknown }) {
  return vi.fn(async (url: string) => {
    if (url.includes("copilot_internal/v2/token")) return jsonResponse(handlers.exchange ?? EXCHANGE);
    if (url.endsWith("/models")) return jsonResponse(handlers.models ?? RAW_MODELS);
    if (url.endsWith("/chat/completions")) return jsonResponse(handlers.chat);
    if (url.endsWith("/responses")) return jsonResponse(handlers.responses);
    throw new Error(`unexpected url ${url}`);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  _resetCopilotTokenCache();
  _resetCopilotModelsCache();
});

describe("filterUsableModels", () => {
  it("keeps only picker-enabled chat models with structured output and a usable endpoint", () => {
    const result = filterUsableModels(RAW_MODELS.data);
    expect(result.map((m) => m.id)).toEqual(["claude-opus-4.8", "gpt-5.5"]);
  });

  it("marks the API kind from supported_endpoints (chat preferred over responses)", () => {
    const byId = Object.fromEntries(filterUsableModels(RAW_MODELS.data).map((m) => [m.id, m.api]));
    expect(byId["claude-opus-4.8"]).toBe("chat");
    expect(byId["gpt-5.5"]).toBe("responses");
  });
});

describe("listCopilotModels", () => {
  it("exchanges then fetches and filters the model catalog", async () => {
    const fetchImpl = routerFetch({});
    const models = await listCopilotModels("gho_x", { fetchImpl, now: () => 0 });
    expect(models.map((m) => m.id)).toEqual(["claude-opus-4.8", "gpt-5.5"]);
  });

  it("caches the catalog within its TTL", async () => {
    const fetchImpl = routerFetch({});
    await listCopilotModels("gho_x", { fetchImpl, now: () => 0 });
    await listCopilotModels("gho_x", { fetchImpl, now: () => 1000 });
    const calls = vi.mocked(fetchImpl).mock.calls.map((c) => c[0] as string);
    expect(calls.filter((u) => u.endsWith("/models")).length).toBe(1);
  });

  it("throws CopilotError with the status on a failed catalog fetch", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes("copilot_internal") ? jsonResponse(EXCHANGE) : jsonResponse({ message: "no" }, 403),
    ) as unknown as typeof fetch;
    await expect(listCopilotModels("gho_x", { fetchImpl, now: () => 0 })).rejects.toMatchObject({ status: 403 });
  });
});

describe("chatJsonCopilot", () => {
  const schema = { name: "r", schema: { type: "object" } };

  it("uses /chat/completions for a chat-API model and parses message content", async () => {
    const fetchImpl = routerFetch({
      chat: { choices: [{ message: { content: JSON.stringify({ band: 7 }) } }] },
    });
    const result = await chatJsonCopilot<{ band: number }>({
      oauthToken: "gho_x",
      model: "claude-opus-4.8",
      system: "s",
      user: "u",
      schema,
      deps: { fetchImpl, now: () => 0 },
    });
    expect(result.band).toBe(7);
    const calls = vi.mocked(fetchImpl).mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.endsWith("/chat/completions"))).toBe(true);
    const chatCall = vi.mocked(fetchImpl).mock.calls.find((c) => (c[0] as string).endsWith("/chat/completions"));
    const body = JSON.parse((chatCall![1] as RequestInit).body as string);
    expect(body.model).toBe("claude-opus-4.8");
    expect(body.response_format.type).toBe("json_schema");
  });

  it("embeds the JSON schema in the user prompt (so non-enforcing models comply)", async () => {
    const fetchImpl = routerFetch({
      chat: { choices: [{ message: { content: JSON.stringify({ band: 7 }) } }] },
    });
    await chatJsonCopilot({
      oauthToken: "gho_x",
      model: "claude-opus-4.8",
      system: "s",
      user: "PROMPT_BODY",
      schema: { name: "r", schema: { type: "object", properties: { band: { type: "number" } } } },
      deps: { fetchImpl, now: () => 0 },
    });
    const chatCall = vi.mocked(fetchImpl).mock.calls.find((c) => (c[0] as string).endsWith("/chat/completions"));
    const body = JSON.parse((chatCall![1] as RequestInit).body as string);
    const userMsg = body.messages.find((m: { role: string }) => m.role === "user").content;
    expect(userMsg).toContain("PROMPT_BODY");
    expect(userMsg).toContain("\"band\""); // the schema shape is included
  });

  it("uses /responses for a responses-only model and parses output_text", async () => {
    const fetchImpl = routerFetch({
      responses: {
        output: [
          { type: "reasoning", content: [] },
          { type: "message", content: [{ type: "output_text", text: JSON.stringify({ band: 8 }) }] },
        ],
      },
    });
    const result = await chatJsonCopilot<{ band: number }>({
      oauthToken: "gho_x",
      model: "gpt-5.5",
      system: "s",
      user: "u",
      schema,
      deps: { fetchImpl, now: () => 0 },
    });
    expect(result.band).toBe(8);
    const respCall = vi.mocked(fetchImpl).mock.calls.find((c) => (c[0] as string).endsWith("/responses"));
    const body = JSON.parse((respCall![1] as RequestInit).body as string);
    expect(body.text.format.type).toBe("json_schema");
    expect(body.input).toHaveLength(2);
  });

  it("throws CopilotError with the status when the completion fails", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("copilot_internal")) return jsonResponse(EXCHANGE);
      if (url.endsWith("/models")) return jsonResponse(RAW_MODELS);
      return jsonResponse({ error: "bad" }, 401);
    }) as unknown as typeof fetch;
    await expect(
      chatJsonCopilot({ oauthToken: "gho_x", model: "claude-opus-4.8", system: "s", user: "u", schema, deps: { fetchImpl, now: () => 0 } }),
    ).rejects.toMatchObject({ name: "CopilotError", status: 401 });
  });
});
