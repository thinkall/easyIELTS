"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReadingTest } from "@/lib/content/types";
import { scoreReadingTest, type ReadingResult } from "@/lib/reading/score-reading";
import { recordAttempt } from "@/lib/storage/adapter";
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

  // Mirror the latest answers in a ref so the countdown effect does NOT depend
  // on `answers` (otherwise every keystroke clears and reschedules the 1s timer,
  // freezing the clock while the candidate types).
  const answersRef = useRef(answers);
  const recordedRef = useRef(false);

  const submitted = result !== null;

  const handleSubmit = useCallback(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    const scored = scoreReadingTest(test, answersRef.current);
    recordAttempt({
      skill: "reading", testId: test.id, title: test.title,
      band: scored.band, raw: scored.raw, total: scored.total, estimated: scored.bandIsEstimated,
    });
    setResult(scored);
  }, [test]);

  // Countdown; auto-submit at zero. Reads answers via the ref, never `answers`.
  useEffect(() => {
    if (submitted) return;
    if (secondsLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [handleSubmit, secondsLeft, submitted]);

  const resultById = useMemo(() => {
    if (!result) return {} as Record<string, { correct: boolean; accepted: string[] }>;
    return Object.fromEntries(
      result.results.map((r) => [r.id, { correct: r.correct, accepted: r.accepted }]),
    );
  }, [result]);

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      answersRef.current = next;
      return next;
    });
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
