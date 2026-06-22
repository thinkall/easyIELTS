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
