import { z } from "zod";
import { roundToHalfBand } from "@/lib/ielts/rounding";
import { skillAverageBand } from "@/lib/ielts/aggregate";
import { wordCount } from "@/lib/scoring/normalize";
import type { TaskEvaluation, WritingTaskInput } from "./types";

export type ChatFn = (options: {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
}) => Promise<unknown>;

const llmSchema = z.object({
  criteria: z.object({
    taskResponse: z.number(),
    coherenceCohesion: z.number(),
    lexicalResource: z.number(),
    grammaticalRangeAccuracy: z.number(),
  }),
  feedback: z.object({
    strengths: z.array(z.string()),
    improvements: z.array(z.string()),
    correctedExamples: z.array(
      z.object({ original: z.string(), corrected: z.string(), note: z.string() }),
    ),
  }),
  modelAnswer: z.string(),
});

const JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["criteria", "feedback", "modelAnswer"],
  properties: {
    criteria: {
      type: "object",
      additionalProperties: false,
      required: ["taskResponse", "coherenceCohesion", "lexicalResource", "grammaticalRangeAccuracy"],
      properties: {
        taskResponse: { type: "number" },
        coherenceCohesion: { type: "number" },
        lexicalResource: { type: "number" },
        grammaticalRangeAccuracy: { type: "number" },
      },
    },
    feedback: {
      type: "object",
      additionalProperties: false,
      required: ["strengths", "improvements", "correctedExamples"],
      properties: {
        strengths: { type: "array", items: { type: "string" } },
        improvements: { type: "array", items: { type: "string" } },
        correctedExamples: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["original", "corrected", "note"],
            properties: {
              original: { type: "string" },
              corrected: { type: "string" },
              note: { type: "string" },
            },
          },
        },
      },
    },
    modelAnswer: { type: "string" },
  },
};

function buildSystemPrompt(taskNumber: 1 | 2): string {
  const taskDesc =
    taskNumber === 1
      ? "IELTS General Training Writing Task 1 (a letter of at least 150 words)"
      : "IELTS Writing Task 2 (an essay of at least 250 words)";
  return [
    `You are a certified, strict IELTS examiner. Assess the candidate's ${taskDesc}.`,
    "Score each of the four criteria (Task Response/Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy) on the 0-9 band scale in 0.5 steps.",
    "Band 7 markers: ~50% of sentences error-free; a clear, fully-developed position; less-common vocabulary with awareness of collocation; varied complex structures.",
    "Penalise under-length, off-topic, or memorised responses. Provide concrete, specific feedback and a band-8+ model answer.",
    "Respond ONLY with JSON matching the provided schema.",
  ].join(" ");
}

export async function evaluateWritingTask(
  input: WritingTaskInput,
  chat: ChatFn,
): Promise<TaskEvaluation> {
  const wc = wordCount(input.response);
  const raw = await chat({
    system: buildSystemPrompt(input.taskNumber),
    user: `TASK PROMPT:\n${input.prompt}\n\nCANDIDATE RESPONSE (${wc} words):\n${input.response}`,
    schema: { name: "ielts_writing_task_evaluation", schema: JSON_SCHEMA },
  });

  const parsed = llmSchema.parse(raw);
  const criteria = {
    taskResponse: roundToHalfBand(parsed.criteria.taskResponse),
    coherenceCohesion: roundToHalfBand(parsed.criteria.coherenceCohesion),
    lexicalResource: roundToHalfBand(parsed.criteria.lexicalResource),
    grammaticalRangeAccuracy: roundToHalfBand(parsed.criteria.grammaticalRangeAccuracy),
  };
  const taskBand = skillAverageBand([
    criteria.taskResponse,
    criteria.coherenceCohesion,
    criteria.lexicalResource,
    criteria.grammaticalRangeAccuracy,
  ]);

  return {
    taskNumber: input.taskNumber,
    criteria,
    taskBand,
    wordCount: wc,
    feedback: parsed.feedback,
    modelAnswer: parsed.modelAnswer,
  };
}
