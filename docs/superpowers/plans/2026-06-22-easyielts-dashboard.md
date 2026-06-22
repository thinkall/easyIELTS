# easyIELTS Persistence + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Persist each test attempt (anonymous → browser `localStorage`) behind a clean storage interface, wire all four skill runners to record their results, and add a Band-7 progress dashboard showing per-skill bands, distance to 7, overall band, and history.

**Architecture:** A `StorageAdapter` interface with a `LocalStorageAdapter` implementation keeps persistence swappable (a DB-backed `ApiAdapter` for logged-in users can be added later without touching callers — that's the spec's multi-user path). A pure `computeStats(attempts)` function does all aggregation (tested). Runners call `recordAttempt(...)` on completion. The dashboard reads attempts and renders stats.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind · Vitest + RTL (jsdom provides `localStorage`). All client-side and fully testable.

**Depends on (already on `main`):** the four runners (Reading/Listening/Writing/Speaking), `src/lib/ielts/aggregate.ts` (`overallBand`), `src/lib/ielts/rounding.ts`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/storage/types.ts` | `Attempt`, `Skill`, `SkillStats`, `DashboardStats` |
| `src/lib/storage/adapter.ts` | `StorageAdapter` interface + `getStorage()` (returns local adapter) + `recordAttempt()` |
| `src/lib/storage/local.ts` | `LocalStorageAdapter` (read/write `localStorage`) |
| `src/lib/storage/stats.ts` | `computeStats(attempts)` (pure aggregation) |
| `src/components/dashboard/Dashboard.tsx` | Renders stats + history (injectable attempts) |
| `src/app/dashboard/page.tsx` | Dashboard route |
| `src/app/page.tsx` (modify) | Add a Dashboard link |
| `src/components/reading/ReadingRunner.tsx` (modify) | Record attempt on submit |
| `src/components/listening/ListeningRunner.tsx` (modify) | Record attempt on submit |
| `src/components/writing/WritingRunner.tsx` (modify) | Record attempt when both tasks scored |
| `src/components/speaking/SpeakingRunner.tsx` (modify) | Record attempt on score |
| `tests/storage/*`, `tests/dashboard/*` | Unit + component tests |

---

## Task 1: Storage types, local adapter, recordAttempt

**Files:** Create `src/lib/storage/types.ts`, `src/lib/storage/local.ts`, `src/lib/storage/adapter.ts`, `tests/storage/local.test.ts`

- [ ] **Step 1: Create `C:\code\easyIELTS\src\lib\storage\types.ts`:**
```ts
export type Skill = "reading" | "listening" | "writing" | "speaking";

export interface Attempt {
  id: string;
  skill: Skill;
  testId: string;
  title: string;
  band: number;        // the skill band for this attempt
  raw?: number;        // reading/listening: correct answers
  total?: number;      // reading/listening: total questions
  estimated?: boolean; // band scaled from < 40 questions
  createdAt: number;   // epoch ms
}

export interface SkillStats {
  skill: Skill;
  latest: number | null;
  best: number | null;
  attempts: number;
  history: { createdAt: number; band: number }[];
  distanceToSeven: number | null; // max(0, 7 - latest); null if no attempts
  metTarget: boolean;             // latest >= 7
}

export interface DashboardStats {
  perSkill: Record<Skill, SkillStats>;
  overall: number | null;         // overall band from latest of each skill (needs all 4)
  overallDistanceToSeven: number | null;
  totalAttempts: number;
}
```

- [ ] **Step 2: Write the failing test `C:\code\easyIELTS\tests\storage\local.test.ts`:**
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageAdapter } from "@/lib/storage/local";

beforeEach(() => localStorage.clear());

describe("LocalStorageAdapter", () => {
  it("saves and lists attempts (newest first)", () => {
    const store = new LocalStorageAdapter();
    store.saveAttempt({ id: "a", skill: "reading", testId: "t", title: "T", band: 6.5, createdAt: 1 });
    store.saveAttempt({ id: "b", skill: "listening", testId: "t2", title: "T2", band: 7, createdAt: 2 });
    const all = store.listAttempts();
    expect(all.map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("clears all attempts", () => {
    const store = new LocalStorageAdapter();
    store.saveAttempt({ id: "a", skill: "reading", testId: "t", title: "T", band: 6, createdAt: 1 });
    store.clear();
    expect(store.listAttempts()).toEqual([]);
  });

  it("tolerates corrupt storage by returning an empty list", () => {
    localStorage.setItem("easyielts.attempts", "{not json");
    expect(new LocalStorageAdapter().listAttempts()).toEqual([]);
  });
});
```

- [ ] **Step 3: Run, confirm FAIL.** `npx vitest run tests/storage/local.test.ts`

- [ ] **Step 4: Implement `C:\code\easyIELTS\src\lib\storage\local.ts`:**
```ts
import type { Attempt } from "./types";

const KEY = "easyielts.attempts";

/** Persists attempts in the browser's localStorage (anonymous users). */
export class LocalStorageAdapter {
  private read(): Attempt[] {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as Attempt[]) : [];
    } catch {
      return [];
    }
  }

  private write(attempts: Attempt[]): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(attempts));
  }

  listAttempts(): Attempt[] {
    return this.read().sort((a, b) => b.createdAt - a.createdAt);
  }

  saveAttempt(attempt: Attempt): void {
    this.write([...this.read(), attempt]);
  }

  clear(): void {
    this.write([]);
  }
}
```

- [ ] **Step 5: Implement `C:\code\easyIELTS\src\lib\storage\adapter.ts`:**
```ts
import type { Attempt } from "./types";
import { LocalStorageAdapter } from "./local";

