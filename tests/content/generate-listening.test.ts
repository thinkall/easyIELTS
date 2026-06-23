import { describe, it, expect, vi } from "vitest";
import { generateListeningTest } from "@/lib/content/generate-listening";

const valid = {
  title: "Booking a tennis court",
  sectionName: "Part 1",
  script:
    "Receptionist: Good morning, Sports Centre. Caller: Hi, I'd like to book a tennis court. " +
    "Receptionist: Certainly, what day? Caller: Tuesday evening, around seven.",
  questions: Array.from({ length: 6 }, (_, i) => ({
    type: "sentence_completion",
    prompt: `Question ${i + 1}: ______`,
    accepted: ["tuesday"],
    wordLimit: 1,
  })),
};

describe("generateListeningTest", () => {
  it("builds a listening test with a labelled script and questions", async () => {
    const chat = vi.fn(async () => valid);
    const test = await generateListeningTest("sports", chat);

    expect(test.skill).toBe("listening");
    expect(test.id).toMatch(/^gen-listening-/);
    expect(test.sections).toHaveLength(1);
    expect(test.sections[0].script).toContain("Receptionist:");
    expect(test.sections[0].questions).toHaveLength(6);
    expect(test.sections[0].questions[0].number).toBe(1);
    // No committed audio — the player generates it on demand.
    expect(test.sections[0].audioUrl).toBeUndefined();

    const userPrompt = (chat.mock.calls[0][0] as { user: string }).user;
    expect(userPrompt).toContain("sports");
  });

  it("collapses empty options to undefined", async () => {
    const chat = vi.fn(async () => ({
      ...valid,
      questions: [
        { type: "true_false_notgiven", prompt: "q1", accepted: ["true"], options: [] },
        ...valid.questions.slice(1),
      ],
    }));
    const test = await generateListeningTest("x", chat);
    expect(test.sections[0].questions[0].options).toBeUndefined();
  });

  it("throws on malformed output", async () => {
    const chat = vi.fn(async () => ({ bad: 1 }));
    await expect(generateListeningTest("x", chat)).rejects.toThrow();
  });
});
