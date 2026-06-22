# easyIELTS Listening Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a GT/Academic Listening practice module: a play-once audio player (browser Speech Synthesis), synced questions, instant auto-scoring with the Listening band table, and a per-question review that reveals the transcript.

**Architecture:** Reuse the Reading building blocks — `QuestionView`, `ResultsSummary`, the scoring engine, and `listeningRawToBand`. New pieces: listening content types + an original seed test (transcript + questions), `scoreListeningTest`, an `AudioPlayer` that speaks the transcript once via the Web Speech API (with an injectable `speak` for tests), and a `ListeningRunner` client component. Two routes mirror Reading.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind · Vitest + RTL. Audio: `window.speechSynthesis` (real Gemini‑TTS audio files arrive in the content-generation plan).

**Depends on (already on `main`):** `src/lib/scoring/*`, `src/lib/ielts/bands.ts` (`listeningRawToBand`), `src/components/reading/QuestionView.tsx`, `src/components/reading/ResultsSummary.tsx`, `src/lib/content/types.ts`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/content/types.ts` (modify) | Add `ListeningSection`, `ListeningTest` (reuse `ReadingQuestion`) |
| `content/tests/listening/gt-community-hall.ts` | Original seed listening test (transcript + 8 questions + key) |
| `src/lib/content/listening.ts` | `getListeningTests()`, `getListeningTest(id)` |
| `src/lib/listening/score-listening.ts` | `scoreListeningTest()` (reuses scoring engine + `listeningRawToBand`) |
| `src/components/listening/AudioPlayer.tsx` | Play-once transcript player (injectable `speak`) |
| `src/components/listening/ListeningRunner.tsx` | `"use client"` runner (audio, questions, timer, submit, review) |
| `src/app/listening/page.tsx`, `src/app/listening/[testId]/page.tsx` | List + runner routes |
| `src/app/page.tsx` (modify) | Link the Listening card to `/listening` |
| `tests/listening/*` | Unit + component tests |

---

## Task 1: Listening content types, seed test, and loader

**Files:** Modify `src/lib/content/types.ts`; Create `content/tests/listening/gt-community-hall.ts`, `src/lib/content/listening.ts`, `tests/listening/content.test.ts`

- [ ] **Step 1: Append listening types to `C:\code\easyIELTS\src\lib\content\types.ts`** (keep all existing exports; add at the end):
```ts
export interface ListeningSection {
  id: string;
  name: string;
  /** The audio transcript, spoken by the player and revealed in review. */
  script: string;
  questions: ReadingQuestion[];
}

export interface ListeningTest {
  id: string;
  skill: "listening";
  title: string;
  timeMinutes: number;
  sections: ListeningSection[];
}
```

- [ ] **Step 2: Create the original seed `C:\code\easyIELTS\content\tests\listening\gt-community-hall.ts`** (ALL original — no copied exam material):
```ts
import type { ListeningTest } from "@/lib/content/types";

export const communityHallTest: ListeningTest = {
  id: "gt-community-hall",
  skill: "listening",
  title: "Listening Practice — Booking a Community Hall",
  timeMinutes: 10,
  sections: [
    {
      id: "p1",
      name: "Part 1",
      script:
        "Receptionist: Good morning, Riverside Community Centre, how can I help you? " +
        "Caller: Hi, I'd like to book a room for a children's party next month. " +
        "Receptionist: Of course. What date were you thinking of? " +
        "Caller: Saturday the fourteenth, in the afternoon. " +
        "Receptionist: Let me check. Yes, the main hall is free from two o'clock. How many guests are you expecting? " +
        "Caller: About twenty-five children, plus a few parents. " +
        "Receptionist: That's fine, the hall holds up to sixty. The afternoon rate is forty pounds for three hours. " +
        "Caller: Great. Does that include tables and chairs? " +
        "Receptionist: Yes, tables and chairs are included, but you'll need to bring your own decorations. " +
        "Caller: Understood. Is there a kitchen we can use? " +
        "Receptionist: There's a small kitchen with a kettle and a fridge, but no oven, so please bring food ready to serve. " +
        "Caller: Perfect. And how do I pay? " +
        "Receptionist: We take a ten-pound deposit now to hold the booking, and the rest on the day.",
      questions: [
        { id: "l1", number: 1, type: "sentence_completion", wordLimit: 1,
          prompt: "Booking date: Saturday the ______.", accepted: ["fourteenth", "14th", "14"] },
        { id: "l2", number: 2, type: "sentence_completion", wordLimit: 1,
          prompt: "The main hall is free from ______ o'clock.", accepted: ["two", "2"] },
        { id: "l3", number: 3, type: "sentence_completion", wordLimit: 1,
          prompt: "Number of children expected: ______.", accepted: ["twenty-five", "twenty five", "25"] },
        { id: "l4", number: 4, type: "sentence_completion", wordLimit: 1,
          prompt: "Afternoon rate: £______ for three hours.", accepted: ["forty", "40"] },
        { id: "l5", number: 5, type: "sentence_completion", wordLimit: 1,
          prompt: "Deposit required now: £______.", accepted: ["ten", "10"] },
        { id: "l6", number: 6, type: "single_choice",
          prompt: "What is included in the hire price?",
          options: [
            { value: "A", label: "decorations" },
            { value: "B", label: "tables and chairs" },
            { value: "C", label: "food" },
          ],
          accepted: ["B"] },
        { id: "l7", number: 7, type: "single_choice",
          prompt: "What does the kitchen NOT have?",
          options: [
            { value: "A", label: "a kettle" },
            { value: "B", label: "a fridge" },
            { value: "C", label: "an oven" },
          ],
          accepted: ["C"] },
        { id: "l8", number: 8, type: "true_false_notgiven",
          prompt: "The caller must pay the full amount at the time of booking.",
          accepted: ["false"] },
      ],
    },
  ],
};
```

- [ ] **Step 3: Create the loader `C:\code\easyIELTS\src\lib\content\listening.ts`:**
```ts
import type { ListeningTest } from "./types";
import { communityHallTest } from "@content/tests/listening/gt-community-hall";

