# easyIELTS Settings + BYO Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let users supply their **own** API credentials: a Settings page stores a personal Gemini Live API key and a personal GitHub token in the browser. When a user provides their own Gemini key, the live speaking test connects **directly** to Gemini (their quota, owner key untouched). When they provide a GitHub token, writing/speaking evaluations use it. Plus a "clear my data" control.

**Architecture:** A small client-only `settings` store in `localStorage`. The speaking `session` gains a **direct mode** that, given a user Gemini key, connects the browser straight to the Gemini Live WebSocket and runs the protocol with the existing pure helpers (`buildSetupMessage`/`parseServerMessage`/`encodeAudioChunk`/`encodeTextTurn`/`buildExaminerSystemInstruction`) — no proxy. The writing/speaking evaluate routes already accept an optional `token`; the runners now pass the user's stored token. A Settings page surfaces all of this and a data-reset.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind · Vitest + RTL. Verified this session: a browser-style WebSocket to the Gemini Live endpoint with an API key returns examiner audio + transcript (the same protocol the proxy uses).

**Depends on (already on `main`):** `src/lib/speaking/{session,gemini-live,examiner,types}.ts`, `src/components/speaking/SpeakingRunner.tsx`, `src/components/writing/WritingRunner.tsx`, `src/lib/storage/adapter.ts` (`getStorage().clear()`), `src/components/auth/ConnectGitHub.tsx`.

**Security note:** A user's own keys live only in their browser `localStorage` and are sent only to the service they belong to (their Gemini key → Gemini directly; their GitHub token → our evaluate route which forwards it to GitHub Models). The owner's pre-configured keys remain server-side and are never exposed. This matches the spec: user keys are not persisted in our DB.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/settings/settings.ts` | `getSettings`, `saveSettings`, `clearSettings` (localStorage) |
| `src/components/settings/SettingsForm.tsx` | Key inputs, GitHub connect, clear-data (injectable deps) |
| `src/app/settings/page.tsx` | Settings route |
| `src/app/page.tsx` (modify) | Add a Settings link |
| `src/lib/speaking/session.ts` (modify) | Add direct-to-Gemini mode when a user key is supplied |
| `src/components/speaking/SpeakingRunner.tsx` (modify) | Pass user Gemini key + GitHub token |
| `src/components/writing/WritingRunner.tsx` (modify) | Send user GitHub token in evaluate POST |
| `tests/settings/*` | Unit + component tests |

---

## Task 1: Settings store

**Files:** Create `src/lib/settings/settings.ts`, `tests/settings/settings.test.ts`

- [ ] **Step 1: Write the failing test `C:\code\easyIELTS\tests\settings\settings.test.ts`:**
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getSettings, saveSettings, clearSettings } from "@/lib/settings/settings";

beforeEach(() => localStorage.clear());

describe("settings store", () => {
  it("returns empty settings by default", () => {
    expect(getSettings()).toEqual({});
  });

  it("saves and merges settings", () => {
    saveSettings({ geminiApiKey: "g" });
    saveSettings({ githubToken: "t" });
    expect(getSettings()).toEqual({ geminiApiKey: "g", githubToken: "t" });
  });

  it("clears settings", () => {
    saveSettings({ geminiApiKey: "g" });
    clearSettings();
    expect(getSettings()).toEqual({});
  });

  it("tolerates corrupt storage", () => {
    localStorage.setItem("easyielts.settings", "{bad");
    expect(getSettings()).toEqual({});
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.** `npx vitest run tests/settings/settings.test.ts`

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\lib\settings\settings.ts`:**
```ts
export interface UserSettings {
  geminiApiKey?: string;
  githubToken?: string;
}

const KEY = "easyielts.settings";

export function getSettings(): UserSettings {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as UserSettings) : {};
  } catch {
    return {};
  }
}

export function saveSettings(patch: UserSettings): void {
  if (typeof localStorage === "undefined") return;
  const next = { ...getSettings(), ...patch };
  // Drop empty-string values so "unset" is consistent.
  for (const k of Object.keys(next) as (keyof UserSettings)[]) {
    if (!next[k]) delete next[k];
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
}

export function clearSettings(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* best-effort */
  }
}
```

- [ ] **Step 4: Run, confirm PASS. Commit.**
```powershell
cd C:\code\easyIELTS
npx vitest run tests/settings/settings.test.ts
git add src/lib/settings/settings.ts tests/settings/settings.test.ts
git commit -m "feat: user settings store (own Gemini/GitHub keys in localStorage)"
```

---

## Task 2: Direct-to-Gemini speaking mode

**Files:** Modify `src/lib/speaking/session.ts`; Create `tests/speaking/session-mode.test.ts`

- [ ] **Step 1: Add a constant + option for direct mode in `C:\code\easyIELTS\src\lib\speaking\session.ts`.** At the top (after imports) add the client-safe default model and a helper to choose the socket URL, and import the pure helpers:
```ts
import { buildSetupMessage, parseServerMessage, encodeAudioChunk, encodeTextTurn } from "./gemini-live";
import { buildExaminerSystemInstruction } from "./examiner";
import type { SpeakingPart } from "./types";

