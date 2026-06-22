# easyIELTS Scoring Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, framework-free scoring core: IELTS band-conversion tables (Listening + GT Reading), the official half-band rounding rule, score aggregation (writing/overall), answer normalization, and objective auto-scoring — all fully unit-tested.

**Architecture:** Two pure modules under `src/lib`. `src/lib/ielts/` holds IELTS domain data + math (rounding, raw→band tables, aggregation). `src/lib/scoring/` holds the test-answer model + normalization + objective scoring. No React, no Next, no I/O — just deterministic functions, so correctness is provable by Vitest. Later UI/API plans import these.

**Tech Stack:** TypeScript · Vitest (already configured) · `@/*` alias → `src/*`.

**Reference data (authoritative — see `docs/superpowers/specs/2026-06-22-easyielts-design.md` §5):**
- Listening Band 7 = **30–31/40**. GT Reading Band 7 = **34–35/40** (more than Academic).
- Overall = avg of 4 skills; Writing = (T1 + 2·T2)/3; round to nearest 0.5, exact .25/.75 ties round **up**.

---

## File Structure (created by this plan)

| Path | Responsibility |
|---|---|
| `src/lib/ielts/rounding.ts` | `roundToHalfBand()` — official nearest-0.5 ties-up rounding, clamped [0,9] |
| `src/lib/ielts/bands.ts` | Listening + GT Reading raw→band tables and lookup functions (with source citations) |
| `src/lib/ielts/aggregate.ts` | `writingBand()`, `skillAverageBand()`, `overallBand()` |
| `src/lib/ielts/index.ts` | Barrel export for the `ielts` module |
| `src/lib/scoring/types.ts` | `QuestionType`, `Question`, `QuestionResult`, `ObjectiveScore` |
| `src/lib/scoring/normalize.ts` | `normalizeAnswer()`, `wordCount()`, `exceedsWordLimit()` |
| `src/lib/scoring/score.ts` | `scoreObjective()` — marks answers, returns raw + per-question results |
| `src/lib/scoring/index.ts` | Barrel export for the `scoring` module |
| `tests/ielts/*.test.ts`, `tests/scoring/*.test.ts` | Unit tests (boundary-focused) |

---

## Task 1: Half-band rounding

**Files:**
- Create: `src/lib/ielts/rounding.ts`, `tests/ielts/rounding.test.ts`
- Delete: `src/lib/ielts/.gitkeep` (real files now exist in this dir)

- [ ] **Step 1: Write the failing test.** Create `C:\code\easyIELTS\tests\ielts\rounding.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { roundToHalfBand } from "@/lib/ielts/rounding";

describe("roundToHalfBand", () => {
  it("rounds to the nearest half band", () => {
    expect(roundToHalfBand(6.1)).toBe(6.0);
    expect(roundToHalfBand(6.3)).toBe(6.5);
    expect(roundToHalfBand(6.85)).toBe(7.0);
  });
  it("rounds exact .25 up to the next half band", () => {
    expect(roundToHalfBand(6.25)).toBe(6.5);
  });
  it("rounds exact .75 up to the next whole band", () => {
    expect(roundToHalfBand(6.75)).toBe(7.0);
  });
  it("leaves exact half/whole bands unchanged", () => {
    expect(roundToHalfBand(6.5)).toBe(6.5);
    expect(roundToHalfBand(7)).toBe(7.0);
  });
  it("clamps to the 0..9 range", () => {
    expect(roundToHalfBand(-1)).toBe(0);
    expect(roundToHalfBand(9.4)).toBe(9);
  });
});
```

- [ ] **Step 2: Run, confirm it FAILS.** `npx vitest run tests/ielts/rounding.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement.** Create `C:\code\easyIELTS\src\lib\ielts\rounding.ts`:
```ts
/**
 * Round an IELTS score to the nearest half band. Exact .25/.75 midpoints round
 * up (the official rule: ".25 rounds up to the next half band, .75 rounds up to
 * the next whole band"). Result is clamped to the valid [0, 9] band range.
 */
export function roundToHalfBand(value: number): number {
  const clamped = Math.min(9, Math.max(0, value));
  return Math.round(clamped * 2) / 2;
}
```

- [ ] **Step 4: Run, confirm it PASSES.** `npx vitest run tests/ielts/rounding.test.ts` → PASS (5 tests).

- [ ] **Step 5: Remove the placeholder and commit.**
```powershell
cd C:\code\easyIELTS
Remove-Item src/lib/ielts/.gitkeep -ErrorAction SilentlyContinue
git add src/lib/ielts/rounding.ts tests/ielts/rounding.test.ts src/lib/ielts/.gitkeep
git commit -m "feat: half-band rounding with official ties-up rule"
```

---

## Task 2: Raw-score → band tables (Listening + GT Reading)

**Files:**
- Create: `src/lib/ielts/bands.ts`, `tests/ielts/bands.test.ts`

- [ ] **Step 1: Write the failing test.** Create `C:\code\easyIELTS\tests\ielts\bands.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { listeningRawToBand, gtReadingRawToBand } from "@/lib/ielts/bands";

