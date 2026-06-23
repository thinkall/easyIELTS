import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { POST as login } from "@/app/api/admin/login/route";
import { GET as status } from "@/app/api/admin/status/route";
import { POST as setGemini, DELETE as unsetGemini } from "@/app/api/admin/gemini/route";
import { POST as disconnectCopilot } from "@/app/api/admin/copilot/disconnect/route";
import { POST as setModel, DELETE as unsetModel } from "@/app/api/admin/model/route";
import { adminCookieValue } from "@/server/admin-auth";

let dir: string;
let prevCwd: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "eielts-admin-"));
  prevCwd = process.cwd();
  process.chdir(dir);
  vi.stubEnv("ADMIN_PASSWORD", "s3cret");
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => {
  process.chdir(prevCwd);
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function req(body?: unknown, cookie?: string) {
  return new Request("http://x/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
function adminCookie() {
  return `eielts_admin=${encodeURIComponent(adminCookieValue())}`;
}

describe("admin login", () => {
  it("rejects a wrong password", async () => {
    const res = await login(req({ password: "nope" }));
    expect(res.status).toBe(401);
  });
  it("accepts the right password and sets the admin cookie", async () => {
    const res = await login(req({ password: "s3cret" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("eielts_admin=");
  });
  it("401s when no admin password is configured", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    const res = await login(req({ password: "anything" }));
    expect(res.status).toBe(401);
  });
});

describe("admin status", () => {
  it("reports unauthenticated without a valid cookie", async () => {
    const res = await status(new Request("http://x/api/admin/status"));
    const data = await res.json();
    expect(data.adminConfigured).toBe(true);
    expect(data.authenticated).toBe(false);
  });
  it("reports credential status when authenticated", async () => {
    vi.stubEnv("EASYIELTS_SHARED_COPILOT_TOKEN", "gho_shared");
    vi.stubEnv("GEMINI_API_KEY", "AIzaKEY1234");
    const res = await status(new Request("http://x/api/admin/status", { headers: { cookie: adminCookie() } }));
    const data = await res.json();
    expect(data.authenticated).toBe(true);
    expect(data.copilot.connected).toBe(true);
    expect(data.gemini.set).toBe(true);
    expect(data.gemini.hint).toContain("1234");
  });
});

describe("admin gemini set/unset", () => {
  it("requires authentication", async () => {
    const res = await setGemini(req({ key: "k" }));
    expect(res.status).toBe(401);
  });
  it("writes the key to .env and process.env", async () => {
    const res = await setGemini(req({ key: "AIzaNEWKEY" }, adminCookie()));
    expect(res.status).toBe(200);
    expect(process.env.GEMINI_API_KEY).toBe("AIzaNEWKEY");
    expect(readFileSync(join(dir, ".env"), "utf8")).toContain("GEMINI_API_KEY=AIzaNEWKEY");
  });
  it("removes the key on DELETE", async () => {
    writeFileSync(join(dir, ".env"), "GEMINI_API_KEY=old\n");
    process.env.GEMINI_API_KEY = "old";
    const res = await unsetGemini(req(undefined, adminCookie()));
    expect(res.status).toBe(200);
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    expect(readFileSync(join(dir, ".env"), "utf8")).not.toContain("GEMINI_API_KEY=");
  });
});

describe("admin copilot disconnect", () => {
  it("requires authentication", async () => {
    const res = await disconnectCopilot(req());
    expect(res.status).toBe(401);
  });
  it("removes the shared copilot token", async () => {
    writeFileSync(join(dir, ".env"), "EASYIELTS_SHARED_COPILOT_TOKEN=gho_shared\n");
    process.env.EASYIELTS_SHARED_COPILOT_TOKEN = "gho_shared";
    const res = await disconnectCopilot(req(undefined, adminCookie()));
    expect(res.status).toBe(200);
    expect(process.env.EASYIELTS_SHARED_COPILOT_TOKEN).toBeUndefined();
    expect(existsSync(join(dir, ".env"))).toBe(true);
  });
});

describe("admin shared model set/unset", () => {
  it("requires authentication", async () => {
    const res = await setModel(req({ model: "gpt-5.5" }));
    expect(res.status).toBe(401);
  });
  it("writes the selected model to .env and process.env", async () => {
    const res = await setModel(req({ model: "claude-opus-4.8" }, adminCookie()));
    expect(res.status).toBe(200);
    expect(process.env.EASYIELTS_SHARED_MODEL).toBe("claude-opus-4.8");
    expect(readFileSync(join(dir, ".env"), "utf8")).toContain("EASYIELTS_SHARED_MODEL=claude-opus-4.8");
  });
  it("removes the model on DELETE", async () => {
    writeFileSync(join(dir, ".env"), "EASYIELTS_SHARED_MODEL=gpt-5.5\n");
    process.env.EASYIELTS_SHARED_MODEL = "gpt-5.5";
    const res = await unsetModel(req(undefined, adminCookie()));
    expect(res.status).toBe(200);
    expect(process.env.EASYIELTS_SHARED_MODEL).toBeUndefined();
  });
});
