import { z } from "zod";
import type { ReadingTest, ListeningTest, ReadingQuestion, QuestionOption } from "@/lib/content/types";
import type { WritingTest } from "@/lib/content/writing";
import type { SpeakingTest } from "@/lib/content/speaking";
import type { QuestionType } from "@/lib/scoring/types";

const QUESTION_TYPES: [QuestionType, ...QuestionType[]] = [
  "single_choice",
  "multiple_choice",
  "true_false_notgiven",
  "yes_no_notgiven",
  "matching_headings",
  "matching_info",
  "matching_features",
  "matching_sentence_endings",
  "sentence_completion",
  "summary_completion",
  "note_completion",
  "table_completion",
  "flowchart_completion",
  "form_completion",
  "diagram_label",
  "map_label",
  "short_answer",
];

const questionSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().min(1),
  accepted: z.array(z.string().min(1)).min(1),
  options: z.array(z.string().min(1)).optional(),
  wordLimit: z.number().int().positive().optional(),
});

const listeningSchema = z.object({
  timeMinutes: z.number().int().positive().optional(),
  sections: z
    .array(
      z.object({
        name: z.string().min(1),
        audio: z.string().min(1).optional(),
        script: z.string().optional(),
        questions: z.array(questionSchema).min(1),
      }),
    )
    .min(1),
});

const readingSchema = z.object({
  timeMinutes: z.number().int().positive().optional(),
  sections: z
    .array(
      z.object({
        name: z.string().min(1),
        passageTitle: z.string().min(1),
        passageParagraphs: z.array(z.string().min(1)).min(1),
        questions: z.array(questionSchema).min(1),
      }),
    )
    .min(1),
});

const writingSchema = z.object({
  tasks: z
    .array(
      z.object({
        taskNumber: z.union([z.literal(1), z.literal(2)]),
        minWords: z.number().int().positive().optional(),
        instructions: z.string().min(1),
      }),
    )
    .min(1),
});

const speakingSchema = z.object({
  parts: z
    .array(
      z.object({
        part: z.union([z.literal("1"), z.literal("2"), z.literal("3")]),
        title: z.string().min(1).optional(),
        topic: z.string().min(1).optional(),
      }),
    )
    .min(1),
});

export const pastExamManifestSchema = z
  .object({
    title: z.string().min(1),
    listening: listeningSchema.optional(),
    reading: readingSchema.optional(),
    writing: writingSchema.optional(),
    speaking: speakingSchema.optional(),
  })
  .refine((m) => m.listening || m.reading || m.writing || m.speaking, {
    message: "A past exam must define at least one of: listening, reading, writing, speaking.",
  });

export type PastExamManifest = z.infer<typeof pastExamManifestSchema>;
export type PastExamSkill = "listening" | "reading" | "writing" | "speaking";

export interface PastExamSummary {
  id: string;
  title: string;
  skills: PastExamSkill[];
}

/** Parse and validate raw manifest JSON; throws ZodError on invalid input. */
export function parseManifest(raw: unknown): PastExamManifest {
  return pastExamManifestSchema.parse(raw);
}

/** Which skills a manifest provides, in canonical order. */
export function manifestSkills(m: PastExamManifest): PastExamSkill[] {
  const skills: PastExamSkill[] = [];
  if (m.listening) skills.push("listening");
  if (m.reading) skills.push("reading");
  if (m.writing) skills.push("writing");
  if (m.speaking) skills.push("speaking");
  return skills;
}

/** Build the URL that serves a local past-exam audio file via the API. */
export function pastExamAudioUrl(examId: string, file: string): string {
  return `/api/past-exams/audio?exam=${encodeURIComponent(examId)}&file=${encodeURIComponent(file)}`;
}

/** Parse an option string like "A apples" into { value: "A", label: "apples" }. */
function parseOption(raw: string): QuestionOption {
  const match = raw.match(/^\s*([A-Za-z])[).\s]+(.*)$/);
  if (match) return { value: match[1].toUpperCase(), label: match[2].trim() };
  return { value: raw.trim(), label: raw.trim() };
}

function toQuestions(
  examId: string,
  skill: string,
  sectionIndex: number,
  raws: z.infer<typeof questionSchema>[],
  startNumber: number,
): { questions: ReadingQuestion[]; nextNumber: number } {
  let n = startNumber;
  const questions = raws.map((q, i) => {
    const number = n++;
    return {
      id: `${examId}-${skill}-s${sectionIndex + 1}-q${i + 1}`,
      number,
      type: q.type,
      prompt: q.prompt,
      accepted: q.accepted,
      wordLimit: q.wordLimit,
      options: q.options && q.options.length > 0 ? q.options.map(parseOption) : undefined,
    } satisfies ReadingQuestion;
  });
  return { questions, nextNumber: n };
}

export function toListeningTest(examId: string, m: PastExamManifest): ListeningTest | undefined {
  if (!m.listening) return undefined;
  let number = 1;
  const sections = m.listening.sections.map((s, i) => {
    const { questions, nextNumber } = toQuestions(examId, "listening", i, s.questions, number);
    number = nextNumber;
    return {
      id: `${examId}-listening-s${i + 1}`,
      name: s.name,
      script: s.script ?? "",
      audioUrl: s.audio ? pastExamAudioUrl(examId, s.audio) : undefined,
      questions,
    };
  });
  return {
    id: examId,
    skill: "listening",
    title: `${m.title} — Listening`,
    timeMinutes: m.listening.timeMinutes ?? 30,
    sections,
  };
}

export function toReadingTest(examId: string, m: PastExamManifest): ReadingTest | undefined {
  if (!m.reading) return undefined;
  let number = 1;
  const sections = m.reading.sections.map((s, i) => {
    const { questions, nextNumber } = toQuestions(examId, "reading", i, s.questions, number);
    number = nextNumber;
    return {
      id: `${examId}-reading-s${i + 1}`,
      name: s.name,
      passageTitle: s.passageTitle,
      passageParagraphs: s.passageParagraphs,
      questions,
    };
  });
  return {
    id: examId,
    skill: "reading",
    variant: "general-training",
    title: `${m.title} — Reading`,
    timeMinutes: m.reading.timeMinutes ?? 60,
    sections,
  };
}

export function toWritingTest(examId: string, m: PastExamManifest): WritingTest | undefined {
  if (!m.writing) return undefined;
  return {
    id: examId,
    skill: "writing",
    variant: "general-training",
    title: `${m.title} — Writing`,
    tasks: m.writing.tasks.map((t) => ({
      taskNumber: t.taskNumber,
      minWords: t.minWords ?? (t.taskNumber === 1 ? 150 : 250),
      instructions: t.instructions,
    })),
  };
}

/** A past speaking exam exposes one runnable SpeakingTest per part. */
export function toSpeakingTests(examId: string, m: PastExamManifest): SpeakingTest[] {
  if (!m.speaking) return [];
  return m.speaking.parts.map((p, i) => ({
    id: `${examId}-speaking-${i + 1}`,
    skill: "speaking",
    title: p.title ?? `${m.title} — Speaking Part ${p.part}`,
    part: p.part,
    topic: p.topic,
  }));
}
