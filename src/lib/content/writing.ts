import { writingTest001, type WritingTest } from "@content/tests/writing/gt-writing-001";
import { moreWritingTests } from "@content/tests/writing/more-writing";

const WRITING_TESTS: WritingTest[] = [writingTest001, ...moreWritingTests];

export function getWritingTests(): WritingTest[] {
  return WRITING_TESTS;
}

export function getWritingTest(id: string): WritingTest | undefined {
  return WRITING_TESTS.find((test) => test.id === id);
}

export type { WritingTest, WritingTaskPrompt } from "@content/tests/writing/gt-writing-001";
