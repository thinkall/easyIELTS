import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { POST } from "@/app/api/speaking/evaluate/route";
import { _resetRateLimitStore } from "@/server/rate-limit";

const geminiPayload = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              criteria: { fluencyCoherence: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7, pronunciation: 7 },
              feedback: { strengths: [], improvements: [], examples: [] },
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

function req(body: unknown, cookie?: string) {
  return new Request("http://x/api/speaking/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

const transcript = [
  { role: "examiner", text: "Do you work?" },
  { role: "candidate", text: "Yes, I am an engineer." },
];

beforeEach(() => _resetRateLimitStore());
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("POST /api/speaking/evaluate (Gemini audio path)", () => {
  it("evaluates audio via Gemini using the owner key when configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "owner-key");
    const fetchMock = vi.fn(async () => res(geminiPayload));
    vi.stubGlobal("fetch", fetchMock);

    const r = await POST(req({ transcript, audio: "QUJD" }));
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json.speakingBand).toBeCloseTo(7, 5);
    expect(json.pronunciationIsApproximate).toBe(false);

    const url = String(vi.mocked(fetchMock).mock.calls[0][0]);
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("key=owner-key");
  });

  it("uses the user's own Gemini key from the body when provided", async () => {
    const fetchMock = vi.fn(async () => res(geminiPayload));
    vi.stubGlobal("fetch", fetchMock);

    const r = await POST(req({ transcript, audio: "QUJD", geminiApiKey: "user-key" }));
    expect(r.status).toBe(200);
    expect(String(vi.mocked(fetchMock).mock.calls[0][0])).toContain("key=user-key");
  });

  it("propagates a Gemini error status", async () => {
    vi.stubEnv("GEMINI_API_KEY", "owner-key");
    vi.stubGlobal("fetch", vi.fn(async () => res({ error: "bad" }, 400)));
    const r = await POST(req({ transcript, audio: "QUJD" }));
    expect(r.status).toBe(400);
  });

  it("falls back to GitHub Models (transcript only) when no Gemini key is available", async () => {
    // Ensure no ambient owner key so the legacy GitHub Models path runs deterministically.
    vi.stubEnv("GEMINI_API_KEY", "");
    const ghContent = JSON.stringify({
      criteria: { fluencyCoherence: 6, lexicalResource: 6, grammaticalRangeAccuracy: 6, pronunciation: 6 },
      feedback: { strengths: [], improvements: [], examples: [] },
    });
    const fetchMock = vi.fn(async () => res({ choices: [{ message: { content: ghContent } }] }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await POST(req({ transcript, token: "ghp_x" }));
    expect(r.status).toBe(200);
    expect(String(vi.mocked(fetchMock).mock.calls[0][0])).toContain("models.github.ai");
  });
});
