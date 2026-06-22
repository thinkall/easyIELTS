# easyIELTS Writing Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a user write IELTS GT Writing Task 1 (letter) and Task 2 (essay) and receive LLM-based, per-criterion band scores, targeted feedback, and a model answer — using the **GitHub Models** API (the available "GitHub Copilot SDK" path), with the owner key kept server-side and user-supplied tokens optional.

**Architecture:** A server-only GitHub Models client (`chatJson`) calls `models.github.ai` with a JSON-schema response format. A pure, injectable `evaluateWritingTask(input, chat)` builds the examiner prompt + schema, validates the LLM output with zod, and computes the task band from the four criteria (we do the arithmetic, not the LLM). A POST route wires the real client in. A client `WritingRunner` posts each task and renders results; the overall Writing band = `(T1 + 2·T2)/3` via the existing `writingBand()`.

**Tech Stack:** Next.js 16 route handlers · React 19 · TypeScript · zod · Vitest (mock `fetch` / inject a fake `chat` — no real key needed for tests).

**Depends on (already on `main`):** `src/lib/env.ts`, `src/lib/ielts/rounding.ts` + `aggregate.ts` (`roundToHalfBand`, `skillAverageBand`, `writingBand`), `src/lib/scoring/normalize.ts` (`wordCount`).

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/server/github-models.ts` | Server-only `chatJson()` + `GitHubModelsError` (calls GitHub Models) |
| `src/lib/writing/types.ts` | `CriterionBands`, `TaskEvaluation`, `WritingTaskInput` |
| `src/lib/writing/evaluate.ts` | `evaluateWritingTask(input, chat)` — prompt + schema + validation + band math |
| `content/tests/writing/gt-writing-001.ts` | Original Task 1 + Task 2 prompts |
| `src/lib/content/writing.ts` | `getWritingTests()`, `getWritingTest(id)` |
| `src/app/api/writing/evaluate/route.ts` | POST handler → `evaluateWritingTask` |
| `src/components/writing/WritingRunner.tsx` | `"use client"` editor (word counts, submit, results) |
| `src/app/writing/page.tsx`, `[testId]/page.tsx` | List + editor routes |
| `src/app/page.tsx` (modify) | Link the Writing card |
| `tests/writing/*` | Client, evaluate, route, content tests |

---

## Task 1: GitHub Models client

**Files:** Create `src/server/github-models.ts`, `tests/writing/github-models.test.ts`

- [ ] **Step 1: Write the failing test `C:\code\easyIELTS\tests\writing\github-models.test.ts`** (mocks `fetch`):
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { chatJson, GitHubModelsError } from "@/server/github-models";

const schema = { name: "x", schema: { type: "object" } };

afterEach(() => vi.unstubAllGlobals());

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    })),
  );
}

describe("chatJson", () => {
  it("parses the JSON content from a successful response", async () => {
    mockFetchOnce(200, { choices: [{ message: { content: JSON.stringify({ band: 7 }) } }] });
    const result = await chatJson<{ band: number }>({ system: "s", user: "u", schema, token: "t" });
    expect(result.band).toBe(7);
  });

  it("throws GitHubModelsError with the status on a failed response", async () => {
    mockFetchOnce(401, { error: "bad token" });
    await expect(chatJson({ system: "s", user: "u", schema, token: "t" })).rejects.toMatchObject({
      name: "GitHubModelsError",
      status: 401,
    });
  });

  it("throws 503 when no token is available", async () => {
    await expect(chatJson({ system: "s", user: "u", schema })).rejects.toMatchObject({ status: 503 });
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.** `npx vitest run tests/writing/github-models.test.ts`

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\server\github-models.ts`:**
```ts
import "server-only";
import { env } from "@/lib/env";

export class GitHubModelsError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubModelsError";
    this.status = status;
  }
}

export interface ChatJsonOptions {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
  /** Optional user-supplied GitHub token; defaults to the owner's server key. */
  token?: string;
  model?: string;
}

const ENDPOINT = "https://models.github.ai/inference/chat/completions";

