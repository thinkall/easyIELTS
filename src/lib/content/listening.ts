import type { ListeningTest } from "./types";
import { communityHallTest } from "@content/tests/listening/gt-community-hall";
import { moreListeningTests } from "@content/tests/listening/more-listening";

const LISTENING_TESTS: ListeningTest[] = [communityHallTest, ...moreListeningTests];

export function getListeningTests(): ListeningTest[] {
  return LISTENING_TESTS;
}

export function getListeningTest(id: string): ListeningTest | undefined {
  return LISTENING_TESTS.find((test) => test.id === id);
}
