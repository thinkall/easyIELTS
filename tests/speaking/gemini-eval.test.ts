import { describe, it, expect, vi } from "vitest";
import { evaluateSpeaking } from "@/server/gemini-eval";
import type { TranscriptTurn } from "@/lib/speaking/types";

const transcript: TranscriptTurn[] = [
  { role: "examiner", text: "Do you work or study?" },
  { role: "candidate", text: "I work as a software engineer." },
];

const goodPayload = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              criteria: { fluencyCoherence: 7, lexicalResource: 7, grammaticalRangeAccuracy: 6.5, pronunciation: 7 },
              feedback: { strengths: ["clear"], improvements: ["expand"], examples: ["e.g."] },
            }),
          },
        ],
      },
    },
  ],
};

function res(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

describe("evaluateSpeaking", () => {
  it("sends the audio as inlineData and a structured schema, returning a rounded evaluation", async () => {
    const fetchImpl = vi.fn(async () => res(goodPayload)) as unknown as typeof fetch;
    const result = await evaluateSpeaking({
      transcript,
      audioBase64: "QUJD",
      apiKey: "K",
      fetchImpl,
    });

    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(String(url)).toContain("generativelanguage.googleapis.com");
    expect(String(url)).toContain("key=K");
    const body = JSON.parse((init as RequestInit).body as string);
    const parts = body.contents[0].parts;
    expect(parts.some((p: { inlineData?: { data: string } }) => p.inlineData?.data === "QUJD")).toBe(true);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema).toBeTruthy();

    expect(result.criteria).toEqual({ fluencyCoherence: 7, lexicalResource: 7, grammaticalRangeAccuracy: 6.5, pronunciation: 7 });
    expect(result.speakingBand).toBeCloseTo(7, 5);
    expect(result.pronunciationIsApproximate).toBe(false);
  });

  it("marks pronunciation approximate when no audio is provided", async () => {
    const fetchImpl = vi.fn(async () => res(goodPayload)) as unknown as typeof fetch;
    const result = await evaluateSpeaking({ transcript, apiKey: "K", fetchImpl });
    expect(result.pronunciationIsApproximate).toBe(true);
    const body = JSON.parse((vi.mocked(fetchImpl).mock.calls[0][1] as RequestInit).body as string);
    expect(body.contents[0].parts.some((p: { inlineData?: unknown }) => p.inlineData)).toBe(false);
  });

  it("retries on 503 then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res({ error: "busy" }, 503))
      .mockResolvedValueOnce(res(goodPayload)) as unknown as typeof fetch;
    const sleep = vi.fn(async () => {});
    const result = await evaluateSpeaking({ transcript, apiKey: "K", fetchImpl, sleep });
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(result.speakingBand).toBeCloseTo(7, 5);
  });

  it("falls back to a different model when the first is overloaded (503)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res({ error: "busy" }, 503))
      .mockResolvedValueOnce(res(goodPayload)) as unknown as typeof fetch;
    await evaluateSpeaking({
      transcript,
      apiKey: "K",
      models: ["model-a", "model-b"],
      fetchImpl,
      sleep: async () => {},
    });
    const firstUrl = String(vi.mocked(fetchImpl).mock.calls[0][0]);
    const secondUrl = String(vi.mocked(fetchImpl).mock.calls[1][0]);
    expect(firstUrl).toContain("model-a");
    expect(secondUrl).toContain("model-b");
  });

  it("retries on 429 (rate limit) as well", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res({ error: "rate" }, 429))
      .mockResolvedValueOnce(res(goodPayload)) as unknown as typeof fetch;
    const result = await evaluateSpeaking({ transcript, apiKey: "K", fetchImpl, sleep: async () => {} });
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(2);
    expect(result.speakingBand).toBeCloseTo(7, 5);
  });

  it("throws GeminiEvalError with the status on a non-retryable error", async () => {
    const fetchImpl = vi.fn(async () => res({ error: "bad key" }, 400)) as unknown as typeof fetch;
    await expect(evaluateSpeaking({ transcript, apiKey: "K", fetchImpl })).rejects.toMatchObject({
      name: "GeminiEvalError",
      status: 400,
    });
  });

  it("throws after exhausting retries on persistent 503", async () => {
    const fetchImpl = vi.fn(async () => res({ error: "busy" }, 503)) as unknown as typeof fetch;
    const sleep = vi.fn(async () => {});
    await expect(evaluateSpeaking({ transcript, apiKey: "K", fetchImpl, sleep })).rejects.toMatchObject({ status: 503 });
  });
});