export interface StorageAdapter {
  listAttempts(): Attempt[];
  saveAttempt(attempt: Attempt): void;
  clear(): void;
}

let instance: StorageAdapter | null = null;

/** The active storage adapter. Today: localStorage. Later: an API/DB adapter for logged-in users. */
export function getStorage(): StorageAdapter {
  if (!instance) instance = new LocalStorageAdapter();
  return instance;
}

/** Convenience: record a completed attempt (generates id + timestamp if absent). */
export function recordAttempt(input: Omit<Attempt, "id" | "createdAt"> & { id?: string; createdAt?: number }): void {
  const id = input.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));
  getStorage().saveAttempt({ ...input, id, createdAt: input.createdAt ?? Date.now() });
}
```

- [ ] **Step 6: Run, confirm PASS. Commit.**
```powershell
cd C:\code\easyIELTS
npx vitest run tests/storage/local.test.ts
git add src/lib/storage/types.ts src/lib/storage/local.ts src/lib/storage/adapter.ts tests/storage/local.test.ts
git commit -m "feat: storage adapter and localStorage attempt persistence"
```

---

## Task 2: Stats aggregation (pure)

**Files:** Create `src/lib/storage/stats.ts`, `tests/storage/stats.test.ts`

- [ ] **Step 1: Write the failing test `C:\code\easyIELTS\tests\storage\stats.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { computeStats } from "@/lib/storage/stats";
import type { Attempt } from "@/lib/storage/types";

const A = (skill: Attempt["skill"], band: number, createdAt: number): Attempt => ({
  id: `${skill}-${createdAt}`, skill, testId: "t", title: "T", band, createdAt,
});

