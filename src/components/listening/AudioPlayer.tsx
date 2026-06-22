"use client";

import { useEffect, useState } from "react";

export type SpeakFn = (text: string, onEnd: () => void) => void;

const defaultSpeak: SpeakFn = (text, onEnd) => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd();
    return;
  }
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;

  let finished = false;
  const timers: {
    pump?: ReturnType<typeof setInterval>;
    watchdog?: ReturnType<typeof setTimeout>;
  } = {};

  const finish = () => {
    if (finished) return;
    finished = true;
    if (timers.pump) clearInterval(timers.pump);
    if (timers.watchdog) clearTimeout(timers.watchdog);
    onEnd();
  };

  utterance.onend = finish;
  utterance.onerror = finish;

  synth.cancel();
  synth.speak(utterance);

  // Chrome silently auto-pauses long utterances (~15s); periodic resume keeps it going.
  timers.pump = setInterval(() => {
    if (!finished) synth.resume();
  }, 10000);

  // Safety net so the UI never sticks on "playing": estimate an upper bound on
  // speech duration (~12 chars/sec + buffer) and force completion after it.
  const maxMs = Math.min(15 * 60 * 1000, (text.length / 12) * 1000 + 5000);
  timers.watchdog = setTimeout(finish, maxMs);
};

type Status = "idle" | "playing" | "done";

export function AudioPlayer({ script, speak = defaultSpeak }: { script: string; speak?: SpeakFn }) {
  const [status, setStatus] = useState<Status>("idle");

  // Stop any in-flight speech if the component unmounts (e.g. navigation).
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function play() {
    if (status !== "idle") return;
    setStatus("playing");
    speak(script, () => setStatus("done"));
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <button
        type="button"
        onClick={play}
        disabled={status !== "idle"}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        ▶ Play audio (plays once)
      </button>
      <span aria-live="polite" className="text-sm text-gray-500">
        {status === "idle" && "The recording plays once only."}
        {status === "playing" && "Playing…"}
        {status === "done" && "Finished — answer the questions."}
      </span>
    </div>
  );
}
