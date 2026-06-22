"use client";

import { useEffect, useRef, useState } from "react";
import type { SpeakingEvent, TranscriptTurn, SpeakingEvaluation } from "@/lib/speaking/types";
import type { SpeakingSession, SessionCallbacks, SessionStatus } from "@/lib/speaking/session";
import { createSpeakingSession } from "@/lib/speaking/session";
import type { SpeakingTest } from "@/lib/content/speaking";

type CreateSession = (part: string, cb: SessionCallbacks) => SpeakingSession;
type UiStatus = SessionStatus | "idle" | "scoring" | "scored";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SpeakingRunner({
  test,
  createSession = createSpeakingSession,
}: {
  test: SpeakingTest;
  createSession?: CreateSession;
}) {
  const [status, setStatus] = useState<UiStatus>("idle");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [result, setResult] = useState<SpeakingEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const sessionRef = useRef<SpeakingSession | null>(null);
  const turnsRef = useRef<TranscriptTurn[]>([]);
  const finalizedRef = useRef(false);

  const isLive = status === "live" || status === "connecting";

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isLive]);

  // Backstop: release the mic/socket if the user navigates away mid-session.
  useEffect(() => () => sessionRef.current?.end(), []);

  function addTurn(role: TranscriptTurn["role"], text: string) {
    turnsRef.current = [...turnsRef.current, { role, text }];
    setTurns(turnsRef.current);
  }

  function handleEvent(event: SpeakingEvent) {
    if (event.type === "output_transcript") addTurn("examiner", event.text);
    else if (event.type === "input_transcript") addTurn("candidate", event.text);
    else if (event.type === "error") setError(event.error);
  }

  async function finalize() {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setStatus("scoring");
    try {
      const res = await fetch("/api/speaking/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: turnsRef.current }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Scoring failed (${res.status})`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed.");
    } finally {
      setStatus("scored");
    }
  }

  // Session status from the audio layer. On end/error with speech recorded,
  // auto-score; otherwise just reflect the status. Ignored once finalized.
  function handleStatus(s: SessionStatus) {
    if (finalizedRef.current) return;
    if ((s === "ended" || s === "error") && turnsRef.current.length > 0) {
      void finalize();
      return;
    }
    setStatus(s);
  }

  async function start() {
    setError(null);
    finalizedRef.current = false;
    turnsRef.current = [];
    setTurns([]);
    setResult(null);
    setElapsed(0);
    const session = createSession(test.part, { onEvent: handleEvent, onStatus: handleStatus });
    sessionRef.current = session;
    try {
      await session.start();
    } catch {
      finalizedRef.current = true;
      setError("Could not access the microphone or connect. Please allow microphone access and try again.");
      setStatus("error");
    }
  }

  function finish() {
    sessionRef.current?.end();
  }

  const showStart = !isLive && status !== "scoring";
  const showFinish = isLive;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{test.title}</h1>
          <p className="text-sm text-amber-600">🎯 Band 7 = wide vocabulary, &gt;50% error-free, natural fluency</p>
        </div>
        {isLive && (
          <p className="font-mono text-sm text-gray-600 dark:text-gray-300" aria-label="elapsed time">
            ⏱ {formatTime(elapsed)} <span className="text-gray-400">/ 6:00 max</span>
          </p>
        )}
      </header>

      {showStart && (
        <button onClick={start} className="self-start rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700">
          {status === "idle" ? "Start speaking test" : "Start again"}
        </button>
      )}
      {status === "connecting" && <p className="text-sm text-gray-500">Connecting… allow microphone access.</p>}
      {showFinish && (
        <button onClick={finish} className="self-start rounded-lg bg-red-600 px-6 py-2 font-medium text-white hover:bg-red-700">
          Finish &amp; get my band
        </button>
      )}
      {status === "scoring" && <p className="text-sm text-gray-500">Scoring your responses…</p>}
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950">
          <h2 className="text-lg font-semibold">Speaking band</h2>
          <p className="text-3xl font-bold">Band {result.speakingBand.toFixed(1)}</p>
          <ul className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            <li>Fluency &amp; Coherence: <strong>{result.criteria.fluencyCoherence.toFixed(1)}</strong></li>
            <li>Lexical Resource: <strong>{result.criteria.lexicalResource.toFixed(1)}</strong></li>
            <li>Grammatical Range: <strong>{result.criteria.grammaticalRangeAccuracy.toFixed(1)}</strong></li>
            <li>Pronunciation: <strong>{result.criteria.pronunciation.toFixed(1)}</strong>{result.pronunciationIsApproximate ? " *" : ""}</li>
          </ul>
          {result.pronunciationIsApproximate && (
            <p className="mt-1 text-xs text-gray-500">* Pronunciation is estimated from the transcript and is approximate.</p>
          )}
          {result.feedback.improvements.length > 0 && (
            <div className="mt-3 text-sm">
              <p className="font-medium">To improve:</p>
              <ul className="list-disc pl-5">{result.feedback.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase text-gray-500">Transcript</h2>
        <div className="mt-2 flex flex-col gap-2">
          {turns.length === 0 && <p className="text-sm text-gray-400">The examiner will begin once you start.</p>}
          {turns.map((t, i) => (
            <p key={i} className={`text-sm ${t.role === "examiner" ? "font-medium" : "text-gray-700 dark:text-gray-300"}`}>
              <span className="uppercase text-xs text-gray-400">{t.role}: </span>{t.text}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
