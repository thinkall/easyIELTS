# easyIELTS Speaking Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the Speaking module's backend: an examiner persona, Gemini Live message builders/parsers, a WebSocket **audio proxy** (browser ↔ our server ↔ Gemini Live) so the owner's key never reaches the client, and LLM transcript scoring of the four speaking criteria.

**Architecture:** Pure, framework-free modules in `src/lib/speaking` (examiner text, Live protocol builders/parsers) are shared by the proxy, the route, and tests. `src/server/speaking-proxy.ts` runs inside the custom `server.ts` (plain Node) so it **must not import any `server-only` module** — it reads `process.env` directly and uses the pure helpers + the `ws` package. Transcript scoring reuses the GitHub Models client + credential resolver from the RSC route `/api/speaking/evaluate`.

**Tech Stack:** Next.js 16 · TypeScript · `ws` (WebSocket server + Gemini client) · zod · Vitest. Gemini Live verified this session: `gemini-3.1-flash-live-preview`, AUDIO-only output, `responseModalities:["AUDIO"]` + input/output transcription.

**Depends on (already on `main`):** `server.ts` (reserved upgrade hook), `src/server/github-models.ts` (`chatJson`), `src/server/github-token.ts` (`resolveServerToken`), `src/server/cookies.ts`, `src/server/rate-limit.ts`, `src/lib/ielts/{rounding,aggregate}.ts`.

**CRITICAL constraints (verified this session):**
- `import "server-only"` THROWS in plain Node. The proxy + its import chain must avoid server-only modules. Use `process.env.GEMINI_API_KEY` / `process.env.GEMINI_LIVE_MODEL` directly in the proxy.
- `tsx` resolves the `@/` alias, so `server.ts` and the proxy may use `@/` imports for pure (non-server-only) modules.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/speaking/types.ts` | `SpeakingEvent`, `SpeakingPart`, scoring types |
| `src/lib/speaking/examiner.ts` | `buildExaminerSystemInstruction(part)`, `getCueCard()` (original) |
| `src/lib/speaking/gemini-live.ts` | `buildSetupMessage`, `encodeAudioChunk`, `encodeTextTurn`, `parseServerMessage` (pure) |
| `src/lib/speaking/score-speaking.ts` | `scoreSpeakingTranscript(transcript, chat)` (4 criteria) |
| `src/server/speaking-proxy.ts` | `attachSpeakingProxy(server)` — WS bridge (no server-only) |
| `server.ts` (modify) | Call `attachSpeakingProxy(server)` in the reserved upgrade hook |
| `src/app/api/speaking/evaluate/route.ts` | POST transcript → scored bands |
| `tests/speaking/*` | Unit + route tests |

---

## Task 1: Examiner persona + types

**Files:** Create `src/lib/speaking/types.ts`, `src/lib/speaking/examiner.ts`, `tests/speaking/examiner.test.ts`

- [ ] **Step 1: Create `C:\code\easyIELTS\src\lib\speaking\types.ts`:**
```ts
export type SpeakingPart = "1" | "2" | "3";

export type SpeakingEvent =
  | { type: "ready" }
  | { type: "audio"; data: string }            // base64 PCM 24kHz from the examiner
  | { type: "input_transcript"; text: string } // what the candidate said
  | { type: "output_transcript"; text: string }// what the examiner said
  | { type: "turn_complete" }
  | { type: "interrupted" }
  | { type: "error"; error: string }
  | { type: "session_end"; reason: string };

export interface SpeakingCriteria {
  fluencyCoherence: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
  pronunciation: number;
}

export interface SpeakingEvaluation {
  criteria: SpeakingCriteria;
  speakingBand: number;
  pronunciationIsApproximate: boolean;
  feedback: { strengths: string[]; improvements: string[]; examples: string[] };
}

export interface TranscriptTurn {
  role: "examiner" | "candidate";
  text: string;
}
```

- [ ] **Step 2: Write the failing test `C:\code\easyIELTS\tests\speaking\examiner.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { buildExaminerSystemInstruction, getCueCard } from "@/lib/speaking/examiner";

describe("buildExaminerSystemInstruction", () => {
  it("describes the IELTS examiner role and the requested part", () => {
    const p1 = buildExaminerSystemInstruction("1");
    expect(p1.toLowerCase()).toContain("examiner");
    expect(p1).toContain("Part 1");
    expect(buildExaminerSystemInstruction("2")).toContain("Part 2");
    expect(buildExaminerSystemInstruction("3")).toContain("Part 3");
  });
  it("instructs the model to speak one turn at a time and not coach", () => {
    const text = buildExaminerSystemInstruction("1");
    expect(text.toLowerCase()).toContain("one question at a time");
  });
});

describe("getCueCard", () => {
  it("returns a Part 2 cue card with a topic and bullet prompts", () => {
    const card = getCueCard();
    expect(card.topic.length).toBeGreaterThan(0);
    expect(card.bullets.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 3: Run, confirm FAIL.** `npx vitest run tests/speaking/examiner.test.ts`

- [ ] **Step 4: Implement `C:\code\easyIELTS\src\lib\speaking\examiner.ts`:**
```ts
import type { SpeakingPart } from "./types";

export interface CueCard {
  topic: string;
  bullets: string[];
}

/** Original Part 2 cue card (not copied from any real exam). */
export function getCueCard(): CueCard {
  return {
    topic: "Describe a skill you would like to learn.",
    bullets: [
      "what the skill is",
      "why you want to learn it",
      "how you would learn it",
      "and explain how this skill would help you.",
    ],
  };
}

