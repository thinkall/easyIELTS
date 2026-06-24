import type { ReadingTest } from "./types";
import { toolLibrariesTest } from "@content/tests/reading/gt-tool-libraries";
import { moreReadingTests } from "@content/tests/reading/more-reading";

const READING_TESTS: ReadingTest[] = [toolLibrariesTest, ...moreReadingTests];

export function getReadingTests(): ReadingTest[] {
  return READING_TESTS;
}

export function getReadingTest(id: string): ReadingTest | undefined {
  return READING_TESTS.find((test) => test.id === id);
}
