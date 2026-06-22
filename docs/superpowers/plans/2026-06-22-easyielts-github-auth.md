# easyIELTS GitHub Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make GitHub-hosted LLM access work without a personal access token: a server token resolver (per-user token → owner env key → local `gh` CLI fallback) and a GitHub OAuth **device-flow** sign-in, then wire the Writing evaluation route to use them.

**Architecture:** All server-only. `github-token.ts` resolves the credential used for GitHub Models calls, falling back to `gh auth token` in development so the owner needs zero config. `github-device.ts` implements the OAuth device flow (request code → poll for token). Cookie-based auth routes let any deployed user "sign in with a device code"; their token is stored in an httpOnly cookie and used for their own quota. The Writing route prefers a user credential (body token or cookie) and otherwise uses the shared owner/CLI token under the existing rate limit.

**Tech Stack:** Next.js 16 route handlers · TypeScript · zod · `node:child_process` (gh CLI) · Vitest (mock `fetch`, inject deps — no real network in tests).

**Verified facts (this session):** `gh auth token` works directly against `https://models.github.ai/inference/chat/completions` (200). Valid model ids include `openai/gpt-4.1`, `openai/gpt-4o`, `openai/gpt-5`. The GitHub CLI OAuth client id `178c6fc778ccc68e1d6a` supports the device flow.

**Depends on (already on `main`):** `src/lib/env.ts`, `src/server/github-models.ts` (`chatJson`), `src/server/rate-limit.ts`, `src/app/api/writing/evaluate/route.ts`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/env.ts` (modify) | Add `GITHUB_OAUTH_CLIENT_ID` (default = gh CLI id) |
| `src/server/github-token.ts` | `resolveServerToken()` (env → dev `gh` CLI, cached, injectable) |
| `src/server/github-device.ts` | `requestDeviceCode()`, `pollAccessToken()` (injectable fetch) |
| `src/server/cookies.ts` | `getCookie(req,name)`, `serializeCookie(...)` (testable, no next/headers) |
| `src/app/api/auth/github/start/route.ts` | Begin device flow, set device cookie |
| `src/app/api/auth/github/poll/route.ts` | Poll; on success set token cookie |
| `src/app/api/auth/github/status/route.ts` | Report connected state |
| `src/app/api/auth/github/logout/route.ts` | Clear token cookie |
| `src/app/api/writing/evaluate/route.ts` (modify) | Use credential resolver (cookie/body/shared) |
| `src/components/auth/ConnectGitHub.tsx` | Device-flow sign-in UI |
| `src/app/connect/page.tsx` | Hosts ConnectGitHub |
| `src/app/page.tsx` (modify) | Add a "Connect GitHub" link |
| `tests/auth/*` | Unit + route tests |

---

## Task 1: Server token resolver (gh CLI fallback)

**Files:** Modify `src/lib/env.ts`; Create `src/server/github-token.ts`, `tests/auth/github-token.test.ts`

- [ ] **Step 1: Add the OAuth client id to `C:\code\easyIELTS\src\lib\env.ts`.** Inside the `z.object({ ... })`, add (alongside the existing keys):
```ts
  // GitHub OAuth app client id for the device flow. Defaults to the GitHub CLI
  // public client id, which supports device flow out of the box.
  GITHUB_OAUTH_CLIENT_ID: z.string().default("178c6fc778ccc68e1d6a"),
```
(Keep everything else. The `parseEnv` empty-string coercion already handles a blank override.)

- [ ] **Step 2: Write the failing test `C:\code\easyIELTS\tests\auth\github-token.test.ts`:**
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveServerToken, _resetTokenCache } from "@/server/github-token";

beforeEach(() => _resetTokenCache());

describe("resolveServerToken", () => {
  it("prefers the configured owner token", async () => {
    const runGhCli = vi.fn(async () => "gh-cli-token");
    const token = await resolveServerToken({
      env: { GITHUB_MODELS_TOKEN: "owner", NODE_ENV: "production" },
      runGhCli,
    });
    expect(token).toBe("owner");
    expect(runGhCli).not.toHaveBeenCalled();
  });

  it("falls back to the gh CLI in development when no owner token", async () => {
    const runGhCli = vi.fn(async () => "gh-cli-token");
    const token = await resolveServerToken({
      env: { GITHUB_MODELS_TOKEN: undefined, NODE_ENV: "development" },
      runGhCli,
    });
    expect(token).toBe("gh-cli-token");
  });

  it("does NOT use the gh CLI in production", async () => {
    const runGhCli = vi.fn(async () => "gh-cli-token");
    const token = await resolveServerToken({
      env: { GITHUB_MODELS_TOKEN: undefined, NODE_ENV: "production" },
      runGhCli,
    });
    expect(token).toBeUndefined();
    expect(runGhCli).not.toHaveBeenCalled();
  });

  it("does NOT use the gh CLI in the test environment", async () => {
    const runGhCli = vi.fn(async () => "gh-cli-token");
    const token = await resolveServerToken({
      env: { GITHUB_MODELS_TOKEN: undefined, NODE_ENV: "test" },
      runGhCli,
    });
    expect(token).toBeUndefined();
    expect(runGhCli).not.toHaveBeenCalled();
  });

  it("caches the gh CLI result", async () => {
    const runGhCli = vi.fn(async () => "gh-cli-token");
    const env = { GITHUB_MODELS_TOKEN: undefined, NODE_ENV: "development" } as const;
    await resolveServerToken({ env, runGhCli });
    await resolveServerToken({ env, runGhCli });
    expect(runGhCli).toHaveBeenCalledTimes(1);
  });

  it("returns undefined if the gh CLI errors", async () => {
    const runGhCli = vi.fn(async () => { throw new Error("not installed"); });
    const token = await resolveServerToken({
      env: { GITHUB_MODELS_TOKEN: undefined, NODE_ENV: "development" },
      runGhCli,
    });
    expect(token).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run, confirm FAIL.** `npx vitest run tests/auth/github-token.test.ts`

- [ ] **Step 4: Implement `C:\code\easyIELTS\src\server\github-token.ts`:**
```ts
import "server-only";
import { execFile } from "node:child_process";
import { env } from "@/lib/env";

export type RunGhCli = () => Promise<string>;

const defaultRunGhCli: RunGhCli = () =>
  new Promise((resolve, reject) => {
    execFile("gh", ["auth", "token"], { timeout: 5000 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout.trim());
    });
  });

interface ResolveDeps {
  env?: { GITHUB_MODELS_TOKEN?: string; NODE_ENV?: string };
  runGhCli?: RunGhCli;
}

let cachedCliToken: string | undefined;
let cliAttempted = false;

/** Test helper: clear the gh CLI token cache. */
export function _resetTokenCache(): void {
  cachedCliToken = undefined;
  cliAttempted = false;
}