const PART_GUIDANCE: Record<SpeakingPart, string> = {
  "1": "You are conducting Part 1. Ask short, familiar questions about the candidate's home, work or studies, and everyday topics (4-5 minutes).",
  "2": `You are conducting Part 2. Give the candidate this cue card topic and bullet points, allow them about one minute to prepare, then let them speak for up to two minutes before asking one brief rounding-off question. Cue card: "${getCueCard().topic}" with points: ${getCueCard().bullets.join("; ")}.`,
  "3": "You are conducting Part 3. Ask more abstract, analytical questions thematically linked to the Part 2 topic; encourage the candidate to explain and justify opinions (4-5 minutes).",
};

export function buildExaminerSystemInstruction(part: SpeakingPart): string {
  return [
    "You are a professional, friendly IELTS speaking examiner conducting a live oral test.",
    PART_GUIDANCE[part],
    "Ask one question at a time and wait for the candidate to answer before continuing.",
    "Speak naturally and concisely. Do NOT coach, correct, score, or give feedback during the test.",
    "Do not break character or mention that you are an AI.",
  ].join(" ");
}
```

- [ ] **Step 5: Run, confirm PASS. Commit.**
```powershell
cd C:\code\easyIELTS
npx vitest run tests/speaking/examiner.test.ts
git add src/lib/speaking/types.ts src/lib/speaking/examiner.ts tests/speaking/examiner.test.ts
git commit -m "feat: IELTS speaking examiner persona and cue card"
```

---

## Task 2: Gemini Live protocol (pure builders/parsers)

**Files:** Create `src/lib/speaking/gemini-live.ts`, `tests/speaking/gemini-live.test.ts`

- [ ] **Step 1: Write the failing test `C:\code\easyIELTS\tests\speaking\gemini-live.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { buildSetupMessage, encodeAudioChunk, encodeTextTurn, parseServerMessage } from "@/lib/speaking/gemini-live";

describe("buildSetupMessage", () => {
  it("requests AUDIO output with transcription and a system instruction", () => {
    const msg = buildSetupMessage("gemini-3.1-flash-live-preview", "You are an examiner.") as any;
    expect(msg.setup.model).toBe("models/gemini-3.1-flash-live-preview");
    expect(msg.setup.generationConfig.responseModalities).toEqual(["AUDIO"]);
    expect(msg.setup.systemInstruction.parts[0].text).toContain("examiner");
    expect(msg.setup.outputAudioTranscription).toBeDefined();
    expect(msg.setup.inputAudioTranscription).toBeDefined();
  });
});

