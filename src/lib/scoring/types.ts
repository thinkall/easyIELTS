export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false_notgiven"
  | "yes_no_notgiven"
  | "matching_headings"
  | "matching_info"
  | "matching_features"
  | "matching_sentence_endings"
  | "sentence_completion"
  | "summary_completion"
  | "note_completion"
  | "table_completion"
  | "flowchart_completion"
  | "form_completion"
  | "diagram_label"
  | "map_label"
  | "short_answer";

export interface Question {
  id: string;
  type: QuestionType;
  /** Accepted correct answers — any match (after normalization) counts as correct. */
  accepted: string[];
  /** Optional max words allowed (completion/short-answer). Over-limit = incorrect. */
  wordLimit?: number;
  /** Marks for this item. Defaults to 1. */
  points?: number;
}

export interface QuestionResult {
  id: string;
  correct: boolean;
  given: string;
  accepted: string[];
  points: number;
  earned: number;
}

export interface ObjectiveScore {
  /** Total marks earned. */
  raw: number;
  /** Total marks possible. */
  total: number;
  results: QuestionResult[];
}
