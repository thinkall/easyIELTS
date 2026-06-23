import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/models/route";
import { _resetCopilotTokenCache } from "@/server/copilot-token";
import { _resetCopilotModelsCache } from "@/server/copilot-models";

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

function req(cookie?: string) {
  return new Request("http://x/api/models", { headers: cookie ? { cookie } : {} });
}

beforeEach(() => {
  _resetCopilotTokenCache();
  _resetCopilotModelsCache();
});
afterEach(() => vi.unstubAllGlobals());

describe("GET /api/models", () => {
  it("reports disconnected with no models when there is no cookie", async () => {
    const response = await GET(req());
    const data = await response.json();
    expect(data).toEqual({ connected: false, models: [] });
  });

  it("lists the connected user's usable models", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes("copilot_internal") ? res(EXCHANGE) : res(MODELS),
    ));
    const response = await GET(req("eielts_gh=gho_u"));
    const data = await response.json();
    expect(data.connected).toBe(true);
    expect(data.models.map((m: { id: string }) => m.id)).toEqual(["claude-opus-4.8"]);
  });

  it("degrades gracefully (connected, empty) when the exchange fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res({ message: "no copilot" }, 404)));
    const response = await GET(req("eielts_gh=gho_u"));
    const data = await response.json();
    expect(data.connected).toBe(true);
    expect(data.models).toEqual([]);
  });
});
