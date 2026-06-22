import { writingTest001, type WritingTest } from "@content/tests/writing/gt-writing-001";

const WRITING_TESTS: WritingTest[] = [writingTest001];

export function getWritingTests(): WritingTest[] {
  return WRITING_TESTS;
}

export function getWritingTest(id: string): WritingTest | undefined {
  return WRITING_TESTS.find((test) => test.id === id);
}

export type { WritingTest, WritingTaskPrompt } from "@content/tests/writing/gt-writing-001";
