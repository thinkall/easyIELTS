# easyIELTS Content Generation (Reading) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let users generate an unlimited supply of **original** GT Reading tests on demand via the LLM, then take them in the existing reading runner (auto-scored, reviewed, recorded). This rounds out the Band-7 prep tool with fresh practice material that's copyright-free.

**Architecture:** A pure `generateReadingTest(topic, chat)` builds a strict json-schema prompt, validates the LLM output with zod, and returns a `ReadingTest` (assigning ids/numbers). A POST route wires the GitHub Models client + the shared credential resolver + rate limit (same pattern as writing/speaking). A `/reading/generate` client page requests a test, shows progress, and renders it in `ReadingRunner`. Attempts still record to the dashboard via the runner.

**Tech Stack:** Next.js 16 · TypeScript · zod · Vitest. Reuses `chatJson`, `resolveServerToken`, `getCookie`, `rateLimit`, the `ReadingTest` types, and `ReadingRunner`. Live-verifiable with the owner's `gh` credential (model `openai/gpt-4.1`).

**Depends on (already on `main`):** `src/server/github-models.ts`, `src/server/github-token.ts`, `src/server/cookies.ts`, `src/server/rate-limit.ts`, `src/lib/content/types.ts` (`ReadingTest`/`ReadingQuestion`), `src/components/reading/ReadingRunner.tsx`, `src/lib/settings/settings.ts`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/content/generate-reading.ts` | `generateReadingTest(topic, chat)` — prompt + schema + validation → `ReadingTest` |
| `src/app/api/content/reading/route.ts` | POST → generate a reading test (credential + rate limit) |
| `src/components/reading/GenerateReading.tsx` | `"use client"` request + render-in-runner |
| `src/app/reading/generate/page.tsx` | Generate route |
| `src/app/reading/page.tsx` (modify) | Add a "Generate a new test with AI" link |
| `tests/content/*` | Unit + route tests |

---

## Task 1: Reading generation logic

**Files:** Create `src/lib/content/generate-reading.ts`, `tests/content/generate-reading.test.ts`

- [ ] **Step 1: Write the failing test `C:\code\easyIELTS\tests\content\generate-reading.test.ts`:**
```ts
import { describe, it, expect, vi } from "vitest";
import { generateReadingTest, type GenerateChatFn } from "@/lib/content/generate-reading";

const llm = {
  title: "Community Gardens",
  passageTitle: "The Rise of Community Gardens",
  passageParagraphs: ["Community gardens are shared plots...", "They began in the 1970s...", "Today they are popular..."],
  questions: [
    { type: "true_false_notgiven", prompt: "Community gardens are private.", accepted: ["false"] },
    { type: "sentence_completion", prompt: "Gardens began in the ____.", accepted: ["1970s"], wordLimit: 1 },
    { type: "single_choice", prompt: "Gardens are:", options: ["A private", "B shared", "C closed"], accepted: ["B"] },
    { type: "true_false_notgiven", prompt: "Gardens are popular today.", accepted: ["true"] },
    { type: "short_answer", prompt: "What kind of plots are they?", accepted: ["shared"], wordLimit: 1 },
  ],
};

describe("generateReadingTest", () => {
  it("validates and shapes the LLM output into a ReadingTest", async () => {
    const chat: GenerateChatFn = vi.fn(async () => llm);
    const test = await generateReadingTest("community gardens", chat);
    expect(chat).toHaveBeenCalledOnce();
    expect(test.skill).toBe("reading");
    expect(test.variant).toBe("general-training");
    expect(test.sections).toHaveLength(1);
    const qs = test.sections[0].questions;
    expect(qs).toHaveLength(5);
    // ids + numbers assigned
    expect(qs[0].id).toBeTruthy();
    expect(qs[0].number).toBe(1);
    expect(qs[2].number).toBe(3);
    // single_choice options parsed to {value,label}
    expect(qs[2].options?.[0]).toEqual({ value: "A", label: "private" });
    expect(qs[2].accepted).toEqual(["B"]);
  });

  it("throws on malformed LLM output", async () => {
    const chat: GenerateChatFn = vi.fn(async () => ({ nope: 1 }));
    await expect(generateReadingTest("x", chat)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.** `npx vitest run tests/content/generate-reading.test.ts`

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\lib\content\generate-reading.ts`:**
```ts
import { z } from "zod";
import type { ReadingTest, ReadingQuestion, QuestionOption } from "./types";

export type GenerateChatFn = (options: {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
}) => Promise<unknown>;

const QUESTION_TYPES = [
  "true_false_notgiven",
  "yes_no_notgiven",
  "single_choice",
  "sentence_completion",
  "short_answer",
] as const;

const llmSchema = z.object({
  title: z.string().min(1),
  passageTitle: z.string().min(1),
  passageParagraphs: z.array(z.string().min(1)).min(2),
  questions: z
    .array(
      z.object({
        type: z.enum(QUESTION_TYPES),
        prompt: z.string().min(1),
        options: z.array(z.string().min(1)).optional(),
        accepted: z.array(z.string().min(1)).min(1),
        wordLimit: z.number().int().positive().optional(),
      }),
    )
    .min(5),
});

const JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["title", "passageTitle", "passageParagraphs", "questions"],
  properties: {
    title: { type: "string" },
    passageTitle: { type: "string" },
    passageParagraphs: { type: "array", items: { type: "string" } },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "prompt", "accepted"],
        properties: {
          type: { type: "string", enum: [...QUESTION_TYPES] },
          prompt: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          accepted: { type: "array", items: { type: "string" } },
          wordLimit: { type: "number" },
        },
      },
    },
  },
};

const SYSTEM = [
  "You are an IELTS General Training Reading test author.",
  "Write an ORIGINAL, copyright-free passage (general-interest, ~250-350 words) and questions for it.",
  "Use only these question types: true_false_notgiven, yes_no_notgiven, single_choice, sentence_completion, short_answer.",
  "For single_choice, provide 'options' as strings each starting with a letter and a space (e.g. 'A apples'), and 'accepted' = the correct letter (e.g. ['B']).",
  "For true_false_notgiven use accepted ['true'|'false'|'not given']; for yes_no_notgiven ['yes'|'no'|'not given'].",
  "For completion/short_answer, 'accepted' must be words that literally appear in the passage; include sensible variants; set 'wordLimit'.",
  "Every answer MUST be findable in or directly inferable from the passage. Produce 8-12 questions. Respond ONLY with JSON matching the schema.",
].join(" ");

/** Parse an option string like "A apples" into { value: "A", label: "apples" }. */
function parseOption(raw: string): QuestionOption {
  const match = raw.match(/^\s*([A-Za-z])[).\s]+(.*)$/);
  if (match) return { value: match[1].toUpperCase(), label: match[2].trim() };
  return { value: raw.trim(), label: raw.trim() };
}