describe("encodeAudioChunk / encodeTextTurn", () => {
  it("wraps base64 audio as a realtimeInput media chunk at 16kHz", () => {
    const msg = encodeAudioChunk("YWJj") as any;
    expect(msg.realtimeInput.mediaChunks[0]).toEqual({ mimeType: "audio/pcm;rate=16000", data: "YWJj" });
  });
  it("wraps text as a completed client turn", () => {
    const msg = encodeTextTurn("hello") as any;
    expect(msg.clientContent.turnComplete).toBe(true);
    expect(msg.clientContent.turns[0].parts[0].text).toBe("hello");
  });
});

describe("parseServerMessage", () => {
  it("maps setupComplete to a ready event", () => {
    expect(parseServerMessage({ setupComplete: {} })).toEqual([{ type: "ready" }]);
  });
  it("extracts audio, output transcript, and turn completion", () => {
    const events = parseServerMessage({
      serverContent: {
        modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm", data: "QUJD" } }] },
        outputTranscription: { text: "Good morning." },
        turnComplete: true,
      },
    });
    expect(events).toContainEqual({ type: "audio", data: "QUJD" });
    expect(events).toContainEqual({ type: "output_transcript", text: "Good morning." });
    expect(events).toContainEqual({ type: "turn_complete" });
  });
  it("extracts input transcription and interruption", () => {
    expect(parseServerMessage({ serverContent: { inputTranscription: { text: "I think" } } }))
      .toContainEqual({ type: "input_transcript", text: "I think" });
    expect(parseServerMessage({ serverContent: { interrupted: true } }))
      .toContainEqual({ type: "interrupted" });
  });
  it("returns an empty array for unrecognised messages", () => {
    expect(parseServerMessage({ foo: 1 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\lib\speaking\gemini-live.ts`:**
```ts
import type { SpeakingEvent } from "./types";

/** First message on the Gemini Live socket: configure model, audio output, transcription. */
export function buildSetupMessage(model: string, systemInstruction: string): unknown {
  return {
    setup: {
      model: `models/${model}`,
      generationConfig: { responseModalities: ["AUDIO"] },
      systemInstruction: { parts: [{ text: systemInstruction }] },
      outputAudioTranscription: {},
      inputAudioTranscription: {},
    },
  };
}

/** Wrap a base64 PCM (16kHz) chunk of microphone audio for streaming input. */
export function encodeAudioChunk(base64Pcm16k: string): unknown {
  return { realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: base64Pcm16k }] } };
}

/** Send a completed text turn (used to kick off the examiner). */
export function encodeTextTurn(text: string): unknown {
  return { clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } };
}

interface ServerMessage {
  setupComplete?: unknown;
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data?: string }; text?: string }[] };
    outputTranscription?: { text?: string };
    inputTranscription?: { text?: string };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
}

/** Translate a raw Gemini Live server message into zero or more SpeakingEvents. */
export function parseServerMessage(message: ServerMessage): SpeakingEvent[] {
  const events: SpeakingEvent[] = [];
  if (message.setupComplete !== undefined) events.push({ type: "ready" });

  const content = message.serverContent;
  if (content) {
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) events.push({ type: "audio", data: part.inlineData.data });
    }
    if (content.inputTranscription?.text) {
      events.push({ type: "input_transcript", text: content.inputTranscription.text });
    }
    if (content.outputTranscription?.text) {
      events.push({ type: "output_transcript", text: content.outputTranscription.text });
    }
    if (content.interrupted) events.push({ type: "interrupted" });
    if (content.turnComplete) events.push({ type: "turn_complete" });
  }
  return events;
}
```

- [ ] **Step 4: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/speaking/gemini-live.test.ts
git add src/lib/speaking/gemini-live.ts tests/speaking/gemini-live.test.ts
git commit -m "feat: Gemini Live protocol builders and message parser"
```

---

## Task 3: Transcript scoring + evaluate route

**Files:** Create `src/lib/speaking/score-speaking.ts`, `src/app/api/speaking/evaluate/route.ts`, `tests/speaking/score-speaking.test.ts`, `tests/speaking/route.test.ts`

