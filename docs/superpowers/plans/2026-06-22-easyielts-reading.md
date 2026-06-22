# easyIELTS Reading Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first complete user-facing feature: take a GT Reading test in the browser, submit, and get an instant raw score, estimated band (with the official GT table), and a per-question review — built on the existing scoring engine.

**Architecture:** Typed reading content (committed, original) under `content/tests/reading/`, loaded by a small content loader. A pure `scoreReadingTest()` wraps the scoring engine (`scoreObjective` + `gtReadingRawToBand`). Presentational React components render passages and questions; a single client component `ReadingRunner` owns answer state, the timer, submit, and results. Two App Router routes list and run tests.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind · Vitest + React Testing Library (+ `@testing-library/user-event`). All consistent with the foundation.

**Depends on (already on `main`):** `src/lib/scoring/*` (`scoreObjective`, `Question`), `src/lib/ielts/bands.ts` (`gtReadingRawToBand`).

---

## File Structure (created by this plan)

| Path | Responsibility |
|---|---|
| `tsconfig.json` (modify) | Add `@content/*` path alias → `./content/*` |
| `src/lib/content/types.ts` | `ReadingQuestion`, `ReadingSection`, `ReadingTest` content types |
| `content/tests/reading/gt-tool-libraries.ts` | One original GT reading test (passage + 10 questions + answer key) |
| `src/lib/content/reading.ts` | `getReadingTests()`, `getReadingTest(id)` loader/registry |
| `src/lib/reading/score-reading.ts` | `scoreReadingTest()` — raw + scaled/40 + band + per-question results |
| `src/components/reading/QuestionView.tsx` | Renders one question (radio for choice/TFNG, text input otherwise) + review state |
| `src/components/reading/ResultsSummary.tsx` | Score/band/estimate + distance-to-Band-7 |
| `src/components/reading/ReadingRunner.tsx` | `"use client"` runner: answer state, countdown timer, submit, results |
| `src/app/reading/page.tsx` | Lists available reading tests |
| `src/app/reading/[testId]/page.tsx` | Loads a test (async params) and renders the runner |
| `src/app/page.tsx` (modify) | Link the Reading card to `/reading` |
| `tests/reading/*.test.ts(x)` | Unit + component tests |

---

## Task 1: Reading content types, seed test, and loader

**Files:**
- Modify: `tsconfig.json` (add `@content/*` path)
- Create: `src/lib/content/types.ts`, `content/tests/reading/gt-tool-libraries.ts`, `src/lib/content/reading.ts`, `tests/reading/content.test.ts`

- [ ] **Step 1: Add the `@content/*` path alias.** In `C:\code\easyIELTS\tsconfig.json`, inside `compilerOptions.paths`, add the `@content/*` entry alongside the existing `@/*`:
```jsonc
"paths": {
  "@/*": ["./src/*"],
  "@content/*": ["./content/*"]
}
```
(Keep whatever the existing `@/*` mapping is; just add the `@content/*` line.)

- [ ] **Step 2: Create the content types `C:\code\easyIELTS\src\lib\content\types.ts`:**
```ts
import type { Question } from "@/lib/scoring/types";

export interface QuestionOption {
  value: string;
  label: string;
}

/** A reading question: the scoring `Question` fields plus UI presentation fields. */
export interface ReadingQuestion extends Question {
  /** 1-based number shown to the user. */
  number: number;
  /** The question stem/prompt. */
  prompt: string;
  /** Options for choice questions. TFNG/YNNG use fixed options supplied by the renderer. */
  options?: QuestionOption[];
}

export interface ReadingSection {
  id: string;
  name: string;
  passageTitle: string;
  /** Passage body as paragraphs (each rendered as a <p>). */
  passageParagraphs: string[];
  questions: ReadingQuestion[];
}

export interface ReadingTest {
  id: string;
  skill: "reading";
  variant: "general-training";
  title: string;
  /** Recommended time in minutes (drives the countdown timer). */
  timeMinutes: number;
  sections: ReadingSection[];
}
```