/**
 * Resolve the GitHub token used for shared (owner) GitHub Models calls:
 * the configured owner token, or — in development only — the local `gh` CLI
 * token (so the owner needs zero config). Returns undefined if none is available.
 */
export async function resolveServerToken(deps: ResolveDeps = {}): Promise<string | undefined> {
  const resolvedEnv = deps.env ?? { GITHUB_MODELS_TOKEN: env.GITHUB_MODELS_TOKEN, NODE_ENV: env.NODE_ENV };
  if (resolvedEnv.GITHUB_MODELS_TOKEN) return resolvedEnv.GITHUB_MODELS_TOKEN;
  // gh CLI fallback is for local development ONLY (never test or production),
  // so tests never shell out and deployments never depend on a local CLI.
  if (resolvedEnv.NODE_ENV !== "development") return undefined;

  if (cliAttempted) return cachedCliToken;
  cliAttempted = true;
  try {
    const token = await (deps.runGhCli ?? defaultRunGhCli)();
    cachedCliToken = token && token.length > 0 ? token : undefined;
  } catch {
    cachedCliToken = undefined;
  }
  return cachedCliToken;
}
```

- [ ] **Step 5: Run, confirm PASS. Commit.**
```powershell
cd C:\code\easyIELTS
npx vitest run tests/auth/github-token.test.ts
git add src/lib/env.ts src/server/github-token.ts tests/auth/github-token.test.ts
git commit -m "feat: server GitHub token resolver with gh CLI dev fallback"
```

---

## Task 2: Device-flow client

**Files:** Create `src/server/github-device.ts`, `tests/auth/github-device.test.ts`

- [ ] **Step 1: Write the failing test `C:\code\easyIELTS\tests\auth\github-device.test.ts`:**
```ts
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

  it("reports an error for terminal failures", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "expired_token" })) as unknown as typeof fetch;
    const result = await pollAccessToken("dc", "client123", fetchImpl);
    expect(result.status).toBe("error");
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\server\github-device.ts`:**
```ts
import "server-only";

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export type PollResult =
  | { status: "connected"; accessToken: string }
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "error"; error: string };

