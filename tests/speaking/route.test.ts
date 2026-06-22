import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { POST } from "@/app/api/speaking/evaluate/route";
import { _resetRateLimitStore } from "@/server/rate-limit";

beforeEach(() => _resetRateLimitStore());
afterEach(() => vi.unstubAllGlobals());

const llmContent = JSON.stringify({
  criteria: { fluencyCoherence: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7, pronunciation: 6.5 },
  feedback: { strengths: [], improvements: [], examples: [] },
});

function req(body: unknown, cookie?: string) {
  return new Request("http://x/api/speaking/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describe("POST /api/speaking/evaluate", () => {
  it("returns 400 for an invalid body", async () => {
    expect((await POST(req({ transcript: [] }))).status).toBe(400);
  });
  it("scores a transcript when the model responds (cookie credential)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: llmContent } }] }), text: async () => llmContent })));
    const res = await POST(req({ transcript: [{ role: "candidate", text: "Hello there, I enjoy reading." }] }, "eielts_gh=gho_u"));
    expect(res.status).toBe(200);
    expect((await res.json()).speakingBand).toBe(7); // avg(7,7,7,6.5)=6.875 -> 7
  });
});
