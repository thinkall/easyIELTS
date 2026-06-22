import { describe, it, expect, vi, afterEach } from "vitest";
import { POST as start } from "@/app/api/auth/github/start/route";
import { POST as poll } from "@/app/api/auth/github/poll/route";
import { GET as status } from "@/app/api/auth/github/status/route";

afterEach(() => vi.unstubAllGlobals());

function mockFetch(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) })));
}

describe("github auth routes", () => {
  it("start returns a user code and sets the device cookie", async () => {
    mockFetch({ device_code: "dc", user_code: "WXYZ-9999", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 });
    const res = await start();
    const json = await res.json();
    expect(json.userCode).toBe("WXYZ-9999");
    expect(res.headers.get("set-cookie")).toContain("eielts_ghdev=dc");
  });

  it("poll sets the token cookie on success", async () => {
    mockFetch({ access_token: "gho_abc" });
    const req = new Request("http://x/api/auth/github/poll", { method: "POST", headers: { cookie: "eielts_ghdev=dc" } });
    const res = await poll(req);
    expect((await res.json()).status).toBe("connected");
    expect(res.headers.get("set-cookie")).toContain("eielts_gh=gho_abc");
  });

  it("status reflects the token cookie", async () => {
    const connected = await status(new Request("http://x", { headers: { cookie: "eielts_gh=gho_abc" } }));
    expect((await connected.json()).connected).toBe(true);
    const anon = await status(new Request("http://x"));
    expect((await anon.json()).connected).toBe(false);
  });
});
