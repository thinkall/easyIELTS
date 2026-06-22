import { describe, it, expect, vi } from "vitest";
import { scoreSpeakingTranscript, type SpeakingChatFn } from "@/lib/speaking/score-speaking";
import type { TranscriptTurn } from "@/lib/speaking/types";

const transcript: TranscriptTurn[] = [
  { role: "examiner", text: "Where are you from?" },
  { role: "candidate", text: "I am from a small town near the coast, which I really enjoy." },
];

const llm = {
  criteria: { fluencyCoherence: 7, lexicalResource: 6.4, grammaticalRangeAccuracy: 7, pronunciation: 6 },
  feedback: { strengths: ["clear"], improvements: ["range"], examples: [] },
};

describe("scoreSpeakingTranscript", () => {
  it("rounds criteria, averages the band, and flags approximate pronunciation", async () => {
    const chat: SpeakingChatFn = vi.fn(async () => llm);
    const result = await scoreSpeakingTranscript(transcript, chat);
    expect(chat).toHaveBeenCalledOnce();
    expect(result.criteria.lexicalResource).toBe(6.5);
    // average(7,6.5,7,6) = 6.625 -> 6.5
    expect(result.speakingBand).toBe(6.5);
    expect(result.pronunciationIsApproximate).toBe(true);
  });
  it("throws on malformed LLM output", async () => {
    const chat: SpeakingChatFn = vi.fn(async () => ({ nope: true }));
    await expect(scoreSpeakingTranscript(transcript, chat)).rejects.toThrow();
  });
});