let counter = 0;

export async function generateReadingTest(topic: string, chat: GenerateChatFn): Promise<ReadingTest> {
  const raw = await chat({
    system: SYSTEM,
    user: `Topic: ${topic || "any general-interest subject"}. Write the passage and questions now.`,
    schema: { name: "ielts_gt_reading_test", schema: JSON_SCHEMA },
  });
  const parsed = llmSchema.parse(raw);
  const id = `gen-reading-${Date.now()}-${counter++}`;

  const questions: ReadingQuestion[] = parsed.questions.map((q, index) => ({
    id: `${id}-q${index + 1}`,
    number: index + 1,
    type: q.type,
    prompt: q.prompt,
    accepted: q.accepted,
    wordLimit: q.wordLimit,
    options: q.options ? q.options.map(parseOption) : undefined,
  }));

  return {
    id,
    skill: "reading",
    variant: "general-training",
    title: parsed.title,
    timeMinutes: 20,
    sections: [
      {
        id: `${id}-s1`,
        name: "Section 3: General Reading (AI-generated)",
        passageTitle: parsed.passageTitle,
        passageParagraphs: parsed.passageParagraphs,
        questions,
      },
    ],
  };
}
```

- [ ] **Step 4: Run, confirm PASS. Commit.**
```powershell
cd C:\code\easyIELTS
npx vitest run tests/content/generate-reading.test.ts
git add src/lib/content/generate-reading.ts tests/content/generate-reading.test.ts
git commit -m "feat: AI generation of original GT reading tests"
```

---

## Task 2: Generation API route

**Files:** Create `src/app/api/content/reading/route.ts`, `tests/content/route.test.ts`

- [ ] **Step 1: Implement `C:\code\easyIELTS\src\app\api\content\reading\route.ts`:**
```ts
import { z } from "zod";
import { generateReadingTest } from "@/lib/content/generate-reading";
import { chatJson, GitHubModelsError } from "@/server/github-models";
import { resolveServerToken } from "@/server/github-token";
import { getCookie } from "@/server/cookies";
import { rateLimit } from "@/server/rate-limit";