/** Begin the OAuth device flow. `scope` defaults to read:user (enough for Models). */
export async function requestDeviceCode(
  clientId: string,
  fetchImpl: typeof fetch = fetch,
  scope = "read:user",
): Promise<DeviceCode> {
  const res = await fetchImpl(DEVICE_CODE_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, scope }),
  });
  if (!res.ok) throw new Error(`Device code request failed (${res.status})`);
  const data = (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}

/** Poll once for the access token. Caller waits `interval` seconds between calls. */
export async function pollAccessToken(
  deviceCode: string,
  clientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PollResult> {
  const res = await fetchImpl(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (data.access_token) return { status: "connected", accessToken: data.access_token };
  if (data.error === "authorization_pending") return { status: "pending" };
  if (data.error === "slow_down") return { status: "slow_down" };
  return { status: "error", error: data.error ?? "unknown_error" };
}
```

- [ ] **Step 4: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/auth/github-device.test.ts
git add src/server/github-device.ts tests/auth/github-device.test.ts
git commit -m "feat: GitHub OAuth device-flow client"
```

---

## Task 3: Cookie helpers + auth routes

**Files:** Create `src/server/cookies.ts`, `src/app/api/auth/github/start/route.ts`, `.../poll/route.ts`, `.../status/route.ts`, `.../logout/route.ts`, `tests/auth/cookies.test.ts`, `tests/auth/auth-routes.test.ts`

- [ ] **Step 1: Write `C:\code\easyIELTS\tests\auth\cookies.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { getCookie, serializeCookie } from "@/server/cookies";

describe("cookies", () => {
  it("reads a named cookie from a request", () => {
    const req = new Request("http://x", { headers: { cookie: "a=1; eielts_gh=tok123; b=2" } });
    expect(getCookie(req, "eielts_gh")).toBe("tok123");
    expect(getCookie(req, "missing")).toBeUndefined();
  });

  it("serializes an httpOnly cookie with attributes", () => {
    const c = serializeCookie("eielts_gh", "tok", { maxAge: 60, httpOnly: true, secure: true });
    expect(c).toContain("eielts_gh=tok");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Max-Age=60");
    expect(c).toContain("Path=/");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Secure");
  });

  it("serializes an expiring (cleared) cookie with Max-Age=0", () => {
    expect(serializeCookie("eielts_gh", "", { maxAge: 0 })).toContain("Max-Age=0");
  });
});
```

- [ ] **Step 2: Implement `C:\code\easyIELTS\src\server\cookies.ts`:**
```ts
import "server-only";

export function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export interface CookieOptions {
  maxAge: number;
  httpOnly?: boolean;
  secure?: boolean;
}

export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${options.maxAge}`,
  ];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}
```

- [ ] **Step 3: Run cookie test, confirm PASS.** `npx vitest run tests/auth/cookies.test.ts`

- [ ] **Step 4: Implement the four routes.**

`C:\code\easyIELTS\src\app\api\auth\github\start\route.ts`:
```ts
import { requestDeviceCode } from "@/server/github-device";
import { serializeCookie } from "@/server/cookies";
import { env } from "@/lib/env";

