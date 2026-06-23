import { z } from "zod";
import type { WritingTest } from "@/lib/content/writing";

export type GenerateChatFn = (options: {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
}) => Promise<unknown>;

const llmSchema = z.object({
  title: z.string().min(1),
  task1Instructions: z.string().min(1),
  task2Instructions: z.string().min(1),
});

const JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["title", "task1Instructions", "task2Instructions"],
  properties: {
    title: { type: "string" },
    task1Instructions: { type: "string" },
    task2Instructions: { type: "string" },
  },
};

const SYSTEM = [
  "You are an IELTS General Training Writing test author.",
  "Write an ORIGINAL, copyright-free test with two tasks.",
  "Task 1 is a letter (at least 150 words): give a realistic situation and three bullet points of what to include,",
  "and tell the candidate how to begin (e.g. \"Begin your letter 'Dear Sir or Madam,'\").",
  "Task 2 is an essay (at least 250 words): give a debatable prompt and ask the candidate to discuss/argue and give their opinion.",
  "Keep instructions self-contained and exam-realistic. Respond ONLY with JSON matching the schema.",
].join(" ");

let counter = 0;

export async function generateWritingTest(topic: string, chat: GenerateChatFn): Promise<WritingTest> {
  const raw = await chat({
    system: SYSTEM,
    user: `Topic or theme: ${topic || "any everyday general-interest subject"}. Write the two tasks now.`,
    schema: { name: "ielts_gt_writing_test", schema: JSON_SCHEMA },
  });
  const parsed = llmSchema.parse(raw);
  const id = `gen-writing-${Date.now()}-${counter++}`;

  return {
    id,
    skill: "writing",
    variant: "general-training",
    title: parsed.title,
    tasks: [
      { taskNumber: 1, minWords: 150, instructions: parsed.task1Instructions },
      { taskNumber: 2, minWords: 250, instructions: parsed.task2Instructions },
    ],
  };
}