describe("listeningRawToBand", () => {
  it("maps the Band 7 boundary (30-31) correctly", () => {
    expect(listeningRawToBand(29)).toBe(6.5);
    expect(listeningRawToBand(30)).toBe(7);
    expect(listeningRawToBand(31)).toBe(7);
    expect(listeningRawToBand(32)).toBe(7.5);
  });
  it("maps the extremes", () => {
    expect(listeningRawToBand(40)).toBe(9);
    expect(listeningRawToBand(39)).toBe(9);
    expect(listeningRawToBand(0)).toBeLessThanOrEqual(2.5);
  });
});

describe("gtReadingRawToBand", () => {
  it("requires 34-35 for Band 7 (harder than Academic)", () => {
    expect(gtReadingRawToBand(33)).toBe(6.5);
    expect(gtReadingRawToBand(34)).toBe(7);
    expect(gtReadingRawToBand(35)).toBe(7);
    expect(gtReadingRawToBand(36)).toBe(7.5);
  });
  it("maps the top of the scale", () => {
    expect(gtReadingRawToBand(40)).toBe(9);
    expect(gtReadingRawToBand(39)).toBe(8.5);
    expect(gtReadingRawToBand(37)).toBe(8);
  });
  it("clamps out-of-range raw scores", () => {
    expect(gtReadingRawToBand(41)).toBe(9);
    expect(gtReadingRawToBand(-5)).toBeLessThanOrEqual(2.5);
  });
});
```

- [ ] **Step 2: Run, confirm it FAILS.** `npx vitest run tests/ielts/bands.test.ts` → FAIL.

- [ ] **Step 3: Implement.** Create `C:\code\easyIELTS\src\lib\ielts\bands.ts`:
```ts
/**
 * IELTS raw-score (out of 40) → band-score conversion tables.
 *
 * Sources: ielts.org "understanding-ielts-scoring" (Listening Band 7 avg = 30;
 * General Training Reading Band 7 avg = 35), and ieltsbuddy.com/ielts-scores.html.
 * Official note: exact marks vary slightly per test version; these are the
 * industry-standard tables. GT Reading needs MORE correct answers than Academic.
 */

interface BandRow {
  /** Minimum raw score (inclusive) to reach `band`. Rows are sorted descending. */
  minRaw: number;
  band: number;
}

const LISTENING_TABLE: BandRow[] = [
  { minRaw: 39, band: 9 },
  { minRaw: 37, band: 8.5 },
  { minRaw: 35, band: 8 },
  { minRaw: 32, band: 7.5 },
  { minRaw: 30, band: 7 },
  { minRaw: 26, band: 6.5 },
  { minRaw: 23, band: 6 },
  { minRaw: 18, band: 5.5 },
  { minRaw: 16, band: 5 },
  { minRaw: 13, band: 4.5 },
  { minRaw: 11, band: 4 },
  { minRaw: 8, band: 3.5 },
  { minRaw: 6, band: 3 },
  { minRaw: 4, band: 2.5 },
];

const GT_READING_TABLE: BandRow[] = [
  { minRaw: 40, band: 9 },
  { minRaw: 39, band: 8.5 },
  { minRaw: 37, band: 8 },
  { minRaw: 36, band: 7.5 },
  { minRaw: 34, band: 7 },
  { minRaw: 32, band: 6.5 },
  { minRaw: 30, band: 6 },
  { minRaw: 27, band: 5.5 },
  { minRaw: 23, band: 5 },
  { minRaw: 19, band: 4.5 },
  { minRaw: 15, band: 4 },
  { minRaw: 12, band: 3.5 },
  { minRaw: 9, band: 3 },
  { minRaw: 6, band: 2.5 },
];

function rawToBand(table: BandRow[], raw: number): number {
  if (!Number.isFinite(raw)) {
    throw new Error(`raw score must be a finite number, received: ${raw}`);
  }
  const clamped = Math.max(0, Math.min(40, Math.round(raw)));
  for (const row of table) {
    if (clamped >= row.minRaw) return row.band;
  }
  // Below the lowest documented threshold — sub-meaningful for a Band-7 tool.
  return 1;
}