const LISTENING_TESTS: ListeningTest[] = [communityHallTest];

export function getListeningTests(): ListeningTest[] {
  return LISTENING_TESTS;
}

export function getListeningTest(id: string): ListeningTest | undefined {
  return LISTENING_TESTS.find((test) => test.id === id);
}
```

- [ ] **Step 4: Write `C:\code\easyIELTS\tests\listening\content.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { getListeningTests, getListeningTest } from "@/lib/content/listening";

describe("listening content", () => {
  it("exposes a test with a non-empty script and questions", () => {
    const tests = getListeningTests();
    expect(tests.length).toBeGreaterThan(0);
    const test = getListeningTest(tests[0].id)!;
    expect(test.sections[0].script.length).toBeGreaterThan(50);
    expect(test.sections[0].questions.length).toBeGreaterThan(0);
    expect(getListeningTest("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 5: Run + build, then commit.**
```powershell
cd C:\code\easyIELTS
npx vitest run tests/listening/content.test.ts
npm run build
git add src/lib/content/types.ts content/tests/listening/gt-community-hall.ts src/lib/content/listening.ts tests/listening/content.test.ts
git commit -m "feat: listening content types, original seed test, and loader"
```

---

## Task 2: Listening scoring

**Files:** Create `src/lib/listening/score-listening.ts`, `tests/listening/score-listening.test.ts`

- [ ] **Step 1: Write the failing test `C:\code\easyIELTS\tests\listening\score-listening.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { scoreListeningTest } from "@/lib/listening/score-listening";
import { getListeningTest } from "@/lib/content/listening";

const test = getListeningTest("gt-community-hall")!;
const key: Record<string, string> = {
  l1: "fourteenth", l2: "two", l3: "25", l4: "40", l5: "ten", l6: "B", l7: "C", l8: "false",
};

describe("scoreListeningTest", () => {
  it("scores a fully-correct attempt and maps a band via the Listening table", () => {
    const result = scoreListeningTest(test, key);
    expect(result.raw).toBe(8);
    expect(result.total).toBe(8);
    expect(result.scaledTo40).toBe(40);
    expect(result.band).toBe(9);
    expect(result.bandIsEstimated).toBe(true);
  });

  it("accepts numeric or word variants and marks misses", () => {
    const result = scoreListeningTest(test, { ...key, l1: "14", l4: "wrong" });
    expect(result.results.find((r) => r.id === "l1")?.correct).toBe(true); // "14" accepted
    expect(result.results.find((r) => r.id === "l4")?.correct).toBe(false);
    expect(result.raw).toBe(7);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.** `npx vitest run tests/listening/score-listening.test.ts`

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\lib\listening\score-listening.ts`:**
```ts
import type { ListeningTest } from "@/lib/content/types";
import { scoreObjective } from "@/lib/scoring/score";
import type { ObjectiveScore } from "@/lib/scoring/types";
import { listeningRawToBand } from "@/lib/ielts/bands";

export interface ListeningResult extends ObjectiveScore {
  scaledTo40: number;
  band: number;
  bandIsEstimated: boolean;
}

export function scoreListeningTest(
  test: ListeningTest,
  answers: Record<string, string>,
): ListeningResult {
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
    band: listeningRawToBand(scaledTo40),
    bandIsEstimated: objective.total !== 40,
  };
}
```

- [ ] **Step 4: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/listening/score-listening.test.ts
git add src/lib/listening/score-listening.ts tests/listening/score-listening.test.ts
git commit -m "feat: listening scoring with Listening band table"
```

---

## Task 3: Play-once AudioPlayer

**Files:** Create `src/components/listening/AudioPlayer.tsx`, `tests/listening/AudioPlayer.test.tsx`

- [ ] **Step 1: Write the failing test `C:\code\easyIELTS\tests\listening\AudioPlayer.test.tsx`:**
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AudioPlayer } from "@/components/listening/AudioPlayer";

describe("AudioPlayer", () => {
  it("plays the script once and disables replay", async () => {
    const speak = vi.fn((_text: string, onEnd: () => void) => onEnd());
    render(<AudioPlayer script="hello world" speak={speak} />);
    const button = screen.getByRole("button", { name: /play audio/i });
    await userEvent.click(button);
    expect(speak).toHaveBeenCalledWith("hello world", expect.any(Function));
    // After playing once, the control is disabled (play-once).
    expect(screen.getByRole("button", { name: /play/i })).toBeDisabled();
  });

  it("does not start a second playback", async () => {
    const speak = vi.fn((_t: string, _onEnd: () => void) => {}); // never ends
    render(<AudioPlayer script="x" speak={speak} />);
    const button = screen.getByRole("button", { name: /play audio/i });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(speak).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\components\listening\AudioPlayer.tsx`:**
```tsx
"use client";

import { useState } from "react";

export type SpeakFn = (text: string, onEnd: () => void) => void;

const defaultSpeak: SpeakFn = (text, onEnd) => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.onend = () => onEnd();
  utterance.onerror = () => onEnd();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

type Status = "idle" | "playing" | "done";

export function AudioPlayer({ script, speak = defaultSpeak }: { script: string; speak?: SpeakFn }) {
  const [status, setStatus] = useState<Status>("idle");

  function play() {
    if (status !== "idle") return;
    setStatus("playing");
    speak(script, () => setStatus("done"));
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <button
        type="button"
        onClick={play}
        disabled={status !== "idle"}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        ▶ Play audio (plays once)
      </button>
      <span className="text-sm text-gray-500">
        {status === "idle" && "The recording plays once only."}
        {status === "playing" && "Playing…"}
        {status === "done" && "Finished — answer the questions."}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/listening/AudioPlayer.test.tsx
git add src/components/listening/AudioPlayer.tsx tests/listening/AudioPlayer.test.tsx
git commit -m "feat: play-once listening audio player (Speech Synthesis)"
```

---

## Task 4: ListeningRunner (client)

**Files:** Create `src/components/listening/ListeningRunner.tsx`, `tests/listening/ListeningRunner.test.tsx`

- [ ] **Step 1: Write the failing test `C:\code\easyIELTS\tests\listening\ListeningRunner.test.tsx`:**
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListeningRunner } from "@/components/listening/ListeningRunner";
import { getListeningTest } from "@/lib/content/listening";

const test = getListeningTest("gt-community-hall")!;

describe("ListeningRunner", () => {
  it("plays audio, scores on submit, and reveals the transcript in review", async () => {
    render(<ListeningRunner test={test} />);
    expect(screen.getByText(/Booking a Community Hall/)).toBeInTheDocument();
    // Transcript is hidden before submitting.
    expect(screen.queryByText(/Riverside Community Centre/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /play audio/i }));
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/Your result/)).toBeInTheDocument();
    // Transcript revealed after submit.
    expect(screen.getByText(/Riverside Community Centre/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\components\listening\ListeningRunner.tsx`:**
```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ListeningTest } from "@/lib/content/types";
import { scoreListeningTest, type ListeningResult } from "@/lib/listening/score-listening";
import { QuestionView } from "@/components/reading/QuestionView";
import { ResultsSummary } from "@/components/reading/ResultsSummary";
import { AudioPlayer } from "./AudioPlayer";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ListeningRunner({ test }: { test: ListeningTest }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ListeningResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(test.timeMinutes * 60);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submitted = result !== null;

  useEffect(() => {
    if (submitted) return;
    if (secondsLeft <= 0) {
      setResult((prev) => prev ?? scoreListeningTest(test, answersRef.current));
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, submitted, test]);

  const resultById = useMemo(() => {
    if (!result) return {} as Record<string, { correct: boolean; accepted: string[] }>;
    return Object.fromEntries(
      result.results.map((r) => [r.id, { correct: r.correct, accepted: r.accepted }]),
    );
  }, [result]);

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }
  function handleSubmit() {
    setResult((prev) => prev ?? scoreListeningTest(test, answersRef.current));
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{test.title}</h1>
          <p className="text-sm text-amber-600">🎯 Band 7 (Listening) = 30–31 / 40</p>
        </div>
        {!submitted && (
          <span className="rounded-lg bg-gray-900 px-3 py-1 font-mono text-white">⏱ {formatTime(secondsLeft)}</span>
        )}
      </header>

      {result && <ResultsSummary result={result} />}

      {test.sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{section.name}</h2>
          {!submitted && <AudioPlayer script={section.script} />}
          {submitted && (
            <details className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700" open>
              <summary className="cursor-pointer font-medium">Transcript</summary>
              <p className="mt-2 leading-relaxed text-gray-700 dark:text-gray-300">{section.script}</p>
            </details>
          )}
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

- [ ] **Step 4: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/listening/ListeningRunner.test.tsx
git add src/components/listening/ListeningRunner.tsx tests/listening/ListeningRunner.test.tsx
git commit -m "feat: ListeningRunner with play-once audio, scoring, transcript review"
```

---

## Task 5: Routes + landing link + verification

**Files:** Create `src/app/listening/page.tsx`, `src/app/listening/[testId]/page.tsx`; Modify `src/app/page.tsx`

- [ ] **Step 1: Create `C:\code\easyIELTS\src\app\listening\page.tsx`:**
```tsx
import Link from "next/link";
import { getListeningTests } from "@/lib/content/listening";

export const metadata = { title: "Listening practice — easyIELTS" };

export default function ListeningIndexPage() {
  const tests = getListeningTests();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Listening practice</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          The recording plays once. Answer, submit, and get your band instantly.
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {tests.map((test) => (
          <li key={test.id}>
            <Link href={`/listening/${test.id}`} className="block rounded-xl border border-gray-200 p-4 hover:border-indigo-400 dark:border-gray-700">
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

- [ ] **Step 2: Create `C:\code\easyIELTS\src\app\listening\[testId]\page.tsx`:**
```tsx
import { notFound } from "next/navigation";
import { getListeningTest, getListeningTests } from "@/lib/content/listening";
import { ListeningRunner } from "@/components/listening/ListeningRunner";

export function generateStaticParams() {
  return getListeningTests().map((test) => ({ testId: test.id }));
}

export default async function ListeningTestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const test = getListeningTest(testId);
  if (!test) notFound();
  return <ListeningRunner test={test} />;
}
```

- [ ] **Step 3: Link the Listening card on the landing page.** In `C:\code\easyIELTS\src\app\page.tsx`, the cards already branch on `s.name`. Extend the branch so `"Listening"` links to `/listening` just like Reading links to `/reading`. Replace the existing return inside `SKILLS.map(...)` with:
```tsx
          const href = s.name === "Reading" ? "/reading" : s.name === "Listening" ? "/listening" : null;
          return href ? (
            <Link key={s.name} href={href}>{card}</Link>
          ) : (
            <div key={s.name}>{card}</div>
          );
```
(Keep the `card` variable and the rest of the component unchanged. The foundation landing-page test must still pass.)

- [ ] **Step 4: Full verification.**
```powershell
cd C:\code\easyIELTS
npm run test
npm run lint
npm run build
```
Expected: all tests pass (now includes listening suites), lint exit 0 no warnings, build compiles with `/listening` and `/listening/[testId]` routes.

- [ ] **Step 5: Server smoke test** (use a NON-reserved variable; never `$home`):
```powershell
$p = Start-Process npm -ArgumentList "run","start" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 14
try {
  $list = (Invoke-WebRequest http://localhost:3000/listening -UseBasicParsing -TimeoutSec 5).StatusCode
  $run  = (Invoke-WebRequest http://localhost:3000/listening/gt-community-hall -UseBasicParsing -TimeoutSec 5)
  Write-Output "list=$list run=$($run.StatusCode) hasPlayer=$($run.Content -match 'Play audio')"
} finally {
  if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force }
  Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -gt (Get-Date).AddMinutes(-2) } | Stop-Process -Force -ErrorAction SilentlyContinue
}
```
Expected: `list=200 run=200 hasPlayer=True`; no node processes left.

- [ ] **Step 6: Commit.**
```powershell
git add src/app/listening/page.tsx "src/app/listening/[testId]/page.tsx" src/app/page.tsx
git commit -m "feat: listening routes and landing-page link"
```

---

## Done criteria

- `/listening` lists the seed test; `/listening/gt-community-hall` runs it: play-once audio, answer, submit → raw, Listening band (estimated/scaled), distance-to-7, per-question review with the transcript revealed.
- `npm run test` / `lint` / `build` green; server serves both pages (200).
- All content original; no audio binaries committed (Speech Synthesis at runtime).

## Notes for later plans

- Real recorded/TTS audio files (replacing Speech Synthesis) come with the content-generation plan (Gemini TTS, pre-generated under `public/audio/`).
- `ResultsSummary` and the timer logic are now shared informally by Reading and Listening; a future refactor could extract a generic `TestRunner`/`useCountdown` (deferred — not needed yet).
