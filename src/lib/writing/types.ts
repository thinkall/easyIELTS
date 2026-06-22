export interface CriterionBands {
  taskResponse: number; // labelled "Task Achievement" for Task 1 in the UI
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
}

export interface CorrectedExample {
  original: string;
  corrected: string;
  note: string;
}

export interface TaskEvaluation {
  taskNumber: 1 | 2;
  criteria: CriterionBands;
  taskBand: number;
  wordCount: number;
  feedback: {
    strengths: string[];
    improvements: string[];
    correctedExamples: CorrectedExample[];
  };
  modelAnswer: string;
}

export interface WritingTaskInput {
  taskNumber: 1 | 2;
  prompt: string;
  response: string;
}
