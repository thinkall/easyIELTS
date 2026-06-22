"use client";

import { useEffect, useState } from "react";

export type SpeakFn = (text: string, onEnd: () => void) => void;

const defaultSpeak: SpeakFn = (text, onEnd) => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.onend = () => onEnd();
  utterance.onerror = () => onEnd();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

type Status = "idle" | "playing" | "done";

export function AudioPlayer({ script, speak = defaultSpeak }: { script: string; speak?: SpeakFn }) {
  const [status, setStatus] = useState<Status>("idle");

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
      <span className="text-sm text-gray-500">
        {status === "idle" && "The recording plays once only."}
        {status === "playing" && "Playing…"}
        {status === "done" && "Finished — answer the questions."}
      </span>
    </div>
  );
}