export async function chatJson<T>(options: ChatJsonOptions): Promise<T> {
  const token = options.token ?? env.GITHUB_MODELS_TOKEN;
  if (!token) {
    throw new GitHubModelsError("No GitHub Models token configured.", 503);
  }
  const model = options.model ?? env.GITHUB_MODELS_MODEL;

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: options.schema.name, schema: options.schema.schema, strict: true },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GitHubModelsError(
      `GitHub Models request failed (${response.status}): ${detail.slice(0, 200)}`,
      response.status,
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new GitHubModelsError("GitHub Models returned no content.", 502);
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new GitHubModelsError("GitHub Models returned invalid JSON.", 502);
  }
}
```

- [ ] **Step 4: Run, confirm PASS. Commit.**
```powershell
cd C:\code\easyIELTS
npx vitest run tests/writing/github-models.test.ts
git add src/server/github-models.ts tests/writing/github-models.test.ts
git commit -m "feat: server-only GitHub Models JSON client"
```

---

## Task 2: Writing content (original prompts) + loader

**Files:** Create `content/tests/writing/gt-writing-001.ts`, `src/lib/content/writing.ts`, `tests/writing/content.test.ts`

- [ ] **Step 1: Create `C:\code\easyIELTS\content\tests\writing\gt-writing-001.ts`** (original prompts):
```ts
export interface WritingTaskPrompt {
  taskNumber: 1 | 2;
  instructions: string;
  minWords: number;
}

export interface WritingTest {
  id: string;
  skill: "writing";
  variant: "general-training";
  title: string;
  tasks: WritingTaskPrompt[];
}

export const writingTest001: WritingTest = {
  id: "gt-writing-001",
  skill: "writing",
  variant: "general-training",
  title: "GT Writing Practice — Set 1",
  tasks: [
    {
      taskNumber: 1,
      minWords: 150,
      instructions:
        "You recently stayed at a hotel for a short holiday and were not satisfied with your stay. " +
        "Write a letter to the hotel manager. In your letter:\n" +
        "- explain why you were staying at the hotel\n" +
        "- describe the problems you experienced\n" +
        "- say what you would like the manager to do about it.\n\n" +
        "Begin your letter 'Dear Sir or Madam,'. Write at least 150 words.",
    },
    {
      taskNumber: 2,
      minWords: 250,
      instructions:
        "Some people believe that children should be taught how to manage money from a young age. " +
        "Others think that handling money is a responsibility for adults only.\n\n" +
        "Discuss both these views and give your own opinion. " +
        "Give reasons for your answer and include relevant examples from your own knowledge or experience. " +
        "Write at least 250 words.",
    },
  ],
};
```

- [ ] **Step 2: Create `C:\code\easyIELTS\src\lib\content\writing.ts`:**
```ts
import { writingTest001, type WritingTest } from "@content/tests/writing/gt-writing-001";

const WRITING_TESTS: WritingTest[] = [writingTest001];

export function getWritingTests(): WritingTest[] {
  return WRITING_TESTS;
}

export function getWritingTest(id: string): WritingTest | undefined {
  return WRITING_TESTS.find((test) => test.id === id);
}

export type { WritingTest, WritingTaskPrompt } from "@content/tests/writing/gt-writing-001";
```

- [ ] **Step 3: Create `C:\code\easyIELTS\tests\writing\content.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { getWritingTests, getWritingTest } from "@/lib/content/writing";

