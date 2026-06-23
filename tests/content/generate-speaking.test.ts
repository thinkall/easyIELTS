import { describe, it, expect, vi } from "vitest";
import { generateSpeakingTest } from "@/lib/content/generate-speaking";

describe("generateSpeakingTest", () => {
  it("builds a Part 2 speaking test with a cue card topic", async () => {
    const chat = vi.fn(async () => ({
      title: "Describe a memorable journey",
      cueCardTopic: "Describe a memorable journey you have taken.",
      bullets: ["where you went", "who you went with", "what you did", "why it was memorable"],
    }));
    const test = await generateSpeakingTest("travel", chat);

    expect(test.skill).toBe("speaking");
    expect(test.part).toBe("2");
    expect(test.id).toMatch(/^gen-speaking-/);
    expect(test.title).toContain("memorable journey");
    // The cue card topic + bullets are composed into the examiner topic.
    expect(test.topic).toContain("Describe a memorable journey");
    expect(test.topic).toContain("where you went");

    const userPrompt = (chat.mock.calls[0][0] as { user: string }).user;
    expect(userPrompt).toContain("travel");
  });

  it("throws on malformed output", async () => {
    const chat = vi.fn(async () => ({ bad: 1 }));
    await expect(generateSpeakingTest("x", chat)).rejects.toThrow();
  });
});
