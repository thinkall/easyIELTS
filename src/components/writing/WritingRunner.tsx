"use client";

import { useRef, useState } from "react";
import { writingBand } from "@/lib/ielts/aggregate";
import { wordCount } from "@/lib/scoring/normalize";
import { recordAttempt } from "@/lib/storage/adapter";
import type { TaskEvaluation } from "@/lib/writing/types";
import type { WritingTest } from "@/lib/content/writing";
import { getSettings } from "@/lib/settings/settings";

type Evaluations = Partial<Record<1 | 2, TaskEvaluation>>;

async function evaluate(taskNumber: 1 | 2, prompt: string, response: string): Promise<TaskEvaluation> {
  const settings = getSettings();
  const res = await fetch("/api/writing/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskNumber,
      prompt,
      response,
      ...(settings.githubToken ? { token: settings.githubToken } : {}),
      ...(settings.model ? { model: settings.model } : {}),
    }),
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
  const recordedRef = useRef(false);

  const overall =
    evals[1] && evals[2] ? writingBand(evals[1]!.taskBand, evals[2]!.taskBand) : null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const next: Evaluations = {};
      for (const task of test.tasks) {
        const evaluation = await evaluate(task.taskNumber, task.instructions, responses[task.taskNumber]);
        next[task.taskNumber] = evaluation;
        setEvals((prev) => ({ ...prev, [task.taskNumber]: evaluation }));
      }
      const t1 = next[1]; const t2 = next[2];
      if (t1 && t2 && !recordedRef.current) {
        recordedRef.current = true;
        recordAttempt({ skill: "writing", testId: test.id, title: test.title, band: writingBand(t1.taskBand, t2.taskBand) });
      }
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