- [ ] **Step 1: Write the failing test `C:\code\easyIELTS\tests\speaking\score-speaking.test.ts`:**
```ts
import { describe, it, expect, vi } from "vitest";
import { scoreSpeakingTranscript, type SpeakingChatFn } from "@/lib/speaking/score-speaking";
import type { TranscriptTurn } from "@/lib/speaking/types";

const transcript: TranscriptTurn[] = [
  { role: "examiner", text: "Where are you from?" },
  { role: "candidate", text: "I am from a small town near the coast, which I really enjoy." },
];

const llm = {
  criteria: { fluencyCoherence: 7, lexicalResource: 6.4, grammaticalRangeAccuracy: 7, pronunciation: 6 },
  feedback: { strengths: ["clear"], improvements: ["range"], examples: [] },
};

describe("scoreSpeakingTranscript", () => {
  it("rounds criteria, averages the band, and flags approximate pronunciation", async () => {
    const chat: SpeakingChatFn = vi.fn(async () => llm);
    const result = await scoreSpeakingTranscript(transcript, chat);
    expect(chat).toHaveBeenCalledOnce();
    expect(result.criteria.lexicalResource).toBe(6.5);
    // average(7,6.5,7,6) = 6.625 -> 6.5
    expect(result.speakingBand).toBe(6.5);
    expect(result.pronunciationIsApproximate).toBe(true);
  });
  it("throws on malformed LLM output", async () => {
    const chat: SpeakingChatFn = vi.fn(async () => ({ nope: true }));
    await expect(scoreSpeakingTranscript(transcript, chat)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement `C:\code\easyIELTS\src\lib\speaking\score-speaking.ts`:**
```ts
import { z } from "zod";
import { roundToHalfBand } from "@/lib/ielts/rounding";
import { skillAverageBand } from "@/lib/ielts/aggregate";
import type { SpeakingEvaluation, TranscriptTurn } from "./types";

export type SpeakingChatFn = (options: {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
}) => Promise<unknown>;

const llmSchema = z.object({
  criteria: z.object({
    fluencyCoherence: z.number(),
    lexicalResource: z.number(),
    grammaticalRangeAccuracy: z.number(),
    pronunciation: z.number(),
  }),
  feedback: z.object({
    strengths: z.array(z.string()),
    improvements: z.array(z.string()),
    examples: z.array(z.string()),
  }),
});

const JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["criteria", "feedback"],
  properties: {
    criteria: {
      type: "object",
      additionalProperties: false,
      required: ["fluencyCoherence", "lexicalResource", "grammaticalRangeAccuracy", "pronunciation"],
      properties: {
        fluencyCoherence: { type: "number" },
        lexicalResource: { type: "number" },
        grammaticalRangeAccuracy: { type: "number" },
        pronunciation: { type: "number" },
      },
    },
    feedback: {
      type: "object",
      additionalProperties: false,
      required: ["strengths", "improvements", "examples"],
      properties: {
        strengths: { type: "array", items: { type: "string" } },
        improvements: { type: "array", items: { type: "string" } },
        examples: { type: "array", items: { type: "string" } },
      },
    },
  },
};

const SYSTEM = [
  "You are a certified IELTS speaking examiner. Assess the following speaking-test transcript",
  "on the four criteria (Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation)",
  "using the 0-9 band scale in 0.5 steps. Band 7 markers: speaks at length without noticeable effort,",
  "uses a range of less-common vocabulary and complex structures with >50% error-free sentences.",
  "NOTE: you are working from a transcript, so estimate Pronunciation from word choice, structure and",
  "any disfluency markers, and treat it as approximate. Respond ONLY with JSON matching the schema.",
].join(" ");

function renderTranscript(turns: TranscriptTurn[]): string {
  return turns.map((t) => `${t.role === "examiner" ? "EXAMINER" : "CANDIDATE"}: ${t.text}`).join("\n");
}

