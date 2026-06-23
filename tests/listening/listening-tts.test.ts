import { describe, it, expect, vi } from "vitest";
import { generateListeningAudio } from "@/server/listening-tts";

// Two PCM samples, base64 of bytes [1,0,2,0].
const pcmB64 = Buffer.from(new Uint8Array([1, 0, 2, 0])).toString("base64");

function ttsResponse(b64: string, status = 200) {
  const body = {
    candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: b64 } }] } }],
  };
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

const dialogue =
  "Receptionist: Good morning, how can I help? Caller: I'd like to book a room.";

describe("generateListeningAudio", () => {
  it("returns a WAV (RIFF header) wrapping the returned PCM", async () => {
    const fetchImpl = vi.fn(async () => ttsResponse(pcmB64)) as unknown as typeof fetch;
    const wav = await generateListeningAudio({ script: dialogue, apiKey: "K", fetchImpl });
    expect(String.fromCharCode(wav[0], wav[1], wav[2], wav[3])).toBe("RIFF");
    expect(wav.length).toBe(44 + 4);
  });

  it("uses a multi-speaker voice config for a two-speaker dialogue", async () => {
    const fetchImpl = vi.fn(async () => ttsResponse(pcmB64)) as unknown as typeof fetch;
    await generateListeningAudio({ script: dialogue, apiKey: "K", fetchImpl });
    const body = JSON.parse((vi.mocked(fetchImpl).mock.calls[0][1] as RequestInit).body as string);
    const cfgs = body.generationConfig.speechConfig.multiSpeakerVoiceConfig.speakerVoiceConfigs;
    expect(cfgs).toHaveLength(2);
    expect(cfgs.map((c: { speaker: string }) => c.speaker)).toEqual(["Receptionist", "Caller"]);
    expect(cfgs[0].voiceConfig.prebuiltVoiceConfig.voiceName).not.toBe(cfgs[1].voiceConfig.prebuiltVoiceConfig.voiceName);
    // The script (with labels) is sent so the model maps voices to speakers.
    expect(body.contents[0].parts[0].text).toContain("Receptionist:");
  });

  it("uses a single-speaker voice config (no labels) for a monologue", async () => {
    const fetchImpl = vi.fn(async () => ttsResponse(pcmB64)) as unknown as typeof fetch;
    await generateListeningAudio({ script: "The museum opens at nine.", apiKey: "K", fetchImpl });
    const body = JSON.parse((vi.mocked(fetchImpl).mock.calls[0][1] as RequestInit).body as string);
    expect(body.generationConfig.speechConfig.voiceConfig).toBeTruthy();
    expect(body.generationConfig.speechConfig.multiSpeakerVoiceConfig).toBeUndefined();
  });

  it("retries on 503 then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ttsResponse(pcmB64, 503))
      .mockResolvedValueOnce(ttsResponse(pcmB64)) as unknown as typeof fetch;
    const wav = await generateListeningAudio({ script: dialogue, apiKey: "K", fetchImpl, sleep: async () => {} });
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(2);
    expect(wav.length).toBeGreaterThan(44);
  });

  it("throws ListeningTtsError with the status on a hard failure", async () => {
    const fetchImpl = vi.fn(async () => ttsResponse("", 400)) as unknown as typeof fetch;
    await expect(generateListeningAudio({ script: dialogue, apiKey: "K", fetchImpl })).rejects.toMatchObject({
      name: "ListeningTtsError",
      status: 400,
    });
  });
});
