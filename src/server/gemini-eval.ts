import { z } from "zod";
import { roundToHalfBand } from "@/lib/ielts/rounding";
import { skillAverageBand } from "@/lib/ielts/aggregate";
import type { SpeakingEvaluation, TranscriptTurn } from "@/lib/speaking/types";

export class GeminiEvalError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiEvalError";
    this.status = status;
  }
}

export interface EvaluateSpeakingOptions {
  transcript: TranscriptTurn[];
  /** Base64 WAV of the candidate's microphone audio (enables real pronunciation). */
  audioBase64?: string;
  audioMimeType?: string;
  apiKey: string;
  /** A single model id (back-compat); prefer `models` for fallback. */
  model?: string;
  /** Ordered candidate models; tried in turn when one is overloaded (503/429). */
  models?: string[];
  fetchImpl?: typeof fetch;
  /** Injected for tests; defaults to a real delay between retries. */
  sleep?: (ms: number) => Promise<void>;
}

// Tried in order; later entries are fallbacks when earlier ones are overloaded.
// "lite" models are fast and reliably available on the free tier; the heavier
// gemini-2.5-flash is a quality fallback when the lite models are unavailable.
const DEFAULT_MODELS = ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash"];
const MIN_ATTEMPTS = 4;
const RETRY_DELAY_MS = 1500;

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

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    criteria: {
      type: "object",
      properties: {
        fluencyCoherence: { type: "number" },
        lexicalResource: { type: "number" },
        grammaticalRangeAccuracy: { type: "number" },
        pronunciation: { type: "number" },
      },
      required: ["fluencyCoherence", "lexicalResource", "grammaticalRangeAccuracy", "pronunciation"],
    },
    feedback: {
      type: "object",
      properties: {
        strengths: { type: "array", items: { type: "string" } },
        improvements: { type: "array", items: { type: "string" } },
        examples: { type: "array", items: { type: "string" } },
      },
      required: ["strengths", "improvements", "examples"],
    },
  },
  required: ["criteria", "feedback"],
};

function renderTranscript(turns: TranscriptTurn[]): string {
  return turns.map((t) => `${t.role === "examiner" ? "EXAMINER" : "CANDIDATE"}: ${t.text}`).join("\n");
}

function buildPrompt(transcript: TranscriptTurn[], hasAudio: boolean): string {
  return [
    "You are a certified IELTS speaking examiner. Assess the candidate on the four criteria",
    "(Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation)",
    "using the 0-9 band scale in 0.5 steps. Band 7 markers: speaks at length without noticeable",
    "effort, uses a range of less-common vocabulary and complex structures with >50% error-free sentences.",
    hasAudio
      ? "Assess Pronunciation from the ACTUAL candidate audio provided (individual sounds, word and sentence stress, intonation, and clarity/accent intelligibility)."
      : "NOTE: no audio is available, so estimate Pronunciation from word choice and disfluency markers and treat it as approximate.",
    "Only the CANDIDATE's speech is being assessed; the EXAMINER turns are context.",
    "Give concrete strengths, improvements, and example phrases. Respond ONLY with JSON matching the schema.",
    `\n\nTRANSCRIPT (for reference):\n${renderTranscript(transcript)}`,
  ].join(" ");
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function evaluateSpeaking(options: EvaluateSpeakingOptions): Promise<SpeakingEvaluation> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const models = options.models ?? (options.model ? [options.model] : DEFAULT_MODELS);
  const hasAudio = Boolean(options.audioBase64);

  const parts: unknown[] = [{ text: buildPrompt(options.transcript, hasAudio) }];
  if (options.audioBase64) {
    parts.push({ inlineData: { mimeType: options.audioMimeType ?? "audio/wav", data: options.audioBase64 } });
  }
  const requestBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
  });

  const maxAttempts = Math.max(MIN_ATTEMPTS, models.length);
  let lastStatus = 500;
  let lastDetail = "";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const model = models[attempt % models.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
    });

    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text;
      if (typeof text !== "string") throw new GeminiEvalError("Gemini returned no content.", 502);
      let parsed: z.infer<typeof llmSchema>;
      try {
        parsed = llmSchema.parse(JSON.parse(text));
      } catch {
        throw new GeminiEvalError("Gemini returned invalid evaluation JSON.", 502);
      }
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
        pronunciationIsApproximate: !hasAudio,
        feedback: parsed.feedback,
      };
    }

    lastStatus = response.status;
    lastDetail = await response.text().catch(() => "");
    // 503 (overloaded) / 429 (rate) are transient: back off and try the next model.
    if (response.status === 503 || response.status === 429) {
      if (attempt < maxAttempts - 1) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      break;
    }
    // Anything else (bad key, bad request) is not worth retrying.
    throw new GeminiEvalError(
      `Gemini evaluation failed (${response.status}): ${lastDetail.slice(0, 160)}`,
      response.status,
    );
  }

  throw new GeminiEvalError(
    `Gemini evaluation failed (${lastStatus}): ${lastDetail.slice(0, 160)}`,
    lastStatus,
  );
}
