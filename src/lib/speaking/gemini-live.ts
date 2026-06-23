import type { SpeakingEvent } from "./types";

/** First message on the Gemini Live socket: configure model, audio output, transcription. */
export function buildSetupMessage(model: string, systemInstruction: string): unknown {
  return {
    setup: {
      model: `models/${model}`,
      generationConfig: { responseModalities: ["AUDIO"] },
      systemInstruction: { parts: [{ text: systemInstruction }] },
      outputAudioTranscription: {},
      inputAudioTranscription: {},
    },
  };
}

/** Wrap a base64 PCM (16kHz) chunk of microphone audio for streaming input. */
export function encodeAudioChunk(base64Pcm16k: string): unknown {
  return { realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: base64Pcm16k } } };
}

/** Send a completed text turn (used to kick off the examiner). */
export function encodeTextTurn(text: string): unknown {
  return { clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } };
}

interface ServerMessage {
  setupComplete?: unknown;
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data?: string }; text?: string }[] };
    outputTranscription?: { text?: string };
    inputTranscription?: { text?: string };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
}

/** Translate a raw Gemini Live server message into zero or more SpeakingEvents. */
export function parseServerMessage(message: ServerMessage): SpeakingEvent[] {
  const events: SpeakingEvent[] = [];
  if (message.setupComplete !== undefined) events.push({ type: "ready" });

  const content = message.serverContent;
  if (content) {
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) events.push({ type: "audio", data: part.inlineData.data });
    }
    if (content.inputTranscription?.text) {
      events.push({ type: "input_transcript", text: content.inputTranscription.text });
    }
    if (content.outputTranscription?.text) {
      events.push({ type: "output_transcript", text: content.outputTranscription.text });
    }
    if (content.interrupted) events.push({ type: "interrupted" });
    if (content.turnComplete) events.push({ type: "turn_complete" });
  }
  return events;
}
