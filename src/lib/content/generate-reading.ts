import { z } from "zod";
import type { ReadingTest, ReadingQuestion, QuestionOption } from "./types";

export type GenerateChatFn = (options: {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
}) => Promise<unknown>;

const QUESTION_TYPES = [
  "true_false_notgiven",
  "yes_no_notgiven",
  "single_choice",
  "sentence_completion",
  "short_answer",
] as const;

const llmSchema = z.object({
  title: z.string().min(1),
  passageTitle: z.string().min(1),
  passageParagraphs: z.array(z.string().min(1)).min(2),
  questions: z
    .array(
      z.object({
        type: z.enum(QUESTION_TYPES),
        prompt: z.string().min(1),
        options: z.array(z.string().min(1)).optional(),
        accepted: z.array(z.string().min(1)).min(1),
        wordLimit: z.number().int().positive().optional(),
      }),
    )
    .min(5),
});

const JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["title", "passageTitle", "passageParagraphs", "questions"],
  properties: {
    title: { type: "string" },
    passageTitle: { type: "string" },
    passageParagraphs: { type: "array", items: { type: "string" } },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "prompt", "accepted"],
        properties: {
          type: { type: "string", enum: [...QUESTION_TYPES] },
          prompt: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          accepted: { type: "array", items: { type: "string" } },
          wordLimit: { type: "number" },
        },
      },
    },
  },
};

const SYSTEM = [
  "You are an IELTS General Training Reading test author.",
  "Write an ORIGINAL, copyright-free passage (general-interest, ~250-350 words) and questions for it.",
  "Use only these question types: true_false_notgiven, yes_no_notgiven, single_choice, sentence_completion, short_answer.",
  "For single_choice, provide 'options' as strings each starting with a letter and a space (e.g. 'A apples'), and 'accepted' = the correct letter (e.g. ['B']).",
  "For true_false_notgiven use accepted ['true'|'false'|'not given']; for yes_no_notgiven ['yes'|'no'|'not given'].",
  "For completion/short_answer, 'accepted' must be words that literally appear in the passage; include sensible variants; set 'wordLimit'.",
  "Every answer MUST be findable in or directly inferable from the passage. Produce 8-12 questions. Respond ONLY with JSON matching the schema.",
].join(" ");

/** Parse an option string like "A apples" into { value: "A", label: "apples" }. */
function parseOption(raw: string): QuestionOption {
  const match = raw.match(/^\s*([A-Za-z])[).\s]+(.*)$/);
  if (match) return { value: match[1].toUpperCase(), label: match[2].trim() };
  return { value: raw.trim(), label: raw.trim() };
}

let counter = 0;

export async function generateReadingTest(topic: string, chat: GenerateChatFn): Promise<ReadingTest> {
  const raw = await chat({
    system: SYSTEM,
    user: `Topic: ${topic || "any general-interest subject"}. Write the passage and questions now.`,
    schema: { name: "ielts_gt_reading_test", schema: JSON_SCHEMA },
  });
  const parsed = llmSchema.parse(raw);
  const id = `gen-reading-${Date.now()}-${counter++}`;

  const questions: ReadingQuestion[] = parsed.questions.map((q, index) => ({
    id: `${id}-q${index + 1}`,
    number: index + 1,
    type: q.type,
    prompt: q.prompt,
    accepted: q.accepted,
    wordLimit: q.wordLimit,
    options: q.options ? q.options.map(parseOption) : undefined,
  }));

  return {
    id,
    skill: "reading",
    variant: "general-training",
    title: parsed.title,
    timeMinutes: 20,
    sections: [
      {
        id: `${id}-s1`,
        name: "Section 3: General Reading (AI-generated)",
        passageTitle: parsed.passageTitle,
        passageParagraphs: parsed.passageParagraphs,
        questions,
      },
    ],
  };
}
