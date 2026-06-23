"use client";

import { useEffect, useRef, useState } from "react";
import { parseScriptTurns, uniqueSpeakers, stripLabels } from "@/lib/listening/script";
import { getSettings } from "@/lib/settings/settings";

export type SpeakFn = (text: string, onEnd: () => void) => void;
/** Fetch a playable audio URL for the script, or null if generation is unavailable. */
export type LoadAudioFn = (script: string) => Promise<string | null>;
/** Play an audio URL; returns a stop function. Calls onEnd when finished. */
export type PlayUrlFn = (url: string, onEnd: () => void) => () => void;

const defaultLoadAudio: LoadAudioFn = async (script) => {
  try {
    const settings = getSettings();
    const res = await fetch("/api/listening/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script, ...(settings.geminiApiKey ? { geminiApiKey: settings.geminiApiKey } : {}) }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

const defaultPlayUrl: PlayUrlFn = (url, onEnd) => {
  const audio = new Audio(url);
  const revoke = () => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); };
  const done = () => { revoke(); onEnd(); };
  audio.onended = done;
  audio.onerror = done;
  const result = audio.play();
  if (result && typeof result.catch === "function") result.catch(done);
  return () => { audio.pause(); revoke(); };
};

// Browser-TTS fallback: speak each turn with a distinct voice, never reading the
// speaker labels aloud. Used only when real audio generation is unavailable.
const defaultSpeak: SpeakFn = (text, onEnd) => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd();
    return;
  }
  const synth = window.speechSynthesis;
  const turns = parseScriptTurns(text);
  const speakers = uniqueSpeakers(turns);
  const voices = synth.getVoices?.() ?? [];

  let finished = false;
  const timers: { pump?: ReturnType<typeof setInterval>; watchdog?: ReturnType<typeof setTimeout> } = {};
  const finish = () => {
    if (finished) return;
    finished = true;
    if (timers.pump) clearInterval(timers.pump);
    if (timers.watchdog) clearTimeout(timers.watchdog);
    onEnd();
  };

  synth.cancel();
  turns.forEach((turn, i) => {
    const u = new SpeechSynthesisUtterance(turn.text);
    u.rate = 0.95;
    // Give each speaker a different voice / pitch so it sounds like a dialogue.
    const idx = speakers.indexOf(turn.speaker);
    if (voices.length > 0) u.voice = voices[idx % voices.length];
    u.pitch = idx % 2 === 0 ? 1 : 0.85;
    if (i === turns.length - 1) {
      u.onend = finish;
      u.onerror = finish;
    }
    synth.speak(u);
  });

  // Chrome silently auto-pauses long utterances (~15s); periodic resume keeps it going.
  timers.pump = setInterval(() => { if (!finished) synth.resume(); }, 10000);
  // Safety net so the UI never sticks on "playing".
  const maxMs = Math.min(20 * 60 * 1000, (text.length / 12) * 1000 + 8000);
  timers.watchdog = setTimeout(finish, maxMs);
};

type Status = "idle" | "loading" | "playing" | "done";

export function AudioPlayer({
  script,
  audioUrl,
  loadAudio = defaultLoadAudio,
  playUrl = defaultPlayUrl,
  speak = defaultSpeak,
}: {
  script: string;
  audioUrl?: string;
  loadAudio?: LoadAudioFn;
  playUrl?: PlayUrlFn;
  speak?: SpeakFn;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const stopRef = useRef<(() => void) | null>(null);
  const unmountedRef = useRef(false);

  // Stop any in-flight playback if the component unmounts (e.g. navigation).
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      stopRef.current?.();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  async function play() {
    if (status !== "idle") return;
    setStatus("loading");
    // Prefer a pre-generated audio file (instant); otherwise generate on demand.
    const url = audioUrl ?? (await loadAudio(script));
    if (unmountedRef.current) {
      if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
      return;
    }
    if (url) {
      stopRef.current = playUrl(url, () => setStatus("done"));
    } else {
      // Fall back to multi-voice browser TTS with the labels removed.
      speak(stripLabels(script), () => setStatus("done"));
    }
    setStatus("playing");
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
        {status === "loading" && "Preparing the recording…"}
        {status === "playing" && "Playing…"}
        {status === "done" && "Finished — answer the questions."}
      </span>
    </div>
  );
}