describe("writing content", () => {
  it("provides Task 1 and Task 2 prompts with minimum word counts", () => {
    const test = getWritingTest(getWritingTests()[0].id)!;
    expect(test.tasks).toHaveLength(2);
    expect(test.tasks.find((t) => t.taskNumber === 1)?.minWords).toBe(150);
    expect(test.tasks.find((t) => t.taskNumber === 2)?.minWords).toBe(250);
    expect(getWritingTest("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run + commit.**
```powershell
npx vitest run tests/writing/content.test.ts
git add content/tests/writing/gt-writing-001.ts src/lib/content/writing.ts tests/writing/content.test.ts
git commit -m "feat: original GT writing prompts and loader"
```

---

## Task 3: Writing evaluation logic

**Files:** Create `src/lib/writing/types.ts`, `src/lib/writing/evaluate.ts`, `tests/writing/evaluate.test.ts`

- [ ] **Step 1: Create `C:\code\easyIELTS\src\lib\writing\types.ts`:**
```ts
export interface CriterionBands {
  taskResponse: number; // labelled "Task Achievement" for Task 1 in the UI
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
}

export interface CorrectedExample {
  original: string;
  corrected: string;
  note: string;
}

export interface TaskEvaluation {
  taskNumber: 1 | 2;
  criteria: CriterionBands;
  taskBand: number;
  wordCount: number;
  feedback: {
    strengths: string[];
    improvements: string[];
    correctedExamples: CorrectedExample[];
  };
  modelAnswer: string;
}

export interface WritingTaskInput {
  taskNumber: 1 | 2;
  prompt: string;
  response: string;
}
```

- [ ] **Step 2: Write the failing test `C:\code\easyIELTS\tests\writing\evaluate.test.ts`** (injects a fake `chat`):
```ts
import { describe, it, expect, vi } from "vitest";
import { evaluateWritingTask, type ChatFn } from "@/lib/writing/evaluate";

const llmResponse = {
  criteria: { taskResponse: 7, coherenceCohesion: 7, lexicalResource: 6.4, grammaticalRangeAccuracy: 6 },
  feedback: { strengths: ["clear position"], improvements: ["more range"], correctedExamples: [] },
  modelAnswer: "A model answer.",
};

describe("evaluateWritingTask", () => {
  it("validates the LLM output, rounds criteria, and computes the task band", async () => {
    const chat: ChatFn = vi.fn(async () => llmResponse);
    const result = await evaluateWritingTask(
      { taskNumber: 2, prompt: "Discuss...", response: "one two three four five" },
      chat,
    );
    expect(chat).toHaveBeenCalledOnce();
    expect(result.wordCount).toBe(5);
    expect(result.criteria.lexicalResource).toBe(6.5); // 6.4 rounded to nearest half band
    // average(7,7,6.5,6) = 6.625 -> 6.5
    expect(result.taskBand).toBe(6.5);
    expect(result.modelAnswer).toBe("A model answer.");
  });

  it("throws if the LLM output does not match the schema", async () => {
    const chat: ChatFn = vi.fn(async () => ({ nonsense: true }));
    await expect(
      evaluateWritingTask({ taskNumber: 1, prompt: "p", response: "r" }, chat),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run, confirm FAIL.**

- [ ] **Step 4: Implement `C:\code\easyIELTS\src\lib\writing\evaluate.ts`:**
```ts
import { z } from "zod";
import { roundToHalfBand } from "@/lib/ielts/rounding";
import { skillAverageBand } from "@/lib/ielts/aggregate";
import { wordCount } from "@/lib/scoring/normalize";
import type { TaskEvaluation, WritingTaskInput } from "./types";

export type ChatFn = (options: {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
}) => Promise<unknown>;

const llmSchema = z.object({
  criteria: z.object({
    taskResponse: z.number(),
    coherenceCohesion: z.number(),
    lexicalResource: z.number(),
    grammaticalRangeAccuracy: z.number(),
  }),
  feedback: z.object({
    strengths: z.array(z.string()),
    improvements: z.array(z.string()),
    correctedExamples: z.array(
      z.object({ original: z.string(), corrected: z.string(), note: z.string() }),
    ),
  }),
  modelAnswer: z.string(),
});

const JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["criteria", "feedback", "modelAnswer"],
  properties: {
    criteria: {
      type: "object",
      additionalProperties: false,
      required: ["taskResponse", "coherenceCohesion", "lexicalResource", "grammaticalRangeAccuracy"],
      properties: {
        taskResponse: { type: "number" },
        coherenceCohesion: { type: "number" },
        lexicalResource: { type: "number" },
        grammaticalRangeAccuracy: { type: "number" },
      },
    },
    feedback: {
      type: "object",
      additionalProperties: false,
      required: ["strengths", "improvements", "correctedExamples"],
      properties: {
        strengths: { type: "array", items: { type: "string" } },
        improvements: { type: "array", items: { type: "string" } },
        correctedExamples: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["original", "corrected", "note"],
            properties: {
              original: { type: "string" },
              corrected: { type: "string" },
              note: { type: "string" },
            },
          },
        },
      },
    },
    modelAnswer: { type: "string" },
  },
};

function buildSystemPrompt(taskNumber: 1 | 2): string {
  const taskDesc =
    taskNumber === 1
      ? "IELTS General Training Writing Task 1 (a letter of at least 150 words)"
      : "IELTS Writing Task 2 (an essay of at least 250 words)";
  return [
    `You are a certified, strict IELTS examiner. Assess the candidate's ${taskDesc}.`,
    "Score each of the four criteria (Task Response/Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy) on the 0-9 band scale in 0.5 steps.",
    "Band 7 markers: ~50% of sentences error-free; a clear, fully-developed position; less-common vocabulary with awareness of collocation; varied complex structures.",
    "Penalise under-length, off-topic, or memorised responses. Provide concrete, specific feedback and a band-8+ model answer.",
    "Respond ONLY with JSON matching the provided schema.",
  ].join(" ");
}

export async function evaluateWritingTask(
  input: WritingTaskInput,
  chat: ChatFn,
): Promise<TaskEvaluation> {
  const wc = wordCount(input.response);
  const raw = await chat({
    system: buildSystemPrompt(input.taskNumber),
    user: `TASK PROMPT:\n${input.prompt}\n\nCANDIDATE RESPONSE (${wc} words):\n${input.response}`,
    schema: { name: "ielts_writing_task_evaluation", schema: JSON_SCHEMA },
  });

  const parsed = llmSchema.parse(raw);
  const criteria = {
    taskResponse: roundToHalfBand(parsed.criteria.taskResponse),
    coherenceCohesion: roundToHalfBand(parsed.criteria.coherenceCohesion),
    lexicalResource: roundToHalfBand(parsed.criteria.lexicalResource),
    grammaticalRangeAccuracy: roundToHalfBand(parsed.criteria.grammaticalRangeAccuracy),
  };
  const taskBand = skillAverageBand([
    criteria.taskResponse,
    criteria.coherenceCohesion,
    criteria.lexicalResource,
    criteria.grammaticalRangeAccuracy,
  ]);

  return {
    taskNumber: input.taskNumber,
    criteria,
    taskBand,
    wordCount: wc,
    feedback: parsed.feedback,
    modelAnswer: parsed.modelAnswer,
  };
}
```

- [ ] **Step 5: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/writing/evaluate.test.ts
git add src/lib/writing/types.ts src/lib/writing/evaluate.ts tests/writing/evaluate.test.ts
git commit -m "feat: writing task evaluation (prompt, schema, validation, band math)"
```

---

## Task 4: Evaluation API route

**Files:** Create `src/app/api/writing/evaluate/route.ts`, `tests/writing/route.test.ts`

- [ ] **Step 1: Implement `C:\code\easyIELTS\src\app\api\writing\evaluate\route.ts`:**
```ts
import { z } from "zod";
import { evaluateWritingTask } from "@/lib/writing/evaluate";
import { chatJson, GitHubModelsError } from "@/server/github-models";

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

  try {
    const result = await evaluateWritingTask(
      { taskNumber: body.taskNumber, prompt: body.prompt, response: body.response },
      (options) => chatJson({ ...options, token: body.token }),
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

- [ ] **Step 2: Write `C:\code\easyIELTS\tests\writing\route.test.ts`** (mocks `fetch` so the real client runs without network):
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { POST } from "@/app/api/writing/evaluate/route";

afterEach(() => vi.unstubAllGlobals());

function req(body: unknown) {
  return new Request("http://localhost/api/writing/evaluate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const llmContent = JSON.stringify({
  criteria: { taskResponse: 7, coherenceCohesion: 7, lexicalResource: 7, grammaticalRangeAccuracy: 6.5 },
  feedback: { strengths: [], improvements: [], correctedExamples: [] },
  modelAnswer: "model",
});

describe("POST /api/writing/evaluate", () => {
  it("returns 400 for an invalid body", async () => {
    const res = await POST(req({ taskNumber: 3 }));
    expect(res.status).toBe(400);
  });

  it("returns an evaluation when the model responds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: llmContent } }] }),
      text: async () => llmContent,
    })));
    const res = await POST(req({ taskNumber: 2, prompt: "p", response: "a b c", token: "t" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.taskBand).toBe(7); // avg(7,7,7,6.5)=6.875 -> 7
  });

  it("propagates the GitHub Models error status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 401, json: async () => ({}), text: async () => "bad token",
    })));
    const res = await POST(req({ taskNumber: 1, prompt: "p", response: "r", token: "t" }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/writing/route.test.ts
git add "src/app/api/writing/evaluate/route.ts" tests/writing/route.test.ts
git commit -m "feat: writing evaluation API route"
```

---

## Task 5: Writing UI + routes + verification

**Files:** Create `src/components/writing/WritingRunner.tsx`, `src/app/writing/page.tsx`, `src/app/writing/[testId]/page.tsx`; Modify `src/app/page.tsx`

- [ ] **Step 1: Create `C:\code\easyIELTS\src\components\writing\WritingRunner.tsx`:**
```tsx
"use client";

import { useState } from "react";
import { writingBand } from "@/lib/ielts/aggregate";
import { wordCount } from "@/lib/scoring/normalize";
import type { TaskEvaluation } from "@/lib/writing/types";
import type { WritingTest } from "@/lib/content/writing";

type Evaluations = Partial<Record<1 | 2, TaskEvaluation>>;

async function evaluate(taskNumber: 1 | 2, prompt: string, response: string): Promise<TaskEvaluation> {
  const res = await fetch("/api/writing/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskNumber, prompt, response }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Evaluation failed (${res.status})`);
  }
  return res.json();
}

