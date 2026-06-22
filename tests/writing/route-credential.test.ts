import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { POST } from "@/app/api/writing/evaluate/route";
import { _resetRateLimitStore } from "@/server/rate-limit";

beforeEach(() => _resetRateLimitStore());
afterEach(() => vi.unstubAllGlobals());

const llmContent = JSON.stringify({
  criteria: { taskResponse: 7, coherenceCohesion: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7 },
  feedback: { strengths: [], improvements: [], correctedExamples: [] },
  modelAnswer: "m",
});

function mockModelOk() {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true, status: 200, json: async () => ({ choices: [{ message: { content: llmContent } }] }), text: async () => llmContent,
  })));
}

function req(cookie?: string) {
  return new Request("http://x/api/writing/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ taskNumber: 2, prompt: "p", response: "a b c" }),
  });
}

describe("writing route credential resolution", () => {
  it("uses the device-flow cookie token and is NOT rate-limited", async () => {
    mockModelOk();
    // 12 calls with a cookie credential; none should hit the 10/hr shared limit.
    for (let i = 0; i < 12; i++) {
      const res = await POST(req("eielts_gh=gho_user"));
      expect(res.status).toBe(200);
    }
  });
});
