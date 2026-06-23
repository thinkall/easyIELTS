"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ListeningTest } from "@/lib/content/types";
import { scoreListeningTest, type ListeningResult } from "@/lib/listening/score-listening";
import { recordAttempt } from "@/lib/storage/adapter";
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
  const recordedRef = useRef(false);
  const submitted = result !== null;

  const handleSubmit = useCallback(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    const scored = scoreListeningTest(test, answersRef.current);
    setResult(scored);
    recordAttempt({
      skill: "listening", testId: test.id, title: test.title,
      band: scored.band, raw: scored.raw, total: scored.total, estimated: scored.bandIsEstimated,
    });
  }, [test]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{test.title}</h1>
          <p className="text-sm text-gray-500">Listening · scored on the IELTS 0–9 band scale</p>
        </div>
        {!submitted && (
          <span className="rounded-lg bg-gray-900 px-3 py-1 font-mono text-white">⏱ {formatTime(secondsLeft)}</span>
        )}
      </header>

      {result && <ResultsSummary result={result} />}

      {test.sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{section.name}</h2>
          {!submitted && <AudioPlayer script={section.script} audioUrl={section.audioUrl} />}
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
