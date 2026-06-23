import { z } from "zod";
import type { ListeningTest } from "@/lib/content/types";
import type { ReadingQuestion, QuestionOption } from "@/lib/content/types";

export type GenerateChatFn = (options: {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
}) => Promise<unknown>;

const QUESTION_TYPES = [
  "true_false_notgiven",
  "single_choice",
  "sentence_completion",
  "short_answer",
] as const;

const llmSchema = z.object({
  title: z.string().min(1),
  sectionName: z.string().min(1),
  script: z.string().min(1),
  questions: z
    .array(
      z.object({
        type: z.enum(QUESTION_TYPES),
        prompt: z.string().min(1),
        options: z.array(z.string().min(1)).nullable().optional(),
        accepted: z.array(z.string().min(1)).min(1),
        wordLimit: z.number().int().positive().nullable().optional(),
      }),
    )
    .min(5),
});

const JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["title", "sectionName", "script", "questions"],
  properties: {
    title: { type: "string" },
    sectionName: { type: "string" },
    script: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "prompt", "options", "accepted", "wordLimit"],
        properties: {
          type: { type: "string", enum: [...QUESTION_TYPES] },
          prompt: { type: "string" },
          options: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] },
          accepted: { type: "array", items: { type: "string" } },
          wordLimit: { anyOf: [{ type: "number" }, { type: "null" }] },
        },
      },
    },
  },
};

const SYSTEM = [
  "You are an IELTS General Training Listening test author.",
  "Write an ORIGINAL, copyright-free Section 1-style transcript: a natural everyday conversation",
  "between exactly TWO speakers, each line prefixed with a role label and a colon",
  "(e.g. 'Receptionist: ...' and 'Caller: ...'). About 180-260 words.",
  "Then write 6-10 questions answerable ONLY from the transcript, using these types:",
  "true_false_notgiven, single_choice, sentence_completion, short_answer.",
  "For single_choice, provide 'options' as strings each starting with a letter (e.g. 'A 7pm') and 'accepted' = the correct letter.",
  "For completion/short_answer, 'accepted' must be words spoken in the transcript; include sensible variants and set 'wordLimit'.",
  "Respond ONLY with JSON matching the schema.",
].join(" ");

function parseOption(raw: string): QuestionOption {
  const match = raw.match(/^\s*([A-Za-z])[).\s]+(.*)$/);
  if (match) return { value: match[1].toUpperCase(), label: match[2].trim() };
  return { value: raw.trim(), label: raw.trim() };
}

let counter = 0;

export async function generateListeningTest(topic: string, chat: GenerateChatFn): Promise<ListeningTest> {
  const raw = await chat({
    system: SYSTEM,
    user: `Topic or setting: ${topic || "any everyday situation (booking, enquiry, registration, etc.)"}. Write the transcript and questions now.`,
    schema: { name: "ielts_gt_listening_test", schema: JSON_SCHEMA },
  });
  const parsed = llmSchema.parse(raw);
  const id = `gen-listening-${Date.now()}-${counter++}`;

  const questions: ReadingQuestion[] = parsed.questions.map((q, index) => ({
    id: `${id}-q${index + 1}`,
    number: index + 1,
    type: q.type,
    prompt: q.prompt,
    accepted: q.accepted,
    wordLimit: q.wordLimit ?? undefined,
    options: q.options && q.options.length > 0 ? q.options.map(parseOption) : undefined,
  }));

  return {
    id,
    skill: "listening",
    title: parsed.title,
    timeMinutes: 10,
    sections: [
      {
        id: `${id}-s1`,
        name: parsed.sectionName,
        script: parsed.script,
        questions,
      },
    ],
  };
}
