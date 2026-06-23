import { describe, it, expect } from "vitest";
import { parseScriptTurns, uniqueSpeakers, stripLabels } from "@/lib/listening/script";

const script =
  "Receptionist: Good morning, how can I help? " +
  "Caller: I'd like to book a room. " +
  "Receptionist: Of course. What date?";

describe("parseScriptTurns", () => {
  it("splits a labelled script into speaker turns without the labels", () => {
    const turns = parseScriptTurns(script);
    expect(turns).toEqual([
      { speaker: "Receptionist", text: "Good morning, how can I help?" },
      { speaker: "Caller", text: "I'd like to book a room." },
      { speaker: "Receptionist", text: "Of course. What date?" },
    ]);
  });

  it("returns a single narrator turn when there are no labels", () => {
    const turns = parseScriptTurns("The museum opens at nine and closes at five.");
    expect(turns).toEqual([{ speaker: "Narrator", text: "The museum opens at nine and closes at five." }]);
  });

  it("does not treat common in-sentence labels (e.g. 'Remember:') as a new speaker", () => {
    const turns = parseScriptTurns("Tutor: Okay. Remember: bring your passport. Student: Got it.");
    expect(turns).toEqual([
      { speaker: "Tutor", text: "Okay. Remember: bring your passport." },
      { speaker: "Student", text: "Got it." },
    ]);
  });

  it("captures leading narration before the first speaker label", () => {
    const turns = parseScriptTurns("You will hear a conversation. Clerk: Good afternoon.");
    expect(turns).toEqual([
      { speaker: "Narrator", text: "You will hear a conversation." },
      { speaker: "Clerk", text: "Good afternoon." },
    ]);
  });
});

describe("uniqueSpeakers", () => {
  it("lists distinct speakers in order of first appearance", () => {
    expect(uniqueSpeakers(parseScriptTurns(script))).toEqual(["Receptionist", "Caller"]);
  });
});

describe("stripLabels", () => {
  it("removes the speaker labels for narration/fallback TTS", () => {
    expect(stripLabels(script)).toBe(
      "Good morning, how can I help? I'd like to book a room. Of course. What date?",
    );
  });

  it("keeps a non-speaker label word in the narration text", () => {
    expect(stripLabels("Tutor: Okay. Remember: bring your passport.")).toBe(
      "Okay. Remember: bring your passport.",
    );
  });
});
