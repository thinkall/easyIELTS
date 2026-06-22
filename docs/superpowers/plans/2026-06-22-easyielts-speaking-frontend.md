# easyIELTS Speaking Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give the Speaking module a browser UI: capture microphone audio, stream it to the `/ws/speaking` proxy, play the examiner's audio back, show a live transcript and timer, and on finish score the transcript and show the band — completing the live oral-test experience.

**Architecture:** Pure PCM helpers (`src/lib/speaking/pcm.ts`) are unit-tested. The Web Audio glue (`getUserMedia`, `AudioWorklet`, the proxy `WebSocket`) lives in a thin client-only `SpeakingSession` created by an injectable factory, so `SpeakingRunner`'s logic (transcript accumulation, status, timer, finish→score) is tested with a fake session. AudioWorklet processors are static JS in `public/worklets/`. Routes mirror the other skills.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Web Audio API (AudioWorklet) · Vitest + RTL. Verified this session: examiner returns 24kHz PCM audio + transcript through our proxy; mic input is sent as base64 PCM 16kHz via `{type:"audio",data}`.

**Depends on (already on `main`):** `/ws/speaking` proxy, `/api/speaking/evaluate`, `src/lib/speaking/types.ts` (`SpeakingEvent`, `TranscriptTurn`, `SpeakingEvaluation`).

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/speaking/pcm.ts` | Pure PCM conversion: `floatTo16BitPCM`, `int16ToBase64`, `base64ToInt16`, `downsample` |
| `public/worklets/recorder-processor.js` | AudioWorklet: forward mic frames to main thread |
| `public/worklets/player-processor.js` | AudioWorklet: queue + play 24kHz PCM |
| `src/lib/speaking/session.ts` | `SpeakingSession` + `createSpeakingSession` (Web Audio + WS glue, client-only) |
| `src/components/speaking/SpeakingRunner.tsx` | `"use client"` UI: transcript, timer, controls, results (injectable session) |
| `src/app/speaking/page.tsx`, `[testId]/page.tsx` | List + runner routes |
| `src/app/page.tsx` (modify) | Link the Speaking card |
| `src/lib/content/speaking.ts` | Minimal speaking "test" registry (parts/intro) |
| `tests/speaking/pcm.test.ts`, `tests/speaking/SpeakingRunner.test.tsx` | Unit + component tests |

---

## Task 1: Pure PCM helpers

**Files:** Create `src/lib/speaking/pcm.ts`, `tests/speaking/pcm.test.ts`

- [ ] **Step 1: Write the failing test `C:\code\easyIELTS\tests\speaking\pcm.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { floatTo16BitPCM, int16ToBase64, base64ToInt16, downsample } from "@/lib/speaking/pcm";

