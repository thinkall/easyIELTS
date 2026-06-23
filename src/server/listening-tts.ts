import { parseScriptTurns, uniqueSpeakers, stripLabels } from "@/lib/listening/script";
import { wrapPcmWav } from "@/lib/listening/wav";

export class ListeningTtsError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ListeningTtsError";
    this.status = status;
  }
}

export interface GenerateListeningAudioOptions {
  script: string;
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

// Distinct prebuilt voices to assign to speakers (varied timbre for realism).
const VOICES = ["Kore", "Puck", "Charon", "Aoede", "Fenrir"];
const DEFAULT_MODEL = "gemini-2.5-flash-preview-tts";
const OUTPUT_RATE = 24000;
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 1500;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function buildSpeechConfig(speakers: string[]): Record<string, unknown> {
  // Gemini multi-speaker TTS supports up to two speakers. For one speaker (or a
  // narration fallback for 3+ speakers) use a single voice config.
  if (speakers.length === 2) {
    return {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: speakers.map((speaker, i) => ({
          speaker,
          voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[i % VOICES.length] } },
        })),
      },
    };
  }
  return { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[0] } } };
}

/**
 * Generate a realistic listening recording from a labelled script using Gemini
 * multi-speaker TTS. Two-speaker dialogues get distinct voices (the model does
 * not read the labels aloud); monologues / 3+ speakers are narrated single-voice.
 * Returns a WAV (PCM16 mono, 24kHz).
 */
export async function generateListeningAudio(options: GenerateListeningAudioOptions): Promise<Uint8Array> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const model = options.model || DEFAULT_MODEL;

  const turns = parseScriptTurns(options.script);
  const speakers = uniqueSpeakers(turns);
  const useMultiSpeaker = speakers.length === 2;

  // For multi-speaker, send the labelled script so voices map to speakers; for a
  // single voice, send label-free narration so names aren't read aloud.
  const spokenText = useMultiSpeaker ? options.script : stripLabels(options.script);
  const instruction = useMultiSpeaker
    ? "Read this as a natural IELTS listening recording — a realistic spoken conversation at a measured pace:\n\n"
    : "Read this aloud as a clear, natural IELTS listening recording at a measured pace:\n\n";

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: instruction + spokenText }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: buildSpeechConfig(speakers),
    },
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`;

  let lastStatus = 500;
  let lastDetail = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
    });

    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
      };
      const b64 = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
      if (!b64) throw new ListeningTtsError("TTS returned no audio.", 502);
      const pcm = Uint8Array.from(Buffer.from(b64, "base64"));
      return wrapPcmWav(pcm, OUTPUT_RATE);
    }

    lastStatus = response.status;
    lastDetail = await response.text().catch(() => "");
    if ((response.status === 503 || response.status === 429) && attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS);
      continue;
    }
    throw new ListeningTtsError(
      `Listening TTS failed (${response.status}): ${lastDetail.slice(0, 160)}`,
      response.status,
    );
  }

  throw new ListeningTtsError(`Listening TTS failed (${lastStatus}): ${lastDetail.slice(0, 160)}`, lastStatus);
}