export async function POST() {
  try {
    const code = await requestDeviceCode(env.GITHUB_OAUTH_CLIENT_ID);
    const cookie = serializeCookie("eielts_ghdev", code.deviceCode, {
      maxAge: code.expiresIn,
      httpOnly: true,
      secure: env.NODE_ENV === "production",
    });
    return Response.json(
      { userCode: code.userCode, verificationUri: code.verificationUri, interval: code.interval, expiresIn: code.expiresIn },
      { headers: { "Set-Cookie": cookie } },
    );
  } catch {
    return Response.json({ error: "Could not start GitHub sign-in." }, { status: 502 });
  }
}
```

`C:\code\easyIELTS\src\app\api\auth\github\poll\route.ts`:
```ts
import { pollAccessToken } from "@/server/github-device";
import { getCookie, serializeCookie } from "@/server/cookies";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const deviceCode = getCookie(request, "eielts_ghdev");
  if (!deviceCode) return Response.json({ status: "error", error: "no_device_code" }, { status: 400 });

  const result = await pollAccessToken(deviceCode, env.GITHUB_OAUTH_CLIENT_ID);
  if (result.status === "connected") {
    const secure = env.NODE_ENV === "production";
    const headers = new Headers();
    headers.append("Set-Cookie", serializeCookie("eielts_gh", result.accessToken, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, secure }));
    headers.append("Set-Cookie", serializeCookie("eielts_ghdev", "", { maxAge: 0, httpOnly: true, secure }));
    return Response.json({ status: "connected" }, { headers });
  }
  return Response.json({ status: result.status });
}
```

`C:\code\easyIELTS\src\app\api\auth\github\status\route.ts`:
```ts
import { getCookie } from "@/server/cookies";

export async function GET(request: Request) {
  return Response.json({ connected: Boolean(getCookie(request, "eielts_gh")) });
}
```

`C:\code\easyIELTS\src\app\api\auth\github\logout\route.ts`:
```ts
import { serializeCookie } from "@/server/cookies";
import { env } from "@/lib/env";

export async function POST() {
  const cookie = serializeCookie("eielts_gh", "", { maxAge: 0, httpOnly: true, secure: env.NODE_ENV === "production" });
  return Response.json({ status: "disconnected" }, { headers: { "Set-Cookie": cookie } });
}
```

- [ ] **Step 5: Write `C:\code\easyIELTS\tests\auth\auth-routes.test.ts`** (mock fetch; verify cookies):
```ts
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
```

- [ ] **Step 6: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/auth/cookies.test.ts tests/auth/auth-routes.test.ts
git add src/server/cookies.ts "src/app/api/auth/github/start/route.ts" "src/app/api/auth/github/poll/route.ts" "src/app/api/auth/github/status/route.ts" "src/app/api/auth/github/logout/route.ts" tests/auth/cookies.test.ts tests/auth/auth-routes.test.ts
git commit -m "feat: cookie helpers and GitHub device-flow auth routes"
```

---

## Task 4: Wire the Writing route to the credential resolver

**Files:** Modify `src/app/api/writing/evaluate/route.ts`; Create `tests/writing/route-credential.test.ts`

- [ ] **Step 1: Replace `C:\code\easyIELTS\src\app\api\writing\evaluate\route.ts` with:**
```ts
import { z } from "zod";
import { evaluateWritingTask } from "@/lib/writing/evaluate";
import { chatJson, GitHubModelsError } from "@/server/github-models";
import { resolveServerToken } from "@/server/github-token";
import { getCookie } from "@/server/cookies";
import { rateLimit } from "@/server/rate-limit";

const bodySchema = z.object({
  taskNumber: z.union([z.literal(1), z.literal(2)]),
  prompt: z.string().min(1),
  response: z.string().min(1),
  token: z.string().optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Prefer a user-supplied credential (own quota, no shared rate limit):
  // explicit body token, then the device-flow cookie. Otherwise use the shared
  // owner/CLI token under the rate limit.
  const userToken = body.token ?? getCookie(request, "eielts_gh");
  let token = userToken;
  if (!token) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    const limit = rateLimit(`writing:${ip}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return Response.json(
        { error: "Rate limit reached for shared evaluations. Sign in with GitHub or use your own token." },
        { status: 429 },
      );
    }
    token = await resolveServerToken();
  }

  try {
    const result = await evaluateWritingTask(
      { taskNumber: body.taskNumber, prompt: body.prompt, response: body.response },
      (options) => chatJson({ ...options, token }),
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof GitHubModelsError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Evaluation failed." }, { status: 500 });
  }
}
```
(`chatJson` already throws 503 when `token` is undefined, so the no-credential case is handled.)

- [ ] **Step 2: Confirm the existing writing route tests still pass** (they pass `token: "t"`, so they bypass the resolver and rate limiter):
```powershell
npx vitest run tests/writing/route.test.ts
```
Expected: still green.

- [ ] **Step 3: Write `C:\code\easyIELTS\tests\writing\route-credential.test.ts`** (cookie credential bypasses the rate limit):
```ts
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { POST } from "@/app/api/writing/evaluate/route";
import { _resetRateLimitStore } from "@/server/rate-limit";