const DIRECT_GEMINI_MODEL = "gemini-3.1-flash-live-preview";
const GEMINI_WS = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/** Build a function that returns the SpeakingEvent(s) for a raw socket message. */
export interface SpeakingSessionOptions {
  /** If set, connect the browser directly to Gemini (user's own key) instead of the proxy. */
  geminiApiKey?: string;
}
```

- [ ] **Step 2: Change `createSpeakingSession` to accept options and branch on direct vs proxy.** Update its signature and the connection logic. Replace the function signature and the WebSocket-creation + onmessage wiring so that:
  - **Proxy mode (no key):** unchanged — connect to `/ws/speaking?part=`, the server sends events already in `SpeakingEvent` shape, so `ws.onmessage` parses JSON and the message IS the event (current behavior).
  - **Direct mode (key present):** connect to `${GEMINI_WS}?key=${apiKey}`; on open, send `buildSetupMessage(DIRECT_GEMINI_MODEL, buildExaminerSystemInstruction(part as SpeakingPart))`; `ws.onmessage` parses the RAW Gemini message and runs it through `parseServerMessage(...)`, emitting each resulting event (audio → playAudio + onEvent; transcripts/turn/interrupted → onEvent); audio input is sent via `encodeAudioChunk(base64)` and text via `encodeTextTurn(text)` (instead of the proxy's `{type:"audio"|"text"}` envelope).

Concretely, modify the function so the message/translation differs by mode. Use this structure (integrate with the existing teardown/closed/playAudio logic — keep all the resource-cleanup and connecting-window guards from the current file):
```ts
export function createSpeakingSession(
  part: string,
  cb: SessionCallbacks,
  options: SpeakingSessionOptions = {},
): SpeakingSession {
  const direct = Boolean(options.geminiApiKey);
  // ... existing refs: ws, audioCtx, playerCtx, micStream, playerNode, closed ...
  // ... existing releaseResources()/teardown() unchanged ...

  function emit(event: SpeakingEvent) {
    if (event.type === "audio") playAudio(event.data);
    else if (event.type === "interrupted") playerNode?.port.postMessage("flush");
    cb.onEvent(event);
  }

  async function start(): Promise<void> {
    cb.onStatus("connecting");
    try {
      if (direct) {
        ws = new WebSocket(`${GEMINI_WS}?key=${options.geminiApiKey}`);
        ws.onopen = () => {
          if (closed) return;
          ws!.send(JSON.stringify(buildSetupMessage(DIRECT_GEMINI_MODEL, buildExaminerSystemInstruction(part as SpeakingPart))));
          cb.onStatus("live");
        };
        ws.onmessage = (e) => {
          let raw: unknown;
          try { raw = JSON.parse(e.data); } catch { return; }
          if (typeof raw !== "object" || raw === null) return;
          for (const event of parseServerMessage(raw as never)) emit(event);
        };
      } else {
        const proto = location.protocol === "https:" ? "wss" : "ws";
        ws = new WebSocket(`${proto}://${location.host}/ws/speaking?part=${encodeURIComponent(part)}`);
        ws.onopen = () => { if (!closed) cb.onStatus("live"); };
        ws.onmessage = (e) => {
          let event: SpeakingEvent;
          try { event = JSON.parse(e.data); } catch { return; }
          emit(event);
        };
      }
      ws.onclose = () => { teardown(); cb.onStatus("ended"); };
      ws.onerror = () => { teardown(); cb.onStatus("error"); };

      // ... the rest of start() (mic + worklets) is UNCHANGED, including the
      //     post-await `if (closed) { releaseResources(); return; }` guards ...
      //     EXCEPT: when sending mic audio, branch on `direct`:
      //       const payload = direct ? encodeAudioChunk(base64) : { type: "audio", data: base64 };
      //       if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    } catch (err) {
      teardown();
      throw err;
    }
  }

  // sendText: branch on mode
  function sendText(text: string): void {
    if (closed || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(direct ? encodeTextTurn(text) : { type: "text", text }));
  }

  // end(): in direct mode there is no proxy "end" envelope; just close.
  // Keep the existing teardown(); only the proxy benefits from the {type:"end"} hint,
  // which is harmless to skip in direct mode — teardown already closes the socket.
  // ... rest unchanged ...
}
```
IMPORTANT: keep ALL existing teardown/closed/connecting-window-guard/`playAudio` logic intact; only (a) add the `options`/`direct` branch for URL + setup + message parsing, (b) branch the mic-audio and text payloads on `direct`, and (c) export `SpeakingSessionOptions`. The `teardown()`'s `ws?.send({type:"end"})` is fine to keep (Gemini ignores an unknown field / it's a best-effort close hint wrapped in try/catch).

- [ ] **Step 3: Write a lightweight mode test `C:\code\easyIELTS\tests\speaking\session-mode.test.ts`** that verifies URL selection without real audio, by stubbing `WebSocket` and short-circuiting before mic access. Since `start()` calls `getUserMedia` after opening the socket, assert the chosen URL synchronously from the constructed socket:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { createSpeakingSession } from "@/lib/speaking/session";

const urls: string[] = [];
class FakeWS {
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  constructor(url: string) { urls.push(url); }
  send() {}
  close() {}
}

afterEach(() => { vi.unstubAllGlobals(); urls.length = 0; });

describe("speaking session mode", () => {
  it("connects to the proxy when no user key is given", () => {
    vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
    vi.stubGlobal("location", { protocol: "http:", host: "localhost:3000" });
    // getUserMedia will be undefined; we only care about the socket URL chosen synchronously.
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise(() => {}) } });
    createSpeakingSession("1", { onEvent: () => {}, onStatus: () => {} }).start().catch(() => {});
    expect(urls[0]).toContain("/ws/speaking?part=1");
  });

  it("connects directly to Gemini when a user key is given", () => {
    vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise(() => {}) } });
    createSpeakingSession("1", { onEvent: () => {}, onStatus: () => {} }, { geminiApiKey: "USERKEY" }).start().catch(() => {});
    expect(urls[0]).toContain("generativelanguage.googleapis.com");
    expect(urls[0]).toContain("key=USERKEY");
  });
});
```

