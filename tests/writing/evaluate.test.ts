import { describe, it, expect, vi } from "vitest";
import { evaluateWritingTask, type ChatFn } from "@/lib/writing/evaluate";

const llmResponse = {
  criteria: { taskResponse: 7, coherenceCohesion: 7, lexicalResource: 6.4, grammaticalRangeAccuracy: 6 },
  feedback: { strengths: ["clear position"], improvements: ["more range"], correctedExamples: [] },
  modelAnswer: "A model answer.",
};

describe("evaluateWritingTask", () => {
  it("validates the LLM output, rounds criteria, and computes the task band", async () => {
    const chat: ChatFn = vi.fn(async () => llmResponse);
    const result = await evaluateWritingTask(
      { taskNumber: 2, prompt: "Discuss...", response: "one two three four five" },
      chat,
    );
    expect(chat).toHaveBeenCalledOnce();
    expect(result.wordCount).toBe(5);
    expect(result.criteria.lexicalResource).toBe(6.5); // 6.4 rounded to nearest half band
    // average(7,7,6.5,6) = 6.625 -> 6.5
    expect(result.taskBand).toBe(6.5);
    expect(result.modelAnswer).toBe("A model answer.");
  });

  it("throws if the LLM output does not match the schema", async () => {
    const chat: ChatFn = vi.fn(async () => ({ nonsense: true }));
    await expect(
      evaluateWritingTask({ taskNumber: 1, prompt: "p", response: "r" }, chat),
    ).rejects.toThrow();
  });
});
