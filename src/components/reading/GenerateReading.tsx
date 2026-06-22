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