export async function scoreSpeakingTranscript(
  transcript: TranscriptTurn[],
  chat: SpeakingChatFn,
): Promise<SpeakingEvaluation> {
  const raw = await chat({
    system: SYSTEM,
    user: `TRANSCRIPT:\n${renderTranscript(transcript)}`,
    schema: { name: "ielts_speaking_evaluation", schema: JSON_SCHEMA },
  });
  const parsed = llmSchema.parse(raw);
  const criteria = {
    fluencyCoherence: roundToHalfBand(parsed.criteria.fluencyCoherence),
    lexicalResource: roundToHalfBand(parsed.criteria.lexicalResource),
    grammaticalRangeAccuracy: roundToHalfBand(parsed.criteria.grammaticalRangeAccuracy),
    pronunciation: roundToHalfBand(parsed.criteria.pronunciation),
  };
  return {
    criteria,
    speakingBand: skillAverageBand([
      criteria.fluencyCoherence,
      criteria.lexicalResource,
      criteria.grammaticalRangeAccuracy,
      criteria.pronunciation,
    ]),
    pronunciationIsApproximate: true,
    feedback: parsed.feedback,
  };
}
```

- [ ] **Step 4: Run, confirm PASS.** `npx vitest run tests/speaking/score-speaking.test.ts`

- [ ] **Step 5: Implement the route `C:\code\easyIELTS\src\app\api\speaking\evaluate\route.ts`** (mirrors the writing route's credential logic):
```ts
import { z } from "zod";
import { scoreSpeakingTranscript } from "@/lib/speaking/score-speaking";
import { chatJson, GitHubModelsError } from "@/server/github-models";
import { resolveServerToken } from "@/server/github-token";
import { getCookie } from "@/server/cookies";
import { rateLimit } from "@/server/rate-limit";

const bodySchema = z.object({
  transcript: z
    .array(z.object({ role: z.enum(["examiner", "candidate"]), text: z.string() }))
    .min(1),
  token: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userToken = body.token ?? getCookie(request, "eielts_gh");
  let token = userToken;
  if (!token) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    if (!rateLimit(`speaking:${ip}`, 10, 60 * 60 * 1000).allowed) {
      return Response.json(
        { error: "Rate limit reached. Sign in with GitHub or use your own token." },
        { status: 429 },
      );
    }
    token = await resolveServerToken();
  }

  try {
    const result = await scoreSpeakingTranscript(body.transcript, (options) =>
      chatJson({ ...options, token }),
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof GitHubModelsError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Evaluation failed." }, { status: 500 });
  }
}
```

- [ ] **Step 6: Write `C:\code\easyIELTS\tests\speaking\route.test.ts`:**
```ts
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { POST } from "@/app/api/speaking/evaluate/route";
import { _resetRateLimitStore } from "@/server/rate-limit";

beforeEach(() => _resetRateLimitStore());
afterEach(() => vi.unstubAllGlobals());

const llmContent = JSON.stringify({
  criteria: { fluencyCoherence: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7, pronunciation: 6.5 },
  feedback: { strengths: [], improvements: [], examples: [] },
});

function req(body: unknown, cookie?: string) {
  return new Request("http://x/api/speaking/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describe("POST /api/speaking/evaluate", () => {
  it("returns 400 for an invalid body", async () => {
    expect((await POST(req({ transcript: [] }))).status).toBe(400);
  });
  it("scores a transcript when the model responds (cookie credential)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: llmContent } }] }), text: async () => llmContent })));
    const res = await POST(req({ transcript: [{ role: "candidate", text: "Hello there, I enjoy reading." }] }, "eielts_gh=gho_u"));
    expect(res.status).toBe(200);
    expect((await res.json()).speakingBand).toBe(7); // avg(7,7,7,6.5)=6.875 -> 7
  });
});
```

- [ ] **Step 7: Run, confirm PASS. Commit.**
```powershell
npx vitest run tests/speaking/score-speaking.test.ts tests/speaking/route.test.ts
git add src/lib/speaking/score-speaking.ts "src/app/api/speaking/evaluate/route.ts" tests/speaking/score-speaking.test.ts tests/speaking/route.test.ts
git commit -m "feat: speaking transcript scoring and evaluate route"
```

---

## Task 4: WebSocket audio proxy + server wiring

**Files:** Create `src/server/speaking-proxy.ts`; Modify `server.ts`; install `ws`

- [ ] **Step 1: Install the WebSocket library.**
```powershell
cd C:\code\easyIELTS
npm install ws
npm install -D @types/ws
```

- [ ] **Step 2: Implement `C:\code\easyIELTS\src\server\speaking-proxy.ts`** (NO `import "server-only"` — runs in plain Node):
```ts
import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { buildSetupMessage, encodeAudioChunk, encodeTextTurn, parseServerMessage } from "@/lib/speaking/gemini-live";
import { buildExaminerSystemInstruction } from "@/lib/speaking/examiner";
import type { SpeakingPart } from "@/lib/speaking/types";