beforeEach(() => _resetRateLimitStore());
afterEach(() => vi.unstubAllGlobals());

const llmContent = JSON.stringify({
  criteria: { taskResponse: 7, coherenceCohesion: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7 },
  feedback: { strengths: [], improvements: [], correctedExamples: [] },
  modelAnswer: "m",
});

function mockModelOk() {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true, status: 200, json: async () => ({ choices: [{ message: { content: llmContent } }] }), text: async () => llmContent,
  })));
}

function req(cookie?: string) {
  return new Request("http://x/api/writing/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ taskNumber: 2, prompt: "p", response: "a b c" }),
  });
}

describe("writing route credential resolution", () => {
  it("uses the device-flow cookie token and is NOT rate-limited", async () => {
    mockModelOk();
    // 12 calls with a cookie credential; none should hit the 10/hr shared limit.
    for (let i = 0; i < 12; i++) {
      const res = await POST(req("eielts_gh=gho_user"));
      expect(res.status).toBe(200);
    }
  });
});
```

- [ ] **Step 4: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/writing/route-credential.test.ts
git add "src/app/api/writing/evaluate/route.ts" tests/writing/route-credential.test.ts
git commit -m "feat: writing route resolves credential from cookie/owner/CLI"
```

---

## Task 5: Connect UI + live verification

**Files:** Create `src/components/auth/ConnectGitHub.tsx`, `src/app/connect/page.tsx`; Modify `src/app/page.tsx`

- [ ] **Step 1: Create `C:\code\easyIELTS\src\components\auth\ConnectGitHub.tsx`:**
```tsx
"use client";

import { useEffect, useState } from "react";

type Phase = "idle" | "awaiting" | "connected" | "error";

export function ConnectGitHub() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [userCode, setUserCode] = useState("");
  const [verifyUri, setVerifyUri] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/github/status")
      .then((r) => r.json())
      .then((d) => { if (d.connected) setPhase("connected"); })
      .catch(() => {});
  }, []);

  async function start() {
    setMessage("");
    const res = await fetch("/api/auth/github/start", { method: "POST" });
    if (!res.ok) { setPhase("error"); setMessage("Could not start sign-in."); return; }
    const data = await res.json();
    setUserCode(data.userCode);
    setVerifyUri(data.verificationUri);
    setPhase("awaiting");
    poll(data.interval ?? 5, data.expiresIn ?? 900);
  }

  function poll(intervalSec: number, expiresIn: number) {
    const deadline = Date.now() + expiresIn * 1000;
    const tick = async () => {
      if (Date.now() > deadline) { setPhase("error"); setMessage("Code expired. Try again."); return; }
      const res = await fetch("/api/auth/github/poll", { method: "POST" });
      const data = await res.json();
      if (data.status === "connected") { setPhase("connected"); return; }
      if (data.status === "error") { setPhase("error"); setMessage("Sign-in failed. Try again."); return; }
      setTimeout(tick, intervalSec * 1000);
    };
    setTimeout(tick, intervalSec * 1000);
  }

  async function logout() {
    await fetch("/api/auth/github/logout", { method: "POST" });
    setPhase("idle");
  }

  if (phase === "connected") {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
        <p className="font-medium text-green-800 dark:text-green-200">✓ GitHub Copilot connected</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Writing &amp; speaking feedback will use your GitHub account.</p>
        <button onClick={logout} className="mt-3 text-sm text-red-600 underline">Disconnect</button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h2 className="text-lg font-semibold">Connect GitHub Copilot</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        Sign in with a device code to use your GitHub account for AI writing &amp; speaking feedback.
      </p>
      {phase === "idle" || phase === "error" ? (
        <>
          <button onClick={start} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Connect with device code
          </button>
          {message && <p className="mt-2 text-sm text-red-600">{message}</p>}
        </>
      ) : (
        <div className="mt-3 text-sm">
          <p>1. Open <a className="text-indigo-600 underline" href={verifyUri} target="_blank" rel="noreferrer">{verifyUri}</a></p>
          <p className="mt-1">2. Enter this code:</p>
          <p className="mt-1 font-mono text-2xl tracking-widest">{userCode}</p>
          <p className="mt-2 text-gray-500">Waiting for authorization…</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `C:\code\easyIELTS\src\app\connect\page.tsx`:**
```tsx
import { ConnectGitHub } from "@/components/auth/ConnectGitHub";

