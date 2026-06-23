"use client";

import { useState } from "react";
import { ListeningRunner } from "./ListeningRunner";
import { getSettings } from "@/lib/settings/settings";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import type { ListeningTest } from "@/lib/content/types";

export function GenerateListening() {
  const [topic, setTopic] = useState("");
  const [test, setTest] = useState<ListeningTest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const settings = getSettings();
      const res = await fetch("/api/content/listening", {
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

  if (test) return <ListeningRunner test={test} />;

  return (
    <Container className="max-w-2xl py-10">
      <PageHeader title="Generate a listening test" subtitle="The AI writes an original two-speaker transcript and questions; the recording is voiced for you. Optionally pick a setting." />
      <div className="mt-6 flex flex-col gap-4">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Setting (optional), e.g. library, gym, course enrolment, hotel"
          aria-label="topic"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        <Button onClick={generate} disabled={busy} className="self-start px-6">
          {busy ? "Generating…" : "Generate test"}
        </Button>
        {busy && <p className="text-sm text-gray-500">Writing your transcript and questions… this can take ~20 seconds. The audio is then voiced when you press play.</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
      </div>
    </Container>
  );
}