describe("computeStats", () => {
  it("computes latest, best, and distance-to-7 per skill", () => {
    const stats = computeStats([A("reading", 6, 1), A("reading", 6.5, 3), A("reading", 7, 2)]);
    const r = stats.perSkill.reading;
    expect(r.latest).toBe(6.5);   // newest by createdAt (3)
    expect(r.best).toBe(7);
    expect(r.attempts).toBe(3);
    expect(r.distanceToSeven).toBe(0.5);
    expect(r.metTarget).toBe(false);
  });

  it("computes overall only when all four skills have attempts", () => {
    const none = computeStats([A("reading", 7, 1)]);
    expect(none.overall).toBeNull();
    const all = computeStats([A("reading", 7, 1), A("listening", 7, 1), A("writing", 6.5, 1), A("speaking", 6.5, 1)]);
    expect(all.overall).toBe(7); // (7+7+6.5+6.5)/4 = 6.75 -> 7
    expect(all.overallDistanceToSeven).toBe(0);
  });

  it("reports empty skills cleanly", () => {
    const stats = computeStats([]);
    expect(stats.totalAttempts).toBe(0);
    expect(stats.perSkill.writing.latest).toBeNull();
    expect(stats.perSkill.writing.metTarget).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\lib\storage\stats.ts`:**
```ts
import type { Attempt, Skill, SkillStats, DashboardStats } from "./types";
import { overallBand } from "@/lib/ielts/aggregate";

const SKILLS: Skill[] = ["reading", "listening", "writing", "speaking"];

function skillStats(skill: Skill, attempts: Attempt[]): SkillStats {
  const mine = attempts.filter((a) => a.skill === skill).sort((a, b) => a.createdAt - b.createdAt);
  if (mine.length === 0) {
    return { skill, latest: null, best: null, attempts: 0, history: [], distanceToSeven: null, metTarget: false };
  }
  const latest = mine[mine.length - 1].band;
  const best = Math.max(...mine.map((a) => a.band));
  return {
    skill,
    latest,
    best,
    attempts: mine.length,
    history: mine.map((a) => ({ createdAt: a.createdAt, band: a.band })),
    distanceToSeven: Math.max(0, Number((7 - latest).toFixed(1))),
    metTarget: latest >= 7,
  };
}

export function computeStats(attempts: Attempt[]): DashboardStats {
  const perSkill = Object.fromEntries(SKILLS.map((s) => [s, skillStats(s, attempts)])) as Record<Skill, SkillStats>;
  const haveAll = SKILLS.every((s) => perSkill[s].latest !== null);
  const overall = haveAll
    ? overallBand({
        listening: perSkill.listening.latest!,
        reading: perSkill.reading.latest!,
        writing: perSkill.writing.latest!,
        speaking: perSkill.speaking.latest!,
      })
    : null;
  return {
    perSkill,
    overall,
    overallDistanceToSeven: overall === null ? null : Math.max(0, Number((7 - overall).toFixed(1))),
    totalAttempts: attempts.length,
  };
}
```

- [ ] **Step 4: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/storage/stats.test.ts
git add src/lib/storage/stats.ts tests/storage/stats.test.ts
git commit -m "feat: dashboard stats aggregation"
```

---

## Task 3: Dashboard component + route

**Files:** Create `src/components/dashboard/Dashboard.tsx`, `src/app/dashboard/page.tsx`, `tests/dashboard/Dashboard.test.tsx`; Modify `src/app/page.tsx`

- [ ] **Step 1: Write the failing component test `C:\code\easyIELTS\tests\dashboard\Dashboard.test.tsx`:**
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { Attempt } from "@/lib/storage/types";

const attempts: Attempt[] = [
  { id: "1", skill: "reading", testId: "t", title: "Reading T", band: 6.5, raw: 33, total: 40, createdAt: 1 },
  { id: "2", skill: "listening", testId: "t", title: "Listening T", band: 7, createdAt: 2 },
];

describe("Dashboard", () => {
  it("shows per-skill bands and distance to Band 7", () => {
    render(<Dashboard attempts={attempts} />);
    expect(screen.getByText(/Reading/)).toBeInTheDocument();
    expect(screen.getAllByText(/6\.5/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Listening/)).toBeInTheDocument();
    // Reading is 0.5 below target.
    expect(screen.getByText(/0\.5 to go/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no attempts", () => {
    render(<Dashboard attempts={[]} />);
    expect(screen.getByText(/no attempts yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\components\dashboard\Dashboard.tsx`:**
```tsx
import type { Attempt, Skill } from "@/lib/storage/types";
import { computeStats } from "@/lib/storage/stats";

const SKILL_LABELS: Record<Skill, string> = {
  reading: "Reading", listening: "Listening", writing: "Writing", speaking: "Speaking",
};

function bandText(band: number | null): string {
  return band === null ? "—" : band.toFixed(1);
}

export function Dashboard({ attempts }: { attempts: Attempt[] }) {
  const stats = computeStats(attempts);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Your progress</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">Goal: Band 7 in all four skills.</p>
      </header>

      <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950">
        <h2 className="text-sm font-semibold uppercase text-gray-500">Overall band</h2>
        <p className="text-4xl font-bold">{bandText(stats.overall)}</p>
        <p className="mt-1 text-sm">
          {stats.overall === null
            ? "Complete at least one test in each skill to see your overall band."
            : stats.overall >= 7
              ? "On target — Band 7 overall. 🎯"
              : `${stats.overallDistanceToSeven} to go to Band 7.`}
        </p>
      </section>

      {stats.totalAttempts === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
          No attempts yet. Take a test to start tracking your progress.
        </p>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(Object.keys(SKILL_LABELS) as Skill[]).map((skill) => {
            const s = stats.perSkill[skill];
            return (
              <div key={skill} className="rounded-xl border border-gray-200 p-5 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{SKILL_LABELS[skill]}</h3>
                  {s.metTarget && <span className="text-sm text-green-600">🎯 Band 7</span>}
                </div>
                <p className="mt-1 text-3xl font-bold">{bandText(s.latest)}</p>
                <p className="text-sm text-gray-500">
                  {s.latest === null
                    ? "No attempts yet"
                    : `Best ${bandText(s.best)} · ${s.attempts} attempt${s.attempts === 1 ? "" : "s"}`}
                  {s.distanceToSeven !== null && s.distanceToSeven > 0 && (
                    <span className="ml-1 text-amber-600">· {s.distanceToSeven} to go</span>
                  )}
                </p>
              </div>
            );
          })}
        </section>
      )}

      {stats.totalAttempts > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase text-gray-500">Recent attempts</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {attempts.slice(0, 10).map((a) => (
              <li key={a.id} className="flex justify-between border-b border-gray-100 py-1 dark:border-gray-800">
                <span>{SKILL_LABELS[a.skill]} — {a.title}</span>
                <span className="font-medium">
                  Band {a.band.toFixed(1)}
                  {a.raw !== undefined && a.total !== undefined ? ` (${a.raw}/${a.total})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run, confirm PASS.** `npx vitest run tests/dashboard/Dashboard.test.tsx`

- [ ] **Step 5: Create the route `C:\code\easyIELTS\src\app\dashboard\page.tsx`** (client wrapper that reads localStorage):
```tsx
"use client";

import { useEffect, useState } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { getStorage } from "@/lib/storage/adapter";
import type { Attempt } from "@/lib/storage/types";

export default function DashboardPage() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  useEffect(() => { setAttempts(getStorage().listAttempts()); }, []);
  if (attempts === null) {
    return <main className="mx-auto max-w-4xl px-6 py-12 text-gray-500">Loading…</main>;
  }
  return <Dashboard attempts={attempts} />;
}
```

- [ ] **Step 6: Add a Dashboard link on the landing page.** In `C:\code\easyIELTS\src\app\page.tsx`, near the existing "Connect GitHub" link in the header, add:
```tsx
        <a href="/dashboard" className="mt-2 inline-block text-sm text-indigo-600 underline">
          View your progress dashboard →
        </a>
```
(Keep everything else; the landing-page test must still pass.)

- [ ] **Step 7: Commit.**
```powershell
git add src/components/dashboard/Dashboard.tsx src/app/dashboard/page.tsx src/app/page.tsx tests/dashboard/Dashboard.test.tsx
git commit -m "feat: Band-7 progress dashboard"
```

---

## Task 4: Wire the four runners to record attempts

**Files:** Modify `src/components/reading/ReadingRunner.tsx`, `src/components/listening/ListeningRunner.tsx`, `src/components/writing/WritingRunner.tsx`, `src/components/speaking/SpeakingRunner.tsx`; add `tests/storage/record-on-submit.test.tsx`

- [ ] **Step 1: ReadingRunner** — in `C:\code\easyIELTS\src\components\reading\ReadingRunner.tsx`, import the recorder and record on submit. Add at the top:
```tsx
import { recordAttempt } from "@/lib/storage/adapter";
```
**Record OUTSIDE any `setState` updater** (a side effect inside an updater double-fires under React StrictMode in dev → duplicate attempts). Use a ref guard so it records exactly once, and route BOTH the button and the timer auto-submit through `handleSubmit`. Add a ref near the other refs:
```tsx
  const recordedRef = useRef(false);
```
Rewrite `handleSubmit` to score once, record once, then set state:
```tsx
  function handleSubmit() {
    if (recordedRef.current) return;
    recordedRef.current = true;
    const scored = scoreReadingTest(test, answersRef.current);
    recordAttempt({
      skill: "reading", testId: test.id, title: test.title,
      band: scored.band, raw: scored.raw, total: scored.total, estimated: scored.bandIsEstimated,
    });
    setResult(scored);
  }
```
In the countdown effect, replace the inline auto-submit (`setResult((prev) => prev ?? scoreReadingTest(...))`) with a call to `handleSubmit()` so the timed-out path records through the same guard. (`recordedRef` ensures a single record even if the button and timer race.)

- [ ] **Step 2: ListeningRunner** — apply the SAME ref-guarded pattern in `C:\code\easyIELTS\src\components\listening\ListeningRunner.tsx`: import `recordAttempt`, add a `recordedRef`, record exactly once OUTSIDE any setState updater in `handleSubmit` (and route the auto-submit timer through it), with `{ skill: "listening", testId: test.id, title: test.title, band: scored.band, raw: scored.raw, total: scored.total, estimated: scored.bandIsEstimated }`.

- [ ] **Step 3: WritingRunner** — in `C:\code\easyIELTS\src\components\writing\WritingRunner.tsx`, import `recordAttempt` and the `writingBand` is already used to compute `overall`. After BOTH tasks are evaluated (the `submit` loop completes and both `evals[1]` and `evals[2]` exist), record one writing attempt with the overall writing band. At the end of the successful `submit` try-block (after the loop sets all evals), compute and record:
```tsx
      const t1 = next[1]; const t2 = next[2];
      if (t1 && t2) {
        recordAttempt({ skill: "writing", testId: test.id, title: test.title, band: writingBand(t1.taskBand, t2.taskBand) });
      }
```
(Adapt to the actual variable names in `submit`; if the component sets evals incrementally into state rather than a local `next`, accumulate the two task evals locally in the loop and record once both exist. Record exactly once per submit.)

- [ ] **Step 4: SpeakingRunner** — in `C:\code\easyIELTS\src\components\speaking\SpeakingRunner.tsx`, import `recordAttempt` and record when scoring succeeds. In `finalize`, after `setResult(scored)` (where the evaluation is obtained), record:
```tsx
      const scored = await res.json();
      setResult(scored);
      recordAttempt({ skill: "speaking", testId: test.id, title: test.title, band: scored.speakingBand });
```
(Adapt to the actual code: record once, only on a successful score, using `scored.speakingBand`.)

- [ ] **Step 5: Write a focused wiring test `C:\code\easyIELTS\tests\storage\record-on-submit.test.tsx`** (Reading records an attempt on submit):
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadingRunner } from "@/components/reading/ReadingRunner";
import { getReadingTest } from "@/lib/content/reading";
import { getStorage } from "@/lib/storage/adapter";

beforeEach(() => localStorage.clear());

describe("attempt recording", () => {
  it("records a reading attempt on submit", async () => {
    const test = getReadingTest("gt-tool-libraries")!;
    render(<ReadingRunner test={test} />);
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    await screen.findByText(/Your result/);
    const attempts = getStorage().listAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].skill).toBe("reading");
    expect(attempts[0].total).toBe(10);
  });
});
```

- [ ] **Step 6: Run the focused test + full suite.**
```powershell
cd C:\code\easyIELTS
npx vitest run tests/storage/record-on-submit.test.tsx
npm run test
npm run lint
npm run build
```
Expected: the wiring test passes; the full suite is green (watch the existing ReadingRunner/ListeningRunner tests still pass — recording is additive); lint exit 0; build compiles with `/dashboard`.

- [ ] **Step 7: Server smoke test** (dashboard renders empty state). Use a NON-reserved variable; if `Start-Process npm` fails use `npm.cmd`; track/stop only the PID you start.
```powershell
cd C:\code\easyIELTS
$before = (Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$p = Start-Process npm.cmd -ArgumentList "run","start" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 16
try {
  $dash = (Invoke-WebRequest http://localhost:3000/dashboard -UseBasicParsing -TimeoutSec 5).StatusCode
  Write-Output "dashboard=$dash"
} finally {
  $after = (Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  foreach ($id in $after) { if ($before -notcontains $id) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }
}
```
Expected: `dashboard=200`.

- [ ] **Step 8: Commit.**
```powershell
git add src/components/reading/ReadingRunner.tsx src/components/listening/ListeningRunner.tsx src/components/writing/WritingRunner.tsx src/components/speaking/SpeakingRunner.tsx tests/storage/record-on-submit.test.tsx
git commit -m "feat: record attempts from all four skill runners"
```

---

## Done criteria

- Completing any test records an attempt in `localStorage`; `/dashboard` shows per-skill latest/best bands, distance-to-Band-7, overall band (once all four have data), and recent history; clean empty state.
- `computeStats` and the adapter are unit-tested; the dashboard renders from injected data; reading records an attempt on submit (verified).
- `npm run test` / `lint` / `build` green; `/dashboard` serves 200.
- The `StorageAdapter` interface leaves a clean seam for a future DB-backed adapter (logged-in users) — no caller changes needed.

## Notes for later plans

- Settings (BYO Gemini/GitHub keys, "clear my data") is the next plan; "clear my data" will call `getStorage().clear()`.
- A DB-backed `ApiAdapter` (logged-in persistence) implements the same `StorageAdapter` interface; `getStorage()` would select it based on auth state.