- [ ] **Step 4: Run, confirm PASS, then full suite.**
```powershell
npx vitest run tests/speaking/session-mode.test.ts
npm run test
```
Expected: mode test passes; full suite green (the existing SpeakingRunner test uses a fake session, unaffected).

- [ ] **Step 5: Commit.**
```powershell
git add src/lib/speaking/session.ts tests/speaking/session-mode.test.ts
git commit -m "feat: direct-to-Gemini speaking mode for users' own keys"
```

---

## Task 3: Pass user keys from the runners

**Files:** Modify `src/components/speaking/SpeakingRunner.tsx`, `src/components/writing/WritingRunner.tsx`

- [ ] **Step 1: SpeakingRunner** — in `C:\code\easyIELTS\src\components\speaking\SpeakingRunner.tsx`, import settings and pass the Gemini key into the session (direct mode) and the GitHub token into scoring. Add:
```tsx
import { getSettings } from "@/lib/settings/settings";
```
In `start()`, when creating the session, pass the user's Gemini key:
```tsx
    const session = createSession(test.part, { onEvent: handleEvent, onStatus: handleStatus }, { geminiApiKey: getSettings().geminiApiKey });
```
Update the `CreateSession` type to accept the optional third arg:
```tsx
type CreateSession = (part: string, cb: SessionCallbacks, options?: { geminiApiKey?: string }) => SpeakingSession;
```
(The default `createSpeakingSession` already has this signature after Task 2. The component test passes a fake `createSession`; make the third arg optional so the existing test still type-checks and runs.)
In `finalize()`, include the user's GitHub token in the evaluate POST body when present:
```tsx
        body: JSON.stringify({ transcript: turnsRef.current, ...(getSettings().githubToken ? { token: getSettings().githubToken } : {}) }),
```

