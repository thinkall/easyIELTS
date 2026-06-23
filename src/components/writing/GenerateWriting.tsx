"use client";

import { useState } from "react";
import { WritingRunner } from "./WritingRunner";
import { getSettings } from "@/lib/settings/settings";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import type { WritingTest } from "@/lib/content/writing";

export function GenerateWriting() {
  const [topic, setTopic] = useState("");
  const [test, setTest] = useState<WritingTest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const settings = getSettings();
      const res = await fetch("/api/content/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          ...(settings.githubToken ? { token: settings.githubToken } : {}),
          ...(settings.model ? { model: settings.model } : {}),
        }),
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

  if (test) return <WritingRunner test={test} />;

  return (
    <Container className="max-w-2xl py-10">
      <PageHeader title="Generate a writing test" subtitle="The AI writes an original Task 1 letter and Task 2 essay. Optionally pick a theme." />
      <div className="mt-6 flex flex-col gap-4">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Theme (optional), e.g. travel, work, neighbours, technology"
          aria-label="topic"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        <Button onClick={generate} disabled={busy} className="self-start px-6">
          {busy ? "Generating…" : "Generate test"}
        </Button>
        {busy && <p className="text-sm text-gray-500">Writing your two tasks… this can take ~20 seconds.</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
      </div>
    </Container>
  );
}