const CRITERION_LABELS: Record<string, string> = {
  taskResponse: "Task Response/Achievement",
  coherenceCohesion: "Coherence & Cohesion",
  lexicalResource: "Lexical Resource",
  grammaticalRangeAccuracy: "Grammatical Range & Accuracy",
};

export function WritingRunner({ test }: { test: WritingTest }) {
  const [responses, setResponses] = useState<Record<1 | 2, string>>({ 1: "", 2: "" });
  const [evals, setEvals] = useState<Evaluations>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overall =
    evals[1] && evals[2] ? writingBand(evals[1]!.taskBand, evals[2]!.taskBand) : null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const next: Evaluations = {};
      for (const task of test.tasks) {
        next[task.taskNumber] = await evaluate(
          task.taskNumber,
          task.instructions,
          responses[task.taskNumber],
        );
      }
      setEvals(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">{test.title}</h1>
        <p className="text-sm text-amber-600">🎯 Writing Band = (Task 1 + 2×Task 2) ÷ 3</p>
      </header>

      {overall !== null && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950">
          <h2 className="text-lg font-semibold">Overall Writing band</h2>
          <p className="text-3xl font-bold">Band {overall.toFixed(1)}</p>
          <p className="mt-1 text-sm">
            {overall >= 7 ? "On target for Band 7. 🎯" : `${(7 - overall).toFixed(1)} below your Band 7 goal.`}
          </p>
        </div>
      )}

      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {test.tasks.map((task) => {
        const ev = evals[task.taskNumber];
        const count = wordCount(responses[task.taskNumber]);
        return (
          <section key={task.taskNumber} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Task {task.taskNumber}</h2>
            <p className="whitespace-pre-line rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
              {task.instructions}
            </p>
            <textarea
              value={responses[task.taskNumber]}
              onChange={(e) => setResponses((p) => ({ ...p, [task.taskNumber]: e.target.value }))}
              disabled={busy}
              rows={10}
              aria-label={`Task ${task.taskNumber} response`}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-600 dark:bg-gray-800"
              placeholder="Write your response here…"
            />
            <p className={`text-xs ${count < task.minWords ? "text-red-600" : "text-green-600"}`}>
              {count} / {task.minWords} words
            </p>

            {ev && (
              <div className="rounded-lg border border-gray-200 p-4 text-sm dark:border-gray-700">
                <p className="font-semibold">Task {task.taskNumber} band: {ev.taskBand.toFixed(1)}</p>
                <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {Object.entries(ev.criteria).map(([k, v]) => (
                    <li key={k}>{CRITERION_LABELS[k]}: <strong>{v.toFixed(1)}</strong></li>
                  ))}
                </ul>
                {ev.feedback.improvements.length > 0 && (
                  <div className="mt-3">
                    <p className="font-medium">To improve:</p>
                    <ul className="list-disc pl-5">
                      {ev.feedback.improvements.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                <details className="mt-3">
                  <summary className="cursor-pointer font-medium">Model answer</summary>
                  <p className="mt-1 whitespace-pre-line text-gray-700 dark:text-gray-300">{ev.modelAnswer}</p>
                </details>
              </div>
            )}
          </section>
        );
      })}

      <button
        onClick={submit}
        disabled={busy}
        className="self-start rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? "Evaluating…" : "Submit for evaluation"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `C:\code\easyIELTS\src\app\writing\page.tsx`:**
```tsx
import Link from "next/link";
import { getWritingTests } from "@/lib/content/writing";

export const metadata = { title: "Writing practice — easyIELTS" };

export default function WritingIndexPage() {
  const tests = getWritingTests();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">GT Writing practice</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">Write Task 1 and Task 2, then get AI band feedback.</p>
      </header>
      <ul className="flex flex-col gap-3">
        {tests.map((test) => (
          <li key={test.id}>
            <Link href={`/writing/${test.id}`} className="block rounded-xl border border-gray-200 p-4 hover:border-indigo-400 dark:border-gray-700">
              <span className="font-semibold">{test.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Create `C:\code\easyIELTS\src\app\writing\[testId]\page.tsx`:**
```tsx
import { notFound } from "next/navigation";
import { getWritingTest, getWritingTests } from "@/lib/content/writing";
import { WritingRunner } from "@/components/writing/WritingRunner";

export function generateStaticParams() {
  return getWritingTests().map((test) => ({ testId: test.id }));
}

export default async function WritingTestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const test = getWritingTest(testId);
  if (!test) notFound();
  return <WritingRunner test={test} />;
}
```

- [ ] **Step 4: Link the Writing card on the landing page.** In `C:\code\easyIELTS\src\app\page.tsx`, extend the `href` branch so `"Writing"` → `/writing`:
```tsx
          const href =
            s.name === "Reading" ? "/reading"
            : s.name === "Listening" ? "/listening"
            : s.name === "Writing" ? "/writing"
            : null;
```
(Keep the rest of the card/link logic unchanged. The foundation landing-page test must still pass.)

- [ ] **Step 5: Full verification.**
```powershell
cd C:\code\easyIELTS
npm run test
npm run lint
npm run build
```
Expected: all tests pass (incl. the writing suites), lint exit 0 no warnings, build compiles with `/writing`, `/writing/[testId]`, and `/api/writing/evaluate` in the route table.

- [ ] **Step 6: Server smoke (pages render; the API correctly reports "no key" without one configured).** Use a NON-reserved variable (never `$home`):
```powershell
$p = Start-Process npm -ArgumentList "run","start" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 14
try {
  $list = (Invoke-WebRequest http://localhost:3000/writing -UseBasicParsing -TimeoutSec 5).StatusCode
  $run  = (Invoke-WebRequest http://localhost:3000/writing/gt-writing-001 -UseBasicParsing -TimeoutSec 5).StatusCode
  $api = try {
    Invoke-WebRequest http://localhost:3000/api/writing/evaluate -Method POST -Body '{"taskNumber":1,"prompt":"p","response":"r"}' -ContentType "application/json" -UseBasicParsing -TimeoutSec 8
    "unexpected-200"
  } catch { $_.Exception.Response.StatusCode.value__ }
  Write-Output "list=$list run=$run apiStatus=$api"
} finally {
  if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force }
  Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -gt (Get-Date).AddMinutes(-2) } | Stop-Process -Force -ErrorAction SilentlyContinue
}
```
Expected: `list=200 run=200` and `apiStatus=503` (no `GITHUB_MODELS_TOKEN` configured in this environment, so the route correctly returns 503). No node processes left.

- [ ] **Step 7: Commit.**
```powershell
git add src/components/writing/WritingRunner.tsx src/app/writing/page.tsx "src/app/writing/[testId]/page.tsx" src/app/page.tsx
git commit -m "feat: writing editor UI, routes, and landing link"
```

---

## Done criteria

- `/writing` lists the seed; `/writing/gt-writing-001` shows both tasks with live word counts; submitting calls the GitHub Models route and renders per-criterion bands, the overall Writing band `(T1+2·T2)/3`, improvement points, and a model answer.
- Owner key stays server-side (the route reads `env.GITHUB_MODELS_TOKEN`); a user may supply their own token in the request body. With no key configured, the API returns 503 and the UI shows the error.
- `npm run test` / `lint` / `build` green; all tests use a mocked LLM (no real key needed).
- Writing prompts are original.

## Notes for later plans

- A Settings UI for users to enter their own GitHub token / Gemini key is part of the Auth/Dashboard plan; for now the route accepts an optional `token` field.
- The Speaking plan reuses this GitHub Models client to score the speaking transcript (the four speaking criteria) after the live session.
