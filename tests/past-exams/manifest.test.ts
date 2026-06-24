import { describe, it, expect } from "vitest";
import {
  parseManifest,
  manifestSkills,
  toListeningTest,
  toReadingTest,
  toWritingTest,
  toSpeakingTests,
  pastExamAudioUrl,
} from "@/lib/past-exams/manifest";

const sample = {
  title: "Sample Exam — Test 1",
  listening: {
    timeMinutes: 30,
    sections: [
      {
        name: "Section 1",
        audio: "section1.mp3",
        questions: [
          { type: "form_completion", prompt: "Name: ___", accepted: ["Alex"], wordLimit: 2 },
          { type: "single_choice", prompt: "Pick one", accepted: ["B"], options: ["A red", "B blue"] },
        ],
      },
    ],
  },
  reading: {
    sections: [
      {
        name: "Section 1",
        passageTitle: "A passage",
        passageParagraphs: ["one two three", "four five six"],
        questions: [{ type: "true_false_notgiven", prompt: "Claim", accepted: ["true"] }],
      },
    ],
  },
  writing: { tasks: [{ taskNumber: 1, instructions: "Write a letter." }] },
  speaking: { parts: [{ part: "2", topic: "Describe a place." }] },
};

describe("past-exam manifest", () => {
  it("parses a valid manifest and reports its skills", () => {
    const m = parseManifest(sample);
    expect(manifestSkills(m)).toEqual(["listening", "reading", "writing", "speaking"]);
  });

  it("rejects a manifest with no skills", () => {
    expect(() => parseManifest({ title: "Empty" })).toThrow();
  });

  it("converts listening with audio URL and numbered questions", () => {
    const m = parseManifest(sample);
    const test = toListeningTest("cam4-test1", m)!;
    expect(test.skill).toBe("listening");
    expect(test.sections[0].audioUrl).toBe(pastExamAudioUrl("cam4-test1", "section1.mp3"));
    expect(test.sections[0].questions[0].number).toBe(1);
    expect(test.sections[0].questions[1].number).toBe(2);
    // "B blue" option parsed into value/label.
    expect(test.sections[0].questions[1].options).toEqual([
      { value: "A", label: "red" },
      { value: "B", label: "blue" },
    ]);
  });

  it("converts reading, writing and speaking", () => {
    const m = parseManifest(sample);
    expect(toReadingTest("e", m)!.sections[0].passageTitle).toBe("A passage");
    expect(toWritingTest("e", m)!.tasks[0].minWords).toBe(150); // default for task 1
    const speaking = toSpeakingTests("e", m);
    expect(speaking).toHaveLength(1);
    expect(speaking[0].part).toBe("2");
    expect(speaking[0].topic).toBe("Describe a place.");
  });

  it("returns undefined for skills the manifest omits", () => {
    const m = parseManifest({ title: "L only", listening: sample.listening });
    expect(toReadingTest("e", m)).toBeUndefined();
    expect(toWritingTest("e", m)).toBeUndefined();
    expect(toSpeakingTests("e", m)).toEqual([]);
  });
});