- [ ] **Step 3: Create the original seed test `C:\code\easyIELTS\content\tests\reading\gt-tool-libraries.ts`** (ALL original content — do not copy any real exam material):
```ts
import type { ReadingTest } from "@/lib/content/types";

export const toolLibrariesTest: ReadingTest = {
  id: "gt-tool-libraries",
  skill: "reading",
  variant: "general-training",
  title: "GT Reading Practice — Community Tool Libraries",
  timeMinutes: 20,
  sections: [
    {
      id: "s1",
      name: "Section 3: General Reading",
      passageTitle: "Community Tool Libraries",
      passageParagraphs: [
        "A tool library works much like a library of books, except that instead of borrowing novels or textbooks, members borrow tools. From electric drills and ladders to lawnmowers and sewing machines, a tool library lends out equipment that many people need only occasionally. Members pay a modest annual fee and can then borrow items for a set period, usually a week.",
        "The idea is not new. The first tool-lending schemes appeared in the United States in the 1940s, often run by public libraries as a small side service. They grew slowly until the early twenty-first century, when concerns about waste and the rising cost of living gave them fresh appeal. Today there are hundreds of tool libraries worldwide, many of them run by volunteers.",
        "Supporters point to several benefits. Borrowing rather than buying saves money, particularly for expensive items used once or twice a year. It also saves space, since a single shared drill can replace dozens sitting idle in private cupboards. Environmentally, sharing reduces the demand for manufacturing and cuts the waste created when cheap tools break and are thrown away.",
        "Tool libraries are not without challenges. Tools wear out faster than books and require regular maintenance, so most libraries set aside part of their budget for repairs and replacement. Some items, such as chainsaws, are considered too dangerous to lend without training, and a few libraries offer short workshops so that members can learn to use unfamiliar equipment safely.",
        "For many members, though, the greatest value is social. Tool libraries often become community hubs where neighbours meet, swap advice, and help one another with projects. In this way they lend far more than tools.",
      ],
      questions: [
        {
          id: "q1", number: 1, type: "true_false_notgiven",
          prompt: "Members of a tool library can usually keep a borrowed item for one month.",
          accepted: ["false"],
        },
        {
          id: "q2", number: 2, type: "true_false_notgiven",
          prompt: "The first tool-lending schemes were often run by public libraries.",
          accepted: ["true"],
        },
        {
          id: "q3", number: 3, type: "true_false_notgiven",
          prompt: "Tool libraries became more popular partly because of concerns about waste.",
          accepted: ["true"],
        },
        {
          id: "q4", number: 4, type: "true_false_notgiven",
          prompt: "Some tool libraries are run by volunteers.",
          accepted: ["true"],
        },
        {
          id: "q5", number: 5, type: "sentence_completion", wordLimit: 2,
          prompt: "Members pay a modest annual ______ to join a tool library.",
          accepted: ["fee"],
        },
        {
          id: "q6", number: 6, type: "sentence_completion", wordLimit: 1,
          prompt: "A single shared drill can replace dozens sitting ______ in private cupboards.",
          accepted: ["idle"],
        },
        {
          id: "q7", number: 7, type: "sentence_completion", wordLimit: 1,
          prompt: "Most libraries set aside part of their ______ for repairs and replacement.",
          accepted: ["budget"],
        },
        {
          id: "q8", number: 8, type: "single_choice",
          prompt: "According to the passage, tool libraries save space because:",
          options: [
            { value: "A", label: "members visit them less often" },
            { value: "B", label: "one shared tool can replace many privately owned ones" },
            { value: "C", label: "tools take up less room than books" },
          ],
          accepted: ["B"],
        },
        {
          id: "q9", number: 9, type: "single_choice",
          prompt: "The writer says that for many members the greatest value of a tool library is:",
          options: [
            { value: "A", label: "financial" },
            { value: "B", label: "environmental" },
            { value: "C", label: "social" },
          ],
          accepted: ["C"],
        },
        {
          id: "q10", number: 10, type: "short_answer", wordLimit: 2,
          prompt: "What do a few libraries offer so that members can learn to use unfamiliar equipment safely?",
          accepted: ["workshops", "short workshops"],
        },
      ],
    },
  ],
};
```

- [ ] **Step 4: Create the loader `C:\code\easyIELTS\src\lib\content\reading.ts`:**
```ts
import type { ReadingTest } from "./types";
import { toolLibrariesTest } from "@content/tests/reading/gt-tool-libraries";

const READING_TESTS: ReadingTest[] = [toolLibrariesTest];

export function getReadingTests(): ReadingTest[] {
  return READING_TESTS;
}

export function getReadingTest(id: string): ReadingTest | undefined {
  return READING_TESTS.find((test) => test.id === id);
}
```

