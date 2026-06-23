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

export function buildExaminerSystemInstruction(part: SpeakingPart, topic?: string): string {
  const guidance =
    topic && part === "2"
      ? `You are conducting Part 2. Give the candidate this cue card, allow about one minute to prepare, then let them speak for up to two minutes before asking one brief rounding-off question. Cue card: "${topic}"`
      : topic
        ? `${PART_GUIDANCE[part]} Focus the questions around this theme: "${topic}".`
        : PART_GUIDANCE[part];
  return [
    "You are a professional, friendly IELTS speaking examiner conducting a live oral test.",
    guidance,
    "Ask one question at a time and wait for the candidate to answer before continuing.",
    "Speak naturally and concisely. Do NOT coach, correct, score, or give feedback during the test.",
    "Do not break character or mention that you are an AI.",
  ].join(" ");
}
