"use client";

import { useState } from "react";
import { SpeakingRunner } from "./SpeakingRunner";
import { getSettings } from "@/lib/settings/settings";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import type { SpeakingTest } from "@/lib/content/speaking";

export function GenerateSpeaking() {
  const [topic, setTopic] = useState("");
  const [test, setTest] = useState<SpeakingTest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const settings = getSettings();
      const res = await fetch("/api/content/speaking", {
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

  if (test) {
    return (
      <Container className="max-w-3xl">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm dark:border-indigo-900 dark:bg-indigo-950">
          <span className="font-semibold">Your cue card: </span>
          {test.topic}
        </div>
        <SpeakingRunner test={test} />
      </Container>
    );
  }

  return (
    <Container className="max-w-2xl py-10">
      <PageHeader title="Generate a speaking topic" subtitle="The AI writes an original Part 2 cue card. The live examiner will use it in your test." />
      <div className="mt-6 flex flex-col gap-4">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Theme (optional), e.g. a hobby, a place, a person you admire"
          aria-label="topic"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        <Button onClick={generate} disabled={busy} className="self-start px-6">
          {busy ? "Generating…" : "Generate topic"}
        </Button>
        {busy && <p className="text-sm text-gray-500">Writing your cue card…</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
      </div>
    </Container>
  );
}