const bodySchema = z.object({
  topic: z.string().max(200).optional(),
  token: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userToken = body.token ?? getCookie(request, "eielts_gh");
  let token = userToken;
  if (!token) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    if (!rateLimit(`content:${ip}`, 10, 60 * 60 * 1000).allowed) {
      return Response.json({ error: "Rate limit reached. Sign in with GitHub or use your own token." }, { status: 429 });
    }
    token = await resolveServerToken();
  }

  try {
    const test = await generateReadingTest(body.topic ?? "", (options) => chatJson({ ...options, token }));
    return Response.json(test);
  } catch (error) {
    if (error instanceof GitHubModelsError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Generation failed. The model may have returned an unexpected format — try again." }, { status: 502 });
  }
}
```

- [ ] **Step 2: Write `C:\code\easyIELTS\tests\content\route.test.ts`:**
```ts
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { POST } from "@/app/api/content/reading/route";
import { _resetRateLimitStore } from "@/server/rate-limit";

beforeEach(() => _resetRateLimitStore());
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
  it("returns a generated reading test (cookie credential)", async () => {
    const content = JSON.stringify(generated);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => content })));
    const res = await POST(req({ topic: "gardens" }, "eielts_gh=gho_u"));
    expect(res.status).toBe(200);
    const test = await res.json();
    expect(test.skill).toBe("reading");
    expect(test.sections[0].questions).toHaveLength(8);
  });

  it("propagates a model error status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => "bad token" })));
    const res = await POST(req({ topic: "x" }, "eielts_gh=gho_u"));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/content/route.test.ts
git add "src/app/api/content/reading/route.ts" tests/content/route.test.ts
git commit -m "feat: reading generation API route"
```

---

## Task 3: Generate UI + route + link

**Files:** Create `src/components/reading/GenerateReading.tsx`, `src/app/reading/generate/page.tsx`; Modify `src/app/reading/page.tsx`

- [ ] **Step 1: Create `C:\code\easyIELTS\src\components\reading\GenerateReading.tsx`:**
```tsx
"use client";

import { useState } from "react";
import { ReadingRunner } from "./ReadingRunner";
import { getSettings } from "@/lib/settings/settings";
import type { ReadingTest } from "@/lib/content/types";

export function GenerateReading() {
  const [topic, setTopic] = useState("");
  const [test, setTest] = useState<ReadingTest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const token = getSettings().githubToken;
      const res = await fetch("/api/content/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, ...(token ? { token } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Generation failed (${res.status})`);
      }
      setTest(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  if (test) return <ReadingRunner test={test} />;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Generate a reading test</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          The AI writes an original GT passage and questions. Optionally pick a topic.
        </p>
      </header>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Topic (optional), e.g. recycling, museums, remote work"
        aria-label="topic"
        className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
      />
      <button
        onClick={generate}
        disabled={busy}
        className="self-start rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate test"}
      </button>
      {busy && <p className="text-sm text-gray-500">Writing your passage and questions… this can take ~20 seconds.</p>}
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Create `C:\code\easyIELTS\src\app\reading\generate\page.tsx`:**
```tsx
import { GenerateReading } from "@/components/reading/GenerateReading";

export const metadata = { title: "Generate a reading test — easyIELTS" };

export default function GenerateReadingPage() {
  return <GenerateReading />;
}
```

- [ ] **Step 3: Add the link on `C:\code\easyIELTS\src\app\reading\page.tsx`.** After the header, add:
```tsx
      <a href="/reading/generate" className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        ✨ Generate a new test with AI
      </a>
```
(Keep the existing list of seed tests below it. The route `/reading/generate` must not collide with `/reading/[testId]` — App Router prefers the static `generate` segment over the dynamic one, so `/reading/generate` resolves to this page. Verify in the build route table.)

- [ ] **Step 4: Full verification.**
```powershell
cd C:\code\easyIELTS
npm run test
npm run lint
npm run build
```
Expected: all tests pass (incl. content suites), lint exit 0 no warnings, build compiles with `/api/content/reading` and `/reading/generate` routes (and `/reading/[testId]` still present and distinct).

- [ ] **Step 5: LIVE generation verification** through the running dev server using the owner `gh` credential (no token configured → gh-CLI fallback). Track/stop only PIDs you start.
```powershell
cd C:\code\easyIELTS
$before = (Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$env:PORT = "3072"
$p = Start-Process npm.cmd -ArgumentList "run","dev" -PassThru -WindowStyle Hidden  # dev => gh CLI fallback
Start-Sleep -Seconds 20
try {
  $r = Invoke-WebRequest -Uri "http://localhost:3072/api/content/reading" -Method POST -Body '{"topic":"community libraries"}' -ContentType "application/json" -UseBasicParsing -TimeoutSec 90
  $t = $r.Content | ConvertFrom-Json
  Write-Output ("HTTP " + $r.StatusCode + " title=" + $t.title + " paras=" + $t.sections[0].passageParagraphs.Count + " questions=" + $t.sections[0].questions.Count)
} catch { Write-Output ("FAILED status: " + $_.Exception.Response.StatusCode.value__) }
finally {
  $after = (Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  foreach ($id in $after) { if ($before -notcontains $id) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }
}
```
Expected: `HTTP 200 title=<a title> paras=>=2 questions=8..12` — proving the LLM generates a valid original reading test end-to-end. (If `gh`/network is unavailable it returns 503/502; rely on unit tests + report honestly.)

- [ ] **Step 6: Commit.**
```powershell
git add src/components/reading/GenerateReading.tsx "src/app/reading/generate/page.tsx" src/app/reading/page.tsx
git commit -m "feat: generate-reading UI, route, and link"
```

---

## Done criteria

- `/reading/generate` requests an original AI-authored GT reading test and runs it in the existing runner (auto-scored, reviewed, recorded to the dashboard).
- The generation route reuses the shared credential resolver (owner/CLI/user token) + rate limit; user GitHub token is sent when set.
- `npm run test` / `lint` / `build` green; `/reading/generate` and `/api/content/reading` exist and don't collide with `/reading/[testId]`.
- Live generation verified through the running server; all generated content is original.

## Notes

- Listening generation would additionally need TTS audio (Gemini `gemini-2.5-flash-preview-tts` is available) — a future enhancement; this plan covers reading, the most direct win.
- Generated tests are ephemeral (per session); attempts still persist to the dashboard via the runner's `recordAttempt`.
