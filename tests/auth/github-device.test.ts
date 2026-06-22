import { describe, it, expect, vi } from "vitest";
import { requestDeviceCode, pollAccessToken } from "@/server/github-device";

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}

describe("requestDeviceCode", () => {
  it("returns the user code and verification uri", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ device_code: "dc", user_code: "ABCD-1234", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 }),
    ) as unknown as typeof fetch;
    const result = await requestDeviceCode("client123", fetchImpl);
    expect(result.userCode).toBe("ABCD-1234");
    expect(result.deviceCode).toBe("dc");
    expect(result.verificationUri).toContain("github.com/login/device");
    expect(result.interval).toBe(5);
  });
});

describe("pollAccessToken", () => {
  it("returns the access token on success", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ access_token: "gho_x", token_type: "bearer" })) as unknown as typeof fetch;
    const result = await pollAccessToken("dc", "client123", fetchImpl);
    expect(result).toEqual({ status: "connected", accessToken: "gho_x" });
  });

  it("reports pending while the user has not authorized", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "authorization_pending" })) as unknown as typeof fetch;
    const result = await pollAccessToken("dc", "client123", fetchImpl);
    expect(result).toEqual({ status: "pending" });
  });

  it("reports an error on a non-OK HTTP response", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => "err" })) as unknown as typeof fetch;
    const result = await pollAccessToken("dc", "client123", fetchImpl);
    expect(result.status).toBe("error");
  });

  it("does not parse JSON from a non-OK HTTP response", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error("html response");
      },
      text: async () => "err",
    })) as unknown as typeof fetch;
    const result = await pollAccessToken("dc", "client123", fetchImpl);
    expect(result).toEqual({ status: "error", error: "http_503" });
  });

  it("reports an error for terminal failures", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "expired_token" })) as unknown as typeof fetch;
    const result = await pollAccessToken("dc", "client123", fetchImpl);
    expect(result.status).toBe("error");
  });
});