const GEMINI_WS =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const MAX_SESSION_MS = 6 * 60 * 1000; // hard cost cap

/** Attach the /ws/speaking proxy to the custom Node server. */
export function attachSpeakingProxy(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!req.url || !req.url.startsWith("/ws/speaking")) return;
    wss.handleUpgrade(req, socket, head, (browser) => bridge(browser, req));
  });
}

function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function bridge(browser: WebSocket, req: IncomingMessage): void {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
  if (!apiKey) {
    send(browser, { type: "error", error: "speaking_unavailable" });
    browser.close();
    return;
  }

  const part = (new URL(req.url ?? "", "http://localhost").searchParams.get("part") ?? "1") as SpeakingPart;
  const gemini = new WebSocket(`${GEMINI_WS}?key=${apiKey}`);

  let closed = false;
  const cleanup = (reason: string) => {
    if (closed) return;
    closed = true;
    clearTimeout(cap);
    send(browser, { type: "session_end", reason });
    try { browser.close(); } catch { /* ignore */ }
    try { gemini.close(); } catch { /* ignore */ }
  };
  const cap = setTimeout(() => cleanup("time_cap"), MAX_SESSION_MS);

  gemini.on("open", () => {
    gemini.send(JSON.stringify(buildSetupMessage(model, buildExaminerSystemInstruction(part))));
  });
  gemini.on("message", (data: Buffer) => {
    let parsed: unknown;
    try { parsed = JSON.parse(data.toString()); } catch { return; }
    for (const event of parseServerMessage(parsed as never)) send(browser, event);
  });
  gemini.on("close", () => cleanup("gemini_closed"));
  gemini.on("error", () => { send(browser, { type: "error", error: "gemini_error" }); cleanup("gemini_error"); });

  browser.on("message", (data: Buffer) => {
    let msg: { type?: string; data?: string; text?: string };
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (gemini.readyState !== WebSocket.OPEN) return;
    if (msg.type === "audio" && typeof msg.data === "string") {
      gemini.send(JSON.stringify(encodeAudioChunk(msg.data)));
    } else if (msg.type === "text" && typeof msg.text === "string") {
      gemini.send(JSON.stringify(encodeTextTurn(msg.text)));
    } else if (msg.type === "end") {
      cleanup("client_end");
    }
  });
  browser.on("close", () => cleanup("browser_closed"));
  browser.on("error", () => cleanup("browser_error"));
}
```

- [ ] **Step 3: Wire it into `C:\code\easyIELTS\server.ts`.** Add the import at the top and call `attachSpeakingProxy(server)` where the reserved comment is. The server block becomes:
```ts
import { createServer } from "node:http";
import { loadEnvConfig } from "@next/env";
import next from "next";
import { attachSpeakingProxy } from "@/server/speaking-proxy";

const dev = process.env.NODE_ENV !== "production";
loadEnvConfig(process.cwd(), dev);

const hostname = process.env.HOST ?? "localhost";
const parsedPort = Number.parseInt(process.env.PORT ?? "3000", 10);
const port = Number.isNaN(parsedPort) ? 3000 : parsedPort;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      handle(req, res);
    });

    // Live speaking proxy: browser <-> our server <-> Gemini Live (key stays server-side).
    attachSpeakingProxy(server);

    server.on("error", (err) => {
      console.error("[easyIELTS] server error:", err);
      process.exit(1);
    });

    server.listen(port, hostname, () => {
      console.log(`> easyIELTS ready on http://${hostname}:${port} (${dev ? "dev" : "prod"})`);
    });
  })
  .catch((err) => {
    console.error("[easyIELTS] failed to start:", err);
    process.exit(1);
  });