- [ ] **Step 5: Write a content sanity test `C:\code\easyIELTS\tests\reading\content.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { getReadingTests, getReadingTest } from "@/lib/content/reading";

describe("reading content", () => {
  it("exposes at least one test, retrievable by id", () => {
    const tests = getReadingTests();
    expect(tests.length).toBeGreaterThan(0);
    expect(getReadingTest(tests[0].id)).toBe(tests[0]);
    expect(getReadingTest("does-not-exist")).toBeUndefined();
  });

  it("every question has a non-empty accepted answer and a unique id", () => {
    const ids = new Set<string>();
    for (const test of getReadingTests()) {
      for (const section of test.sections) {
        for (const q of section.questions) {
          expect(q.accepted.length).toBeGreaterThan(0);
          expect(q.accepted.every((a) => a.trim() !== "")).toBe(true);
          expect(ids.has(q.id)).toBe(false);
          ids.add(q.id);
        }
      }
    }
  });
});
```

- [ ] **Step 6: Run the test, confirm PASS, and verify build picks up the alias.**
```powershell
cd C:\code\easyIELTS
npx vitest run tests/reading/content.test.ts
npm run build
```
Expected: content test passes; build compiles (proves the `@content/*` alias resolves in Next too).

- [ ] **Step 7: Commit.**
```powershell
git add tsconfig.json src/lib/content/types.ts content/tests/reading/gt-tool-libraries.ts src/lib/content/reading.ts tests/reading/content.test.ts
git commit -m "feat: reading content types, original seed test, and loader"
```

---

## Task 2: Reading scoring

**Files:**
- Create: `src/lib/reading/score-reading.ts`, `tests/reading/score-reading.test.ts`

- [ ] **Step 1: Write the failing test `C:\code\easyIELTS\tests\reading\score-reading.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { scoreReadingTest } from "@/lib/reading/score-reading";
import { getReadingTest } from "@/lib/content/reading";

const test = getReadingTest("gt-tool-libraries")!;

// The official answer key for the seed test.
const correctAnswers: Record<string, string> = {
  q1: "false", q2: "true", q3: "true", q4: "true", q5: "fee",
  q6: "idle", q7: "budget", q8: "B", q9: "C", q10: "workshops",
};

describe("scoreReadingTest", () => {
  it("scores a fully-correct attempt and scales the band to /40", () => {
    const result = scoreReadingTest(test, correctAnswers);
    expect(result.raw).toBe(10);
    expect(result.total).toBe(10);
    expect(result.scaledTo40).toBe(40);
    expect(result.band).toBe(9);
    expect(result.bandIsEstimated).toBe(true); // fewer than 40 questions
  });

  it("marks wrong/missing answers and reports per-question results", () => {
    const result = scoreReadingTest(test, { ...correctAnswers, q1: "true", q5: "" });
    expect(result.raw).toBe(8);
    expect(result.results.find((r) => r.id === "q1")?.correct).toBe(false);
    expect(result.results.find((r) => r.id === "q5")?.correct).toBe(false);
  });

  it("handles an empty answer set", () => {
    const result = scoreReadingTest(test, {});
    expect(result.raw).toBe(0);
    expect(result.scaledTo40).toBe(0);
  });
});
```

- [ ] **Step 2: Run, confirm it FAILS.** `npx vitest run tests/reading/score-reading.test.ts` → FAIL.

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\lib\reading\score-reading.ts`:**
```ts
import type { ReadingTest } from "@/lib/content/types";
import { scoreObjective } from "@/lib/scoring/score";
import type { ObjectiveScore } from "@/lib/scoring/types";
import { gtReadingRawToBand } from "@/lib/ielts/bands";

export interface ReadingResult extends ObjectiveScore {
  /** Raw scaled to a 40-question equivalent (exact when total === 40). */
  scaledTo40: number;
  /** GT Reading band for the scaled score. */
  band: number;
  /** True when the test has fewer than 40 questions, so the band is an estimate. */
  bandIsEstimated: boolean;
}