- [ ] **Step 2: WritingRunner** — in `C:\code\easyIELTS\src\components\writing\WritingRunner.tsx`, import `getSettings` and include the user's GitHub token in the evaluate POST. Find the `fetch("/api/writing/evaluate", ...)` body and add the token when present:
```tsx
      body: JSON.stringify({ taskNumber, prompt, response, ...(getSettings().githubToken ? { token: getSettings().githubToken } : {}) }),
```
(Add `import { getSettings } from "@/lib/settings/settings";` at the top. Keep everything else.)

- [ ] **Step 3: Verify the suite still passes (existing runner tests unaffected; they don't set settings, so no token/key is sent).**
```powershell
cd C:\code\easyIELTS
npm run test
```
Expected: green. (The writing route tests and SpeakingRunner test don't populate settings, so behavior is unchanged for them.)

- [ ] **Step 4: Commit.**
```powershell
git add src/components/speaking/SpeakingRunner.tsx src/components/writing/WritingRunner.tsx
git commit -m "feat: runners use the user's own Gemini key and GitHub token when set"
```

---

## Task 4: Settings page + route + verification

**Files:** Create `src/components/settings/SettingsForm.tsx`, `src/app/settings/page.tsx`, `tests/settings/SettingsForm.test.tsx`; Modify `src/app/page.tsx`

- [ ] **Step 1: Write the failing component test `C:\code\easyIELTS\tests\settings\SettingsForm.test.tsx`:**
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { getSettings } from "@/lib/settings/settings";
import { getStorage } from "@/lib/storage/adapter";

beforeEach(() => localStorage.clear());

describe("SettingsForm", () => {
  it("saves the entered Gemini key", async () => {
    render(<SettingsForm />);
    await userEvent.type(screen.getByLabelText(/gemini/i), "my-gemini-key");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(getSettings().geminiApiKey).toBe("my-gemini-key");
  });

  it("clears all local data", async () => {
    localStorage.setItem("easyielts.attempts", "[{}]");
    render(<SettingsForm />);
    await userEvent.click(screen.getByRole("button", { name: /clear all my data/i }));
    expect(getStorage().listAttempts()).toEqual([]);
  });
});
```
(Import `getStorage` from `@/lib/storage/adapter` at the top of the test alongside `getSettings`.)

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\components\settings\SettingsForm.tsx`:**
```tsx
"use client";

import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "@/lib/settings/settings";
import { getStorage } from "@/lib/storage/adapter";
import { ConnectGitHub } from "@/components/auth/ConnectGitHub";

export function SettingsForm() {
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = getSettings();
    setGeminiApiKey(s.geminiApiKey ?? "");
    setGithubToken(s.githubToken ?? "");
  }, []);

  function save() {
    saveSettings({ geminiApiKey, githubToken });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function clearData() {
    getStorage().clear();
    saveSettings({ geminiApiKey: "", githubToken: "" });
    setGeminiApiKey("");
    setGithubToken("");
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-xl border border-gray-200 p-5 dark:border-gray-700">
        <h2 className="text-lg font-semibold">Your API keys (optional)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Stored only in this browser. Your Gemini key connects the speaking test directly to Google (your quota);
          your GitHub token is used for writing &amp; speaking feedback. Leave blank to use the shared, rate-limited service.
        </p>
        <label className="text-sm font-medium" htmlFor="gemini">Gemini Live API key</label>
        <input id="gemini" type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" placeholder="AIza…" />
        <label className="text-sm font-medium" htmlFor="ghtoken">GitHub token (models:read)</label>
        <input id="ghtoken" type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" placeholder="ghp_… or gho_…" />
        <div className="flex items-center gap-3">
          <button onClick={save} className="self-start rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Save settings
          </button>
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Or connect GitHub with a device code</h2>
        <ConnectGitHub />
      </section>

      <section className="rounded-xl border border-red-200 p-5 dark:border-red-900">
        <h2 className="text-lg font-semibold">Reset</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">Remove your saved keys and all practice history from this browser.</p>
        <button onClick={clearData} className="mt-3 self-start rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">
          Clear all my data
        </button>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm PASS.** `npx vitest run tests/settings/SettingsForm.test.tsx`

- [ ] **Step 5: Create `C:\code\easyIELTS\src\app\settings\page.tsx`:**
```tsx
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata = { title: "Settings — easyIELTS" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">Bring your own keys and manage your data.</p>
      </header>
      <SettingsForm />
    </main>
  );
}
```

- [ ] **Step 6: Add a Settings link on the landing page.** In `C:\code\easyIELTS\src\app\page.tsx`, near the other header links add:
```tsx
        <a href="/settings" className="mt-2 inline-block text-sm text-indigo-600 underline">
          Settings &amp; your API keys →
        </a>
```
(Keep everything else; the landing-page test must still pass.)

- [ ] **Step 7: Full verification.**
```powershell
cd C:\code\easyIELTS
npm run test
npm run lint
npm run build
```
Expected: all tests pass (incl. settings suites), lint exit 0 no warnings, build compiles with `/settings`.

- [ ] **Step 8: Server smoke test.** Use `npm.cmd` if `Start-Process npm` fails; track/stop only the PID you start.
```powershell
cd C:\code\easyIELTS
$before = (Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$p = Start-Process npm.cmd -ArgumentList "run","start" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 16
try { Write-Output ("settings=" + (Invoke-WebRequest http://localhost:3000/settings -UseBasicParsing -TimeoutSec 5).StatusCode) }
finally {
  $after = (Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  foreach ($id in $after) { if ($before -notcontains $id) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }
}
```
Expected: `settings=200`.

- [ ] **Step 9: Commit.**
```powershell
git add src/components/settings/SettingsForm.tsx src/app/settings/page.tsx src/app/page.tsx tests/settings/SettingsForm.test.tsx
git commit -m "feat: settings page (BYO keys, GitHub connect, clear data)"
```

---

## Done criteria

- `/settings` lets a user store their own Gemini key + GitHub token (browser-only) and clear all data; GitHub device-flow connect is also available.
- With a Gemini key set, the speaking test connects directly to Gemini (their quota); with a GitHub token set, writing/speaking evaluations send it. Without either, the shared rate-limited owner path is used.
- `npm run test` / `lint` / `build` green; `/settings` serves 200.
- User keys are never persisted server-side; owner keys remain server-only.

## Notes

- Direct-mode Gemini was verified this session at the protocol level (browser-style WebSocket to the Live endpoint with a key returns examiner audio + transcript). Full mic E2E requires a real browser.
- Content generation (unlimited AI-authored tests) + local PDF import remain optional future enhancements; the app ships with original seed tests for every skill.