describe("PCM helpers", () => {
  it("converts float samples to clamped 16-bit PCM", () => {
    const pcm = floatTo16BitPCM(new Float32Array([0, 1, -1, 2, -2]));
    expect(pcm[0]).toBe(0);
    expect(pcm[1]).toBe(32767);   // +1.0 -> max
    expect(pcm[2]).toBe(-32768);  // -1.0 -> min
    expect(pcm[3]).toBe(32767);   // clamp >1
    expect(pcm[4]).toBe(-32768);  // clamp <-1
  });

  it("round-trips int16 through base64", () => {
    const original = new Int16Array([0, 1, -1, 12345, -12345, 32767, -32768]);
    const restored = base64ToInt16(int16ToBase64(original));
    expect(Array.from(restored)).toEqual(Array.from(original));
  });

  it("downsamples by decimation and shortens the buffer", () => {
    const input = new Float32Array([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]);
    const out = downsample(input, 48000, 16000); // ratio 3 -> length 2 (floor(8/3))
    expect(out.length).toBe(2);
    expect(out[0]).toBeCloseTo(0);
    expect(out[1]).toBeCloseTo(0.3);
  });

  it("returns the input unchanged when target rate >= input rate", () => {
    const input = new Float32Array([1, 2, 3]);
    expect(downsample(input, 16000, 16000)).toBe(input);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.** `npx vitest run tests/speaking/pcm.test.ts`

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\lib\speaking\pcm.ts`:**
```ts
/** Convert Float32 samples [-1,1] to little-endian 16-bit PCM, clamping out-of-range. */
export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out;
}

/** Base64-encode raw 16-bit PCM bytes (for sending over the proxy). */
export function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Decode base64 PCM bytes back to Int16 samples (for playback). */
export function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
}

/** Down-sample by nearest-sample decimation. Returns input unchanged if no downsampling needed. */
export function downsample(input: Float32Array, inputRate: number, targetRate: number): Float32Array {
  if (targetRate >= inputRate) return input;
  const ratio = inputRate / targetRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) out[i] = input[Math.floor(i * ratio)];
  return out;
}
```

- [ ] **Step 4: Run, confirm PASS. Commit.**
```powershell
cd C:\code\easyIELTS
npx vitest run tests/speaking/pcm.test.ts
git add src/lib/speaking/pcm.ts tests/speaking/pcm.test.ts
git commit -m "feat: pure PCM conversion helpers for speaking audio"
```

---

## Task 2: AudioWorklet processors + session glue

**Files:** Create `public/worklets/recorder-processor.js`, `public/worklets/player-processor.js`, `src/lib/speaking/session.ts`

- [ ] **Step 1: Create `C:\code\easyIELTS\public\worklets\recorder-processor.js`** (plain JS, runs in the audio thread):
```js
// Forwards mono microphone frames (Float32) to the main thread.
class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length) {
      this.port.postMessage(channel.slice(0));
    }
    return true;
  }
}
registerProcessor("recorder-processor", RecorderProcessor);
```

- [ ] **Step 2: Create `C:\code\easyIELTS\public\worklets\player-processor.js`** (queues Float32 chunks and plays them):
```js
// Plays queued Float32 audio chunks pushed from the main thread.
class PlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.current = null;
    this.offset = 0;
    this.port.onmessage = (e) => {
      if (e.data === "flush") { this.queue = []; this.current = null; this.offset = 0; }
      else this.queue.push(e.data);
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0][0];
    for (let i = 0; i < out.length; i++) {
      if (!this.current || this.offset >= this.current.length) {
        this.current = this.queue.shift() || null;
        this.offset = 0;
      }
      out[i] = this.current ? this.current[this.offset++] : 0;
    }
    return true;
  }
}
registerProcessor("player-processor", PlayerProcessor);
```

- [ ] **Step 3: Create `C:\code\easyIELTS\src\lib\speaking\session.ts`** (client-only Web Audio + WS glue; typed, not unit-tested):
```ts
import type { SpeakingEvent } from "./types";
import { floatTo16BitPCM, int16ToBase64, base64ToInt16, downsample } from "./pcm";

export type SessionStatus = "connecting" | "live" | "ended" | "error";

export interface SpeakingSession {
  start(): Promise<void>;
  sendText(text: string): void;
  end(): void;
}

export interface SessionCallbacks {
  onEvent: (event: SpeakingEvent) => void;
  onStatus: (status: SessionStatus) => void;
}

const TARGET_INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

