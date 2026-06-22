export type SpeakingPart = "1" | "2" | "3";

export type SpeakingEvent =
  | { type: "ready" }
  | { type: "audio"; data: string }
  | { type: "input_transcript"; text: string }
  | { type: "output_transcript"; text: string }
  | { type: "turn_complete" }
  | { type: "interrupted" }
  | { type: "error"; error: string }
  | { type: "session_end"; reason: string };

export interface SpeakingCriteria {
  fluencyCoherence: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
  pronunciation: number;
}

export interface SpeakingEvaluation {
  criteria: SpeakingCriteria;
  speakingBand: number;
  pronunciationIsApproximate: boolean;
  feedback: { strengths: string[]; improvements: string[]; examples: string[] };
}

export interface TranscriptTurn {
  role: "examiner" | "candidate";
  text: string;
}
