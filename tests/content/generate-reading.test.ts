import { describe, it, expect, vi } from "vitest";
import { generateReadingTest, type GenerateChatFn } from "@/lib/content/generate-reading";

const llm = {
  title: "Community Gardens",
  passageTitle: "The Rise of Community Gardens",
  passageParagraphs: ["Community gardens are shared plots...", "They began in the 1970s...", "Today they are popular..."],
  questions: [
    { type: "true_false_notgiven", prompt: "Community gardens are private.", accepted: ["false"] },
    { type: "sentence_completion", prompt: "Gardens began in the ____.", accepted: ["1970s"], wordLimit: 1 },
    { type: "single_choice", prompt: "Gardens are:", options: ["A private", "B shared", "C closed"], accepted: ["B"] },
    { type: "true_false_notgiven", prompt: "Gardens are popular today.", accepted: ["true"] },
    { type: "short_answer", prompt: "What kind of plots are they?", accepted: ["shared"], wordLimit: 1 },
  ],
};

describe("generateReadingTest", () => {
  it("validates and shapes the LLM output into a ReadingTest", async () => {
    const chat: GenerateChatFn = vi.fn(async () => llm);
    const test = await generateReadingTest("community gardens", chat);
    expect(chat).toHaveBeenCalledOnce();
    expect(test.skill).toBe("reading");
    expect(test.variant).toBe("general-training");
    expect(test.sections).toHaveLength(1);
    const qs = test.sections[0].questions;
    expect(qs).toHaveLength(5);
    // ids + numbers assigned
    expect(qs[0].id).toBeTruthy();
    expect(qs[0].number).toBe(1);
    expect(qs[2].number).toBe(3);
    // single_choice options parsed to {value,label}
    expect(qs[2].options?.[0]).toEqual({ value: "A", label: "private" });
    expect(qs[2].accepted).toEqual(["B"]);
  });

  it("throws on malformed LLM output", async () => {
    const chat: GenerateChatFn = vi.fn(async () => ({ nope: 1 }));
    await expect(generateReadingTest("x", chat)).rejects.toThrow();
  });
});