/** Listening raw score (0-40) → band score. */
export function listeningRawToBand(raw: number): number {
  return rawToBand(LISTENING_TABLE, raw);
}

/** General Training Reading raw score (0-40) → band score. */
export function gtReadingRawToBand(raw: number): number {
  return rawToBand(GT_READING_TABLE, raw);
}
```

- [ ] **Step 4: Run, confirm it PASSES.** `npx vitest run tests/ielts/bands.test.ts` → PASS.

- [ ] **Step 5: Commit.**
```powershell
git add src/lib/ielts/bands.ts tests/ielts/bands.test.ts
git commit -m "feat: Listening and GT Reading raw-to-band tables"
```

---

## Task 3: Band aggregation (writing, skill average, overall)

**Files:**
- Create: `src/lib/ielts/aggregate.ts`, `tests/ielts/aggregate.test.ts`

- [ ] **Step 1: Write the failing test.** Create `C:\code\easyIELTS\tests\ielts\aggregate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { writingBand, skillAverageBand, overallBand } from "@/lib/ielts/aggregate";

describe("writingBand", () => {
  it("weights Task 2 twice as much as Task 1", () => {
    // (6 + 2*7)/3 = 6.666... -> 6.5
    expect(writingBand(6, 7)).toBe(6.5);
    // (7 + 2*7)/3 = 7 -> 7
    expect(writingBand(7, 7)).toBe(7);
    // (8 + 2*6)/3 = 6.666... -> 6.5
    expect(writingBand(8, 6)).toBe(6.5);
  });
});

describe("skillAverageBand", () => {
  it("averages the four criteria and rounds", () => {
    // (7+7+6.5+6.5)/4 = 6.75 -> 7
    expect(skillAverageBand([7, 7, 6.5, 6.5])).toBe(7);
    // (6.5+6.5+6.5+7)/4 = 6.625 -> 6.5
    expect(skillAverageBand([6.5, 6.5, 6.5, 7])).toBe(6.5);
  });
  it("throws on empty input", () => {
    expect(() => skillAverageBand([])).toThrow();
  });
});

describe("overallBand", () => {
  it("averages the four skills with ties rounding up", () => {
    // (7+7+6.5+6.5)/4 = 6.75 -> 7
    expect(overallBand({ listening: 7, reading: 7, writing: 6.5, speaking: 6.5 })).toBe(7);
    // (6.5+6.5+6.5+6.5)/4 = 6.5
    expect(overallBand({ listening: 6.5, reading: 6.5, writing: 6.5, speaking: 6.5 })).toBe(6.5);
    // (8+7+7+6.5)/4 = 7.125 -> 7
    expect(overallBand({ listening: 8, reading: 7, writing: 7, speaking: 6.5 })).toBe(7);
  });
});
```

- [ ] **Step 2: Run, confirm it FAILS.** `npx vitest run tests/ielts/aggregate.test.ts` → FAIL.

- [ ] **Step 3: Implement.** Create `C:\code\easyIELTS\src\lib\ielts\aggregate.ts`:
```ts
import { roundToHalfBand } from "./rounding";

/** Writing band = (Task1 + 2 x Task2) / 3, rounded. Task 2 is double-weighted. */
export function writingBand(task1Band: number, task2Band: number): number {
  return roundToHalfBand((task1Band + 2 * task2Band) / 3);
}

/** Average of a skill's criteria bands (e.g. the 4 Writing/Speaking criteria), rounded. */
export function skillAverageBand(criteria: number[]): number {
  if (criteria.length === 0) {
    throw new Error("skillAverageBand requires at least one criterion band");
  }
  const sum = criteria.reduce((acc, value) => acc + value, 0);
  return roundToHalfBand(sum / criteria.length);
}

export interface SkillBands {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
}

/** Overall band = average of the four skill bands, rounded. */
export function overallBand(bands: SkillBands): number {
  const { listening, reading, writing, speaking } = bands;
  return roundToHalfBand((listening + reading + writing + speaking) / 4);
}
```

- [ ] **Step 4: Run, confirm it PASSES.** `npx vitest run tests/ielts/aggregate.test.ts` → PASS.

- [ ] **Step 5: Create the barrel `C:\code\easyIELTS\src\lib\ielts\index.ts`:**
```ts
export * from "./rounding";
export * from "./bands";
export * from "./aggregate";
```

- [ ] **Step 6: Commit.**
```powershell
git add src/lib/ielts/aggregate.ts src/lib/ielts/index.ts tests/ielts/aggregate.test.ts
git commit -m "feat: writing/skill/overall band aggregation"
```

---

## Task 4: Answer types + normalization

**Files:**
- Create: `src/lib/scoring/types.ts`, `src/lib/scoring/normalize.ts`, `tests/scoring/normalize.test.ts`
- Delete: `src/lib/scoring/.gitkeep`

- [ ] **Step 1: Write the failing test.** Create `C:\code\easyIELTS\tests\scoring\normalize.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeAnswer, wordCount, exceedsWordLimit } from "@/lib/scoring/normalize";

