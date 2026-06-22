import type { ReadingTest } from "./types";
import { toolLibrariesTest } from "@content/tests/reading/gt-tool-libraries";

const READING_TESTS: ReadingTest[] = [toolLibrariesTest];

export function getReadingTests(): ReadingTest[] {
  return READING_TESTS;
}

export function getReadingTest(id: string): ReadingTest | undefined {
  return READING_TESTS.find((test) => test.id === id);
}