/** Create a live speaking session backed by the proxy WebSocket + Web Audio. */
export function createSpeakingSession(part: string, cb: SessionCallbacks): SpeakingSession {
  let ws: WebSocket | null = null;
  let audioCtx: AudioContext | null = null;
  let playerCtx: AudioContext | null = null;
  let micStream: MediaStream | null = null;
  let recorderNode: AudioWorkletNode | null = null;
  let playerNode: AudioWorkletNode | null = null;

  async function start() {
    cb.onStatus("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws/speaking?part=${encodeURIComponent(part)}`);
    ws.onopen = () => cb.onStatus("live");
    ws.onclose = () => cb.onStatus("ended");
    ws.onerror = () => cb.onStatus("error");
    ws.onmessage = (e) => {
      let event: SpeakingEvent;
      try { event = JSON.parse(e.data); } catch { return; }
      if (event.type === "audio") playAudio(event.data);
      cb.onEvent(event);
    };

    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    await audioCtx.audioWorklet.addModule("/worklets/recorder-processor.js");
    const source = audioCtx.createMediaStreamSource(micStream);
    recorderNode = new AudioWorkletNode(audioCtx, "recorder-processor");
    recorderNode.port.onmessage = (ev) => {
      const frame = ev.data as Float32Array;
      const reduced = downsample(frame, audioCtx!.sampleRate, TARGET_INPUT_RATE);
      const base64 = int16ToBase64(floatTo16BitPCM(reduced));
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "audio", data: base64 }));
    };
    source.connect(recorderNode).connect(audioCtx.destination);

    playerCtx = new AudioContext({ sampleRate: OUTPUT_RATE });
    await playerCtx.audioWorklet.addModule("/worklets/player-processor.js");
    playerNode = new AudioWorkletNode(playerCtx, "player-processor");
    playerNode.connect(playerCtx.destination);
  }

  function playAudio(base64: string) {
    if (!playerNode) return;
    const int16 = base64ToInt16(base64);
    const float = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float[i] = int16[i] / 0x8000;
    playerNode.port.postMessage(float);
  }

  function sendText(text: string) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "text", text }));
  }

  function end() {
    try { ws?.send(JSON.stringify({ type: "end" })); } catch { /* ignore */ }
    try { ws?.close(); } catch { /* ignore */ }
    micStream?.getTracks().forEach((t) => t.stop());
    void audioCtx?.close();
    void playerCtx?.close();
    cb.onStatus("ended");
  }

  return { start, sendText, end };
}
```

- [ ] **Step 4: Commit.**
```powershell
git add public/worklets/recorder-processor.js public/worklets/player-processor.js src/lib/speaking/session.ts
git commit -m "feat: audio worklets and speaking session (Web Audio + proxy WS)"
```

---

## Task 3: SpeakingRunner component (injectable session)

**Files:** Create `src/lib/content/speaking.ts`, `src/components/speaking/SpeakingRunner.tsx`, `tests/speaking/SpeakingRunner.test.tsx`

- [ ] **Step 1: Create `C:\code\easyIELTS\src\lib\content\speaking.ts`:**
```ts
export interface SpeakingTest {
  id: string;
  skill: "speaking";
  title: string;
  part: "1" | "2" | "3";
}

const SPEAKING_TESTS: SpeakingTest[] = [
  { id: "gt-speaking-part1", skill: "speaking", title: "Speaking Part 1 — Interview", part: "1" },
  { id: "gt-speaking-part2", skill: "speaking", title: "Speaking Part 2 — Long turn", part: "2" },
  { id: "gt-speaking-part3", skill: "speaking", title: "Speaking Part 3 — Discussion", part: "3" },
];

export function getSpeakingTests(): SpeakingTest[] {
  return SPEAKING_TESTS;
}
export function getSpeakingTest(id: string): SpeakingTest | undefined {
  return SPEAKING_TESTS.find((t) => t.id === id);
}
```

- [ ] **Step 2: Write the failing component test `C:\code\easyIELTS\tests\speaking\SpeakingRunner.test.tsx`** (fake session + mocked evaluate fetch):
```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpeakingRunner } from "@/components/speaking/SpeakingRunner";
import type { SpeakingSession, SessionCallbacks } from "@/lib/speaking/session";

afterEach(() => vi.unstubAllGlobals());

// A controllable fake session: capture callbacks so the test can emit events.
function fakeFactory() {
  let cbs: SessionCallbacks;
  const session: SpeakingSession = {
    start: vi.fn(async () => { cbs.onStatus("live"); }),
    sendText: vi.fn(),
    end: vi.fn(() => cbs.onStatus("ended")),
  };
  const create = (_part: string, cb: SessionCallbacks) => { cbs = cb; return session; };
  return { create, emit: (e: never) => cbs.onEvent(e), session };
}