export function scoreReadingTest(
  test: ReadingTest,
  answers: Record<string, string>,
): ReadingResult {
  const questions = test.sections.flatMap((section) => section.questions);
  const objective = scoreObjective(questions, answers);
  const scaledTo40 =
    objective.total === 0
      ? 0
      : objective.total === 40
        ? objective.raw
        : Math.round((objective.raw / objective.total) * 40);
  return {
    ...objective,
    scaledTo40,
    band: gtReadingRawToBand(scaledTo40),
    bandIsEstimated: objective.total !== 40,
  };
}
```

- [ ] **Step 4: Run, confirm it PASSES.** `npx vitest run tests/reading/score-reading.test.ts` → PASS.

- [ ] **Step 5: Commit.**
```powershell
git add src/lib/reading/score-reading.ts tests/reading/score-reading.test.ts
git commit -m "feat: reading test scoring with GT band estimate"
```

---

## Task 3: Question renderer component

**Files:**
- Create: `src/components/reading/QuestionView.tsx`, `tests/reading/QuestionView.test.tsx`

- [ ] **Step 1: Write the failing component test `C:\code\easyIELTS\tests\reading\QuestionView.test.tsx`:**
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionView } from "@/components/reading/QuestionView";
import type { ReadingQuestion } from "@/lib/content/types";

const tfng: ReadingQuestion = {
  id: "q1", number: 1, type: "true_false_notgiven",
  prompt: "The sky is green.", accepted: ["false"],
};
const text: ReadingQuestion = {
  id: "q5", number: 5, type: "sentence_completion", wordLimit: 2,
  prompt: "Members pay an annual ______.", accepted: ["fee"],
};

describe("QuestionView", () => {
  it("renders True/False/Not Given options for a TFNG question and reports changes", async () => {
    const onChange = vi.fn();
    render(<QuestionView question={tfng} value="" onChange={onChange} />);
    expect(screen.getByText(/The sky is green/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /^False$/i }));
    expect(onChange).toHaveBeenCalledWith("false");
  });

  it("renders a text input for completion questions", async () => {
    const onChange = vi.fn();
    render(<QuestionView question={text} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "fee");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows the correct answer in review mode when incorrect", () => {
    render(
      <QuestionView question={tfng} value="true" onChange={() => {}} disabled
        result={{ correct: false, accepted: ["false"] }} />,
    );
    expect(screen.getByText(/correct answer: false/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, confirm it FAILS.** `npx vitest run tests/reading/QuestionView.test.tsx` → FAIL.

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\components\reading\QuestionView.tsx`:**
```tsx
import type { ReadingQuestion, QuestionOption } from "@/lib/content/types";

const FIXED_OPTIONS: Record<string, QuestionOption[] | undefined> = {
  true_false_notgiven: [
    { value: "true", label: "True" },
    { value: "false", label: "False" },
    { value: "not given", label: "Not Given" },
  ],
  yes_no_notgiven: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "not given", label: "Not Given" },
  ],
};

export interface QuestionViewProps {
  question: ReadingQuestion;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  result?: { correct: boolean; accepted: string[] };
}

export function QuestionView({ question, value, onChange, disabled, result }: QuestionViewProps) {
  const options = question.options ?? FIXED_OPTIONS[question.type];

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <p className="mb-2 text-sm">
        <span className="font-semibold">{question.number}.</span> {question.prompt}
      </p>

      {options ? (
        <div role="radiogroup" aria-label={`Question ${question.number}`} className="flex flex-col gap-1">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`q-${question.id}`}
                value={opt.value}
                checked={value === opt.value}
                disabled={disabled}
                onChange={() => onChange(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`Question ${question.number} answer`}
          placeholder={question.wordLimit ? `Max ${question.wordLimit} word(s)` : undefined}
          className="w-full max-w-xs rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
      )}

      {result && (
        <p className={`mt-2 text-xs font-medium ${result.correct ? "text-green-600" : "text-red-600"}`}>
          {result.correct ? "Correct" : `Incorrect — correct answer: ${result.accepted.join(" / ")}`}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm it PASSES.** `npx vitest run tests/reading/QuestionView.test.tsx` → PASS.

- [ ] **Step 5: Commit.**
```powershell
git add src/components/reading/QuestionView.tsx tests/reading/QuestionView.test.tsx
git commit -m "feat: reading question renderer (choice + text, review state)"
```

---

## Task 4: Results summary + ReadingRunner (client)

**Files:**
- Create: `src/components/reading/ResultsSummary.tsx`, `src/components/reading/ReadingRunner.tsx`, `tests/reading/ReadingRunner.test.tsx`

- [ ] **Step 1: Create `C:\code\easyIELTS\src\components\reading\ResultsSummary.tsx`:**
```tsx
import type { ReadingResult } from "@/lib/reading/score-reading";