export const metadata = { title: "Connect GitHub — easyIELTS" };

export default function ConnectPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Connect your account</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Optional. Without connecting, shared AI feedback is rate-limited.
        </p>
      </header>
      <ConnectGitHub />
    </main>
  );
}
```

- [ ] **Step 3: Add a "Connect GitHub" link on the landing page.** In `C:\code\easyIELTS\src\app\page.tsx`, add a link in the header area (after the intro paragraph), e.g.:
```tsx
        <a href="/connect" className="mt-2 inline-block text-sm text-indigo-600 underline">
          Connect GitHub Copilot for AI feedback →
        </a>
```
(Keep the existing heading/paragraph and the SKILLS grid. The landing-page test must still pass.)

- [ ] **Step 4: Full verification.**
```powershell
cd C:\code\easyIELTS
npm run test
npm run lint
npm run build
```
Expected: all tests pass (incl. the new auth suites), lint exit 0 no warnings, build compiles with `/connect`, `/api/auth/github/*` routes.

- [ ] **Step 5: LIVE verification of the gh-CLI fallback through the real Writing route.** With no `GITHUB_MODELS_TOKEN` configured, the dev server should resolve the owner's `gh` CLI token and evaluate a real essay. Use a NON-reserved variable; track and stop only PIDs you start.
```powershell
cd C:\code\easyIELTS
$before = (Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$p = Start-Process npm -ArgumentList "run","dev" -PassThru -WindowStyle Hidden  # dev => NODE_ENV development => gh CLI fallback enabled
Start-Sleep -Seconds 18
$essay = "Many people believe children should learn to manage money early, while others think it is an adult responsibility. In my view, teaching children about money from a young age is beneficial because it builds discipline. For example, a child given an allowance learns to prioritise. However, parents must guide them. In conclusion, early financial education, supported by adults, prepares young people for the future."
$body = @{ taskNumber = 2; prompt = "Discuss both views and give your opinion about teaching children to manage money."; response = $essay } | ConvertTo-Json
try {
  $r = Invoke-WebRequest -Uri "http://localhost:3000/api/writing/evaluate" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 90
  $j = $r.Content | ConvertFrom-Json
  Write-Output ("HTTP " + $r.StatusCode + " taskBand=" + $j.taskBand + " words=" + $j.wordCount + " modelAnswerChars=" + $j.modelAnswer.Length)
} catch {
  Write-Output ("FAILED status: " + $_.Exception.Response.StatusCode.value__)
} finally {
  $after = (Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  foreach ($id in $after) { if ($before -notcontains $id) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }
}
```
Expected: `HTTP 200 taskBand=<a band 4-9> words≈64 modelAnswerChars>50` — proving the gh-CLI fallback drives a real evaluation with zero token config. (If `gh` is not installed/authed in the run environment, this returns 503; in that case rely on the unit tests and note it.)

- [ ] **Step 6: Commit.**
```powershell
git add src/components/auth/ConnectGitHub.tsx src/app/connect/page.tsx src/app/page.tsx
git commit -m "feat: GitHub Copilot connect UI and device-code page"
```

---

## Done criteria

- Writing evaluation works with **no PAT**: locally via the owner's `gh` CLI token; for any user via device-code sign-in (cookie token, own quota); shared owner path remains rate-limited.
- `/connect` runs the device flow; `/api/auth/github/*` start/poll/status/logout work; the Writing route resolves the credential from body token → cookie → shared owner/CLI.
- `npm run test` / `lint` / `build` green; all tests use mocks (no network/key). Live gh-CLI evaluation verified through the running server.

## Notes for later plans

- The Settings UI (paste your own token, manage Gemini key) belongs to the Persistence/Dashboard plan; this plan provides the device-flow + cookie mechanism it will surface.
- The Speaking plan reuses `resolveServerToken` for transcript scoring via GitHub Models.
- For production device flow, the owner may set `GITHUB_OAUTH_CLIENT_ID` to their own OAuth app; it defaults to the GitHub CLI client id.