describe("SpeakingRunner", () => {
  it("starts a session, shows transcript turns, and scores on finish", async () => {
    const f = fakeFactory();
    const evalResult = {
      criteria: { fluencyCoherence: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7, pronunciation: 7 },
      speakingBand: 7, pronunciationIsApproximate: true,
      feedback: { strengths: [], improvements: ["extend answers"], examples: [] },
    };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => evalResult })));

    render(<SpeakingRunner test={{ id: "x", skill: "speaking", title: "Part 1", part: "1" }} createSession={f.create} />);
    await userEvent.click(screen.getByRole("button", { name: /start/i }));
    // Examiner speaks, candidate answers.
    f.emit({ type: "output_transcript", text: "What is your name?" } as never);
    f.emit({ type: "input_transcript", text: "My name is Sam." } as never);
    expect(await screen.findByText(/What is your name/)).toBeInTheDocument();
    expect(screen.getByText(/My name is Sam/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /finish/i }));
    expect(await screen.findByText(/Speaking band/i)).toBeInTheDocument();
    expect(screen.getByText(/Band 7\.0/)).toBeInTheDocument();
    expect(screen.getByText(/extend answers/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run, confirm FAIL.**

- [ ] **Step 4: Implement `C:\code\easyIELTS\src\components\speaking\SpeakingRunner.tsx`:**
```tsx
"use client";

import { useRef, useState } from "react";
import type { SpeakingEvent, TranscriptTurn, SpeakingEvaluation } from "@/lib/speaking/types";
import type { SpeakingSession, SessionCallbacks, SessionStatus } from "@/lib/speaking/session";
import { createSpeakingSession } from "@/lib/speaking/session";
import type { SpeakingTest } from "@/lib/content/speaking";

type CreateSession = (part: string, cb: SessionCallbacks) => SpeakingSession;

export function SpeakingRunner({
  test,
  createSession = createSpeakingSession,
}: {
  test: SpeakingTest;
  createSession?: CreateSession;
}) {
  const [status, setStatus] = useState<SessionStatus | "idle" | "scoring">("idle");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [result, setResult] = useState<SpeakingEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<SpeakingSession | null>(null);
  const turnsRef = useRef<TranscriptTurn[]>([]);

  function addTurn(role: TranscriptTurn["role"], text: string) {
    turnsRef.current = [...turnsRef.current, { role, text }];
    setTurns(turnsRef.current);
  }

  function handleEvent(event: SpeakingEvent) {
    if (event.type === "output_transcript") addTurn("examiner", event.text);
    else if (event.type === "input_transcript") addTurn("candidate", event.text);
    else if (event.type === "error") setError(event.error);
  }

  async function start() {
    setError(null);
    const session = createSession(test.part, { onEvent: handleEvent, onStatus: setStatus });
    sessionRef.current = session;
    try {
      await session.start();
    } catch {
      setError("Could not access the microphone or connect.");
      setStatus("error");
    }
  }

  async function finish() {
    sessionRef.current?.end();
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
      setStatus("ended");
    }
  }

  const live = status === "live" || status === "connecting";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">{test.title}</h1>
        <p className="text-sm text-amber-600">🎯 Band 7 = wide vocabulary, &gt;50% error-free, natural fluency</p>
      </header>

      {status === "idle" && (
        <button onClick={start} className="self-start rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700">
          Start speaking test
        </button>
      )}
      {status === "connecting" && <p className="text-sm text-gray-500">Connecting… allow microphone access.</p>}
      {live && (
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
```

- [ ] **Step 5: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/speaking/SpeakingRunner.test.tsx
git add src/lib/content/speaking.ts src/components/speaking/SpeakingRunner.tsx tests/speaking/SpeakingRunner.test.tsx
git commit -m "feat: SpeakingRunner UI with transcript, controls, and band results"
```

---

## Task 4: Routes + landing link + verification

**Files:** Create `src/app/speaking/page.tsx`, `src/app/speaking/[testId]/page.tsx`; Modify `src/app/page.tsx`

- [ ] **Step 1: Create `C:\code\easyIELTS\src\app\speaking\page.tsx`:**
```tsx
import Link from "next/link";
import { getSpeakingTests } from "@/lib/content/speaking";

export const metadata = { title: "Speaking practice — easyIELTS" };

export default function SpeakingIndexPage() {
  const tests = getSpeakingTests();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Speaking practice</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Talk live with an AI examiner, then get your band and feedback. Requires a microphone.
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {tests.map((test) => (
          <li key={test.id}>
            <Link href={`/speaking/${test.id}`} className="block rounded-xl border border-gray-200 p-4 hover:border-indigo-400 dark:border-gray-700">
              <span className="font-semibold">{test.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Create `C:\code\easyIELTS\src\app\speaking\[testId]\page.tsx`:**
```tsx
import { notFound } from "next/navigation";
import { getSpeakingTest, getSpeakingTests } from "@/lib/content/speaking";
import { SpeakingRunner } from "@/components/speaking/SpeakingRunner";

export function generateStaticParams() {
  return getSpeakingTests().map((t) => ({ testId: t.id }));
}

export default async function SpeakingTestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const test = getSpeakingTest(testId);
  if (!test) notFound();
  return <SpeakingRunner test={test} />;
}
```

- [ ] **Step 3: Link the Speaking card on the landing page.** In `C:\code\easyIELTS\src\app\page.tsx`, extend the `href` branch so `"Speaking"` → `/speaking`:
```tsx
          const href =
            s.name === "Reading" ? "/reading"
            : s.name === "Listening" ? "/listening"
            : s.name === "Writing" ? "/writing"
            : s.name === "Speaking" ? "/speaking"
            : null;
```
(Keep the rest unchanged. The foundation landing-page test must still pass.)

- [ ] **Step 4: Full verification.**
```powershell
cd C:\code\easyIELTS
npm run test
npm run lint
npm run build
```
Expected: all tests pass (incl. pcm + SpeakingRunner suites), lint exit 0 no warnings, build compiles with `/speaking` and `/speaking/[testId]` routes.

- [ ] **Step 5: Server smoke test** (pages render; worklet files served). Use a NON-reserved variable; track/stop only the PID you start.
```powershell
cd C:\code\easyIELTS
$before = (Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$p = Start-Process npm -ArgumentList "run","start" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 16
try {
  $list = (Invoke-WebRequest http://localhost:3000/speaking -UseBasicParsing -TimeoutSec 5).StatusCode
  $run  = (Invoke-WebRequest http://localhost:3000/speaking/gt-speaking-part1 -UseBasicParsing -TimeoutSec 5).StatusCode
  $wl   = (Invoke-WebRequest http://localhost:3000/worklets/recorder-processor.js -UseBasicParsing -TimeoutSec 5).StatusCode
  Write-Output "list=$list run=$run worklet=$wl"
} finally {
  $after = (Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  foreach ($id in $after) { if ($before -notcontains $id) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }
}
```
Expected: `list=200 run=200 worklet=200`. No node processes left.

- [ ] **Step 6: Commit.**
```powershell
git add src/app/speaking/page.tsx "src/app/speaking/[testId]/page.tsx" src/app/page.tsx
git commit -m "feat: speaking routes and landing-page link"
```

---

## Done criteria

- `/speaking` lists the three parts; `/speaking/gt-speaking-part1` runs a live session: Start → mic streams to the proxy → examiner audio plays → transcript builds → Finish → band + 4-criteria feedback.
- The testable core (PCM helpers, SpeakingRunner logic) is unit-tested with a fake session; the Web Audio glue is isolated in `session.ts`.
- `npm run test` / `lint` / `build` green; worklet JS is served from `/worklets/`.
- All four skills now have working UIs.

## Notes / manual verification

- Full audio E2E needs a real browser + microphone (cannot be verified headlessly). The backend proxy was already live-verified (examiner returns audio + transcript). To smoke-test manually: open `/speaking/gt-speaking-part1`, click Start, allow mic, speak; the examiner should reply aloud and the transcript should populate.
- Persistence of speaking attempts is part of the Dashboard/persistence plan.
