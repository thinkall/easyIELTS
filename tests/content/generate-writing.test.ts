import { describe, it, expect, vi } from "vitest";
import { generateWritingTest } from "@/lib/content/generate-writing";

describe("generateWritingTest", () => {
  it("builds a GT writing test with a Task 1 letter and Task 2 essay", async () => {
    const chat = vi.fn(async () => ({
      title: "Complaint letter & education essay",
      task1Instructions: "Write a letter to your manager. Begin 'Dear Sir or Madam,'.",
      task2Instructions: "Some people think... Discuss both views and give your opinion.",
    }));
    const test = await generateWritingTest("work", chat);

    expect(test.skill).toBe("writing");
    expect(test.variant).toBe("general-training");
    expect(test.id).toMatch(/^gen-writing-/);
    expect(test.tasks).toHaveLength(2);
    expect(test.tasks[0]).toMatchObject({ taskNumber: 1, minWords: 150 });
    expect(test.tasks[0].instructions).toContain("Dear Sir or Madam");
    expect(test.tasks[1]).toMatchObject({ taskNumber: 2, minWords: 250 });

    // The topic is passed to the model.
    const userPrompt = (chat.mock.calls[0][0] as { user: string }).user;
    expect(userPrompt).toContain("work");
  });

  it("throws on malformed model output", async () => {
    const chat = vi.fn(async () => ({ nope: true }));
    await expect(generateWritingTest("x", chat)).rejects.toThrow();
  });
});