describe("normalizeAnswer", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeAnswer("  The   Library ")).toBe("the library");
  });
  it("strips surrounding punctuation but keeps internal apostrophes/hyphens", () => {
    expect(normalizeAnswer("well-known.")).toBe("well-known");
    expect(normalizeAnswer("o'clock,")).toBe("o'clock");
  });
});

describe("wordCount", () => {
  it("counts whitespace-separated tokens; a number is one word", () => {
    expect(wordCount("twenty past four")).toBe(3);
    expect(wordCount("14")).toBe(1);
    expect(wordCount("   ")).toBe(0);
  });
});

describe("exceedsWordLimit", () => {
  it("is false when no limit is set", () => {
    expect(exceedsWordLimit("a b c", undefined)).toBe(false);
  });
  it("flags answers over the limit", () => {
    expect(exceedsWordLimit("two words", 2)).toBe(false);
    expect(exceedsWordLimit("three little words", 2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm it FAILS.** `npx vitest run tests/scoring/normalize.test.ts` → FAIL.

- [ ] **Step 3: Implement the types.** Create `C:\code\easyIELTS\src\lib\scoring\types.ts`:
```ts
export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false_notgiven"
  | "yes_no_notgiven"
  | "matching_headings"
  | "matching_info"
  | "matching_features"
  | "matching_sentence_endings"
  | "sentence_completion"
  | "summary_completion"
  | "note_completion"
  | "table_completion"
  | "flowchart_completion"
  | "form_completion"
  | "diagram_label"
  | "map_label"
  | "short_answer";

export interface Question {
  id: string;
  type: QuestionType;
  /** Accepted correct answers — any match (after normalization) counts as correct. */
  accepted: string[];
  /** Optional max words allowed (completion/short-answer). Over-limit = incorrect. */
  wordLimit?: number;
  /** Marks for this item. Defaults to 1. */
  points?: number;
}

export interface QuestionResult {
  id: string;
  correct: boolean;
  given: string;
  accepted: string[];
  points: number;
  earned: number;
}

export interface ObjectiveScore {
  /** Total marks earned. */
  raw: number;
  /** Total marks possible. */
  total: number;
  results: QuestionResult[];
}
```

- [ ] **Step 4: Implement normalization.** Create `C:\code\easyIELTS\src\lib\scoring\normalize.ts`:
```ts
/**
 * Normalize a free-text answer for comparison: lowercase, trim, collapse
 * internal whitespace, and strip surrounding quotes/punctuation. Internal
 * apostrophes and hyphens (e.g. "o'clock", "well-known") are preserved.
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^["'.,;:!?]+|["'.,;:!?]+$/g, "")
    .trim();
}

/** Count whitespace-separated word tokens. A bare number ("14") counts as one. */
export function wordCount(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

/** True if `raw` exceeds `wordLimit` (when a limit is set). */
export function exceedsWordLimit(raw: string, wordLimit: number | undefined): boolean {
  if (wordLimit === undefined) return false;
  return wordCount(raw) > wordLimit;
}
```

- [ ] **Step 5: Run, confirm it PASSES.** `npx vitest run tests/scoring/normalize.test.ts` → PASS.

- [ ] **Step 6: Remove the placeholder and commit.**
```powershell
Remove-Item src/lib/scoring/.gitkeep -ErrorAction SilentlyContinue
git add src/lib/scoring/types.ts src/lib/scoring/normalize.ts tests/scoring/normalize.test.ts src/lib/scoring/.gitkeep
git commit -m "feat: scoring types and answer normalization"
```

---

## Task 5: Objective scoring

**Files:**
- Create: `src/lib/scoring/score.ts`, `tests/scoring/score.test.ts`

- [ ] **Step 1: Write the failing test.** Create `C:\code\easyIELTS\tests\scoring\score.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scoreObjective } from "@/lib/scoring/score";
import type { Question } from "@/lib/scoring/types";

const questions: Question[] = [
  { id: "q1", type: "single_choice", accepted: ["B"] },
  { id: "q2", type: "true_false_notgiven", accepted: ["false"] },
  { id: "q3", type: "sentence_completion", accepted: ["library", "the library"], wordLimit: 2 },
  { id: "q4", type: "short_answer", accepted: ["14"], wordLimit: 1 },
];

describe("scoreObjective", () => {
  it("marks correct, case-insensitive, and accepted-variant answers", () => {
    const score = scoreObjective(questions, { q1: "b", q2: "False", q3: "The Library", q4: "14" });
    expect(score.raw).toBe(4);
    expect(score.total).toBe(4);
    expect(score.results.every((r) => r.correct)).toBe(true);
  });

  it("marks wrong and missing answers as incorrect", () => {
    const score = scoreObjective(questions, { q1: "A", q2: "true" });
    expect(score.raw).toBe(0);
    expect(score.results.find((r) => r.id === "q3")?.correct).toBe(false); // missing
  });

  it("rejects answers that exceed the word limit even if content matches", () => {
    // "the public library" is 3 words but limit is 2 -> incorrect
    const score = scoreObjective(questions, { q3: "the public library" });
    expect(score.results.find((r) => r.id === "q3")?.correct).toBe(false);
  });

  it("respects custom points per question", () => {
    const weighted: Question[] = [{ id: "a", type: "single_choice", accepted: ["A"], points: 2 }];
    const score = scoreObjective(weighted, { a: "A" });
    expect(score.raw).toBe(2);
    expect(score.total).toBe(2);
  });
});
```

- [ ] **Step 2: Run, confirm it FAILS.** `npx vitest run tests/scoring/score.test.ts` → FAIL.

- [ ] **Step 3: Implement.** Create `C:\code\easyIELTS\src\lib\scoring\score.ts`:
```ts
import type { Question, ObjectiveScore, QuestionResult } from "./types";
import { normalizeAnswer, exceedsWordLimit } from "./normalize";

/**
 * Auto-score objective questions (Listening / Reading). Each question is one
 * mark by default. An answer is correct when, after normalization, it matches
 * any accepted variant and does not exceed the question's word limit.
 */
export function scoreObjective(
  questions: Question[],
  answers: Record<string, string>,
): ObjectiveScore {
  const results: QuestionResult[] = questions.map((question) => {
    const points = question.points ?? 1;
    const given = answers[question.id] ?? "";
    const normalizedGiven = normalizeAnswer(given);
    const overLimit = exceedsWordLimit(given, question.wordLimit);
    const correct =
      !overLimit &&
      normalizedGiven !== "" &&
      question.accepted.some((variant) => normalizeAnswer(variant) === normalizedGiven);

    return {
      id: question.id,
      correct,
      given,
      accepted: question.accepted,
      points,
      earned: correct ? points : 0,
    };
  });

  const raw = results.reduce((sum, result) => sum + result.earned, 0);
  const total = results.reduce((sum, result) => sum + result.points, 0);
  return { raw, total, results };
}
```

- [ ] **Step 4: Run, confirm it PASSES.** `npx vitest run tests/scoring/score.test.ts` → PASS.

- [ ] **Step 5: Create the barrel `C:\code\easyIELTS\src\lib\scoring\index.ts`:**
```ts
export * from "./types";
export * from "./normalize";
export * from "./score";
```

- [ ] **Step 6: Run the FULL suite + lint + build to confirm nothing regressed.**
```powershell
cd C:\code\easyIELTS
npm run test
npm run lint
npm run build
```
Expected: all tests pass (foundation 5 + new ielts/scoring suites), lint exit 0 no warnings, build compiles.

- [ ] **Step 7: Commit.**
```powershell
git add src/lib/scoring/score.ts src/lib/scoring/index.ts tests/scoring/score.test.ts
git commit -m "feat: objective auto-scoring for listening/reading"
```

---

## Done criteria

- `roundToHalfBand`, `listeningRawToBand`, `gtReadingRawToBand`, `writingBand`, `skillAverageBand`, `overallBand`, `normalizeAnswer`, `wordCount`, `exceedsWordLimit`, and `scoreObjective` all exist, are exported via barrels, and are unit-tested.
- Band-7 boundaries are pinned by tests: Listening 30→7 / 29→6.5; GT Reading 34→7 / 33→6.5.
- `npm run test`, `npm run lint`, `npm run build` all green.
- Modules are pure (no React/Next/I/O imports) and ready for the Reading/Listening/Writing/Speaking plans to consume.

## Notes for the next plan (Reading module)

- The Reading module will define a `Test`/`Section` content shape that wraps `Question[]` and call `scoreObjective`, then `gtReadingRawToBand` for the band.
- Question rendering by `type` is a UI concern (next plan); scoring already treats each item uniformly via `accepted`.
