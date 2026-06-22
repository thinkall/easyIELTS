export interface SpeakingTest {
  id: string;
  skill: "speaking";
  title: string;
  part: "1" | "2" | "3";
}

const SPEAKING_TESTS: SpeakingTest[] = [
  { id: "gt-speaking-part1", skill: "speaking", title: "Speaking Part 1 — Interview", part: "1" },
  { id: "gt-speaking-part2", skill: "speaking", title: "Speaking Part 2 — Long turn", part: "2" },
  { id: "gt-speaking-part3", skill: "speaking", title: "Speaking Part 3 — Discussion", part: "3" },
];

export function getSpeakingTests(): SpeakingTest[] {
  return SPEAKING_TESTS;
}
export function getSpeakingTest(id: string): SpeakingTest | undefined {
  return SPEAKING_TESTS.find((t) => t.id === id);
}