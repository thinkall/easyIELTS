import { z } from "zod";
import type { SpeakingTest } from "@/lib/content/speaking";

export type GenerateChatFn = (options: {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
}) => Promise<unknown>;

const llmSchema = z.object({
  title: z.string().min(1),
  cueCardTopic: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(2),
});

const JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["title", "cueCardTopic", "bullets"],
  properties: {
    title: { type: "string" },
    cueCardTopic: { type: "string" },
    bullets: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM = [
  "You are an IELTS Speaking examiner and test author.",
  "Create an ORIGINAL Part 2 cue card: a 'Describe ...' topic plus 3-4 bullet points",
  "the candidate should cover. Keep it natural and answerable in a 2-minute long turn.",
  "Respond ONLY with JSON matching the schema.",
].join(" ");

let counter = 0;

export async function generateSpeakingTest(topic: string, chat: GenerateChatFn): Promise<SpeakingTest> {
  const raw = await chat({
    system: SYSTEM,
    user: `Theme: ${topic || "any everyday general-interest subject"}. Write the cue card now.`,
    schema: { name: "ielts_speaking_cue_card", schema: JSON_SCHEMA },
  });
  const parsed = llmSchema.parse(raw);
  const id = `gen-speaking-${Date.now()}-${counter++}`;

  const composedTopic = `${parsed.cueCardTopic} You should say: ${parsed.bullets.join("; ")}.`;

  return {
    id,
    skill: "speaking",
    title: parsed.title,
    part: "2",
    topic: composedTopic,
  };
}