```
(Preserve the existing structure; the only additions are the import and the `attachSpeakingProxy(server)` call. Keep the existing `.catch`/error handling.)

- [ ] **Step 4: Verify the suite, lint, and build still pass.**
```powershell
cd C:\code\easyIELTS
npm run test
npm run lint
npm run build
```
Expected: all tests pass (incl. new speaking suites), lint exit 0 no warnings, build compiles with `/api/speaking/evaluate` in the route table. (The proxy isn't a Next route, so it won't appear in the route table — that's expected.)

- [ ] **Step 5: LIVE end-to-end proxy verification.** Start the dev server and run a Node `ws` client that connects to `/ws/speaking`, sends a text turn, and confirms the examiner replies with audio + a transcript THROUGH our proxy (using the owner's `GEMINI_API_KEY` from `.env`). Track/stop only the PIDs you start.
```powershell
cd C:\code\easyIELTS
npm install ws  # ensure available to the probe
$before = (Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$env:PORT = "3066"
$p = Start-Process npm -ArgumentList "run","dev" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 20
@'
const WebSocket = require("ws");
const ws = new WebSocket("ws://localhost:3066/ws/speaking?part=1");
let audio = 0, transcript = "";
const done = (m) => { console.log(m); try{ws.close();}catch{}; setTimeout(()=>process.exit(0),200); };
const t = setTimeout(()=>done("PROXY RESULT audioBytes="+audio+" transcript="+JSON.stringify(transcript.trim())), 25000);
ws.on("open", () => { /* wait for ready */ });
ws.on("message", (d) => {
  let e; try{ e = JSON.parse(d.toString()); }catch{ return; }
  if (e.type === "ready") ws.send(JSON.stringify({ type: "text", text: "Please ask me your first question." }));
  if (e.type === "audio") audio += Buffer.from(e.data, "base64").length;
  if (e.type === "output_transcript") transcript += e.text;
  if (e.type === "turn_complete") { clearTimeout(t); done("PROXY RESULT audioBytes="+audio+" transcript="+JSON.stringify(transcript.trim())); }
  if (e.type === "error") { clearTimeout(t); done("PROXY ERROR " + e.error); }
});
ws.on("error", (err) => { clearTimeout(t); done("WS ERROR " + err.message); });
'@ | node -
$after = (Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
foreach ($id in $after) { if ($before -notcontains $id) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }
```
Expected: `PROXY RESULT audioBytes=<a large number, e.g. >50000> transcript="<an examiner question>"` — proving the browser↔our-server↔Gemini bridge works and the examiner speaks. If `GEMINI_API_KEY` is missing it prints `PROXY ERROR speaking_unavailable`; if `ws`/network is unavailable, note it and rely on the unit tests. Leave NO node processes running.

- [ ] **Step 6: Commit.**
```powershell
git add src/server/speaking-proxy.ts server.ts package.json package-lock.json
git commit -m "feat: Gemini Live speaking WebSocket audio proxy"
```

---

## Done criteria

- Pure modules (`examiner`, `gemini-live`, `score-speaking`) are unit-tested; the proxy bridges `/ws/speaking` to Gemini Live with the key server-side; `/api/speaking/evaluate` scores a transcript on the four criteria with the shared/owner/user credential logic + rate limit.
- `npm run test` / `lint` / `build` all green.
- Live verification shows the examiner returns audio + a transcript through our proxy.
- The proxy imports NO `server-only` module (it runs in the custom Node server); all content is original.

## Notes for the frontend plan (Speaking UI)

- The browser will: open `ws://<host>/ws/speaking?part=N`, capture mic audio (AudioWorklet → 16kHz PCM → base64) and send `{type:"audio",data}`, play received `{type:"audio",data}` (24kHz PCM) via an AudioWorklet, accumulate `input_transcript`/`output_transcript` into a `TranscriptTurn[]`, and on end POST the transcript to `/api/speaking/evaluate`.
- PCM conversion helpers should be pure and unit-tested; the AudioWorklet processors live in `public/` as static JS.
- `SpeakingRunner` shows a live transcript, a session timer (the proxy also caps at 6 min), and the final band + feedback.
