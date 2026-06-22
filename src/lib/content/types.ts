import type { Question } from "@/lib/scoring/types";

export interface QuestionOption {
  value: string;
  label: string;
}

/** A reading question: the scoring `Question` fields plus UI presentation fields. */
export interface ReadingQuestion extends Question {
  /** 1-based number shown to the user. */
  number: number;
  /** The question stem/prompt. */
  prompt: string;
  /** Options for choice questions. TFNG/YNNG use fixed options supplied by the renderer. */
  options?: QuestionOption[];
}

export interface ReadingSection {
  id: string;
  name: string;
  passageTitle: string;
  /** Passage body as paragraphs (each rendered as a <p>). */
  passageParagraphs: string[];
  questions: ReadingQuestion[];
}

export interface ReadingTest {
  id: string;
  skill: "reading";
  variant: "general-training";
  title: string;
  /** Recommended time in minutes (drives the countdown timer). */
  timeMinutes: number;
  sections: ReadingSection[];
}
