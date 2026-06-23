import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCopilotToken, CopilotError, _resetCopilotTokenCache } from "@/server/copilot-token";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const exchangeBody = {
  token: "cop_abc",
  expires_at: 2000,
  endpoints: { api: "https://api.enterprise.githubcopilot.com" },
};

beforeEach(() => _resetCopilotTokenCache());

describe("getCopilotToken", () => {
  it("exchanges the OAuth token for a Copilot token + endpoint", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(exchangeBody)) as unknown as typeof fetch;
    const cred = await getCopilotToken("gho_x", { fetchImpl, now: () => 0 });
    expect(cred).toEqual({ token: "cop_abc", endpoint: "https://api.enterprise.githubcopilot.com" });
    // sends the OAuth token with the `token` scheme
    const headers = (vi.mocked(fetchImpl).mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("token gho_x");
  });

  it("caches the credential and does not re-exchange within its TTL", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(exchangeBody)) as unknown as typeof fetch;
    await getCopilotToken("gho_x", { fetchImpl, now: () => 0 });
    await getCopilotToken("gho_x", { fetchImpl, now: () => 1_000_000 }); // 1000s < expiry(2000s)-60s
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(1);
  });

  it("re-exchanges once the cached credential is near expiry", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(exchangeBody)) as unknown as typeof fetch;
    await getCopilotToken("gho_x", { fetchImpl, now: () => 0 });
    // 1,990,000ms = 1990s > expiry(2000s) - 60s buffer => refresh
    await getCopilotToken("gho_x", { fetchImpl, now: () => 1_990_000 });
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(2);
  });

  it("throws CopilotError with the HTTP status on failure", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "no" }, 404)) as unknown as typeof fetch;
    await expect(getCopilotToken("gho_x", { fetchImpl, now: () => 0 })).rejects.toMatchObject({
      name: "CopilotError",
      status: 404,
    });
  });

  it("throws when the exchange response lacks a token or endpoint", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ expires_at: 2000 })) as unknown as typeof fetch;
    await expect(getCopilotToken("gho_x", { fetchImpl, now: () => 0 })).rejects.toBeInstanceOf(CopilotError);
  });
});
