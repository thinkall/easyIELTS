import { describe, it, expect } from "vitest";
import { buildSetupMessage, encodeAudioChunk, encodeTextTurn, parseServerMessage } from "@/lib/speaking/gemini-live";

interface SetupMessage {
  setup: {
    model: string;
    generationConfig: { responseModalities: string[] };
    systemInstruction: { parts: { text: string }[] };
    outputAudioTranscription: unknown;
    inputAudioTranscription: unknown;
  };
}

interface AudioChunkMessage {
  realtimeInput: { mediaChunks: { mimeType: string; data: string }[] };
}

interface TextTurnMessage {
  clientContent: { turnComplete: boolean; turns: { parts: { text: string }[] }[] };
}

describe("buildSetupMessage", () => {
  it("requests AUDIO output with transcription and a system instruction", () => {
    const msg = buildSetupMessage("gemini-3.1-flash-live-preview", "You are an examiner.") as SetupMessage;
    expect(msg.setup.model).toBe("models/gemini-3.1-flash-live-preview");
    expect(msg.setup.generationConfig.responseModalities).toEqual(["AUDIO"]);
    expect(msg.setup.systemInstruction.parts[0].text).toContain("examiner");
    expect(msg.setup.outputAudioTranscription).toBeDefined();
    expect(msg.setup.inputAudioTranscription).toBeDefined();
  });
});

describe("encodeAudioChunk / encodeTextTurn", () => {
  it("wraps base64 audio as a realtimeInput media chunk at 16kHz", () => {
    const msg = encodeAudioChunk("YWJj") as AudioChunkMessage;
    expect(msg.realtimeInput.mediaChunks[0]).toEqual({ mimeType: "audio/pcm;rate=16000", data: "YWJj" });
  });
  it("wraps text as a completed client turn", () => {
    const msg = encodeTextTurn("hello") as TextTurnMessage;
    expect(msg.clientContent.turnComplete).toBe(true);
    expect(msg.clientContent.turns[0].parts[0].text).toBe("hello");
  });
});

describe("parseServerMessage", () => {
  it("maps setupComplete to a ready event", () => {
    expect(parseServerMessage({ setupComplete: {} })).toEqual([{ type: "ready" }]);
  });
  it("extracts audio, output transcript, and turn completion", () => {
    const events = parseServerMessage({
      serverContent: {
        modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm", data: "QUJD" } }] },
        outputTranscription: { text: "Good morning." },
        turnComplete: true,
      },
    });
    expect(events).toContainEqual({ type: "audio", data: "QUJD" });
    expect(events).toContainEqual({ type: "output_transcript", text: "Good morning." });
    expect(events).toContainEqual({ type: "turn_complete" });
  });
  it("extracts input transcription and interruption", () => {
    expect(parseServerMessage({ serverContent: { inputTranscription: { text: "I think" } } }))
      .toContainEqual({ type: "input_transcript", text: "I think" });
    expect(parseServerMessage({ serverContent: { interrupted: true } }))
      .toContainEqual({ type: "interrupted" });
  });
  it("returns an empty array for unrecognised messages", () => {
    expect(parseServerMessage({ foo: 1 })).toEqual([]);
  });
});