export function ResultsSummary({ result }: { result: ReadingResult }) {
  const toSeven = Math.max(0, 7 - result.band);
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950">
      <h2 className="text-lg font-semibold">Your result</h2>
      <p className="mt-1 text-3xl font-bold">
        Band {result.band.toFixed(1)}
        {result.bandIsEstimated && (
          <span className="ml-2 align-middle text-xs font-normal text-gray-500">estimated</span>
        )}
      </p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {result.raw} / {result.total} correct
        {result.bandIsEstimated && ` (scaled to ${result.scaledTo40}/40)`}
      </p>
      <p className="mt-2 text-sm">
        {result.band >= 7
          ? "On target — Band 7 or above. 🎯"
          : `${toSeven.toFixed(1)} band(s) below your Band 7 goal.`}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing runner test `C:\code\easyIELTS\tests\reading\ReadingRunner.test.tsx`:**
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadingRunner } from "@/components/reading/ReadingRunner";
import { getReadingTest } from "@/lib/content/reading";

const test = getReadingTest("gt-tool-libraries")!;

describe("ReadingRunner", () => {
  it("renders the passage and questions, then scores on submit", async () => {
    render(<ReadingRunner test={test} />);
    expect(screen.getByText(/Community Tool Libraries/)).toBeInTheDocument();
    // Answer question 1 correctly (False) then submit.
    await userEvent.click(screen.getAllByRole("radio", { name: /^False$/i })[0]);
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    // Results appear with a band.
    expect(await screen.findByText(/Your result/)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 10 correct/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run, confirm it FAILS.** `npx vitest run tests/reading/ReadingRunner.test.tsx` → FAIL.

- [ ] **Step 4: Implement `C:\code\easyIELTS\src\components\reading\ReadingRunner.tsx`:**
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReadingTest } from "@/lib/content/types";
import { scoreReadingTest, type ReadingResult } from "@/lib/reading/score-reading";
import { QuestionView } from "./QuestionView";
import { ResultsSummary } from "./ResultsSummary";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ReadingRunner({ test }: { test: ReadingTest }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(test.timeMinutes * 60);

  const submitted = result !== null;

  function handleSubmit() {
    setResult((prev) => prev ?? scoreReadingTest(test, answers));
  }

  // Countdown; auto-submit at zero.
  useEffect(() => {
    if (submitted) return;
    if (secondsLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, submitted]);

  const resultById = useMemo(() => {
    if (!result) return {} as Record<string, { correct: boolean; accepted: string[] }>;
    return Object.fromEntries(
      result.results.map((r) => [r.id, { correct: r.correct, accepted: r.accepted }]),
    );
  }, [result]);

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{test.title}</h1>
          <p className="text-sm text-amber-600">🎯 Band 7 (GT Reading) = 34–35 / 40</p>
        </div>
        {!submitted && (
          <span className="rounded-lg bg-gray-900 px-3 py-1 font-mono text-white">
            ⏱ {formatTime(secondsLeft)}
          </span>
        )}
      </header>

      {submitted && <ResultsSummary result={result!} />}

      {test.sections.map((section) => (
        <section key={section.id} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="prose-sm max-w-none">
            <h2 className="text-lg font-semibold">{section.passageTitle}</h2>
            {section.passageParagraphs.map((p, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {p}
              </p>
            ))}
          </article>
          <div className="flex flex-col gap-3">
            {section.questions.map((q) => (
              <QuestionView
                key={q.id}
                question={q}
                value={answers[q.id] ?? ""}
                onChange={(v) => setAnswer(q.id, v)}
                disabled={submitted}
                result={resultById[q.id]}
              />
            ))}
          </div>
        </section>
      ))}

      {!submitted && (
        <button
          onClick={handleSubmit}
          className="self-start rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700"
        >
          Submit &amp; score
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run, confirm it PASSES.** `npx vitest run tests/reading/ReadingRunner.test.tsx` → PASS. (If the countdown causes act() warnings, they are non-fatal; the assertion on results is what matters.)

- [ ] **Step 6: Commit.**
```powershell
git add src/components/reading/ResultsSummary.tsx src/components/reading/ReadingRunner.tsx tests/reading/ReadingRunner.test.tsx
git commit -m "feat: ReadingRunner client component with timer, submit, and results"
```

---

## Task 5: Routes + landing link + verification

**Files:**
- Create: `src/app/reading/page.tsx`, `src/app/reading/[testId]/page.tsx`
- Modify: `src/app/page.tsx` (link the Reading card)

- [ ] **Step 1: Create the list page `C:\code\easyIELTS\src\app\reading\page.tsx`:**
```tsx
import Link from "next/link";
import { getReadingTests } from "@/lib/content/reading";

export const metadata = {
  title: "Reading practice — easyIELTS",
};

export default function ReadingIndexPage() {
  const tests = getReadingTests();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">GT Reading practice</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Take a test, submit, and get an instant score and band estimate.
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {tests.map((test) => (
          <li key={test.id}>
            <Link
              href={`/reading/${test.id}`}
              className="block rounded-xl border border-gray-200 p-4 hover:border-indigo-400 dark:border-gray-700"
            >
              <span className="font-semibold">{test.title}</span>
              <span className="ml-2 text-sm text-gray-500">~{test.timeMinutes} min</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Create the runner page `C:\code\easyIELTS\src\app\reading\[testId]\page.tsx`** (Next 16: `params` is a Promise; prerender known tests):
```tsx
import { notFound } from "next/navigation";
import { getReadingTest, getReadingTests } from "@/lib/content/reading";
import { ReadingRunner } from "@/components/reading/ReadingRunner";

export function generateStaticParams() {
  return getReadingTests().map((test) => ({ testId: test.id }));
}

export default async function ReadingTestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const test = getReadingTest(testId);
  if (!test) notFound();
  return <ReadingRunner test={test} />;
}
```

- [ ] **Step 3: Link the Reading card on the landing page.** In `C:\code\easyIELTS\src\app\page.tsx`, wrap the Reading card content in a `next/link` to `/reading`. Add at the top:
```tsx
import Link from "next/link";
```
Then change the Reading entry so it links. Replace the `SKILLS.map(...)` card block with one that renders a `<Link>` for Reading and a plain `<div>` for the others:
```tsx
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SKILLS.map((s) => {
          const card = (
            <div className="h-full rounded-xl border border-gray-200 p-5 hover:border-indigo-400 dark:border-gray-700">
              <h2 className="text-xl font-semibold">{s.name}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{s.target}</p>
            </div>
          );
          return s.name === "Reading" ? (
            <Link key={s.name} href="/reading">{card}</Link>
          ) : (
            <div key={s.name}>{card}</div>
          );
        })}
      </section>
```
(Keep the existing `SKILLS` array and header unchanged. The existing landing-page test must still pass — it only checks the `easyIELTS` heading and that "Band 7" text appears, both of which remain.)

- [ ] **Step 4: Full verification.**
```powershell
cd C:\code\easyIELTS
npm run test
npm run lint
npm run build
```
Expected: ALL tests pass (foundation + scoring + new reading suites), lint exit 0 no warnings, build compiles and the route table now includes `/reading` and `/reading/[testId]` (the latter prerendered for `gt-tool-libraries`).

- [ ] **Step 5: Smoke-test the running app** (start the custom server, fetch the pages, then stop it — leave no node processes):
```powershell
$p = Start-Process npm -ArgumentList "run","start" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 14
try {
  $home = (Invoke-WebRequest http://localhost:3000/ -UseBasicParsing -TimeoutSec 5)
  $list = (Invoke-WebRequest http://localhost:3000/reading -UseBasicParsing -TimeoutSec 5)
  $run  = (Invoke-WebRequest http://localhost:3000/reading/gt-tool-libraries -UseBasicParsing -TimeoutSec 5)
  Write-Output "home=$($home.StatusCode) list=$($list.StatusCode) run=$($run.StatusCode)"
  Write-Output ("runHasPassage=" + ($run.Content -match "Community Tool Libraries"))
} finally {
  if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force }
  Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -gt (Get-Date).AddMinutes(-2) } | Stop-Process -Force -ErrorAction SilentlyContinue
}
```
Expected: `home=200 list=200 run=200` and `runHasPassage=True`.

- [ ] **Step 6: Commit.**
```powershell
git add src/app/reading/page.tsx "src/app/reading/[testId]/page.tsx" src/app/page.tsx
git commit -m "feat: reading routes and landing-page link"
```

---

## Done criteria

- Visiting `/reading` lists the seed test; `/reading/gt-tool-libraries` runs it.
- Answering and submitting shows raw score, GT band (estimated, scaled to /40), distance-to-Band-7, and per-question review with correct answers.
- A countdown timer auto-submits at zero.
- `npm run test` / `lint` / `build` all green; the running server serves all three pages (200) with the passage present.
- All content is original (no copyrighted exam material committed).

## Notes for later plans

- Persistence (saving attempts to localStorage/DB) is **Plan 8** — `ReadingRunner` currently shows results in-session only.
- Additional/full 40-question tests come from **Plan 7** (AI content generation); the scaling + `bandIsEstimated` flag already handles non-40 tests.
- The Listening module (**Plan 4**) will reuse `QuestionView`, the scoring engine, and `listeningRawToBand`, adding a play-once audio player.
