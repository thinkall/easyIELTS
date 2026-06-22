export interface WritingTaskPrompt {
  taskNumber: 1 | 2;
  instructions: string;
  minWords: number;
}

export interface WritingTest {
  id: string;
  skill: "writing";
  variant: "general-training";
  title: string;
  tasks: WritingTaskPrompt[];
}

export const writingTest001: WritingTest = {
  id: "gt-writing-001",
  skill: "writing",
  variant: "general-training",
  title: "GT Writing Practice — Set 1",
  tasks: [
    {
      taskNumber: 1,
      minWords: 150,
      instructions:
        "You recently stayed at a hotel for a short holiday and were not satisfied with your stay. " +
        "Write a letter to the hotel manager. In your letter:\n" +
        "- explain why you were staying at the hotel\n" +
        "- describe the problems you experienced\n" +
        "- say what you would like the manager to do about it.\n\n" +
        "Begin your letter 'Dear Sir or Madam,'. Write at least 150 words.",
    },
    {
      taskNumber: 2,
      minWords: 250,
      instructions:
        "Some people believe that children should be taught how to manage money from a young age. " +
        "Others think that handling money is a responsibility for adults only.\n\n" +
        "Discuss both these views and give your own opinion. " +
        "Give reasons for your answer and include relevant examples from your own knowledge or experience. " +
        "Write at least 250 words.",
    },
  ],
};
